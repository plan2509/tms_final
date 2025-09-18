import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    // Optional protection for external schedulers (AWS/EventBridge, etc.)
    const cronSecret = process.env.CRON_SECRET
    // Allow Vercel Cron (adds x-vercel-cron: 1) even when CRON_SECRET is set
    const isVercelCron = req.headers.get("x-vercel-cron") === "1"
    if (cronSecret && !isVercelCron) {
      const url = new URL(req.url)
      const provided = req.headers.get("x-cron-key") || url.searchParams.get("key")
      if (provided !== cronSecret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }
    }

    const supabase = createAdminClient()
    
    // Get notification type from request body or query params
    const body = await req.json().catch(() => ({}))
    const notificationType = body.notification_type || req.nextUrl.searchParams.get("type")

    // Load active schedules based on notification type
    let taxSchedules = []
    let stationSchedules = []
    
    if (notificationType === "tax") {
      const { data: taxSched, error: taxSchedErr } = await supabase
        .from("notification_schedules")
        .select("id, name, days_before, is_active, teams_channel_id")
        .eq("notification_type", "tax")
        .eq("is_active", true)
      if (taxSchedErr) throw taxSchedErr
      taxSchedules = taxSched || []
    } else if (notificationType === "station_schedule") {
      const { data: stationSched, error: stationSchedErr } = await supabase
        .from("notification_schedules")
        .select("id, name, days_before, is_active, teams_channel_id")
        .eq("notification_type", "station_schedule")
        .eq("is_active", true)
      if (stationSchedErr) throw stationSchedErr
      stationSchedules = stationSched || []
    } else {
      // 파라미터가 없으면 세금 알림만 처리 (AWS cron job용)
      const { data: taxSched, error: taxSchedErr } = await supabase
        .from("notification_schedules")
        .select("id, name, days_before, is_active, teams_channel_id")
        .eq("notification_type", "tax")
        .eq("is_active", true)
      if (taxSchedErr) throw taxSchedErr
      taxSchedules = taxSched || []
      
      // 충전소 일정 알림은 수동으로만 처리 (파라미터로 명시적으로 요청할 때만)
      stationSchedules = []
    }

    if (taxSchedules.length === 0 && stationSchedules.length === 0) {
      return NextResponse.json({ success: true, dispatched: 0, dispatchedStation: 0 })
    }

    // Determine current time window
    const now = new Date()
    const nowStr = now.toISOString()

    // Get KST time for notifications
    const kst = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .reduce((acc: any, p) => ((acc[p.type] = p.value), acc), {})

    const yyyy = kst.year
    const mm = kst.month
    const dd = kst.day
    const hh = kst.hour
    const min = kst.minute
    const todayKst = `${yyyy}-${mm}-${dd}`
    const nowHm = `${hh}:${min}`

    let dispatched = 0
    let dispatchedStation = 0

    // Fetch teams channels
    const { data: channels } = await supabase
      .from("teams_channels")
      .select("id, webhook_url")
      .eq("is_active", true)

    const webhooksAll = (channels || []).map((c: any) => c.webhook_url)
    const idToWebhook = new Map((channels || []).map((c: any) => [c.id, c.webhook_url]))

    // Process tax notifications (per tax, per schedule)
    if (taxSchedules && taxSchedules.length > 0) {
      for (const sched of taxSchedules as any[]) {
        const targetDate = new Date(now)
        targetDate.setDate(now.getDate() + sched.days_before)
        const y = targetDate.getFullYear()
        const m = String(targetDate.getMonth() + 1).padStart(2, "0")
        const d = String(targetDate.getDate()).padStart(2, "0")
        const dateStr = `${y}-${m}-${d}`

        const { data: taxes, error: taxErr } = await supabase
          .from("taxes")
          .select("id, tax_type, tax_amount, due_date, charging_stations(station_name)")
          .eq("due_date", dateStr)
        if (taxErr) throw taxErr

        for (const tax of taxes || []) {
          const taxTypeMap: any = { acquisition: '취득세', property: '재산세', other: '기타세' }
          const msg = [
            `세금 납부일 알림입니다.`,
            `${tax.charging_stations?.station_name || '-'} / ${taxTypeMap[tax.tax_type] || '기타세'} / ${tax.due_date}`,
            `https://tms.watercharging.com/`
          ].join("\n")

          // idempotent per tax+schedule+date
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("notification_type", "tax")
            .eq("schedule_id", sched.id)
            .eq("tax_id", tax.id)
            .eq("notification_date", todayKst)
            .limit(1)
            .maybeSingle()

          let newNotification: any = existing
          let notificationError: any = null
          if (!existing) {
            const insertRes = await supabase
              .from("notifications")
              .insert([{
                notification_type: "tax",
                schedule_id: sched.id,
                tax_id: tax.id,
                notification_date: todayKst,
                notification_time: "10:00",
                title: (sched as any).name || '알림',
                message: msg,
                teams_channel_id: sched.teams_channel_id,
                is_sent: false
              }])
              .select()
              .single()
            newNotification = insertRes.data
            notificationError = insertRes.error
          } else {
            // 기존 레코드도 메시지 포맷을 최신으로 동기화
            await supabase
              .from("notifications")
              .update({ message: msg })
              .eq("id", existing.id)
          }

          if (notificationError) {
            console.error(`[Tax Notification] Failed to create notification:`, notificationError)
            continue
          }

          const targetWebhook = sched.teams_channel_id ? idToWebhook.get(sched.teams_channel_id) : null
          const targets = targetWebhook ? [targetWebhook] : webhooksAll
          let sendSuccess = true

          if (targets.length > 0) {
            const sendResults = await Promise.allSettled(
              targets.map((url: string) =>
                fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }),
              ),
            )

            const failedSends = sendResults.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok))
            if (failedSends.length > 0) {
              console.error(`[Tax Notification] Failed to send ${failedSends.length}/${targets.length} Teams messages`)
              sendSuccess = false
            }
          }

          await supabase
            .from("notifications")
            .update({ 
              is_sent: sendSuccess, 
              sent_at: sendSuccess ? new Date().toISOString() : null,
              error_message: sendSuccess ? null : "Teams 발송 실패",
              last_attempt_at: new Date().toISOString()
            })
            .eq("id", newNotification.id)

          dispatched += 1
        }
      }
    }

    // Process station schedule notifications (only if there are active schedules)
    if (stationSchedules && stationSchedules.length > 0) {
      for (const sched of stationSchedules as any[]) {
        // Find stations without schedules (missing dates)
        const { data: allStations, error: stationsErr } = await supabase
          .from("charging_stations")
          .select(`
            id,
            station_name,
            location,
            address,
            canopy_installed,
            created_at
          `)
        if (stationsErr) throw stationsErr

        const { data: existingSchedules, error: schedulesErr } = await supabase
          .from("station_schedules")
          .select("station_id, use_approval_enabled, use_approval_date, safety_inspection_date")
        if (schedulesErr) throw schedulesErr

        // Find stations missing required dates
        const missingUseApprovalStations: any[] = []
        const missingSafetyInspectionStations: any[] = []

        for (const station of allStations || []) {
          const existingSchedule = existingSchedules?.find(s => s.station_id === station.id)
          
          // Check if station was created more than 'days_before' days ago
          const stationCreatedDate = new Date(station.created_at)
          const daysSinceCreation = Math.floor((now.getTime() - stationCreatedDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // Only check for missing dates if the station was created more than 'days_before' days ago
          if (daysSinceCreation >= sched.days_before) {
            // Check for missing use approval date (only for canopy stations)
            if (station.canopy_installed) {
              if (!existingSchedule || !existingSchedule.use_approval_enabled || !existingSchedule.use_approval_date) {
                missingUseApprovalStations.push({
                  ...station,
                  missing_days: daysSinceCreation
                })
              }
            }
            
            // Check for missing safety inspection date (all stations)
            if (!existingSchedule || !existingSchedule.safety_inspection_date) {
              missingSafetyInspectionStations.push({
                ...station,
                missing_days: daysSinceCreation
              })
            }
          }
        }

        // Build membership sets
        const useSet = new Set((missingUseApprovalStations || []).map((s: any) => s.id))
        const safetySet = new Set((missingSafetyInspectionStations || []).map((s: any) => s.id))

        // De-duplicate stations (if both dates missing)
        const dedupMap = new Map<string, any>()
        for (const s of missingUseApprovalStations) dedupMap.set(s.id, s)
        for (const s of missingSafetyInspectionStations) dedupMap.set(s.id, s)
        const missingStations = Array.from(dedupMap.values())

        if (missingStations.length === 0) continue

        for (const s of missingStations) {
          const useMissing = useSet.has(s.id)
          const safetyMissing = safetySet.has(s.id)
          const missingTypes: Array<'use_approval'|'safety_inspection'> = []
          if (useMissing) missingTypes.push('use_approval')
          if (safetyMissing) missingTypes.push('safety_inspection')

          for (const missingType of missingTypes) {
            const label = missingType === 'use_approval' ? '사용 승인일' : '안전 점검일'
            const msg = [
              `${s.station_name} ${label} 미입력 상태입니다.`,
              `날짜를 입력해 주세요.`,
              `https://tms.watercharging.com/`
            ].join("\n")

            // idempotent per station+schedule+date+missingType
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("notification_type", "station_schedule")
              .eq("schedule_id", sched.id)
              .eq("station_id", s.id)
              .eq("notification_date", todayKst)
              .eq("station_missing_type", missingType)
              .limit(1)
              .maybeSingle()

            let newNotification: any = existing
            let notificationError: any = null
            if (!existing) {
              const insertRes = await supabase
                .from("notifications")
                .insert([{
                  notification_type: "station_schedule",
                  schedule_id: sched.id,
                  station_id: s.id,
                  station_missing_type: missingType,
                  notification_date: todayKst,
                  notification_time: "10:00",
                  title: (sched as any).name || '알림',
                  message: msg,
                  teams_channel_id: sched.teams_channel_id,
                  is_sent: false
                }])
                .select()
                .single()
              newNotification = insertRes.data
              notificationError = insertRes.error
            } else {
              // 기존 레코드도 메시지 포맷을 최신으로 동기화
              await supabase
                .from("notifications")
                .update({ message: msg })
                .eq("id", existing.id)
            }

            if (notificationError) {
              console.error(`[Station Schedule Notification] Failed to create notification:`, notificationError)
              continue
            }

            // Send teams to selected channel or all
            const targetWebhook = sched.teams_channel_id ? idToWebhook.get(sched.teams_channel_id) : null
            const targets = targetWebhook ? [targetWebhook] : webhooksAll
            let sendSuccess = true
            
            if (targets.length > 0) {
              const sendResults = await Promise.allSettled(
                targets.map((url: string) =>
                  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }),
                ),
              )
              
              // Check for failed sends
              const failedSends = sendResults.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok))
              if (failedSends.length > 0) {
                console.error(`[Station Schedule Notification] Failed to send ${failedSends.length}/${targets.length} Teams messages`)
                sendSuccess = false
              }
            }

            // Update notification status
            await supabase
              .from("notifications")
              .update({ 
                is_sent: sendSuccess, 
                sent_at: sendSuccess ? new Date().toISOString() : null,
                error_message: sendSuccess ? null : "Teams 발송 실패",
                last_attempt_at: new Date().toISOString()
              })
              .eq("id", newNotification.id)

            dispatchedStation += 1
          }
        }
      }
    }

    // Manual notifications (independent table): send at 10:00 KST when due
    const { data: pendingManuals } = await supabase
      .from("manual_notifications")
      .select("id, message, notification_date, teams_channel_id, is_sent")
      .eq("is_sent", false)
      .eq("notification_date", todayKst)

    let dispatchedManual = 0
    if (pendingManuals && pendingManuals.length > 0) {
      // Optional mapping for channel-specific sends
      const idToWebhook = new Map<string, string>()
      ;(channels || []).forEach((c: any) => idToWebhook.set(c.id, c.webhook_url))

      for (const n of pendingManuals as any[]) {
        // 매일 오전 10시에만 발송 (정확히 10:00-10:04 범위에서만)
        if (hh !== "10" || parseInt(min) > 4) continue

        const msg = n.message as string


        // Send teams to selected channel or all
        const targetWebhook = n.teams_channel_id ? idToWebhook.get(n.teams_channel_id) : null
        const targets = targetWebhook ? [targetWebhook] : webhooksAll
        let sendSuccess = true
        
        if (targets.length > 0) {
          const sendResults = await Promise.allSettled(
            targets.map((url: string) =>
              fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }),
            ),
          )
          
          // Check for failed sends
          const failedSends = sendResults.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok))
          if (failedSends.length > 0) {
            console.error(`[Manual Notification] Failed to send ${failedSends.length}/${targets.length} Teams messages for notification ${n.id}`)
            sendSuccess = false
          }
        }

        // Mark as sent/attempt (manual_notifications schema has no error_message)
        await supabase
          .from("manual_notifications")
          .update({ 
            is_sent: sendSuccess, 
            sent_at: sendSuccess ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq("id", n.id)

        dispatchedManual++
      }
    }

    return NextResponse.json({ success: true, dispatched, dispatchedStation, dispatchedManual, now: nowStr })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message || "Unknown" }, { status: 500 })
  }
}

// Vercel Cron 및 수동 호출용 GET 지원
export async function GET(req: NextRequest) {
  return POST(req)
}


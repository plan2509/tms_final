import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    // Optional protection for external schedulers (AWS/EventBridge, etc.)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
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

너가 자자도ㅣㄴ 알리리    // Load active schedules based on notification type
    let taxSchedules = []
    let stationSchedules = []
    
    if (notificationType === "tax") {
      const { data: taxSched, error: taxSchedErr } = await supabase
        .from("notification_schedules")
        .select("id, days_before, notification_time, is_active, teams_channel_id")
        .eq("notification_type", "tax")
        .eq("is_active", true)
      if (taxSchedErr) throw taxSchedErr
      taxSchedules = taxSched || []
    } else if (notificationType === "station_schedule") {
      const { data: stationSched, error: stationSchedErr } = await supabase
        .from("notification_schedules")
        .select("id, days_before, notification_time, is_active, teams_channel_id")
        .eq("notification_type", "station_schedule")
        .eq("is_active", true)
      if (stationSchedErr) throw stationSchedErr
      stationSchedules = stationSched || []
    } else {
      // 파라미터가 없으면 세금 알림만 처리 (AWS cron job용)
      const { data: taxSched, error: taxSchedErr } = await supabase
        .from("notification_schedules")
        .select("id, days_before, notification_time, is_active, teams_channel_id")
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

    // Process tax notifications (only if there are active tax schedules)
    if (taxSchedules && taxSchedules.length > 0) {
      // Group taxes by due date to avoid duplicates
      const taxesByDate = new Map()
      
      for (const sched of taxSchedules as any[]) {
        const targetDate = new Date(now)
        targetDate.setDate(now.getDate() + sched.days_before) // days_before일 후의 납부기한을 찾음
        const y = targetDate.getFullYear()
        const m = String(targetDate.getMonth() + 1).padStart(2, "0")
        const d = String(targetDate.getDate()).padStart(2, "0")
        const dateStr = `${y}-${m}-${d}`

        const { data: taxes, error: taxErr } = await supabase
          .from("taxes")
          .select("id, tax_type, tax_amount, due_date, charging_stations(station_name)")
          .eq("due_date", dateStr)
        if (taxErr) throw taxErr

        if (taxes && taxes.length > 0) {
          if (!taxesByDate.has(dateStr)) {
            taxesByDate.set(dateStr, { taxes, schedule: sched })
          }
        }
      }

      // Create one notification per due date
      for (const [dateStr, { taxes, schedule }] of taxesByDate) {
        const msg = `세금 일정 알림\n대상 건수: ${taxes.length}건\n기한: ${dateStr}`

        // idempotent: avoid duplicates for same schedule/date
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("notification_type", "tax")
          .eq("schedule_id", schedule.id)
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
              schedule_id: schedule.id,
              notification_date: todayKst,
              notification_time: "10:00",
              message: msg,
              teams_channel_id: schedule.teams_channel_id,
              is_sent: false
            }])
            .select()
            .single()
          newNotification = insertRes.data
          notificationError = insertRes.error
        }

        if (notificationError) {
          console.error(`[Tax Notification] Failed to create notification:`, notificationError)
          continue
        }

        // Send teams
        const targetWebhook = schedule.teams_channel_id ? idToWebhook.get(schedule.teams_channel_id) : null
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

        dispatched += taxes.length
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
      const missingUseApprovalStations = []
      const missingSafetyInspectionStations = []

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

      // Only send notification if there are missing dates
      if (missingUseApprovalStations.length === 0 && missingSafetyInspectionStations.length === 0) {
        continue
      }

      let msg = `🚨 충전소 일정 미입력 알림 (생성 후 ${sched.days_before}일 경과)\n\n`
      msg += "⚠️ 다음 충전소들의 일정 입력이 필요합니다:\n\n"

      if (missingUseApprovalStations.length > 0) {
        msg += `📋 사용 승인일 미입력 (캐노피 설치 충전소):\n`
        missingUseApprovalStations.forEach((station: any) => {
          msg += `• ${station.station_name} - ${station.location} (${station.missing_days}일 경과)\n`
        })
        msg += "\n"
      }

      if (missingSafetyInspectionStations.length > 0) {
        msg += `🔍 안전 점검일 미입력:\n`
        missingSafetyInspectionStations.forEach((station: any) => {
          msg += `• ${station.station_name} - ${station.location} (${station.missing_days}일 경과)\n`
        })
        msg += "\n"
      }

      msg += `총 ${missingUseApprovalStations.length + missingSafetyInspectionStations.length}개 충전소의 일정 입력이 필요합니다.\n`
      msg += `\n💡 사업 일정 페이지에서 해당 충전소들의 일정을 입력해주세요.`

      // Create notification in database
      // idempotent: avoid duplicates for same schedule/date
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("notification_type", "station_schedule")
        .eq("schedule_id", sched.id)
        .eq("notification_date", todayKst)
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
            notification_date: todayKst,
            notification_time: "10:00",
            message: msg,
            teams_channel_id: sched.teams_channel_id,
            is_sent: false
          }])
          .select()
          .single()
        newNotification = insertRes.data
        notificationError = insertRes.error
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

      dispatchedStation += missingUseApprovalStations.length + missingSafetyInspectionStations.length
      }
    }

    // Manual notifications: send at configured date/time when due

    const { data: pendingManuals } = await supabase
      .from("notifications")
      .select("id, message, notification_date, notification_time, teams_channel_id")
      .eq("notification_type", "manual")
      .eq("is_sent", false)
      .eq("notification_date", todayKst)
      .eq("notification_time", "10:00")

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

        // Mark as sent only if successful
        if (sendSuccess) {
          await supabase
            .from("notifications")
            .update({ 
              is_sent: true, 
              sent_at: new Date().toISOString(),
              error_message: null,
              last_attempt_at: new Date().toISOString()
            })
            .eq("id", n.id)
        } else {
          // Mark as failed
          await supabase
            .from("notifications")
            .update({ 
              is_sent: false, 
              error_message: "Teams 발송 실패",
              last_attempt_at: new Date().toISOString() 
            })
            .eq("id", n.id)
        }

        dispatchedManual++
      }
    }

    return NextResponse.json({ success: true, dispatched, dispatchedStation, dispatchedManual, now: nowStr })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message || "Unknown" }, { status: 500 })
  }
}


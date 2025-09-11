import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    let webhookUrls: string[] = Array.isArray(body?.webhookUrls) ? body.webhookUrls : []
    let channelIds: string[] = Array.isArray(body?.channelIds) ? body.channelIds : []
    const notificationId: string | null = typeof body?.notificationId === "string" ? body.notificationId : null
    let text: string = typeof body?.text === "string" && body.text.trim().length > 0 ? body.text : `TMS 테스트 메시지 (${new Date().toLocaleString("ko-KR")})`

    let urls = webhookUrls
    if (channelIds.length > 0) {
      const { data: channels, error } = await supabase
        .from("teams_channels")
        .select("webhook_url")
        .in("id", channelIds)
        .eq("is_active", true)
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      urls = [...urls, ...((channels || []).map((c: any) => c.webhook_url) as string[])]
    }

    // dedupe
    urls = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.startsWith("http"))))
    
    // If notificationId provided, load row and normalize message + default channel
    if (notificationId) {
      const admin = createAdminClient()
      const { data: nRow } = await admin
        .from("notifications")
        .select(`
          id, notification_type, tax_id, station_id, teams_channel_id,
          taxes (
            id, tax_type, due_date, charging_stations ( station_name )
          )
        `)
        .eq("id", notificationId)
        .maybeSingle()

      if (nRow) {
        // Build message templates
        if (nRow.notification_type === 'tax' && nRow.taxes) {
          const stationName = nRow.taxes.charging_stations?.station_name || '-'
          const taxTypeMap: Record<string, string> = { acquisition: '취득세', property: '재산세', other: '기타세' }
          const taxType = taxTypeMap[nRow.taxes.tax_type as string] || nRow.taxes.tax_type || '-'
          const due = nRow.taxes.due_date
          text = [
            `세금 납부일 알림입니다.`,
            `${stationName} / ${taxType} / ${due}`,
            `https://tms.watercharging.com/`
          ].join('\n')
        } else if (nRow.notification_type === 'station_schedule') {
          // We only know station context; use single-station template
          // Try to resolve station name (best-effort)
          let stationName = '-'
          if (nRow.station_id) {
            const { data: st } = await admin
              .from('charging_stations')
              .select('station_name')
              .eq('id', nRow.station_id)
              .maybeSingle()
            stationName = st?.station_name || '-'
          }
          text = [
            `${stationName} 사용 승인일 미입력 상태입니다.`,
            `날짜를 입력해 주세요.`,
            `https://tms.watercharging.com/`
          ].join('\n')
        }

        // If no urls resolved yet, determine from notification's channel or active channels
        if (urls.length === 0) {
          if (nRow.teams_channel_id) {
            const { data: ch } = await admin
              .from('teams_channels')
              .select('webhook_url')
              .eq('id', nRow.teams_channel_id)
              .eq('is_active', true)
              .maybeSingle()
            if (ch?.webhook_url) urls.push(ch.webhook_url)
          } else {
            const { data: actives } = await admin
              .from('teams_channels')
              .select('webhook_url')
              .eq('is_active', true)
            urls.push(...(actives || []).map((c: any) => c.webhook_url))
          }
        }

        // Persist normalized message for UI consistency
        await admin
          .from('notifications')
          .update({ message: text })
          .eq('id', notificationId)
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({ success: false, error: "No webhook URLs provided" }, { status: 400 })
    }

    let ok = 0
    let fail = 0
    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
        if (resp.ok) ok++
        else fail++
      } catch {
        fail++
      }
    }

    // Optionally mark a notification as sent using service role (bypass RLS issues)
    if (notificationId) {
      const admin = createAdminClient()
      const sent = fail === 0 && ok > 0
      await admin
        .from("notifications")
        .update({
          is_sent: sent,
          sent_at: sent ? new Date().toISOString() : null,
          error_message: sent ? null : "Teams 발송 실패",
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", notificationId)

      await admin.from("notification_logs").insert({
        notification_id: notificationId,
        send_status: sent ? "success" : "failed",
        error_message: sent ? null : "Teams 발송 실패",
        sent_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true, sent: ok, failed: fail })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}


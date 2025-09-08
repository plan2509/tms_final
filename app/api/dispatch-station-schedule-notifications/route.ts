import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // 현재 시간 (KST)
    const now = new Date()
    const kstOffset = 9 * 60 // KST는 UTC+9
    const nowKst = new Date(now.getTime() + kstOffset * 60 * 1000)
    const todayKst = nowKst.toISOString().split('T')[0]

    // 충전소 일정 알림 스케줄 조회
    const { data: schedules } = await supabase
      .from("notification_schedules")
      .select("*")
      .eq("notification_type", "station_schedule")
      .eq("is_active", true)

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No active station schedule notification schedules found",
        dispatched: 0 
      })
    }

    // Teams 채널 조회
    const { data: channels } = await supabase
      .from("teams_channels")
      .select("id, webhook_url")
      .eq("is_active", true)

    const webhooksAll = (channels || []).map((c: any) => c.webhook_url)
    const idToWebhook = new Map((channels || []).map((c: any) => [c.id, c.webhook_url]))

    let dispatched = 0

    for (const schedule of schedules as any[]) {
      // 대상 날짜 계산 (days_before일 전)
      const targetDate = new Date(nowKst)
      targetDate.setDate(targetDate.getDate() + schedule.days_before)
      const targetDateStr = targetDate.toISOString().split('T')[0]

      // 해당 날짜에 일정이 있는 충전소 조회
      const { data: stationSchedules } = await supabase
        .from("station_schedules")
        .select(`
          *,
          charging_stations (
            id,
            name,
            location,
            address
          )
        `)
        .or(`use_approval_date.eq.${targetDateStr},safety_inspection_date.eq.${targetDateStr}`)

      if (!stationSchedules || stationSchedules.length === 0) continue

      // 알림 메시지 생성
      const useApprovalStations = stationSchedules.filter((s: any) => 
        s.use_approval_enabled && s.use_approval_date === targetDateStr
      )
      const safetyInspectionStations = stationSchedules.filter((s: any) => 
        s.safety_inspection_date === targetDateStr
      )

      let message = `충전소 일정 알림 (${schedule.days_before}일 전)\n\n`

      if (useApprovalStations.length > 0) {
        message += `📋 사용 승인일 (${targetDateStr}):\n`
        useApprovalStations.forEach((s: any) => {
          message += `• ${s.charging_stations.name} - ${s.charging_stations.location}\n`
        })
        message += "\n"
      }

      if (safetyInspectionStations.length > 0) {
        message += `🔍 안전 점검일 (${targetDateStr}):\n`
        safetyInspectionStations.forEach((s: any) => {
          message += `• ${s.charging_stations.name} - ${s.charging_stations.location}\n`
        })
        message += "\n"
      }

      message += `총 ${stationSchedules.length}개 충전소의 일정이 예정되어 있습니다.`

      // Teams 알림 발송
      const targetWebhook = schedule.teams_channel_id ? idToWebhook.get(schedule.teams_channel_id) : null
      const targets = targetWebhook ? [targetWebhook] : webhooksAll

      if (targets.length > 0) {
        await Promise.all(
          targets.map((url: string) =>
            fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: message }),
            }).catch((err) => console.error("Teams webhook error:", err))
          )
        )
      }

      dispatched++
    }

    return NextResponse.json({
      success: true,
      message: `Station schedule notifications dispatched successfully`,
      dispatched,
      timestamp: nowKst.toISOString(),
    })

  } catch (error) {
    console.error("Error dispatching station schedule notifications:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to dispatch station schedule notifications",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

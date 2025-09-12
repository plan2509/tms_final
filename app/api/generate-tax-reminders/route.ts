import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type ScheduleRow = {
  id: string
  days_before: number
  notification_time: string
  is_active: boolean
}

type TaxRow = {
  id: string
  tax_type: string
  tax_amount: number
  due_date: string
  status?: string
  charging_stations?: {
    station_name?: string
  } | null
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function subtractDaysFromDateString(dateStr: string, days: number): string {
  // Interpret dateStr as UTC midnight to avoid timezone drift
  const base = new Date(`${dateStr}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() - days)
  return formatDate(base)
}

function getKstTodayAndNowHm() {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc: Record<string, string>, p) => {
      acc[p.type] = p.value
      return acc
    }, {})

  const today = `${parts.year}-${parts.month}-${parts.day}`
  const nowHm = `${parts.hour}:${parts.minute}`
  return { today, nowHm }
}

export async function POST(_req: NextRequest) {
  try {
    const supabase = createAdminClient()

    const { data: schedules, error: schedErr } = await supabase
      .from("notification_schedules")
      .select("id, days_before, notification_time, is_active")
      .eq("is_active", true)

    if (schedErr) throw schedErr

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, created: 0, skipped: 0, reason: "no_active_schedules" })
    }

    const { data: taxes, error: taxErr } = await supabase
      .from("taxes")
      .select(
        "id, tax_type, tax_amount, due_date, status, charging_stations(station_name)"
      )
      .not("due_date", "is", null)
      .neq("status", "payment_completed")

    if (taxErr) throw taxErr

    if (!taxes || taxes.length === 0) {
      return NextResponse.json({ success: true, created: 0, skipped: 0, reason: "no_taxes" })
    }

    const { today, nowHm } = getKstTodayAndNowHm()

    let created = 0
    let skipped = 0

    // For each schedule and tax, compute future reminder and insert if not exists
    for (const schedule of schedules as ScheduleRow[]) {
      for (const tax of taxes as TaxRow[]) {
        if (!tax.due_date) {
          skipped++
          continue
        }

        const targetDate = subtractDaysFromDateString(tax.due_date, schedule.days_before || 0)
        const targetTime = schedule.notification_time

        // Only create reminders in the future relative to KST now
        const isFuture = targetDate > today || (targetDate === today && targetTime > nowHm)
        if (!isFuture) {
          skipped++
          continue
        }

        // Check if an identical auto reminder already exists
        const { data: existing, error: existErr } = await supabase
          .from("notifications")
          .select("id")
          .eq("notification_type", "auto")
          .eq("tax_id", tax.id)
          .eq("schedule_id", schedule.id)
          .eq("notification_date", targetDate)
          .eq("notification_time", targetTime)
          .limit(1)

        if (existErr) throw existErr
        if (existing && existing.length > 0) {
          skipped++
          continue
        }

        const taxTypeLabels: Record<string, string> = {
          acquisition: "취득세",
          property: "재산세",
          income: "소득세",
          corporate: "법인세",
          vat: "부가가치세",
          local: "지방세",
          other: "기타세",
        }
        const station = tax.charging_stations?.station_name || ""
        const typeName = taxTypeLabels[tax.tax_type] || tax.tax_type
        const due = tax.due_date
        const amount = new Intl.NumberFormat("ko-KR").format(tax.tax_amount ?? 0)
        const message = station
          ? `${station} ${typeName} ${amount}원 납부 기한 ${due} 리마인더`
          : `${typeName} ${amount}원 납부 기한 ${due} 리마인더`

        const insertRow = {
          tax_id: tax.id,
          notification_type: "auto" as const,
          schedule_id: schedule.id,
          notification_date: targetDate,
          notification_time: targetTime,
          message,
          is_sent: false,
        }

        const { error: insertErr } = await supabase.from("notifications").insert([insertRow])
        if (insertErr) throw insertErr
        created++
      }
    }

    return NextResponse.json({ success: true, created, skipped })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Unknown error" },
      { status: 500 }
    )
  }
}


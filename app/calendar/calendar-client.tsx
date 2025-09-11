"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

interface TaxEvent {
  id: string
  title: string
  date: string
  type: "acquisition" | "property" | "other"
  status: "accounting_review" | "payment_scheduled" | "payment_completed"
  amount: number
  station_name: string
  isOverdue: boolean
}

const typeLabels = {
  acquisition: "취득세",
  property: "재산세",
  other: "기타세",
}

const statusLabels = {
  accounting_review: "회계사 검토",
  payment_scheduled: "납부 예정",
  payment_completed: "납부 완료",
}

const statusColors = {
  accounting_review: "bg-yellow-500",
  payment_scheduled: "bg-blue-500",
  payment_completed: "bg-green-500",
}

const koreanHolidays = {
  2024: [
    { date: "2024-01-01", name: "신정" },
    { date: "2024-02-09", name: "설날 연휴" },
    { date: "2024-02-10", name: "설날" },
    { date: "2024-02-11", name: "설날 연휴" },
    { date: "2024-02-12", name: "대체공휴일" },
    { date: "2024-03-01", name: "삼일절" },
    { date: "2024-04-10", name: "국회의원선거일" },
    { date: "2024-05-05", name: "어린이날" },
    { date: "2024-05-06", name: "대체공휴일" },
    { date: "2024-05-15", name: "부처님오신날" },
    { date: "2024-06-06", name: "현충일" },
    { date: "2024-08-15", name: "광복절" },
    { date: "2024-09-16", name: "추석 연휴" },
    { date: "2024-09-17", name: "추석" },
    { date: "2024-09-18", name: "추석 연휴" },
    { date: "2024-10-03", name: "개천절" },
    { date: "2024-10-09", name: "한글날" },
    { date: "2024-12-25", name: "크리스마스" },
  ],
  2025: [
    { date: "2025-01-01", name: "신정" },
    { date: "2025-01-28", name: "설날 연휴" },
    { date: "2025-01-29", name: "설날" },
    { date: "2025-01-30", name: "설날 연휴" },
    { date: "2025-03-01", name: "삼일절" },
    { date: "2025-03-03", name: "대체공휴일" },
    { date: "2025-05-05", name: "어린이날" },
    { date: "2025-05-12", name: "부처님오신날" },
    { date: "2025-06-06", name: "현충일" },
    { date: "2025-08-15", name: "광복절" },
    { date: "2025-10-05", name: "추석 연휴" },
    { date: "2025-10-06", name: "추석" },
    { date: "2025-10-07", name: "추석 연휴" },
    { date: "2025-10-08", name: "대체공휴일" },
    { date: "2025-10-03", name: "개천절" },
    { date: "2025-10-09", name: "한글날" },
    { date: "2025-12-25", name: "크리스마스" },
  ],
}

const isKoreanHoliday = (date: Date) => {
  const year = date.getFullYear()
  const dateString = date.toISOString().split("T")[0]
  const holidays = koreanHolidays[year as keyof typeof koreanHolidays] || []
  return holidays.find((holiday) => holiday.date === dateString)
}

const isWeekend = (date: Date) => {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

export function CalendarClient() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<TaxEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [supabase, setSupabase] = useState<any>(null)

  useEffect(() => {
    try {
      const client = createClient()
      setSupabase(client)
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error)
      setSupabase(null)
    }
  }, [])

  useEffect(() => {
    if (supabase) {
      fetchEvents()
    }
  }, [currentDate, supabase])

  const fetchEvents = async () => {
    if (!supabase) return

    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data: taxes, error } = await supabase
        .from("taxes")
        .select(`
          id,
          tax_type,
          status,
          tax_amount,
          due_date,
          charging_stations (station_name)
        `)
        .gte("due_date", startOfMonth.toISOString().split("T")[0])
        .lte("due_date", endOfMonth.toISOString().split("T")[0])
        .order("due_date")

      if (error) throw error

      const now = new Date()
      const taxEvents: TaxEvent[] =
        taxes?.map((tax) => ({
          id: tax.id,
          title: `${typeLabels[tax.tax_type as keyof typeof typeLabels]} - ${tax.charging_stations?.station_name}`,
          date: tax.due_date,
          type: tax.tax_type,
          status: tax.status,
          amount: tax.tax_amount,
          station_name: tax.charging_stations?.station_name || "미지정",
          isOverdue: new Date(tax.due_date) < now && tax.status !== "payment_completed",
        })) || []

      setEvents(taxEvents)
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        date: null,
        isCurrentMonth: false,
        events: [],
        isHoliday: null,
        isWeekend: false,
        isEmpty: true,
      })
    }

    // Current month's days only
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayEvents = events.filter((event) => new Date(event.date).toDateString() === date.toDateString())
      days.push({
        date,
        isCurrentMonth: true,
        events: dayEvents,
        isHoliday: isKoreanHoliday(date),
        isWeekend: isWeekend(date),
        isEmpty: false,
      })
    }

    return days
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const groupEventsByType = (events: TaxEvent[]) => {
    const grouped = events.reduce(
      (acc, event) => {
        const key = event.type
        if (!acc[key]) {
          acc[key] = {
            type: event.type,
            count: 0,
            totalAmount: 0,
            hasOverdue: false,
            status: event.status,
          }
        }
        acc[key].count += 1
        acc[key].totalAmount += event.amount
        if (event.isOverdue) {
          acc[key].hasOverdue = true
        }
        return acc
      },
      {} as Record<
        string,
        {
          type: string
          count: number
          totalAmount: number
          hasOverdue: boolean
          status: string
        }
      >,
    )

    return Object.values(grouped)
  }

  const days = getDaysInMonth(currentDate)
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!supabase) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold text-red-600 mb-2">연결 오류</h3>
          <p className="text-muted-foreground">데이터베이스 연결에 실패했습니다. 페이지를 새로고침해주세요.</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            새로고침
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="font-semibold text-3xl">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="border-0 outline-none ring-0 shadow-none hover:bg-yellow-500 hover:text-black focus:border-0 focus:outline-none focus:ring-0 active:border-0 active:outline-none active:ring-0"
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="border-2 border-yellow-500 bg-yellow-500 font-semibold hover:bg-yellow-600 hover:border-yellow-600 text-black"
            >
              오늘
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="border-0 outline-none ring-0 shadow-none hover:bg-yellow-500 hover:text-black focus:border-0 focus:outline-none focus:ring-0 active:border-0 active:outline-none active:ring-0"
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={`p-4 text-center font-medium border-r last:border-r-0 ${
                  index === 0 || index === 6 ? "text-red-600" : ""
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, index) => (
              <div
                key={index}
                className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${day.isEmpty ? "bg-muted/10" : ""} ${
                  day.date && day.date.toDateString() === new Date().toDateString()
                    ? "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 border-2"
                    : ""
                }`}
              >
                {!day.isEmpty && day.date && (
                  <>
                    <div
                      className={`text-sm font-medium mb-2 ${day.isWeekend || day.isHoliday ? "text-red-600" : ""} ${
                        day.date.toDateString() === new Date().toDateString()
                          ? "text-yellow-800 dark:text-yellow-200 font-bold"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span>{day.date.getDate()}</span>
                        {day.isHoliday && (
                          <span className="text-xs text-red-500 leading-tight">{day.isHoliday.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {day.events.length > 0 && (
                        <>
                          {groupEventsByType(day.events)
                            .slice(0, 2)
                            .map((group, groupIndex) => (
                              <div
                                key={groupIndex}
                                className={`text-xs p-1 rounded ${
                                  group.hasOverdue
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                }`}
                                title={`${typeLabels[group.type as keyof typeof typeLabels]} ${group.count}건 - ₩${group.totalAmount.toLocaleString()}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1">
                                    <div
                                      className={`w-2 h-2 rounded-full ${statusColors[group.status as keyof typeof statusColors]}`}
                                    />
                                    <span className="font-medium">
                                      {typeLabels[group.type as keyof typeof typeLabels]}
                                    </span>
                                  </div>
                                  <span className="text-xs">{group.count}건</span>
                                </div>
                                <div className="text-xs mt-1 font-medium">
                                  ₩{(group.totalAmount / 10000).toFixed(0)}만원
                                </div>
                              </div>
                            ))}
                          {groupEventsByType(day.events).length > 2 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{groupEventsByType(day.events).length - 2}개 유형 더
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📅</span>
            <span>다가오는 일정</span>
          </CardTitle>
          <CardDescription>이번 달 세금 납부 일정</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">이번 달에 예정된 세금 일정이 없습니다.</p>
            ) : (
              events.slice(0, 10).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${statusColors[event.status]}`} />
                    <div>
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.date).toLocaleDateString("ko-KR")} • ₩{event.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={event.isOverdue ? "destructive" : "secondary"}>
                      {event.isOverdue ? "연체" : statusLabels[event.status]}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

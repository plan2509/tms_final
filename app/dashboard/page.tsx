"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Brain, RefreshCw } from "lucide-react"

export default function DashboardPage() {
  const [stats, setStats] = useState([
    {
      title: "총 충전소",
      value: 0,
      description: "등록된 충전소 수",
      details: { operating: 0, maintenance: 0, planned: 0 },
    },
    {
      title: "총 세금 항목",
      value: 0,
      description: "관리 중인 세금 항목",
      details: { acquisition: 0, property: 0, other: 0 },
    },
    {
      title: "미납 세금",
      value: 0,
      description: "납부 대기 중인 세금",
      details: { overdue: 0, upcoming: 0, total_amount: 0 },
    },
    {
      title: "이번 달 납부 예정",
      value: 0,
      description: "30일 이내 납부 예정",
      details: { this_week: 0, next_week: 0, later: 0 },
    },
    {
      title: "알림 현황",
      value: 0,
      description: "발송 예정 알림",
      details: { pending: 0, sent_today: 0, failed: 0 },
    },
    {
      title: "세금 처리 현황",
      value: 0,
      description: "진행 중인 세금 처리",
      details: { accounting_review: 0, payment_scheduled: 0, completed_today: 0 },
    },
  ])
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        console.log("[v0] Dashboard: Creating Supabase client")
        const supabase = createClient()

        console.log("[v0] Dashboard: Fetching optimized statistics")

        const [stationsResult, taxesResult, pendingTaxesResult, notificationsResult] = await Promise.all([
          // Combined station queries
          supabase
            .from("charging_stations")
            .select("status"),
          // Combined tax queries
          supabase
            .from("taxes")
            .select("tax_type, status, due_date, tax_amount, updated_at"),
          // Only pending taxes
          supabase
            .from("taxes")
            .select("*", { count: "exact", head: true })
            .neq("status", "payment_completed"),
          // Only notification counts
          supabase
            .from("notifications")
            .select("id, created_at"),
        ])

        const stations = stationsResult.data || []
        const taxes = taxesResult.data || []
        const notifications = notificationsResult.data || []

        const now = new Date()
        const today = now.toISOString().split("T")[0]
        const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const monthFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        // Process stations
        const stationsByStatus = stations.reduce((acc: any, station: any) => {
          acc[station.status] = (acc[station.status] || 0) + 1
          return acc
        }, {})

        // Process taxes efficiently
        const taxesByType = taxes.reduce((acc: any, tax: any) => {
          acc[tax.tax_type] = (acc[tax.tax_type] || 0) + 1
          return acc
        }, {})

        const taxesByStatus = taxes.reduce((acc: any, tax: any) => {
          acc[tax.status] = (acc[tax.status] || 0) + 1
          return acc
        }, {})

        const overdueTaxes = taxes.filter(
          (tax) => new Date(tax.due_date) < now && tax.status !== "payment_completed",
        ).length

        const monthlyTaxes = taxes.filter(
          (tax) =>
            new Date(tax.due_date) >= now &&
            new Date(tax.due_date) < monthFromNow &&
            tax.status !== "payment_completed",
        ).length

        const weeklyTaxes = taxes.filter(
          (tax) =>
            new Date(tax.due_date) >= now && new Date(tax.due_date) < weekFromNow && tax.status !== "payment_completed",
        ).length

        const completedToday = taxes.filter(
          (tax) => tax.status === "payment_completed" && tax.updated_at >= today,
        ).length

        // Process notifications
        const pendingNotifications = notifications.length
        const sentToday = notifications.filter((n) => n.created_at >= today).length

        const updatedStats = [
          {
            ...stats[0],
            value: stations.length,
            details: {
              operating: stationsByStatus.operating || 0,
              maintenance: stationsByStatus.maintenance || 0,
              planned: stationsByStatus.planned || 0,
            },
          },
          {
            ...stats[1],
            value: taxes.length,
            details: {
              acquisition: taxesByType.acquisition || 0,
              property: taxesByType.property || 0,
              other: taxesByType.other || 0,
            },
          },
          {
            ...stats[2],
            value: pendingTaxesResult.count || 0,
            details: {
              overdue: overdueTaxes,
              upcoming: monthlyTaxes,
              total_amount: 0,
            },
          },
          {
            ...stats[3],
            value: monthlyTaxes,
            details: {
              this_week: weeklyTaxes,
              next_week: monthlyTaxes - weeklyTaxes,
              later: 0,
            },
          },
          {
            ...stats[4],
            value: pendingNotifications,
            details: {
              pending: pendingNotifications,
              sent_today: sentToday,
              failed: 0,
            },
          },
          {
            ...stats[5],
            value: (taxesByStatus.accounting_review || 0) + (taxesByStatus.payment_scheduled || 0),
            details: {
              accounting_review: taxesByStatus.accounting_review || 0,
              payment_scheduled: taxesByStatus.payment_scheduled || 0,
              completed_today: completedToday,
            },
          },
        ]

        setStats(updatedStats)
        console.log("[v0] Dashboard: Optimized stats calculated")
      } catch (error) {
        console.error("[v0] Dashboard: Error fetching statistics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const generateTaxInsights = async () => {
    setIsAnalyzing(true)
    setAiAnalysis("")
    setShowAnalysis(true)

    try {
      console.log("[v0] Dashboard: Starting AI analysis")

      const analysisData = {
        totalTaxes: stats[1].value,
        unpaidTaxes: stats[2].value,
        overdueTaxes: stats[2].details.overdue,
        monthlyDue: stats[3].value,
        weeklyDue: stats[3].details.this_week,
      }

      console.log("[v0] Dashboard: Sending analysis data:", analysisData)

      const res = await fetch("/api/analyze-tax-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taxData: analysisData }),
      })

      let text = "서비스를 준비 중입니다"
      try {
        const result = await res.json()
        if (result?.analysis) text = result.analysis
      } catch {}
      setAiAnalysis(text)

      console.log("[v0] Dashboard: Analysis completed")
    } catch (error) {
      console.error("[v0] Dashboard: Error generating tax insights:", error)
      setAiAnalysis("서비스를 준비 중입니다")
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-4">
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-5 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-muted rounded w-1/3 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <Button
          onClick={generateTaxInsights}
          disabled={isAnalyzing}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              AI 세금 분석
            </>
          )}
        </Button>
      </div>

      {showAnalysis && (
        <Card className="border-2 border-primary/20 bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold">AI 세금 현황 분석</CardTitle>
                  <CardDescription className="mt-1">
                    Grok AI가 현재 세금 현황을 종합적으로 분석한 결과입니다
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateTaxInsights}
                disabled={isAnalyzing}
                className="hover:bg-primary/10"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground">AI가 세금 데이터를 분석하고 있습니다...</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {aiAnalysis ? (
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    {aiAnalysis.split("\n").map((line, index) => {
                      if (line.trim() === "현재 세금 현황 요약") {
                        return (
                          <div key={index} className="text-yellow-500 font-semibold text-lg mb-3">
                            {line}
                          </div>
                        )
                      }
                      return line ? (
                        <div key={index} className="mb-2">
                          {line}
                        </div>
                      ) : (
                        <div key={index} className="mb-2"></div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      AI 분석 버튼을 클릭하여 세금 현황에 대한 종합적인 분석을 받아보세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-all duration-200 border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-foreground">{stat.title}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">{stat.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-primary">{stat.value.toLocaleString()}</div>

              {/* Detailed breakdown */}
              <div className="space-y-2 text-sm">
                {stat.title === "총 충전소" && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">운영중:</span>
                      <span className="font-medium text-green-600">{stat.details.operating}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">점검중:</span>
                      <span className="font-medium text-amber-600">{stat.details.maintenance}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">운영예정:</span>
                      <span className="font-medium text-blue-600">{stat.details.planned}</span>
                    </div>
                  </>
                )}

                {stat.title === "총 세금 항목" && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">취득세:</span>
                      <span className="font-medium">{stat.details.acquisition}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">재산세:</span>
                      <span className="font-medium">{stat.details.property}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">기타세:</span>
                      <span className="font-medium">{stat.details.other}</span>
                    </div>
                  </>
                )}

                {stat.title === "미납 세금" && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">연체:</span>
                      <span className="font-medium text-red-600">{stat.details.overdue}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">예정:</span>
                      <span className="font-medium text-amber-600">{stat.details.upcoming}</span>
                    </div>
                  </>
                )}

                {stat.title === "이번 달 납부 예정" && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">이번 주:</span>
                      <span className="font-medium text-red-600">{stat.details.this_week}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">다음 주:</span>
                      <span className="font-medium text-amber-600">{stat.details.next_week}</span>
                    </div>
                  </>
                )}

                {stat.title === "알림 현황" && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">대기중:</span>
                      <span className="font-medium text-amber-600">{stat.details.pending}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">오늘 발송:</span>
                      <span className="font-medium text-green-600">{stat.details.sent_today}</span>
                    </div>
                  </>
                )}

                {stat.title === "세금 처리 현황" && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">회계사 검토:</span>
                      <span className="font-medium text-blue-600">{stat.details.accounting_review}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">납부 예정:</span>
                      <span className="font-medium text-amber-600">{stat.details.payment_scheduled}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">오늘 완료:</span>
                      <span className="font-medium text-green-600">{stat.details.completed_today}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

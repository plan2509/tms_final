"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

interface TaxStats {
  totalTaxes: number
  totalAmount: number
  byType: { type: string; count: number; amount: number }[]
  byStatus: { status: string; count: number; amount: number }[]
  byMonth: { month: string; count: number; amount: number }[]
  byStation: { station: string; count: number; amount: number }[]
  overdueTaxes: number
  completedTaxSum: number
}

const COLORS = [
  "#0ea5e9", // Sky blue
  "#10b981", // Emerald green
  "#f59e0b", // Amber yellow
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime green
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f43f5e", // Rose
  "#8b5a2b", // Brown
  "#64748b", // Slate gray
  "#7c3aed", // Purple
]

const statusLabels = {
  accounting_review: "회계사 검토",
  payment_scheduled: "납부 예정",
  payment_completed: "납부 완료",
  overdue: "연체",
  null: "미설정",
}

const typeLabels = {
  acquisition: "취득세",
  property: "재산세",
  other: "기타세",
}

export function StatisticsClient() {
  const [stats, setStats] = useState<TaxStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase, setSupabase] = useState<any>(null)
  const [monthRange, setMonthRange] = useState<{
    startYear: number
    startMonth: number
    endYear: number
    endMonth: number
  }>({
    startYear: new Date().getFullYear(),
    startMonth: 1,
    endYear: new Date().getFullYear(),
    endMonth: 12,
  })
  const [isFiltered, setIsFiltered] = useState(false)

  useEffect(() => {
    try {
      const client = createClient()
      setSupabase(client)
      fetchStatistics(client)
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error)
      setSupabase(null)
      setLoading(false)
    }
  }, [])

  const fetchStatistics = async (client?: any, startDate?: Date, endDate?: Date) => {
    const supabaseClient = client || supabase
    if (!supabaseClient) return

    try {
      let query = supabaseClient.from("taxes").select(`
          *,
          charging_stations (station_name)
        `)

      if (startDate) {
        query = query.gte("due_date", startDate.toISOString().split("T")[0])
      }
      if (endDate) {
        query = query.lte("due_date", endDate.toISOString().split("T")[0])
      }

      const { data: taxes, error } = await query

      if (error) throw error

      console.log("[v0] Total taxes fetched:", taxes?.length || 0)
      console.log("[v0] Tax statuses:", taxes?.map((tax) => tax.status) || [])
      console.log(
        "[v0] Tax data sample:",
        taxes?.slice(0, 2).map((tax) => ({
          id: tax.id,
          status: tax.status,
          tax_type: tax.tax_type,
          tax_amount: tax.tax_amount,
          due_date: tax.due_date,
        })),
      )

      const completedTaxes = taxes?.filter((tax) => tax.status === "payment_completed") || []
      console.log("[v0] Completed taxes count:", completedTaxes.length)
      console.log(
        "[v0] Completed taxes:",
        completedTaxes.map((tax) => ({
          id: tax.id,
          status: tax.status,
          amount: tax.tax_amount,
        })),
      )

      const now = new Date()
      const totalTaxes = taxes?.length || 0
      const totalAmount = taxes?.reduce((sum, tax) => sum + (tax.tax_amount || 0), 0) || 0

      const byType = Object.entries(
        taxes?.reduce(
          (acc, tax) => {
            const type = tax.tax_type
            if (!acc[type]) acc[type] = { count: 0, amount: 0 }
            acc[type].count++
            acc[type].amount += tax.tax_amount || 0
            return acc
          },
          {} as Record<string, { count: number; amount: number }>,
        ) || {},
      ).map(([type, data]) => ({
        type: typeLabels[type as keyof typeof typeLabels] || type,
        ...data,
      }))

      const byStatus = Object.entries(
        taxes?.reduce(
          (acc, tax) => {
            const status = tax.status || "null"
            if (!acc[status]) acc[status] = { count: 0, amount: 0 }
            acc[status].count++
            acc[status].amount += tax.tax_amount || 0
            return acc
          },
          {} as Record<string, { count: number; amount: number }>,
        ) || {},
      ).map(([status, data]) => ({
        status: statusLabels[status as keyof typeof statusLabels] || status,
        ...data,
      }))

      const monthlyData =
        taxes?.reduce(
          (acc, tax) => {
            const month = new Date(tax.due_date).toLocaleDateString("ko-KR", { year: "numeric", month: "short" })
            if (!acc[month]) acc[month] = { count: 0, amount: 0 }
            acc[month].count++
            acc[month].amount += tax.tax_amount || 0
            return acc
          },
          {} as Record<string, { count: number; amount: number }>,
        ) || {}

      const byMonth = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          ...data,
        }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

      const stationData =
        taxes?.reduce(
          (acc, tax) => {
            const station = tax.charging_stations?.station_name || "미지정"
            if (!acc[station]) acc[station] = { count: 0, amount: 0 }
            acc[station].count++
            acc[station].amount += tax.tax_amount || 0
            return acc
          },
          {} as Record<string, { count: number; amount: number }>,
        ) || {}

      const byStation = Object.entries(stationData)
        .map(([station, data]) => ({ station, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const overdueTaxes =
        taxes?.filter((tax) => new Date(tax.due_date) < now && tax.status !== "payment_completed").length || 0

      const completedTaxSum = completedTaxes.reduce((sum, tax) => sum + (tax.tax_amount || 0), 0)

      console.log("[v0] Final statistics:", {
        totalTaxes,
        totalAmount,
        overdueTaxes,
        completedTaxSum,
        byStatusCount: byStatus.length,
        byTypeCount: byType.length,
      })

      setStats({
        totalTaxes,
        totalAmount,
        byType,
        byStatus,
        byMonth,
        byStation,
        overdueTaxes,
        completedTaxSum,
      })
    } catch (error) {
      console.error("[v0] Error fetching statistics:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthRangeChange = () => {
    const startDate = new Date(monthRange.startYear, monthRange.startMonth - 1, 1)
    const endDate = new Date(monthRange.endYear, monthRange.endMonth, 0) // Last day of the month

    setLoading(true)
    setIsFiltered(true)
    fetchStatistics(supabase, startDate, endDate)
  }

  const resetDateFilter = () => {
    setMonthRange({
      startYear: new Date().getFullYear(),
      startMonth: 1,
      endYear: new Date().getFullYear(),
      endMonth: 12,
    })
    setIsFiltered(false)
    setLoading(true)
    fetchStatistics(supabase)
  }

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
      years.push(year)
    }
    return years
  }

  const monthOptions = [
    { value: 1, label: "1월" },
    { value: 2, label: "2월" },
    { value: 3, label: "3월" },
    { value: 4, label: "4월" },
    { value: 5, label: "5월" },
    { value: 6, label: "6월" },
    { value: 7, label: "7월" },
    { value: 8, label: "8월" },
    { value: 9, label: "9월" },
    { value: 10, label: "10월" },
    { value: 11, label: "11월" },
    { value: 12, label: "12월" },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="flex-1 min-w-[200px] max-w-[280px]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-20 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
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

  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">통계 분석</h2>
          <p className="text-muted-foreground">세금 및 충전소 데이터 통계</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 p-2 border rounded-md bg-background">
            <span className="text-sm text-muted-foreground">시작:</span>
            <select
              value={monthRange.startYear}
              onChange={(e) => setMonthRange((prev) => ({ ...prev, startYear: Number.parseInt(e.target.value) }))}
              className="bg-transparent border-none outline-none text-sm"
            >
              {generateYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <select
              value={monthRange.startMonth}
              onChange={(e) => setMonthRange((prev) => ({ ...prev, startMonth: Number.parseInt(e.target.value) }))}
              className="bg-transparent border-none outline-none text-sm"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-muted-foreground">~</span>

          <div className="flex items-center gap-2 p-2 border rounded-md bg-background">
            <span className="text-sm text-muted-foreground">끝:</span>
            <select
              value={monthRange.endYear}
              onChange={(e) => setMonthRange((prev) => ({ ...prev, endYear: Number.parseInt(e.target.value) }))}
              className="bg-transparent border-none outline-none text-sm"
            >
              {generateYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <select
              value={monthRange.endMonth}
              onChange={(e) => setMonthRange((prev) => ({ ...prev, endMonth: Number.parseInt(e.target.value) }))}
              className="bg-transparent border-none outline-none text-sm"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleMonthRangeChange} size="sm">
            적용
          </Button>

          {isFiltered && (
            <Button variant="ghost" onClick={resetDateFilter} size="sm">
              전체 기간
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[200px] max-w-[280px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 세금 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTaxes.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">등록된 전체 세금</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[200px] max-w-[280px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 세금 금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩{stats.totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">전체 세금 합계</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[200px] max-w-[280px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">연체 세금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdueTaxes}</div>
            <p className="text-xs text-muted-foreground">납부 기한 초과</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[200px] max-w-[280px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료 세금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₩{stats.completedTaxSum.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">납부 완료된 세금 합계</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="type" className="space-y-4">
        <TabsList>
          <TabsTrigger value="type">세금 유형별</TabsTrigger>
          <TabsTrigger value="status">상태별</TabsTrigger>
          <TabsTrigger value="monthly">월별 추이</TabsTrigger>
          <TabsTrigger value="station">충전소별</TabsTrigger>
        </TabsList>

        <TabsContent value="type" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Card className="flex-1 min-w-[400px]">
              <CardHeader>
                <CardTitle>세금 유형별 건수</CardTitle>
                <CardDescription>유형별 세금 등록 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.byType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, count }) => `${type}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.byType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-[400px]">
              <CardHeader>
                <CardTitle>세금 유형별 금액</CardTitle>
                <CardDescription>유형별 세금 금액 분포</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.byType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, "금액"]} />
                    <Bar dataKey="amount" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Card className="flex-1 min-w-[400px]">
              <CardHeader>
                <CardTitle>상태별 건수</CardTitle>
                <CardDescription>세금 처리 상태 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count }) => `${status}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-[400px]">
              <CardHeader>
                <CardTitle>상태별 금액</CardTitle>
                <CardDescription>상태별 세금 금액 분포</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.byStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(0)}M`} />
                    <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, "금액"]} />
                    <Bar dataKey="amount" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>월별 세금 추이</CardTitle>
              <CardDescription>월별 세금 등록 및 금액 변화</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" tickFormatter={(value) => `${value}`} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `₩${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "count" ? `${value}건` : `₩${Number(value).toLocaleString()}`,
                      name === "count" ? "건수" : "금액",
                    ]}
                  />
                  <Bar yAxisId="left" dataKey="count" fill="#0ea5e9" name="count" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="amount"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="amount"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="station" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>충전소별 세금 현황</CardTitle>
              <CardDescription>충전소별 세금 등록 건수 (상위 10개)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={stats.byStation} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="station" type="category" width={120} />
                  <Tooltip formatter={(value) => [`${value}건`, "세금 건수"]} />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

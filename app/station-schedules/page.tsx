"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertTriangle, Save, Building2, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ChargingStation {
  id: string
  station_name: string
  location: string
  address: string
  status: string
  canopy_installed: boolean
}

interface StationSchedule {
  id: string
  station_id: string
  use_approval_enabled: boolean
  use_approval_date: string | null
  safety_inspection_date: string | null
  created_at: string
  updated_at: string
}

interface StationWithSchedule extends ChargingStation {
  schedule?: StationSchedule
}

export default function StationSchedulesPage() {
  const [stations, setStations] = useState<StationWithSchedule[]>([])
  const [schedules, setSchedules] = useState<StationSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingStationId, setSavingStationId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>("viewer")
  const { toast } = useToast()

  const supabase = createClient()
  const isAdmin = userRole === "admin"

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // 사용자 역할 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()
        
        if (userData) {
          setUserRole(userData.role)
        }
      }

      // 일정이 없는 충전소만 조회 (캐노피 설치된 충전소 우선)
      const { data: stationsData } = await supabase
        .from("charging_stations")
        .select("*")
        .order("canopy_installed", { ascending: false })
        .order("created_at", { ascending: false })

      // 일정 목록 조회
      const { data: schedulesData } = await supabase
        .from("station_schedules")
        .select("*")

      if (stationsData) {
        // 일정이 없는 충전소만 필터링
        const stationsWithoutSchedules = stationsData.filter(station => 
          !schedulesData?.some(schedule => schedule.station_id === station.id)
        )

        // 충전소와 일정 데이터 결합
        const stationsWithSchedules = stationsWithoutSchedules.map(station => ({
          ...station,
          schedule: {
            id: "",
            station_id: station.id,
            use_approval_enabled: false,
            use_approval_date: null,
            safety_inspection_date: null,
            created_at: "",
            updated_at: ""
          }
        }))
        setStations(stationsWithSchedules)
      }

      if (schedulesData) {
        setSchedules(schedulesData)
      }

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "오류",
        description: "데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleScheduleChange = (stationId: string, field: string, value: any) => {
    setStations(prev => prev.map(station => {
      if (station.id === stationId) {
        const updatedSchedule = {
          ...station.schedule!,
          [field]: value
        }
        return {
          ...station,
          schedule: updatedSchedule
        }
      }
      return station
    }))
  }

  const handleSaveStation = async (station: StationWithSchedule) => {
    if (!isAdmin) return

    setSavingStationId(station.id)
    try {
      const { schedule } = station
      if (!schedule) return

      const { use_approval_enabled, use_approval_date, safety_inspection_date } = schedule

      // 유효성 검사 - 1개 날짜만 입력해도 저장 가능
      let hasValidDate = false
      
      // 캐노피가 설치된 경우 사용 승인일 체크 (use_approval_enabled가 true이고 날짜가 입력된 경우)
      if (station.canopy_installed && use_approval_enabled && use_approval_date) {
        hasValidDate = true
      }
      
      // 안전 점검일 체크 (항상 가능)
      if (safety_inspection_date) {
        hasValidDate = true
      }
      
      // 캐노피가 없는 경우 안전 점검일은 자동으로 설정되므로 허용
      if (!station.canopy_installed) {
        hasValidDate = true
      }

      // 최소 1개 날짜는 입력되어야 함
      if (!hasValidDate) {
        toast({
          title: "입력 필요",
          description: "사용 승인일 또는 안전 점검일 중 최소 1개는 입력해주세요.",
          variant: "destructive",
        })
        return
      }

      // 안전 점검일 자동 생성 (캐노피가 없는 경우)
      let finalSafetyInspectionDate = safety_inspection_date
      if (!station.canopy_installed && !safety_inspection_date) {
        // 캐노피가 없는 경우 오늘 날짜로 안전 점검일 자동 설정
        finalSafetyInspectionDate = new Date().toISOString().split('T')[0]
      }

      // 일정 생성
      const { error } = await supabase
        .from("station_schedules")
        .insert([{
          station_id: station.id,
          use_approval_enabled,
          use_approval_date: use_approval_enabled ? use_approval_date : null,
          safety_inspection_date: finalSafetyInspectionDate,
        }])

      if (error) throw error

      // 취득세 생성 (사용 승인일과 안전 점검일 각각)
      
      // 1. 사용 승인일 → 캐노피 취득세
      if (use_approval_enabled && use_approval_date) {
        const approvalDate = new Date(use_approval_date)
        const dueDate = new Date(approvalDate)
        dueDate.setDate(dueDate.getDate() + 60) // 60일 후

        // 기존 캐노피 취득세가 있는지 확인
        const { data: existingCanopyTax } = await supabase
          .from("taxes")
          .select("id")
          .eq("station_id", station.id)
          .eq("notes", "캐노피 취득세 (사용 승인일 기준)")
          .single()

        if (!existingCanopyTax) {
          const { error: canopyTaxError } = await supabase
            .from("taxes")
            .insert([{
              station_id: station.id,
              tax_type: "acquisition",
              tax_amount: 0,
              due_date: dueDate.toISOString().split('T')[0],
              status: "payment_scheduled",
              notes: "캐노피 취득세 (사용 승인일 기준)",
            }])

          if (canopyTaxError) {
            console.error("Canopy tax creation error:", canopyTaxError)
          } else {
            console.log(`캐노피 취득세 생성됨: ${station.station_name}`)
          }
        } else {
          console.log(`캐노피 취득세 이미 존재: ${station.station_name}`)
        }
      }

      // 2. 안전 점검일 → 충전기 취득세
      if (finalSafetyInspectionDate) {
        const inspectionDate = new Date(finalSafetyInspectionDate)
        const dueDate = new Date(inspectionDate)
        dueDate.setDate(dueDate.getDate() + 60) // 60일 후

        // 기존 충전기 취득세가 있는지 확인
        const { data: existingChargerTax } = await supabase
          .from("taxes")
          .select("id")
          .eq("station_id", station.id)
          .eq("notes", "충전기 취득세 (안전 점검일 기준)")
          .single()

        if (!existingChargerTax) {
          const { error: chargerTaxError } = await supabase
            .from("taxes")
            .insert([{
              station_id: station.id,
              tax_type: "acquisition",
              tax_amount: 0,
              due_date: dueDate.toISOString().split('T')[0],
              status: "payment_scheduled",
              notes: "충전기 취득세 (안전 점검일 기준)",
            }])

          if (chargerTaxError) {
            console.error("Charger tax creation error:", chargerTaxError)
          } else {
            console.log(`충전기 취득세 생성됨: ${station.station_name}`)
          }
        } else {
          console.log(`충전기 취득세 이미 존재: ${station.station_name}`)
        }
      }

      // 2개 날짜 모두 입력된 경우에만 리스트에서 제거
      const hasUseApproval = use_approval_enabled && use_approval_date
      const hasSafetyInspection = finalSafetyInspectionDate
      
      if (hasUseApproval && hasSafetyInspection) {
        // 2개 날짜 모두 입력된 경우 리스트에서 제거
        setStations(prev => prev.filter(s => s.id !== station.id))
        toast({
          title: "성공",
          description: `${station.station_name} 일정이 완전히 저장되었습니다.`,
        })
      } else {
        // 1개 날짜만 입력된 경우 리스트에서 제거하지 않음
        toast({
          title: "성공",
          description: `${station.station_name} 일정이 부분적으로 저장되었습니다.`,
        })
      }

      // 데이터 새로고침 (저장된 일정이 있는 충전소는 리스트에서 제외)
      await fetchData()

    } catch (error) {
      console.error("Error saving schedule:", error)
      toast({
        title: "오류",
        description: "일정 저장에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setSavingStationId(null)
    }
  }

  const getScheduleStatus = (station: StationWithSchedule) => {
    const { schedule } = station
    if (!schedule) return { status: "empty", message: "일정 미입력" }

    const hasUseApproval = schedule.use_approval_enabled && schedule.use_approval_date
    const hasSafetyInspection = schedule.safety_inspection_date

    if (hasUseApproval && hasSafetyInspection) {
      return { status: "complete", message: "완료" }
    } else if (hasUseApproval || hasSafetyInspection) {
      return { status: "partial", message: "부분 입력" }
    } else {
      return { status: "empty", message: "미입력" }
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">사업 일정</h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">사업 일정</h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stations.map((station) => {
          const scheduleStatus = getScheduleStatus(station)
          const { schedule } = station

          return (
            <Card key={station.id} className="relative">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{station.station_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {station.canopy_installed && (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        캐노피
                      </Badge>
                    )}
                    <Badge 
                      className={
                        scheduleStatus.status === "complete" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : scheduleStatus.status === "partial"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                      }
                    >
                      {scheduleStatus.message}
                    </Badge>
                  </div>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{station.location}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 사용 승인일 - 캐노피 설치된 경우에만 표시 */}
                {station.canopy_installed && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      사용 승인일 *
                    </Label>
                    <Input 
                      type="date"
                      value={schedule?.use_approval_date || ""}
                      onChange={(e) => {
                        const dateValue = e.target.value
                        // 사용 승인일을 입력하면 자동으로 use_approval_enabled를 true로 설정
                        if (dateValue) {
                          handleScheduleChange(station.id, "use_approval_enabled", true)
                        }
                        handleScheduleChange(station.id, "use_approval_date", dateValue)
                      }}
                      disabled={!isAdmin}
                      className="text-sm"
                    />
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      ✓ 사용 승인일 입력 시 캐노피 취득세 자동 생성 (60일 후 납부 기한)
                    </p>
                  </div>
                )}

                {/* 안전 점검일 - 항상 표시 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm">
                    <AlertTriangle className="h-3 w-3" />
                    안전 점검일 *
                  </Label>
                  <Input 
                    type="date"
                    value={schedule?.safety_inspection_date || ""}
                    onChange={(e) => 
                      handleScheduleChange(station.id, "safety_inspection_date", e.target.value)
                    }
                    disabled={!isAdmin}
                    className="text-sm"
                  />
                  {!station.canopy_installed ? (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ 캐노피 미설치: 저장 시 오늘 날짜로 자동 설정
                    </p>
                  ) : (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      ✓ 안전 점검일 입력 시 충전기 취득세 자동 생성 (60일 후 납부 기한)
                    </p>
                  )}
                </div>

                {/* 저장 버튼 */}
                <div className="pt-2">
                  <Button 
                    onClick={() => handleSaveStation(station)}
                    disabled={!isAdmin || savingStationId === station.id}
                    className="w-full gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingStationId === station.id ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {stations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">모든 충전소 일정이 등록되었습니다</h3>
            <p className="text-muted-foreground text-center">
              새로운 충전소가 등록되면 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { Calendar, AlertTriangle } from "lucide-react"

interface Station {
  id: string
  station_name: string
  location: string
  address: string | null
  status: "operating" | "planned" | "terminated"
  canopy_installed: boolean
  created_at: string
  updated_at: string
}

const statusLabels = {
  operating: "운영중",
  planned: "운영예정",
  terminated: "운영종료",
}

const statusColors = {
  operating: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
}

export function StationsClient() {
  const [stations, setStations] = useState<Station[]>([])
  const [userRole, setUserRole] = useState<string>("")
  const [actorName, setActorName] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<Station | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(24)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)

        const { data: profile } = await supabase.from("users").select("role, name, email").eq("id", user.id).single()

        if (profile) {
          setUserRole(profile.role)
          setActorName(profile.name || profile.email || "")
        }

        const { data: stationsData } = await supabase
          .from("charging_stations")
          .select("*")
          .order("created_at", { ascending: false })

        if (stationsData) {
          console.log("[v0] Stations: Total stations loaded:", stationsData.length)
          console.log(
            "[v0] Stations: Station statuses:",
            stationsData.map((s) => s.status),
          )

          const operatingCount = stationsData.filter((s) => s.status === "operating").length
          const plannedCount = stationsData.filter((s) => s.status === "planned").length
          const terminatedCount = stationsData.filter((s) => s.status === "terminated").length

          console.log(
            "[v0] Stations: Operating:",
            operatingCount,
            "Planned:",
            plannedCount,
            "Terminated:",
            terminatedCount,
          )
          console.log("[v0] Stations: Sample station data:", stationsData.slice(0, 3))

          setStations(stationsData)
        } else {
          console.log("[v0] Stations: No station data received")
        }
      } catch (error) {
        console.error("[v0] Stations: Error fetching data:", error)
      } finally {
        setIsInitialLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const isAdmin = userRole === "admin"

  // 일정 정보 컴포넌트
  const StationScheduleInfo = ({ stationId }: { stationId: string }) => {
    const [schedule, setSchedule] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const fetchSchedule = async () => {
        try {
          const { data } = await supabase
            .from("station_schedules")
            .select("*")
            .eq("station_id", stationId)
            .single()
          
          setSchedule(data)
        } catch (error) {
          // 일정이 없는 경우는 정상
        } finally {
          setLoading(false)
        }
      }

      fetchSchedule()
    }, [stationId])

    if (loading) return null
    if (!schedule) return null

    return (
      <div className="space-y-2 text-xs">
        {schedule.use_approval_enabled && schedule.use_approval_date && (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Calendar className="h-3 w-3" />
            <span>사용승인: {new Date(schedule.use_approval_date).toLocaleDateString()}</span>
          </div>
        )}
        {schedule.safety_inspection_date && (
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            <span>안전점검: {new Date(schedule.safety_inspection_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    )
  }

  const filteredStations = useMemo(() => {
    if (!searchTerm) return stations

    return stations.filter(
      (station) =>
        station.station_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        station.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (station.address && station.address.toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }, [stations, searchTerm])

  const operatingStations = useMemo(() => {
    return filteredStations.filter((station) => station.status === "operating")
  }, [filteredStations])

  const nonOperatingStations = useMemo(() => {
    return filteredStations.filter((station) => station.status !== "operating")
  }, [filteredStations])

  const paginatedOperatingStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return operatingStations.slice(startIndex, endIndex)
  }, [operatingStations, currentPage, itemsPerPage])

  const paginatedNonOperatingStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return nonOperatingStations.slice(startIndex, endIndex)
  }, [nonOperatingStations, currentPage, itemsPerPage])

  const totalPages = useMemo(() => {
    const totalItems = Math.max(operatingStations.length, nonOperatingStations.length)
    return Math.ceil(totalItems / itemsPerPage)
  }, [operatingStations.length, nonOperatingStations.length, itemsPerPage])

  const handleCreateStation = async (formData: FormData) => {
    if (!isAdmin) {
      toast({
        title: "권한 없음",
        description: "관리자만 충전소를 등록할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    const stationData = {
      station_name: formData.get("station_name") as string,
      location: formData.get("location") as string,
      address: (formData.get("address") as string) || null,
      status: formData.get("status") as "operating" | "planned" | "terminated",
      canopy_installed: formData.get("canopy_installed") === "on",
      created_by: userId,
    }

    const { data, error } = await supabase.from("charging_stations").insert([stationData]).select().single()

    if (error) {
      toast({
        title: "오류",
        description: "충전소 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setStations([data, ...stations])
      
      // 신규 충전소에 대한 사업 일정 알림 생성
      console.log("=== 충전소 생성 성공, 알림 생성 시작 ===")
      console.log("충전소 데이터:", data)
      console.log("사용자 ID:", userId)
      console.log("캐노피 설치 여부:", data.canopy_installed)
      
      const notifications = []
      
      // 사용 승인일 알림 (캐노피 설치된 경우에만)
      if (data.canopy_installed) {
        const useApprovalNotification = {
          user_id: userId,
          title: "사업 일정 입력 필요",
          message: `${data.station_name}의 사용 승인일 입력이 필요합니다.`,
          type: "warning",
          read: false
        }
        notifications.push(useApprovalNotification)
        console.log("사용 승인일 알림 추가:", useApprovalNotification)
      }
      
      // 안전 점검일 알림 (모든 충전소)
      const safetyInspectionNotification = {
        user_id: userId,
        title: "사업 일정 입력 필요",
        message: `${data.station_name}의 안전 점검일 입력이 필요합니다.`,
        type: "warning",
        read: false
      }
      notifications.push(safetyInspectionNotification)
      console.log("안전 점검일 알림 추가:", safetyInspectionNotification)
      
      console.log("생성할 알림 목록:", notifications)
      
      // 알림 생성
      const { data: insertedNotifications, error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications)
        .select()
      
      if (notificationError) {
        console.error("사업 일정 알림 생성 오류:", notificationError)
        console.error("오류 상세:", JSON.stringify(notificationError, null, 2))
      } else {
        console.log(`사업 일정 알림 생성 성공: ${data.station_name} (${notifications.length}개)`)
        console.log("삽입된 알림:", insertedNotifications)
      }
      
      // audit log: create station
      logAudit({
        menu: "stations",
        action: "create",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `충전소 등록: ${data.station_name}`,
        targetTable: "charging_stations",
        targetId: data.id,
      })
      setIsCreateDialogOpen(false)
      toast({
        title: "성공",
        description: "충전소가 성공적으로 등록되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const handleUpdateStation = async (formData: FormData) => {
    if (!isAdmin || !editingStation) return

    setIsLoading(true)

    const stationData = {
      station_name: formData.get("station_name") as string,
      location: formData.get("location") as string,
      address: (formData.get("address") as string) || null,
      status: formData.get("status") as "operating" | "planned" | "terminated",
      canopy_installed: formData.get("canopy_installed") === "on",
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("charging_stations")
      .update(stationData)
      .eq("id", editingStation.id)
      .select()
      .single()

    if (error) {
      toast({
        title: "오류",
        description: "충전소 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      // 강제로 상태 업데이트
      setStations(prevStations => prevStations.map((s) => (s.id === editingStation.id ? data : s)))
      // audit log: update station
      logAudit({
        menu: "stations",
        action: "update",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `충전소 수정: ${data.station_name}`,
        targetTable: "charging_stations",
        targetId: data.id,
      })
      setEditingStation(null)
      toast({
        title: "성공",
        description: "충전소가 성공적으로 수정되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const handleUpdateStationWithSchedule = async (formData: FormData, scheduleData: any) => {
    if (!isAdmin || !editingStation) return

    setIsLoading(true)

    try {
      // 1. 충전소 정보 업데이트
      const stationData = {
        station_name: formData.get("station_name") as string,
        location: formData.get("location") as string,
        address: (formData.get("address") as string) || null,
        status: formData.get("status") as "operating" | "planned" | "terminated",
        canopy_installed: formData.get("canopy_installed") === "on",
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("charging_stations")
        .update(stationData)
        .eq("id", editingStation.id)
        .select()
        .single()

      if (error) throw error

      // 2. 일정 정보 업데이트
      const { use_approval_enabled, use_approval_date, safety_inspection_date } = scheduleData

      // 기존 일정이 있는지 확인
      const { data: existingSchedule } = await supabase
        .from("station_schedules")
        .select("id")
        .eq("station_id", editingStation.id)
        .single()

      if (existingSchedule) {
        // 기존 일정 업데이트
        const { error: scheduleError } = await supabase
          .from("station_schedules")
          .update({
            use_approval_enabled,
            use_approval_date: use_approval_enabled ? use_approval_date : null,
            safety_inspection_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSchedule.id)

        if (scheduleError) throw scheduleError
      } else {
        // 새 일정 생성
        const { error: scheduleError } = await supabase
          .from("station_schedules")
          .insert([{
            station_id: editingStation.id,
            use_approval_enabled,
            use_approval_date: use_approval_enabled ? use_approval_date : null,
            safety_inspection_date,
          }])

        if (scheduleError) throw scheduleError
      }

      // 3. 취득세 생성 (새로 입력된 날짜에 대해서만)
      if (use_approval_enabled && use_approval_date) {
        const approvalDate = new Date(use_approval_date)
        const dueDate = new Date(approvalDate)
        dueDate.setDate(dueDate.getDate() + 60) // 60일 후

        const { error: canopyTaxError } = await supabase
          .from("taxes")
          .insert([{
            station_id: editingStation.id,
            tax_type: "acquisition",
            tax_amount: 0,
            due_date: dueDate.toISOString().split('T')[0],
            status: "payment_scheduled",
            notes: "캐노피 취득세 (사용 승인일 기준)",
          }])

        if (canopyTaxError) {
          console.error("Canopy tax creation error:", canopyTaxError)
        } else {
          console.log(`캐노피 취득세 생성됨: ${editingStation.station_name}`)
        }
      }

      if (safety_inspection_date) {
        const inspectionDate = new Date(safety_inspection_date)
        const dueDate = new Date(inspectionDate)
        dueDate.setDate(dueDate.getDate() + 60) // 60일 후

        const { error: chargerTaxError } = await supabase
          .from("taxes")
          .insert([{
            station_id: editingStation.id,
            tax_type: "acquisition",
            tax_amount: 0,
            due_date: dueDate.toISOString().split('T')[0],
            status: "payment_scheduled",
            notes: "충전기 취득세 (안전 점검일 기준)",
          }])

        if (chargerTaxError) {
          console.error("Charger tax creation error:", chargerTaxError)
        } else {
          console.log(`충전기 취득세 생성됨: ${editingStation.station_name}`)
        }
      }

      setStations(stations.map((s) => (s.id === editingStation.id ? data : s)))
      setEditingStation(null)
      toast({
        title: "성공",
        description: "충전소와 일정이 성공적으로 수정되었습니다.",
      })

    } catch (error) {
      console.error("Error updating station with schedule:", error)
      toast({
        title: "오류",
        description: "충전소 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteStation = async (stationId: string) => {
    if (!isAdmin) return

    setIsLoading(true)

    const { data: taxes, error: taxError } = await supabase
      .from("taxes")
      .select("id")
      .eq("station_id", stationId)
      .limit(1)

    if (taxError) {
      toast({
        title: "오류",
        description: "충전소 삭제 확인 중 오류가 발생했습니다.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    if (taxes && taxes.length > 0) {
      toast({
        title: "삭제 불가",
        description: "이 충전소에 등록된 세금이 있어 삭제할 수 없습니다. 먼저 관련 세금을 삭제해주세요.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const { error } = await supabase.from("charging_stations").delete().eq("id", stationId)

    if (error) {
      toast({
        title: "오류",
        description: "충전소 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setStations(stations.filter((s) => s.id !== stationId))
      // audit log: delete station
      logAudit({
        menu: "stations",
        action: "delete",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `충전소 삭제: ID ${stationId}`,
        targetTable: "charging_stations",
        targetId: stationId,
      })
      toast({
        title: "성공",
        description: "충전소가 성공적으로 삭제되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const StationForm = ({ station, onSubmit }: { station?: Station; onSubmit: (formData: FormData, scheduleData?: any) => void }) => {
    const [formData, setFormData] = useState({
      station_name: station?.station_name || "",
      location: station?.location || "",
      address: station?.address || "",
      status: station?.status || "operating",
      canopy_installed: station?.canopy_installed || false,
    })
    const [scheduleData, setScheduleData] = useState({
      use_approval_enabled: false,
      use_approval_date: "",
      safety_inspection_date: "",
    })
    const [scheduleLoading, setScheduleLoading] = useState(false)

    // 일정 데이터 로드
    useEffect(() => {
      if (station?.id) {
        setScheduleLoading(true)
        const fetchSchedule = async () => {
          try {
            const { data } = await supabase
              .from("station_schedules")
              .select("*")
              .eq("station_id", station.id)
              .single()
            
            if (data) {
              setScheduleData({
                use_approval_enabled: data.use_approval_enabled || false,
                use_approval_date: data.use_approval_date || "",
                safety_inspection_date: data.safety_inspection_date || "",
              })
            }
          } catch (error) {
            // 일정이 없는 경우는 정상
          } finally {
            setScheduleLoading(false)
          }
        }
        fetchSchedule()
      }
    }, [station?.id])

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      const form = new FormData()
      form.append("station_name", formData.station_name)
      form.append("location", formData.location)
      form.append("address", formData.address)
      form.append("status", formData.status)
      if (formData.canopy_installed) {
        form.append("canopy_installed", "on")
      }
      
      // 기존 충전소 수정 시 일정 데이터도 함께 전송
      if (station?.id) {
        onSubmit(form, scheduleData)
      } else {
        onSubmit(form)
      }
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="station_name">충전소명 *</Label>
          <Input
            id="station_name"
            name="station_name"
            value={formData.station_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, station_name: e.target.value }))}
            placeholder="충전소 이름을 입력하세요"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">주소 *</Label>
          <Textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="주소를 입력하세요"
            rows={3}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">상태 *</Label>
          <Select
            name="status"
            value={formData.status}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, status: value as "operating" | "planned" | "terminated" }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="상태를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operating">운영중</SelectItem>
              <SelectItem value="planned">운영예정</SelectItem>
              <SelectItem value="terminated">운영종료</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="canopy_installed"
              name="canopy_installed"
              checked={formData.canopy_installed}
              onCheckedChange={(checked) => 
                setFormData((prev) => ({ ...prev, canopy_installed: checked as boolean }))
              }
              className="border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <Label htmlFor="canopy_installed">캐노피 설치</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            캐노피가 설치된 충전소는 사용 승인일 입력이 필요합니다.
          </p>
        </div>

        {/* 일정 수정 섹션 (기존 충전소 수정 시에만 표시) */}
        {station?.id && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold">일정 관리</h3>
            
            {scheduleLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">일정 정보를 불러오는 중...</p>
              </div>
            ) : (
              <>
                {/* 사용 승인일 - 캐노피 설치된 경우에만 표시 */}
                {formData.canopy_installed && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="use_approval_enabled"
                        checked={scheduleData.use_approval_enabled}
                        onCheckedChange={(checked) => 
                          setScheduleData((prev) => ({ ...prev, use_approval_enabled: checked as boolean }))
                        }
                        className="border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label htmlFor="use_approval_enabled">사용 승인일 활성화</Label>
                    </div>
                    {scheduleData.use_approval_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="use_approval_date">사용 승인일 *</Label>
                        <Input 
                          id="use_approval_date"
                          type="date"
                          value={scheduleData.use_approval_date}
                          onChange={(e) => 
                            setScheduleData((prev) => ({ ...prev, use_approval_date: e.target.value }))
                          }
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 안전 점검일 - 항상 표시 */}
                <div className="space-y-2">
                  <Label htmlFor="safety_inspection_date">안전 점검일 *</Label>
                  <Input 
                    id="safety_inspection_date"
                    type="date"
                    value={scheduleData.safety_inspection_date}
                    onChange={(e) => 
                      setScheduleData((prev) => ({ ...prev, safety_inspection_date: e.target.value }))
                    }
                    className="text-sm"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateDialogOpen(false)
              setEditingStation(null)
            }}
          >
            취소
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "처리 중..." : station ? "수정" : "등록"}
          </Button>
        </div>
      </form>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">충전소 관리</h2>
        </div>

        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">충전소 등록</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>새 충전소 등록</DialogTitle>
                <DialogDescription>새로운 충전소 정보를 입력해주세요.</DialogDescription>
              </DialogHeader>
              <StationForm onSubmit={handleCreateStation} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Input
            placeholder="충전소명, 주소로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-4 border-zinc-600"
          />
        </div>
      </div>

      {filteredStations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "검색 결과가 없습니다" : "등록된 충전소가 없습니다"}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchTerm
                ? "다른 검색어로 시도해보세요"
                : isAdmin
                  ? "새 충전소를 등록해보세요"
                  : "관리자가 충전소를 등록할 때까지 기다려주세요"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {paginatedOperatingStations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">운영중인 충전소</h3>
                <Badge className={statusColors["operating"]}>{operatingStations.length}개</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedOperatingStations.map((station) => (
                  <Card key={station.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{station.station_name}</CardTitle>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            {station.address || station.location}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={statusColors[station.status]}>{statusLabels[station.status]}</Badge>
                          {station.canopy_installed && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs">
                              캐노피
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* 일정 정보 표시 */}
                      <StationScheduleInfo stationId={station.id} />
                      
                      {isAdmin && (
                        <div className="flex gap-2 mt-3">
                          <Dialog
                            open={editingStation?.id === station.id}
                            onOpenChange={(open) => {
                              if (!open) setEditingStation(null)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 bg-transparent"
                                onClick={() => setEditingStation(station)}
                              >
                                수정
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>충전소 수정</DialogTitle>
                                <DialogDescription>충전소 정보와 일정을 수정해주세요.</DialogDescription>
                              </DialogHeader>
                              <StationForm station={editingStation || undefined} onSubmit={handleUpdateStationWithSchedule} />
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-destructive hover:bg-destructive hover:text-white bg-transparent"
                              >
                                삭제
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>충전소 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{station.station_name}" 충전소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  {"\n\n"}
                                  참고: 이 충전소에 등록된 세금이 있는 경우 삭제할 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteStation(station.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {paginatedNonOperatingStations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold opacity-75">운영예정/운영종료</h3>
                <Badge className={statusColors["planned"]}>{nonOperatingStations.length}개</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-75">
                {paginatedNonOperatingStations.map((station) => (
                  <Card key={station.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{station.station_name}</CardTitle>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            {station.address || station.location}
                          </div>
                        </div>
                        <Badge className={statusColors[station.status]}>{statusLabels[station.status]}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Dialog
                            open={editingStation?.id === station.id}
                            onOpenChange={(open) => {
                              if (!open) setEditingStation(null)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 bg-transparent"
                                onClick={() => setEditingStation(station)}
                              >
                                수정
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>충전소 수정</DialogTitle>
                                <DialogDescription>충전소 정보를 수정해주세요.</DialogDescription>
                              </DialogHeader>
                              <StationForm station={editingStation || undefined} onSubmit={handleUpdateStation} />
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-destructive hover:bg-destructive hover:text-white bg-transparent"
                              >
                                삭제
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>충전소 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{station.station_name}" 충전소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  {"\n\n"}
                                  참고: 이 충전소에 등록된 세금이 있는 경우 삭제할 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteStation(station.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                이전
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        총 {stations.length}개의 충전소
        {searchTerm && ` (${filteredStations.length}개 검색됨)`}
        {totalPages > 1 && ` - ${currentPage}/${totalPages} 페이지`}
      </div>
    </div>
  )
}

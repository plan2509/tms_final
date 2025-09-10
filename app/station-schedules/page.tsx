"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertTriangle, Save, Building2, CheckCircle, XCircle, Shield, Zap } from "lucide-react"
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

interface ScheduleCard {
  id: string
  station: ChargingStation
  type: 'use_approval' | 'safety_inspection'
  date: string | null
  completed: boolean
}

export default function StationSchedulesPage() {
  const [scheduleCards, setScheduleCards] = useState<ScheduleCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingCardId, setSavingCardId] = useState<string | null>(null)
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
        const cards: ScheduleCard[] = []

        // 오늘 날짜 기준으로 신규 충전소 구분 (예: 최근 7일 이내)
        const today = new Date()
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

        stationsData.forEach(station => {
          const existingSchedule = schedulesData?.find(s => s.station_id === station.id)
          const stationCreatedAt = new Date(station.created_at)
          
          // 신규 충전소: 최근 7일 이내에 생성된 경우
          const isNewStation = stationCreatedAt > sevenDaysAgo
          
          if (isNewStation) {
            // 사용 승인일 카드 (캐노피 설치된 경우에만)
            if (station.canopy_installed) {
              const hasUseApproval = existingSchedule?.use_approval_enabled && existingSchedule?.use_approval_date
              cards.push({
                id: `${station.id}-use_approval`,
                station,
                type: 'use_approval',
                date: existingSchedule?.use_approval_date || null,
                completed: hasUseApproval // 사용 승인일이 입력된 경우에만 완료
              })
            }

            // 안전 점검일 카드 (모든 충전소)
            const hasSafetyInspection = !!existingSchedule?.safety_inspection_date
            cards.push({
              id: `${station.id}-safety_inspection`,
              station,
              type: 'safety_inspection',
              date: existingSchedule?.safety_inspection_date || null,
              completed: hasSafetyInspection // 안전 점검일이 입력된 경우에만 완료
            })
          }
        })

        // 완료되지 않은 카드만 표시
        const incompleteCards = cards.filter(card => !card.completed)
        setScheduleCards(incompleteCards)

        // 알림은 충전소 생성 시점에 자동으로 생성되므로 여기서는 생성하지 않음
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

  const handleDateChange = (cardId: string, date: string) => {
    setScheduleCards(prev => prev.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          date
        }
      }
      return card
    }))
  }

  const handleSaveCard = async (card: ScheduleCard) => {
    if (!isAdmin) return

    // 날짜 입력 유효성 검사
    if (!card.date || card.date.trim() === '') {
      const typeName = card.type === 'use_approval' ? '사용 승인일' : '안전 점검일'
      toast({
        title: "입력 필요",
        description: `${typeName}을 입력해주세요.`,
        variant: "destructive",
      })
      return
    }

    setSavingCardId(card.id)
    try {
      const { station, type, date } = card

      // 기존 일정 조회
      const { data: existingSchedule } = await supabase
        .from("station_schedules")
        .select("*")
        .eq("station_id", station.id)
        .single()

      let scheduleData: any = {
        station_id: station.id,
        use_approval_enabled: false,
        use_approval_date: null,
        safety_inspection_date: null,
      }

      // 기존 일정이 있으면 기존 데이터 유지
      if (existingSchedule) {
        scheduleData = {
          ...existingSchedule,
          use_approval_enabled: existingSchedule.use_approval_enabled,
          use_approval_date: existingSchedule.use_approval_date,
          safety_inspection_date: existingSchedule.safety_inspection_date,
        }
      }

      // 현재 카드 타입에 따라 데이터 업데이트
      if (type === 'use_approval') {
        scheduleData.use_approval_enabled = true
        scheduleData.use_approval_date = date
      } else if (type === 'safety_inspection') {
        scheduleData.safety_inspection_date = date
      }

      // 일정 저장 또는 업데이트
      if (existingSchedule) {
        const { error } = await supabase
          .from("station_schedules")
          .update(scheduleData)
          .eq("id", existingSchedule.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("station_schedules")
          .insert([scheduleData])
        if (error) throw error
      }

      // 취득세 생성
      if (type === 'use_approval' && date) {
        // 캐노피 취득세 생성
        const approvalDate = new Date(date)
        const dueDate = new Date(approvalDate)
        dueDate.setDate(dueDate.getDate() + 60)

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
        }
      } else if (type === 'safety_inspection' && date) {
        // 충전기 취득세 생성
        const inspectionDate = new Date(date)
        const dueDate = new Date(inspectionDate)
        dueDate.setDate(dueDate.getDate() + 60)

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
        }
      }

      // 기존 일정 미입력 알림 삭제 (해당 충전소 관련)
      if (date) {
        const { error: deleteError } = await supabase
          .from("notifications")
          .delete()
          .ilike("message", `%${station.station_name}%`)
          .eq("notification_type", "auto")
        
        if (deleteError) {
          console.error("기존 미입력 알림 삭제 오류:", deleteError)
        } else {
          console.log(`기존 미입력 알림 삭제됨: ${station.station_name}`)
        }
      }

      // 알림 생성 (사업 일정 등록 완료 알림)
      if (date) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const typeName = type === 'use_approval' ? '사용 승인일' : '안전 점검일'
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert([{
              user_id: user.id,
              notification_type: "station_schedule",
              notification_date: new Date().toISOString().split('T')[0],
              notification_time: "10:00",
              title: "사업 일정 등록 완료",
              message: `${station.station_name} ${typeName}이 등록되었습니다.`,
              station_id: station.id,
              is_sent: false
            }])
          
          if (notificationError) {
            console.error("Notification creation error:", notificationError)
          } else {
            console.log(`사업 일정 등록 완료 알림 생성됨: ${station.station_name} ${typeName}`)
          }
        }
      }

      // 성공 메시지
      const typeName = type === 'use_approval' ? '사용 승인일' : '안전 점검일'
      toast({
        title: "성공",
        description: `${station.station_name} ${typeName}이 저장되었습니다.`,
      })

      // 데이터 새로고침 (완료된 카드는 리스트에서 제거됨)
      await fetchData()

    } catch (error) {
      console.error("Error saving schedule:", error)
      toast({
        title: "오류",
        description: "일정 저장에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setSavingCardId(null)
    }
  }

  const getCardInfo = (card: ScheduleCard) => {
    if (card.type === 'use_approval') {
      return {
        title: '사용 승인일',
        icon: Shield,
        description: '캐노피 사용 승인일을 입력하세요',
        taxInfo: '캐노피 취득세 자동 생성 (60일 후 납부 기한)',
        color: 'blue'
      }
    } else {
      return {
        title: '안전 점검일',
        icon: AlertTriangle,
        description: '안전 점검일을 입력하세요',
        taxInfo: '충전기 취득세 자동 생성 (60일 후 납부 기한)',
        color: 'orange'
      }
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
        {scheduleCards.map((card) => {
          const cardInfo = getCardInfo(card)
          const IconComponent = cardInfo.icon

          return (
            <Card key={card.id} className="relative">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-4 w-4 ${
                      cardInfo.color === 'blue' 
                        ? 'text-blue-600' 
                        : 'text-orange-600'
                    }`} />
                    <span>{cardInfo.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.station.canopy_installed && card.type === 'use_approval' && (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        캐노피
                      </Badge>
                    )}
                    <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                      {card.station.station_name}
                    </Badge>
                  </div>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{card.station.location}</p>
                <p className="text-xs text-muted-foreground">{cardInfo.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    날짜 입력 *
                  </Label>
                  <Input 
                    type="date"
                    value={card.date || ""}
                    onChange={(e) => handleDateChange(card.id, e.target.value)}
                    disabled={!isAdmin}
                    className="text-sm"
                    placeholder="날짜를 선택하세요"
                    required
                  />
                  <p className={`text-xs ${
                    cardInfo.color === 'blue' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    ✓ {cardInfo.taxInfo}
                  </p>
                </div>

                {/* 저장 버튼 */}
                <div className="pt-2">
                  <Button 
                    onClick={() => handleSaveCard(card)}
                    disabled={!isAdmin || !card.date || savingCardId === card.id}
                    className="w-full gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingCardId === card.id ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {scheduleCards.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">모든 일정이 등록되었습니다</h3>
            <p className="text-muted-foreground text-center">
              새로운 충전소가 등록되거나 일정이 필요하면 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
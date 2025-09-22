"use client"
import { useState, useMemo, useEffect, useRef } from "react"
import { DialogTrigger } from "@/components/ui/dialog"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Receipt, Building2, MoreVertical, ArrowRight, Calendar, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { FileText, Copy, Trash2, BarChart3 } from "lucide-react"
import * as XLSX from 'xlsx'

interface Tax {
  id: string
  station_id: string
  tax_type: "acquisition" | "property" | "other"
  tax_amount: number
  due_date: string
  tax_notice_number: string | null
  tax_year: number | null
  tax_period: string | null
  notes: string | null
  status: "accounting_review" | "payment_scheduled" | "payment_completed"
  payment_date?: string | null
  created_at: string
  updated_at: string
  charging_stations: {
    id: string
    station_name: string
    address: string
    location: string
  }
}

interface Station {
  id: string
  station_name: string
  address: string
  location: string
}

const taxTypeLabels = {
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
  accounting_review: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  payment_scheduled: "bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100",
  payment_completed: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100",
}

const getWorkflowSteps = (taxType: string, currentStatus: string) => {
  const defaultStatus = taxType === "acquisition" ? "accounting_review" : "payment_scheduled"
  const effectiveStatus = currentStatus || defaultStatus

  if (taxType === "acquisition") {
    const steps = ["accounting_review", "payment_scheduled", "payment_completed"]
    const currentIndex = steps.indexOf(effectiveStatus)
    return {
      steps: steps.map((step, index) => ({
        status: step,
        label: statusLabels[step as keyof typeof statusLabels],
        completed: index < currentIndex,
        current: index === currentIndex,
      })),
      nextStatus: currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null,
      prevStatus: currentIndex > 0 ? steps[currentIndex - 1] : null,
    }
  } else {
    const steps = ["payment_scheduled", "payment_completed"]
    const currentIndex = steps.indexOf(effectiveStatus)
    return {
      steps: steps.map((step, index) => ({
        status: step,
        label: statusLabels[step as keyof typeof statusLabels],
        completed: index < currentIndex,
        current: index === currentIndex,
      })),
      nextStatus: currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null,
      prevStatus: currentIndex > 0 ? steps[currentIndex - 1] : null,
    }
  }
}

export function TaxesClient() {
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [userRole, setUserRole] = useState<string>("viewer")
  const [actorName, setActorName] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTax, setEditingTax] = useState<Tax | null>(null)
  const [viewingTax, setViewingTax] = useState<Tax | null>(null)
  const [taxAttachments, setTaxAttachments] = useState<Array<{ id: string; file_name: string; size: number }>>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1)
  const [completedCurrentPage, setCompletedCurrentPage] = useState(1)
  const [sectionItemsPerPage] = useState(5) // 5 items per section
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [isShowingResults, setIsShowingResults] = useState(false)
  const [displayedText, setDisplayedText] = useState("")
  const [displayedSections, setDisplayedSections] = useState<Array<{ section: string; content: string }>>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // AI 이미지 분석 관련 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [extractedText, setExtractedText] = useState<any | null>(null)
  
  // 새로운 Excel 업로드 상태
  const [isExcelUploadOpen, setIsExcelUploadOpen] = useState(false)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  
  const [stationSearchTerm, setStationSearchTerm] = useState("")
  const [selectedStationId, setSelectedStationId] = useState("")
  const [showStationDropdown, setShowStationDropdown] = useState(false)
  const [newTax, setNewTax] = useState({
    tax_type: "",
    amount: 0,
    due_date: "",
    description: "",
  })
  const [isComposing, setIsComposing] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isComposing) {
        setDebouncedSearchTerm(stationSearchTerm)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [stationSearchTerm, isComposing])

  // fetchData 함수를 전역으로 이동
  const fetchData = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        router.push("/auth/login")
        return
      }

      setUserId(userData.user.id)

      const { data: profile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()
      setUserRole(profile?.role || "viewer")
      setActorName(profile?.name || userData.user.email || "")

      const { data: taxesData, error: taxesError } = await supabase
        .from("taxes")
        .select(`
          *,
          charging_stations (
            id,
            station_name,
            address,
            location
          )
        `)
        .order("created_at", { ascending: false })

      const { data: stationsData, error: stationsError } = await supabase
        .from("charging_stations")
        .select("id, station_name, address, location")
        .order("station_name")

      if (taxesError) {
        console.error("Error fetching taxes:", taxesError)
      } else {
        setTaxes(taxesData || [])
      }

      if (stationsError) {
        console.error("Error fetching stations:", stationsError)
      } else {
        setStations(stationsData || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsInitialLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [router, supabase])

  useEffect(() => {
    if (editingTax) {
      setNewTax({
        tax_type: editingTax.tax_type || "",
        amount: editingTax.tax_amount || 0,
        due_date: editingTax.due_date || "",
        description: editingTax.notes || "",
      })
    } else {
      // Reset core form values for new tax (do not clear station search here to avoid input resets)
      setNewTax({
        tax_type: "",
        amount: 0,
        due_date: "",
        description: "",
      })
    }
  }, [editingTax])

  // Update station name/id when editing an existing tax and stations are available
  useEffect(() => {
    if (editingTax?.station_id) {
      const station = stations.find((s) => s.id === editingTax.station_id)
      if (station) {
        setStationSearchTerm(station.station_name)
        setSelectedStationId(station.id)
      }
    }
  }, [editingTax, stations])

  // When opening the create dialog, clear station search fields only at that moment
  useEffect(() => {
    if (isCreateDialogOpen && !editingTax) {
      setStationSearchTerm("")
      setSelectedStationId("")
    }
  }, [isCreateDialogOpen, editingTax])

  const isAdmin = userRole === "admin"

  const filteredTaxes = useMemo(() => {
    let filtered = taxes || []

    if (searchTerm) {
      filtered = filtered.filter(
        (tax) =>
          tax.charging_stations?.station_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tax.tax_notice_number?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterType !== "all") {
      filtered = filtered.filter((tax) => tax.tax_type === filterType)
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((tax) => tax.status === filterStatus)
    }

    return filtered
  }, [taxes, searchTerm, filterType, filterStatus])

  const pendingTaxes = useMemo(() => {
    return filteredTaxes.filter((tax) => tax.status !== "payment_completed")
  }, [filteredTaxes])

  const completedTaxes = useMemo(() => {
    return filteredTaxes.filter((tax) => tax.status === "payment_completed")
  }, [filteredTaxes])

  const paginatedPendingTaxes = useMemo(() => {
    const startIndex = (pendingCurrentPage - 1) * sectionItemsPerPage
    const endIndex = startIndex + sectionItemsPerPage
    return pendingTaxes.slice(startIndex, endIndex)
  }, [pendingTaxes, pendingCurrentPage, sectionItemsPerPage])

  const paginatedCompletedTaxes = useMemo(() => {
    const startIndex = (completedCurrentPage - 1) * sectionItemsPerPage
    const endIndex = startIndex + sectionItemsPerPage
    return completedTaxes.slice(startIndex, endIndex)
  }, [completedTaxes, completedCurrentPage, sectionItemsPerPage])

  const pendingTotalPages = useMemo(() => {
    return Math.ceil(pendingTaxes.length / sectionItemsPerPage)
  }, [pendingTaxes.length, sectionItemsPerPage])

  const completedTotalPages = useMemo(() => {
    return Math.ceil(completedTaxes.length / sectionItemsPerPage)
  }, [completedTaxes.length, sectionItemsPerPage])

  // 새로운 Excel 업로드 함수
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: "파일 형식 오류",
        description: "Excel 파일(.xlsx, .xls)만 업로드 가능합니다.",
        variant: "destructive",
      })
      return
    }

    setIsProcessingExcel(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length < 2) {
        toast({
          title: "데이터 부족",
          description: "Excel 파일에 최소 2행(헤더 + 데이터)이 필요합니다.",
          variant: "destructive",
        })
        return
      }

      const headers = jsonData[0] as string[]
      const rows = jsonData.slice(1) as any[][]
      
      // 데이터 변환 및 빈 행 제거
      const processedData = rows.map((row, index) => {
        const rowData: any = {}
        headers.forEach((header, colIndex) => {
          rowData[header] = row[colIndex]
        })
        return { ...rowData, _rowIndex: index + 2 }
      }).filter(row => {
        // _rowIndex를 제외한 실제 데이터만 확인
        const dataValues = Object.entries(row)
          .filter(([key]) => key !== '_rowIndex')
          .map(([, value]) => value)
        
        // 모든 값이 비어있거나 null/undefined인 행 제거
        const hasValidData = dataValues.some(value => {
          if (value === null || value === undefined) return false
          if (typeof value === 'string') return value.trim() !== ''
          if (typeof value === 'number') return !isNaN(value)
          return true
        })
        
        return hasValidData
      })

      setExcelData(processedData)
      setIsExcelUploadOpen(true)
      
      toast({
        title: "Excel 파일 로드 완료",
        description: `${processedData.length}개의 데이터를 발견했습니다.`,
      })
    } catch (error) {
      console.error("Excel 파일 처리 오류:", error)
      toast({
        title: "파일 처리 오류",
        description: "Excel 파일을 읽는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingExcel(false)
    }
  }

  // 새로운 Excel 일괄 등록 함수
  const handleBulkTaxRegistration = async () => {
    if (!isAdmin) {
      toast({
        title: "권한 없음",
        description: "관리자만 세금을 등록할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    try {
      for (const row of excelData) {
        try {
          // 빈 행 체크
          const hasData = Object.values(row).some(value => 
            value !== null && value !== undefined && value !== '' && value !== 0
          )
          if (!hasData) continue

          // 충전소명 자동 찾기
          let stationName = ''
          let station = null
          
          for (const [key, value] of Object.entries(row)) {
            if (key.toLowerCase().includes('충전소') || 
                key.toLowerCase().includes('station') || 
                key.toLowerCase().includes('명')) {
              stationName = String(value).trim()
              if (stationName) {
                station = stations.find(s => {
                  const excelName = stationName.toLowerCase()
                  const dbName = s.station_name.toLowerCase()
                  return dbName.includes(excelName) || excelName.includes(dbName) || dbName === excelName
                })
                if (station) break
              }
            }
          }

          if (!station) {
            errors.push(`행 ${row._rowIndex}: 충전소를 찾을 수 없습니다. (${stationName || '충전소명 없음'})`)
            errorCount++
            continue
          }

          // 세금 금액 자동 찾기
          let taxAmount = 0
          for (const [key, value] of Object.entries(row)) {
            if (key.toLowerCase().includes('금액') || 
                key.toLowerCase().includes('amount') || 
                key.toLowerCase().includes('세금')) {
              const amount = Number(value)
              if (!isNaN(amount) && amount >= 0) {
                taxAmount = amount
                break
              }
            }
          }

          // 납부 기한 자동 찾기
          let dueDate = new Date().toISOString().split('T')[0]
          for (const [key, value] of Object.entries(row)) {
            if (key.toLowerCase().includes('기한') || 
                key.toLowerCase().includes('due') || 
                key.toLowerCase().includes('날짜')) {
              const formattedDate = formatDate(value)
              if (formattedDate !== new Date().toISOString().split('T')[0]) {
                dueDate = formattedDate
                break
              }
            }
          }

          // 세금 유형 자동 찾기
          let taxType = 'acquisition'
          for (const [key, value] of Object.entries(row)) {
            if (key.toLowerCase().includes('유형') || 
                key.toLowerCase().includes('type') || 
                key.toLowerCase().includes('세금')) {
              const str = String(value).toLowerCase().trim()
              if (str.includes('취득') || str.includes('acquisition')) {
                taxType = 'acquisition'
              } else if (str.includes('재산') || str.includes('property')) {
                taxType = 'property'
              } else if (str.includes('지았을 때때방') || str.includes('local')) {
                taxType = 'other'
              } else {
                taxType = 'other'
              }
              break
            }
          }

          // 세금 데이터 구성 (Supabase 구조에 맞춤)
          const taxData = {
            station_id: station.id,
            tax_type: taxType,
            tax_amount: taxAmount,
            due_date: dueDate,
            tax_notice_number: null,
            tax_year: null,
            tax_period: null,
            notes: null,
            status: 'payment_scheduled' as const,
            created_by: userId
          }

          const { error } = await supabase
            .from('taxes')
            .insert([taxData])

          if (error) {
            errors.push(`행 ${row._rowIndex}: ${error.message}`)
            errorCount++
          } else {
            successCount++
          }
        } catch (error) {
          errors.push(`행 ${row._rowIndex}: 처리 중 오류가 발생했습니다.`)
          errorCount++
        }
      }

      // 결과 토스트
      if (errorCount > 0) {
        toast({
          title: "일부 데이터 등록 실패",
          description: `${successCount}개 성공, ${errorCount}개 실패`,
          variant: "destructive",
        })
        console.log("Excel 업로드 오류 상세:", {
          errorCount,
          successCount,
          totalRows: excelData.length,
          errors
        })
      } else {
        toast({
          title: "일괄 등록 완료",
          description: `${successCount}개의 세금 정보가 등록되었습니다.`,
        })
      }

      // 등록 완료 후 팝업 닫기 및 목록 새로고침
      if (successCount > 0) {
        // 세금 데이터만 새로고침
        const { data: taxesData, error: taxesError } = await supabase
          .from("taxes")
          .select(`
            *,
            charging_stations (
              id,
              station_name,
              address,
              location
            )
          `)
          .order("created_at", { ascending: false })

        if (!taxesError && taxesData) {
          setTaxes(taxesData)
        }
      }
      
      // 등록 처리가 완료되면 항상 팝업 닫기
      setIsExcelUploadOpen(false)
      setExcelData([])
    } catch (error) {
      console.error("일괄 등록 오류:", error)
      toast({
        title: "일괄 등록 실패",
        description: "일괄 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // AI 이미지 분석 함수
  const analyzeImage = async () => {
    if (!selectedImage) return

    setIsAnalyzing(true)
    setAnalysisProgress(0)

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)

      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/analyze-tax-image', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setAnalysisProgress(100)

      let result: any = null
      try { result = await response.json() } catch {}
      const data = result?.data || { extracted_text: "서비스를 준비 중입니다", text_sections: [] }
      setExtractedText(data.extracted_text || "서비스를 준비 중입니다")
      setDisplayedSections(data.text_sections || [])
      setIsShowingResults(true)
      toast({ title: "안내", description: "서비스를 준비 중입니다" })
    } catch (error) {
      console.error('AI 분석 오류:', error)
      toast({ title: "안내", description: "서비스를 준비 중입니다" })
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    }
  }

  // 이미지 선택 함수
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // 이미지 제거 함수
  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    setExtractedText("")
    setDisplayedSections([])
    setIsShowingResults(false)
  }

  // Excel 템플릿 다운로드 함수
  const downloadExcelTemplate = () => {
    // 템플릿 데이터 생성
    const templateData = [
      // 헤더 행
      ['충전소명', '세금유형', '세금금액', '납부기한'],
      // 샘플 데이터 행들
      ['거제 성포해안도로 위판장우측주차장', '취득세', 500000, '2025-09-08'],
      ['서울역 충전소', '재산세', 300000, '2024-12-31'],
      ['강남역 충전소', '기타세', 150000, '2024-11-30'],
      ['', '', '', ''], // 빈 행 (사용자가 입력할 수 있도록)
      ['', '', '', ''], // 빈 행
      ['', '', '', ''], // 빈 행
    ]

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(templateData)

    // 컬럼 너비 설정
    const colWidths = [
      { wch: 30 }, // 충전소명
      { wch: 12 }, // 세금유형
      { wch: 15 }, // 세금금액
      { wch: 12 }, // 납부기한
    ]
    ws['!cols'] = colWidths

    // 헤더 스타일링 (굵게)
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:D1')
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E6E6FA" } }
      }
    }

    // 워크시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '세금등록템플릿')

    // 파일 다운로드
    const fileName = `세금등록템플릿_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }




  // 날짜 포맷팅 함수
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return new Date().toISOString().split('T')[0]
    
    let date: Date
    
    if (dateValue instanceof Date) {
      date = dateValue
    } else if (typeof dateValue === 'number') {
      // Excel 날짜 번호를 Date로 변환
      date = new Date((dateValue - 25569) * 86400 * 1000)
    } else {
      date = new Date(dateValue)
    }
    
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0]
    }
    
    return date.toISOString().split('T')[0]
  }


  const handleCreateTax = async (formData: FormData) => {
    console.log("[v0] Tax registration attempt - userRole:", userRole)
    console.log("[v0] Tax registration attempt - isAdmin:", isAdmin)
    console.log("[v0] Tax registration attempt - userId:", userId)

    if (!isAdmin) {
      console.log("[v0] Tax registration blocked - insufficient permissions")
      toast({
        title: "권한 없음",
        description: "관리자만 세금을 등록할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] Tax registration proceeding - admin permissions confirmed")
    setIsLoading(true)

    const taxType = formData.get("tax_type") as "acquisition" | "property" | "other"
    const defaultStatus = taxType === "acquisition" ? "accounting_review" : "payment_scheduled"

    const stationIdFromForm = (formData.get("charging_station_id") as string) || ""
    if (!stationIdFromForm) {
      toast({ title: "충전소 선택 필요", description: "검색 결과에서 충전소를 선택해 주세요.", variant: "destructive" })
      setIsLoading(false)
      return
    }

    const taxData = {
      station_id: stationIdFromForm,
      tax_type: taxType,
      tax_amount: Number.parseFloat(formData.get("tax_amount") as string),
      due_date: formData.get("due_date") as string,
      tax_notice_number: (formData.get("tax_notice_number") as string) || null,
      tax_year: Number.parseInt(formData.get("tax_year") as string) || null,
      tax_period: (formData.get("tax_period") as string) || null,
      notes: (formData.get("memo") as string) || null,
      status: defaultStatus,
      created_by: userId,
    }

    console.log("[v0] Tax data prepared:", taxData)
    console.log("[v0] Attempting database insertion...")

    const { data, error } = await supabase
      .from("taxes")
      .insert([taxData])
      .select(`
        *,
        charging_stations (
          id,
          station_name,
          address,
          location
        )
      `)
      .single()

    console.log("[v0] Database operation completed")
    console.log("[v0] Database result - data:", data)
    console.log("[v0] Database result - error:", error)

    if (error) {
      console.log("[v0] Tax registration failed with error:", error.message)
      toast({
        title: "오류",
        description: `세금 등록 중 오류가 발생했습니다: ${error.message}`,
        variant: "destructive",
      })
    } else {
      console.log("[v0] Tax registration successful")
      setTaxes([data, ...taxes])
      
      // 팝업을 먼저 닫기
      setIsCreateDialogOpen(false)
      // 알림 생성은 DB/스케줄러에서만 처리 (중복 방지)
      
      logAudit({
        menu: "taxes",
        action: "create",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `세금 등록: 금액 ${data.tax_amount}원, 기한 ${data.due_date}`,
        targetTable: "taxes",
        targetId: data.id,
      })
      
      toast({
        title: "성공",
        description: "세금이 성공적으로 등록되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const handleUpdateTax = async (formData: FormData) => {
    if (!isAdmin || !editingTax) return

    setIsLoading(true)

    const stationIdFromForm = (formData.get("charging_station_id") as string) || ""
    if (!stationIdFromForm) {
      toast({ title: "충전소 선택 필요", description: "검색 결과에서 충전소를 선택해 주세요.", variant: "destructive" })
      setIsLoading(false)
      return
    }

    const taxData = {
      station_id: stationIdFromForm,
      tax_type: formData.get("tax_type") as "acquisition" | "property" | "other",
      tax_amount: Number.parseFloat(formData.get("tax_amount") as string),
      due_date: formData.get("due_date") as string,
      tax_notice_number: (formData.get("tax_notice_number") as string) || null,
      tax_year: Number.parseInt(formData.get("tax_year") as string) || null,
      tax_period: (formData.get("tax_period") as string) || null,
      notes: (formData.get("memo") as string) || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("taxes")
      .update(taxData)
      .eq("id", editingTax.id)
      .select(`
        *,
        charging_stations (
          id,
          station_name,
          address,
          location
        )
      `)
      .single()

    if (error) {
      toast({
        title: "오류",
        description: "세금 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      // 강제로 상태 업데이트
      setTaxes(prevTaxes => prevTaxes.map((t) => (t.id === editingTax.id ? data : t)))
      logAudit({
        menu: "taxes",
        action: "update",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `세금 수정: ID ${data.id}`,
        targetTable: "taxes",
        targetId: data.id,
      })
      setEditingTax(null)
      toast({
        title: "성공",
        description: "세금이 성공적으로 수정되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const handleStatusChange = async (taxId: string, newStatus: string) => {
    if (!isAdmin) return

    console.log("[v0] Status change attempt:", { taxId, newStatus, userId })
    setIsLoading(true)

    const updateData: any = {
      status: newStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    if (newStatus === "payment_completed") {
      updateData.payment_date = new Date().toISOString().split("T")[0]
    }

    console.log("[v0] Update data:", updateData)

    const { data, error } = await supabase
      .from("taxes")
      .update(updateData)
      .eq("id", taxId)
      .select(`
        *,
        charging_stations (
          id,
          station_name,
          address,
          location
        )
      `)
      .single()

    if (error) {
      console.log("[v0] Status change error:", error)
      toast({
        title: "오류",
        description: "상태 변경 중 오류가 발생했습니다: " + error.message,
        variant: "destructive",
      })
    } else {
      console.log("[v0] Status change successful:", data)
      setTaxes(taxes.map((t) => (t.id === taxId ? data : t)))
      // 납부 완료 시, 미래 예약 알림 자동 삭제
      if (newStatus === "payment_completed") {
        try {
          const { error: delErrAll } = await supabase
            .from('notifications')
            .delete()
            .eq('tax_id', taxId)
          if (delErrAll) console.warn('세금 관련 알림 전체 삭제 실패:', delErrAll.message)
          // 첨부 파일도 일괄 삭제
          await fetch('/api/attachments/purge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_type: 'tax', entity_id: taxId })
          }).catch(() => {})
        } catch (e) {
          console.warn('세금 관련 알림 전체 삭제 중 오류:', e)
        }
      }
      toast({
        title: "성공",
        description: "상태가 성공적으로 변경되었습니다.",
      })
    }

    setIsLoading(false)
  }

  // Attachments helpers
  const fetchTaxAttachments = async (taxId: string) => {
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('id, file_name, size')
        .eq('entity_type', 'tax')
        .eq('entity_id', taxId)
        .order('created_at', { ascending: false })
      if (!error && data) setTaxAttachments(data as any)
    } catch {}
  }

  const downloadAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/attachments/signed-url?id=${attachmentId}`)
      const json = await res.json()
      if (json?.success && json?.url) {
        window.open(json.url, '_blank')
      } else {
        toast({ title: '오류', description: '다운로드 링크 발급 실패', variant: 'destructive' })
      }
    } catch {
      toast({ title: '오류', description: '다운로드 실패', variant: 'destructive' })
    }
  }

  const uploadTaxAttachment = async (taxId: string, file: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: '용량 초과', description: '10MB 이하만 업로드 가능합니다.', variant: 'destructive' })
      return
    }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast({ title: '형식 오류', description: 'PDF/PNG/JPG/WEBP만 가능', variant: 'destructive' })
      return
    }
    try {
      setIsUploadingAttachment(true)
      const form = new FormData()
      form.append('entity_type', 'tax')
      form.append('entity_id', taxId)
      form.append('file', file)
      const res = await fetch('/api/attachments/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || 'upload failed')
      await fetchTaxAttachments(taxId)
      toast({ title: '업로드 완료', description: file.name })
    } catch (e: any) {
      toast({ title: '업로드 실패', description: e?.message || '오류가 발생했습니다', variant: 'destructive' })
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handleDeleteTax = async (taxId: string) => {
    if (!isAdmin) return

    setIsLoading(true)

    // 세금 삭제 전 관련 알림 전체 삭제
    try {
      const { error: delErr } = await supabase
        .from('notifications')
        .delete()
        .eq('tax_id', taxId)
      if (delErr) console.warn('세금 관련 알림 삭제 실패:', delErr.message)
    } catch (e) {
      console.warn('세금 관련 알림 삭제 중 오류:', e)
    }

    const { error } = await supabase.from("taxes").delete().eq("id", taxId)

    if (error) {
      toast({
        title: "오류",
        description: "세금 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setTaxes(taxes.filter((t) => t.id !== taxId))
      logAudit({
        menu: "taxes",
        action: "delete",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `세금 삭제: ID ${taxId}`,
        targetTable: "taxes",
        targetId: taxId,
      })
      toast({
        title: "성공",
        description: "세금이 성공적으로 삭제되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const TaxForm = ({ tax, onSubmit }: { tax?: Tax; onSubmit: (formData: FormData) => void }) => {
    const stationInputRef = useRef<HTMLInputElement | null>(null)
    const [stationSearchTerm, setStationSearchTerm] = useState("")
    const [selectedStationId, setSelectedStationId] = useState("")
    const [showStationDropdown, setShowStationDropdown] = useState(false)
    const [isComposing, setIsComposing] = useState(false)
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<Station[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchCache, setSearchCache] = useState<Record<string, Station[]>>({})

    useEffect(() => {
      const controller = new AbortController()
      const run = async () => {
        if (isComposing) return
        const term = debouncedSearchTerm.trim()
        if (!term) {
          setSearchResults([])
          setShowStationDropdown(false)
          return
        }
        try {
          setIsSearching(true)
          
          // 캐시 확인
          if (searchCache[term]) {
            setSearchResults(searchCache[term])
            setShowStationDropdown(true)
            setIsSearching(false)
            return
          }
          
          const wildcard = `%${term}%`
          const { data, error } = await supabase
            .from("charging_stations")
            .select("id, station_name, address, location")
            .ilike("station_name", wildcard)
            .order("station_name")
            .limit(20)

          if (error) {
            console.error("[v0] Station live search error:", error)
            setSearchResults([])
            setShowStationDropdown(false)
          } else {
            const results = data || []
            setSearchResults(results)
            setShowStationDropdown(true)
            
            // 캐시에 저장
            setSearchCache(prev => ({
              ...prev,
              [term]: results
            }))
          }
        } finally {
          setIsSearching(false)
        }
      }

      run()
      return () => controller.abort()
    }, [debouncedSearchTerm, isComposing, supabase])

    // Debounce stationSearchTerm -> debouncedSearchTerm
    useEffect(() => {
      const timer = setTimeout(() => {
        if (!isComposing) setDebouncedSearchTerm(stationSearchTerm)
      }, 150)
      return () => clearTimeout(timer)
    }, [stationSearchTerm, isComposing])

    // Initialize form fields when editing or resetting
    useEffect(() => {
      if (tax) {
        setSelectedStationId(tax.station_id || "")
      } else {
        setSelectedStationId("")
        setStationSearchTerm("")
      }
    }, [tax])
    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        setSelectedImage(file)
        const reader = new FileReader()
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    }

    const analyzeImage = async () => {
      if (!selectedImage) return

      setIsAnalyzing(true)
      setAnalysisProgress(0)
      setExtractedText(null)

      try {
        console.log("[v0] Starting AI image analysis")

        // Show progress updates
        const progressInterval = setInterval(() => {
          setAnalysisProgress((prev) => Math.min(prev + 10, 90))
        }, 200)

        const formData = new FormData()
        formData.append("image", selectedImage)

        const response = await fetch("/api/analyze-tax-image", {
          method: "POST",
          body: formData,
        })

        clearInterval(progressInterval)
        setAnalysisProgress(100)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        console.log("[v0] AI analysis completed:", result)

        if (result.success && result.data) {
          setExtractedText(result.data)
          toast({
            title: "분석 완료",
            description: "이미지에서 텍스트를 성공적으로 추출했습니다.",
          })
        } else {
          throw new Error(result.error || "AI 분석에 실패했습니다.")
        }
      } catch (error) {
        console.error("[v0] AI analysis error:", error)
        toast({
          title: "분석 실패",
          description: error instanceof Error ? error.message : "이미지 분석 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      } finally {
        setIsAnalyzing(false)
        setAnalysisProgress(0)
      }
    }

    const removeImage = () => {
      setSelectedImage(null)
      setImagePreview(null)
      setExtractedText(null)
      setIsShowingResults(false)
      setDisplayedText("")
      setDisplayedSections([])
    }

    return (
      <form action={onSubmit} className="space-y-6">
        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">AI 이미지 인식</h3>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            세금 고지서나 관련 문서 이미지를 업로드하면 AI가 자동으로 정보를 추출합니다.
          </p>

          {!selectedImage ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <div className="mt-4">
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-foreground">이미지를 업로드하세요</span>
                    <span className="mt-1 block text-xs text-muted-foreground">PNG, JPG, JPEG 파일 지원</span>
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={imagePreview! || "/placeholder.svg"}
                  alt="업로드된 이미지"
                  className="w-full max-w-md mx-auto rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2 justify-center">
                <Button type="button" onClick={analyzeImage} disabled={isAnalyzing} className="gap-2">
                  {isAnalyzing ? `추출중...${analysisProgress}%` : "AI 텍스트 추출"}
                </Button>
              </div>

              {isAnalyzing && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">AI 분석 중...</span>
                    <span className="text-muted-foreground">{analysisProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {extractedText && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      추출된 문서 내용
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(extractedText.extracted_text)
                          toast({ title: "복사됨", description: "텍스트가 클립보드에 복사되었습니다." })
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        복사
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setExtractedText(null)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        지우기
                      </Button>
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        전체 추출 텍스트
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 rounded-md p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                          {extractedText.extracted_text}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {extractedText.text_sections && extractedText.text_sections.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          섹션별 정리 ({extractedText.text_sections.length}개 섹션)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {extractedText.text_sections.map((section: any, index: number) => (
                            <div key={index} className="bg-muted/30 rounded-md p-3 border-l-4 border-primary/30">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                  {index + 1}
                                </div>
                                <h4 className="font-medium text-sm">{section.section}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground pl-8">{section.content}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="station_search">충전소 *</Label>
            <div className="relative">
              <Input
                id="station_search"
                ref={stationInputRef}
                defaultValue={stationSearchTerm}
                onChange={(e) => {
                  console.log("[v0] Station search input changed:", e.target.value)
                  setStationSearchTerm(e.target.value)
                  console.log("[v0] Station search term updated to:", e.target.value)
                }}
                autoComplete="off"
                onCompositionStart={() => {
                  console.log("[v0] Korean text composition started")
                  setIsComposing(true)
                  setShowStationDropdown(false)
                }}
                onCompositionEnd={(e) => {
                  console.log("[v0] Korean text composition ended:", e.currentTarget.value)
                  setIsComposing(false)
                  if (e.currentTarget.value.trim()) {
                    setShowStationDropdown(true)
                  }
                }}
                onFocus={() => {
                  console.log("[v0] Station search input focused")
                  // Open dropdown only; do not change aria-hidden ancestors
                  if (!isComposing) setShowStationDropdown(true)
                }}
                onBlur={() => {
                  console.log("[v0] Station search input blurred")
                  setTimeout(() => setShowStationDropdown(false), 200)
                }}
                placeholder="충전소명을 검색하세요"
                className="pl-10"
                required
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />

              {/* Hidden input for form submission */}
              <input type="hidden" name="charging_station_id" value={selectedStationId} />

              {/* Search results dropdown */}
              {showStationDropdown && debouncedSearchTerm.trim() && !isComposing && (
                <div
                  className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {isSearching && (
                    <div className="px-3 py-2 text-muted-foreground">검색 중...</div>
                  )}

                  {!isSearching && searchResults.map((station) => (
                    <div
                      key={station.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer"
                      onClick={() => {
                        setStationSearchTerm(station.station_name)
                        setSelectedStationId(station.id)
                        if (stationInputRef.current) stationInputRef.current.value = station.station_name
                        setShowStationDropdown(false)
                      }}
                    >
                      <div className="font-medium">{station.station_name}</div>
                      <div className="text-sm text-muted-foreground">{station.address || station.location}</div>
                    </div>
                  ))}

                  {!isSearching && searchResults.length === 0 && (
                    <div className="px-3 py-2 text-muted-foreground">검색 결과가 없습니다</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_type">세금 유형 *</Label>
            <Select name="tax_type" defaultValue={tax?.tax_type || newTax.tax_type || ""} required>
              <SelectTrigger>
                <SelectValue placeholder="세금 유형 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acquisition">취득세</SelectItem>
                <SelectItem value="property">재산세</SelectItem>
                <SelectItem value="other">기타세</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_amount">세금 금액 *</Label>
            <Input
              name="tax_amount"
              type="number"
              placeholder="세금 금액을 입력하세요"
              defaultValue={tax?.tax_amount || newTax.amount || ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">납부 기한 *</Label>
            <Input
              name="due_date"
              type="date"
              defaultValue={
                tax?.due_date
                  ? format(new Date(tax.due_date), "yyyy-MM-dd")
                  : newTax.due_date
                    ? format(new Date(newTax.due_date), "yyyy-MM-dd")
                    : ""
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_notice_number">고지서 번호</Label>
            <Input
              name="tax_notice_number"
              placeholder="고지서 번호를 입력하세요"
              defaultValue={tax?.tax_notice_number || newTax.description || ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_year">과세 연도</Label>
            <Input name="tax_year" type="number" placeholder="2024" defaultValue={tax?.tax_year || ""} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_period">과세 기간</Label>
            <Select name="tax_period" defaultValue={tax?.tax_period || ""}>
              <SelectTrigger>
                <SelectValue placeholder="과세 기간 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1분기">1분기</SelectItem>
                <SelectItem value="2분기">2분기</SelectItem>
                <SelectItem value="3분기">3분기</SelectItem>
                <SelectItem value="4분기">4분기</SelectItem>
                <SelectItem value="연간">연간</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="memo">메모</Label>
          <Textarea name="memo" placeholder="추가 메모사항" defaultValue={tax?.notes || ""} rows={3} />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateDialogOpen(false)
              setEditingTax(null)
            }}
          >
            취소
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "처리 중..." : tax ? "수정" : "등록"}
          </Button>
        </div>
      </form>
    )
  }

  const WorkflowSteps = ({ tax }: { tax: Tax }) => {
    const workflow = getWorkflowSteps(tax.tax_type, tax.status)

    return (
      <div className="flex items-center gap-2">
        {workflow.steps.map((step, index) => (
          <div key={step.status} className="flex items-center">
            <div
              className={`px-2 py-1 rounded text-xs font-medium ${
                step.completed
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                  : step.current
                    ? "bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {step.label}
            </div>
            {index < workflow.steps.length - 1 && <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />}
          </div>
        ))}
      </div>
    )
  }

  const TaxCard = ({ tax }: { tax: Tax }) => {
    const workflow = getWorkflowSteps(tax.tax_type, tax.status)
    const isOverdue = new Date(tax.due_date) < new Date() && tax.status !== "payment_completed"

    return (
      <Card
        key={tax.id}
        className={`hover:shadow-md transition-shadow ${isOverdue ? "border-red-200 dark:border-red-800" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{tax.charging_stations.station_name}</CardTitle>
                <Badge variant="outline">{taxTypeLabels[tax.tax_type]}</Badge>
                {isOverdue && <Badge variant="destructive">연체</Badge>}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {tax.charging_stations.address || tax.charging_stations.location}
              </div>
              <WorkflowSteps tax={tax} />
            </div>

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setViewingTax(tax)}>상세 보기</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditingTax(tax)}>수정</DropdownMenuItem>
                  {workflow.nextStatus && (
                    <DropdownMenuItem onClick={() => handleStatusChange(tax.id, workflow.nextStatus!)}>
                      다음 단계로 이동
                    </DropdownMenuItem>
                  )}
                  {workflow.prevStatus && (
                    <DropdownMenuItem onClick={() => handleStatusChange(tax.id, workflow.prevStatus!)}>
                      이전 단계로 원복
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => {
                      if (confirm("정말 삭제하시겠습니까?")) {
                        handleDeleteTax(tax.id)
                      }
                    }}
                  >
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">세금 금액</p>
              <p className="font-medium">{tax.tax_amount.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-muted-foreground">납부 기한</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(tax.due_date).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
          {tax.notes && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">세금 구분</p>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{tax.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold tracking-tight text-2xl">세금 관리</h2>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-3 bg-muted rounded w-full"></div>
                      <div className="h-4 bg-muted rounded w-2/3"></div>
                    </div>
                  ))}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">세금 관리</h2>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  세금 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[70vw] max-w-none max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>세금 등록</DialogTitle>
                  <DialogDescription>새로운 세금 정보를 입력해주세요.</DialogDescription>
                </DialogHeader>
                <TaxForm onSubmit={handleCreateTax} />
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => document.getElementById('excel-upload')?.click()}
              disabled={isProcessingExcel}
            >
              <Upload className="h-4 w-4" />
              {isProcessingExcel ? "처리 중..." : "Excel 업로드"}
            </Button>
            
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={downloadExcelTemplate}
            >
              <FileText className="h-4 w-4" />
              Excel 템플릿
            </Button>
            
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="충전소명, 고지서 번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-500"
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px] border-slate-500">
            <SelectValue placeholder="세금 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 유형</SelectItem>
            <SelectItem value="acquisition">취득세</SelectItem>
            <SelectItem value="property">재산세</SelectItem>
            <SelectItem value="other">기타세</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] border-slate-500">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 상태</SelectItem>
            <SelectItem value="accounting_review">회계사 검토</SelectItem>
            <SelectItem value="payment_scheduled">납부 예정</SelectItem>
            <SelectItem value="payment_completed">납부 완료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTaxes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || filterType !== "all" || filterStatus !== "all"
                ? "검색 결과가 없습니다"
                : "등록된 세금이 없습니다"}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || filterType !== "all" || filterStatus !== "all"
                ? "다른 검색 조건으로 시도해보세요"
                : isAdmin
                  ? "새 세금을 등록해보세요"
                  : "관리자가 세금을 등록할 때까지 기다려주세요"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {paginatedPendingTaxes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">진행 중인 세금</h3>
                <Badge variant="secondary">{pendingTaxes.length}건</Badge>
              </div>
              <div className="space-y-4">
                {paginatedPendingTaxes.map((tax) => (
                  <TaxCard key={tax.id} tax={tax} />
                ))}
              </div>
              {pendingTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={pendingCurrentPage === 1}
                  >
                    이전
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: pendingTotalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={pendingCurrentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPendingCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingCurrentPage((prev) => Math.min(prev + 1, pendingTotalPages))}
                    disabled={pendingCurrentPage === pendingTotalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}

          {paginatedCompletedTaxes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pt-4 border-t">
                <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">납부 완료</h3>
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                >
                  {completedTaxes.length}건
                </Badge>
              </div>
              <div className="space-y-4 opacity-75">
                {paginatedCompletedTaxes.map((tax) => (
                  <TaxCard key={tax.id} tax={tax} />
                ))}
              </div>
              {completedTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletedCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={completedCurrentPage === 1}
                  >
                    이전
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: completedTotalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={completedCurrentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCompletedCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletedCurrentPage((prev) => Math.min(prev + 1, completedTotalPages))}
                    disabled={completedCurrentPage === completedTotalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        총 {taxes.length}개의 세금 항목
        {(searchTerm || filterType !== "all" || filterStatus !== "all") && ` (${filteredTaxes.length}개 표시됨)`}
      </div>

      <Dialog
        open={editingTax !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTax(null)
        }}
      >
        <DialogContent className="w-[70vw] max-w-none max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>세금 수정</DialogTitle>
            <DialogDescription>세금 정보를 수정해주세요.</DialogDescription>
          </DialogHeader>
          <TaxForm tax={editingTax || undefined} onSubmit={handleUpdateTax} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewingTax !== null}
        onOpenChange={(open) => {
          if (!open) setViewingTax(null)
        }}
      >
        <DialogContent className="w-[70vw] max-w-none max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>세금 상세 정보</DialogTitle>
          </DialogHeader>

          {viewingTax && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>충전소</Label>
                  <p className="font-medium">{viewingTax.charging_stations.station_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {viewingTax.charging_stations.address || viewingTax.charging_stations.location}
                  </p>
                </div>
                <div>
                  <Label>세금 유형</Label>
                  <p className="font-medium">{taxTypeLabels[viewingTax.tax_type]}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>세금 금액</Label>
                  <p className="font-medium">{viewingTax.tax_amount.toLocaleString()}원</p>
                </div>
                <div>
                  <Label>납부 기한</Label>
                  <p className="font-medium">{new Date(viewingTax.due_date).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>

              <div>
                <Label>현재 상태</Label>
                <div className="mt-2">
                  <WorkflowSteps tax={viewingTax} />
                </div>
              </div>

              {viewingTax.payment_date && (
                <div>
                  <Label>납부 날짜</Label>
                  <p className="font-medium">{new Date(viewingTax.payment_date).toLocaleDateString("ko-KR")}</p>
                </div>
              )}

              {viewingTax.tax_notice_number && (
                <div>
                  <Label>고지서 번호</Label>
                  <p className="font-medium">{viewingTax.tax_notice_number}</p>
                </div>
              )}

              {viewingTax.notes && (
                <div>
                  <Label>메모</Label>
                  <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm">{viewingTax.notes}</p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                등록일: {new Date(viewingTax.created_at).toLocaleDateString("ko-KR")}
                {viewingTax.updated_at !== viewingTax.created_at && (
                  <span> • 수정일: {new Date(viewingTax.updated_at).toLocaleDateString("ko-KR")}</span>
                )}
              </div>

              {/* Attachments section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label>첨부파일</Label>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadTaxAttachment(viewingTax.id, f)
                      e.currentTarget.value = ''
                    }}
                    disabled={isUploadingAttachment}
                  />
                </div>
                <div className="space-y-2">
                  {taxAttachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">첨부파일이 없습니다.</p>
                  ) : (
                    taxAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between text-sm">
                        <span className="truncate mr-3">{att.file_name} ({Math.ceil(att.size/1024)} KB)</span>
                        <Button size="sm" variant="outline" onClick={() => downloadAttachment(att.id)}>다운로드</Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 새로운 Excel 업로드 다이얼로그 */}
      <Dialog open={isExcelUploadOpen} onOpenChange={setIsExcelUploadOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Excel 일괄 등록</DialogTitle>
            <DialogDescription>
              Excel 파일의 데이터를 자동으로 인식하여 일괄 등록합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 자동 인식 안내 */}
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">자동 인식 필드</h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                • <strong>충전소명</strong>: "충전소", "station", "명" 포함 컬럼 자동 인식<br/>
                • <strong>세금 금액</strong>: "금액", "amount", "세금" 포함 컬럼 자동 인식<br/>
                • <strong>납부 기한</strong>: "기한", "due", "날짜" 포함 컬럼 자동 인식<br/>
                • <strong>세금 유형</strong>: "유형", "type" 포함 컬럼 자동 인식<br/>
                <br/>
                💡 <strong>팁</strong>: "Excel 템플릿" 버튼을 클릭하여 올바른 형식의 템플릿을 다운로드하세요!
              </p>
            </div>

            {/* 데이터 미리보기 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">데이터 미리보기 (최대 10개 행)</h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {excelData.length > 0 && Object.keys(excelData[0]).filter(key => key !== '_rowIndex').map((header) => (
                          <th key={header} className="px-3 py-2 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelData.slice(0, 10).map((row, index) => (
                        <tr key={index} className="border-t">
                          {Object.keys(row).filter(key => key !== '_rowIndex').map((header) => (
                            <td key={header} className="px-3 py-2">
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {excelData.length > 10 && (
                <p className="text-sm text-muted-foreground">
                  ... 외 {excelData.length - 10}개 행 더 있음
                </p>
              )}
            </div>

            {/* 등록 버튼 */}
            <div className="pt-4 border-t space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  ✅ 등록 준비 완료: {excelData.length}개 항목을 등록할 수 있습니다.
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsExcelUploadOpen(false)
                    setExcelData([])
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleBulkTaxRegistration}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? "등록 중..." : "일괄 등록"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

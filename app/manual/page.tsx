import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "매뉴얼 - TMS",
  description: "TMS 시스템 사용 매뉴얼",
}

export default function ManualPage() {
  const manualSections = [
    {
      title: "대시보드",
      description: "시스템 전체 현황 확인",
      content: [
        "시스템 전체 현황을 한눈에 확인할 수 있습니다",
        "충전소 현황, 세금 현황, 알림 상태 등의 통계를 제공합니다",
        "각 카드를 클릭하여 상세 페이지로 이동할 수 있습니다",
      ],
    },
    {
      title: "충전소 관리",
      description: "충전소 등록 및 관리",
      content: [
        "충전소 등록: 우상단 '충전소 등록' 버튼을 클릭하여 새 충전소를 등록합니다",
        "충전소 수정: 각 충전소 카드의 '수정' 버튼을 클릭하여 정보를 수정합니다",
        "충전소 삭제: 각 충전소 카드의 '삭제' 버튼을 클릭하여 삭제합니다",
        "운영중인 충전소와 점검중/운영예정 충전소가 구분되어 표시됩니다",
      ],
    },
    {
      title: "세금 관리",
      description: "AI 기반 세금 정보 관리",
      content: [
        "세금 등록: 우상단 '세금 등록' 버튼을 클릭하여 새 세금을 등록합니다",
        "AI 이미지 인식(Google Gemini): 세금 고지서 이미지를 업로드하면 자동으로 정보를 추출합니다",
        "세금 수정/삭제: 각 세금 항목의 메뉴(⋮)를 클릭하여 수정하거나 삭제합니다",
        "진행중인 세금과 납부 완료된 세금이 구분되어 표시됩니다",
        "세금 인사이트: 대시보드에서 'AI 세금 분석'을 통해 현황 요약을 확인합니다",
      ],
    },
    {
      title: "알림 관리",
      description: "Teams 연동 알림 시스템",
      content: [
        "목록: 표 형태(10개/페이지), '발송일 임박순' 정렬로 표시됩니다",
        "수동 알림: 충전소/날짜/메시지로 생성하며 목록에 'manual' 배지로 표시됩니다",
        "발송 시간: 매일 12:00 (KST) 자동 발송",
        "즉시 발송: 수동 강제 발송은 force=1 파라미터로 수행합니다",
        "Teams 연동: Teams 채널을 등록하면 대상 채널로 전송됩니다",
        "삭제: 각 알림의 메뉴(⋮)에서 삭제할 수 있습니다",
      ],
    },
    {
      title: "수동 알림 생성",
      description: "독립 테이블(manual_notifications) 기반",
      content: [
        "충전소 선택 → 알림 날짜 선택 → 메시지 입력 → 저장",
        "목록에 'manual' 배지로 구분되어 표시됩니다",
        "자동 발송: 알림 날짜의 12:00(KST)에 전송",
        "즉시 발송: /api/dispatch-notifications?type=manual&force=1",
      ],
    },
    {
      title: "통계",
      description: "세금 현황 분석 및 차트",
      content: [
        "세금 현황과 통계를 차트로 확인할 수 있습니다",
        "월별, 분기별 세금 납부 현황을 분석합니다",
        "충전소별 세금 현황을 비교할 수 있습니다",
      ],
    },
    {
      title: "캘린더",
      description: "세금 납부 일정 관리",
      content: [
        "세금 납부 일정을 캘린더 형태로 확인할 수 있습니다",
        "한국 법정 공휴일과 주말이 빨간색으로 표시됩니다",
        "월별/주별 보기를 전환할 수 있습니다",
        "이전달/다음달 버튼으로 날짜를 이동할 수 있습니다",
      ],
    },
    {
      title: "설정",
      description: "사용자 권한 및 시스템 설정",
      content: [
        "사용자 권한을 확인하고 변경할 수 있습니다",
        "뷰어에서 관리자로 권한을 변경할 수 있습니다",
        "시스템 설정을 관리할 수 있습니다",
      ],
    },
    {
      title: "사용자 권한",
      description: "권한별 기능 안내",
      content: [
        "뷰어: 데이터 조회만 가능합니다",
        "관리자: 모든 데이터의 생성, 수정, 삭제가 가능합니다",
        "권한 변경은 설정 페이지에서 가능합니다",
      ],
    },
    {
      title: "알림 발송 정책",
      description: "스케줄/중복/예외 처리",
      content: [
        "발송 대상: 세금(taxes), 사업 일정(station_schedules), 수동(manual_notifications)",
        "발송 시간: 매일 12:00 KST (Vercel Cron/GitHub Actions/AWS EventBridge)",
        "중복 방지: is_sent/sent_at로 중복 발송 방지",
        "예외: 삭제된 스케줄은 제외, 사용승인 미입력 경고는 use_approval_enabled일 때만",
      ],
    },
    {
      title: "디버그 & 문제해결",
      description: "API 디버그 모드와 점검 포인트",
      content: [
        "디버그 모드: /api/*?debug=1 로 상세 오류 확인",
        "AI 오류: GOOGLE_AI_API_KEY 유효성, 할당량/결제 상태 확인",
        "Amplify: amplify.yml에서 .env.production 주입 확인",
        "크론: Vercel Cron 헤더 우회, GitHub Actions 스케줄/시크릿 확인",
      ],
    },
    {
      title: "환경변수",
      description: "필수 설정",
      content: [
        "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
        "CRON_SECRET (수동 호출 보호)",
        "GOOGLE_AI_API_KEY (Google Gemini)",
      ],
    },
  ]

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-8">
        <div>
          <h1 className="font-bold mb-2 text-2xl">TMS 시스템 매뉴얼</h1>
          <p className="text-muted-foreground">{""}</p>
        </div>

        {/* 시스템 개요 도식 */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">시스템 개요</CardTitle>
            <CardDescription>주요 구성요소와 데이터/요청 흐름</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-3 bg-background">
                  <div className="font-medium mb-1">스케줄러</div>
                  <div className="text-muted-foreground">Vercel Cron / GitHub Actions / AWS EventBridge</div>
                </div>
                <div className="flex items-center justify-center">→</div>
                <div className="border rounded-lg p-3 bg-background">
                  <div className="font-medium mb-1">API</div>
                  <div className="text-muted-foreground">/api/dispatch-notifications</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-3 bg-background">
                  <div className="font-medium mb-1">DB</div>
                  <div className="text-muted-foreground">Supabase (taxes, station_schedules, notifications, manual_notifications)</div>
                </div>
                <div className="flex items-center justify-center">→</div>
                <div className="border rounded-lg p-3 bg-background">
                  <div className="font-medium mb-1">Teams</div>
                  <div className="text-muted-foreground">웹훅으로 알림 전송</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-3 bg-background">
                  <div className="font-medium mb-1">AI 분석</div>
                  <div className="text-muted-foreground">/api/analyze-*, Google Gemini</div>
                </div>
                <div className="flex items-center justify-center">↔</div>
                <div className="border rounded-lg p-3 bg-background">
                  <div className="font-medium mb-1">UI</div>
                  <div className="text-muted-foreground">세금 이미지/현황 분석 결과 표시</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {manualSections.map((section, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">
                  {index + 1}. {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.content.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-sm leading-relaxed flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">문의사항</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              시스템 사용 중 문의사항이 있으시면 관리자에게 연락해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

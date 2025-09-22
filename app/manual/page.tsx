import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "매뉴얼 - TMS",
  description: "TMS 사용자 매뉴얼",
}

export default function ManualPage() {
  const sections = [
    {
      title: "시작하기",
      description: "이 시스템은 세금 관리를 효율적으로 할 수 있도록 도와주는 통합 관리 시스템입니다.",
      items: [],
    },
    {
      title: "대시보드 (메인 화면)",
      description: "시스템에 접속하면 가장 먼저 보이는 화면입니다.",
      items: [
        "전체 충전소 개수와 운영 상태를 한눈에 확인",
        "세금 현황 요약 (납부 예정, 완료 등)",
        "중요한 알림 상태 확인",
        "각 항목을 클릭하면 상세 페이지로 이동",
      ],
    },
    {
      title: "충전소 관리",
      description: "충전소 등록/수정/삭제",
      items: [
        "충전소 등록: 화면 우측 상단의 '충전소 등록' 버튼 클릭 → 정보 입력 후 저장",
        "충전소 수정/삭제: 각 충전소 카드에서 '수정' 또는 '삭제' 버튼 클릭",
        "운영중/운영예정/종료 상태로 구분 표시",
      ],
    },
    {
      title: "세금 관리",
      description: "세금 정보 등록 및 확인",
      items: [
        "세금 등록: 우측 상단 '세금 등록' 버튼 클릭",
        "세금 고지서 사진 업로드 시 자동 인식 (필요 시 수동 수정 가능)",
        "세금 수정/삭제: 각 세금 항목 옆 메뉴(⋮)에서 변경",
        "세금 현황: 진행중/납부 완료 구분 표시, 대시보드의 'AI 세금 분석'에서 전체 요약 확인",
      ],
    },
    {
      title: "알림 관리",
      description: "세금/충전소 관련 알림 관리",
      items: [
        "알림 목록: 페이지당 10개, 발송 예정일이 가까운 순으로 정렬",
        "수동 알림 만들기: 충전소 선택 → 알림 날짜 → 메시지 → 팀즈 채널 선택 → 저장",
        "발송 시간: 매일 12:00~13:00 사이 자동 발송",
        "알림 발송: 팀즈 채널로 전송",
        "알림 삭제: 각 알림 옆 메뉴(⋮)에서 삭제",
      ],
    },
    {
      title: "통계",
      description: "세금 관리 현황 차트/그래프",
      items: [
        "월별, 분기별 세금 납부 현황",
        "충전소별 세금 비교",
        "전체 세금 통계 분석",
      ],
    },
    {
      title: "캘린더",
      description: "세금 납부 일정 달력 보기",
      items: [
        "월별 세금/충전소 일정 확인",
        "<, > 버튼으로 월 이동",
      ],
    },
    {
      title: "설정",
      description: "권한 및 사용자 설정",
      items: [
        "현재 권한 상태 확인",
        "권한 변경 필요 시 관리자에게 문의",
      ],
    },
    {
      title: "사용자 권한 안내",
      description: "역할별 권한",
      items: [
        "뷰어: 모든 데이터 조회 가능 (수정/삭제 불가)",
        "사업 개발: 일부 데이터 조회/확인, 사용 승인일·안전 점검일 일정 관리",
        "관리자: 모든 기능 사용 가능 (충전소/세금/알림 생성·수정·삭제)",
      ],
    },
  ]

  const faqs = [
    {
      q: "세금 고지서 사진이 제대로 인식되지 않아요",
      a: "사진이 선명하고 글자가 잘 보이도록 촬영해주세요. 인식이 안 되면 수동으로 입력하실 수 있습니다.",
    },
    {
      q: "알림이 Teams에 오지 않아요",
      a: "Teams 채널 설정을 확인하거나 관리자에게 문의해주세요.",
    },
    {
      q: "권한을 변경하고 싶어요",
      a: "설정 페이지에서 현재 권한을 확인하고, 변경이 필요하면 관리자에게 요청해주세요.",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-8">
        <div>
          <h1 className="font-bold mb-2 text-2xl">TMS 사용자 매뉴얼</h1>
          <p className="text-muted-foreground">일반 사용자를 위한 간단 안내</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {sections.map((s, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-xl">{i + 1}. {s.title}</CardTitle>
                {s.description && <CardDescription>{s.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                {s.items.length > 0 && (
                  <ul className="space-y-2">
                    {s.items.map((item, idx) => (
                      <li key={idx} className="text-sm leading-relaxed flex items-start">
                        <span className="text-primary mr-2 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">자주 묻는 질문</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <div key={i}>
                  <div className="font-medium">Q. {f.q}</div>
                  <div className="text-sm text-muted-foreground mt-1">A. {f.a}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

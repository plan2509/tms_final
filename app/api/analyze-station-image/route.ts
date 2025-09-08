import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get("image") as File

    if (!image) {
      return NextResponse.json({ success: false, error: "이미지가 제공되지 않았습니다." }, { status: 400 })
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("[Gemini] GOOGLE_AI_API_KEY not found")
      return NextResponse.json({ success: false, error: "AI 서비스가 설정되지 않았습니다." }, { status: 500 })
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType = image.type

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `이 이미지는 전기차 충전소 관련 사진입니다. 다음 정보를 추출해주세요:

1. 충전소명 (브랜드명, 회사명 등)
2. 위치 (도시, 구역, 지역명)
3. 상세 주소 (있다면)
4. 운영 상태 (운영중, 점검중, 운영예정 중 하나)

이미지에서 텍스트나 표지판을 읽어서 정확한 정보를 추출해주세요. 한국어로 응답해주세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "station_name": "충전소명",
  "location": "위치",
  "address": "상세주소",
  "status": "operating"
}

JSON 외에는 어떤 텍스트도 포함하지 마세요.`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      }
    ])

    const response = await result.response
    const text = response.text()

    // Parse JSON response
    let cleanText = text.trim()
    cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "")
    
    const jsonStart = cleanText.indexOf("{")
    const jsonEnd = cleanText.lastIndexOf("}")
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanText = cleanText.substring(jsonStart, jsonEnd + 1)
    }

    const object = JSON.parse(cleanText)

    return NextResponse.json({
      success: true,
      data: object,
    })
  } catch (error) {
    console.error("[Gemini] Station image analysis error:")
    try {
      console.error("  message:", (error as any)?.message)
      console.error("  status:", (error as any)?.status || (error as any)?.response?.status)
      console.error("  code:", (error as any)?.code)
    } catch {}
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "이미지 분석 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}

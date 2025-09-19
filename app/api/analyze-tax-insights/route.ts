import { GoogleGenerativeAI } from "@google/generative-ai"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[Gemini] AI Analysis: Starting tax insights generation")

    const debug = request.nextUrl?.searchParams?.get("debug") === "1"

    const { taxData } = await request.json()

    if (!taxData) {
      console.log("[Gemini] AI Analysis: No tax data provided")
      const payload: any = { analysis: "서비스를 준비 중입니다" }
      if (debug) payload.debug = { reason: "NO_TAX_DATA" }
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("[Gemini] AI Analysis: GOOGLE_AI_API_KEY not found")
      const payload: any = { analysis: "서비스를 준비 중입니다" }
      if (debug) payload.debug = { reason: "MISSING_API_KEY", keyPresent: false }
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log("[Gemini] AI Analysis: Calling Gemini AI")

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `세금 현황: 총${taxData.totalTaxes}개, 미납${taxData.unpaidTaxes}개, 연체${taxData.overdueTaxes}개, 이번달${taxData.monthlyDue}개, 이번주${taxData.weeklyDue}개

간단한 현황 분석을 2-3문장으로 요약해주세요.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const analysis = response.text()

    console.log("[Gemini] AI Analysis: Response generated")

    return new Response(JSON.stringify({ analysis }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("[Gemini] AI Analysis: Error analyzing tax insights:", error)
    const debug = request.nextUrl?.searchParams?.get("debug") === "1"
    if (debug) {
      const payload: any = {
        analysis: "서비스를 준비 중입니다",
        debug: {
          message: error?.message,
          status: error?.status || error?.response?.status,
          code: error?.code,
        },
      }
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      })
    }
    return new Response(JSON.stringify({ analysis: "서비스를 준비 중입니다" }), {
      headers: { "Content-Type": "application/json" },
    })
  }
}

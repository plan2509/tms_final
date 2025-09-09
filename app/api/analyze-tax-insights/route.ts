import { GoogleGenerativeAI } from "@google/generative-ai"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[Gemini] AI Analysis: Starting tax insights generation")

    const { taxData } = await request.json()

    if (!taxData) {
      console.log("[Gemini] AI Analysis: No tax data provided")
      return new Response("Tax data is required", { status: 400 })
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      console.error("[Gemini] AI Analysis: GOOGLE_AI_API_KEY not found")
      return new Response("AI service not configured", { status: 500 })
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
  } catch (error) {
    console.error("[Gemini] AI Analysis: Error analyzing tax insights:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to analyze tax data",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

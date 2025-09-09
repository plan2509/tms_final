"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate watercharging.com domain
    if (!email.endsWith("@watercharging.com")) {
      setError("watercharging.com 도메인 이메일만 사용할 수 있습니다.")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        throw error
      }

      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "비밀번호 재설정 요청 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-background">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">TMS</h1>
              <p className="text-muted-foreground">세금 일정 관리 시스템</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">이메일 발송 완료</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Mail className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      이메일을 확인하고 링크를 클릭하여 새 비밀번호를 설정해주세요.
                    </p>
                  </div>
                  <div className="pt-4">
                    <Link href="/auth/login">
                      <Button variant="outline" className="w-full">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        로그인으로 돌아가기
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">TMS</h1>
            <p className="text-muted-foreground">세금 일정 관리 시스템</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">비밀번호 찾기</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@watercharging.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-sm text-yellow-500">@watercharging.com 도메인만 사용할 수 있습니다</p>
                  </div>
                  {error && <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">{error}</div>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "발송 중..." : "비밀번호 재설정 링크 발송"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4 text-primary hover:text-primary/80"
                  >
                    로그인으로 돌아가기
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

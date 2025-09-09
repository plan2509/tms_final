"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"viewer" | "admin" | "business_development">("viewer")
  const [adminPassword, setAdminPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    console.log("[v0] Starting user registration with trigger-based approach")

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("[v0] Missing Supabase environment variables")
      setError("시스템 설정 오류가 발생했습니다. 관리자에게 문의하세요.")
      setIsLoading(false)
      return
    }

    if (!email.endsWith("@watercharging.com")) {
      setError("watercharging.com 도메인 이메일만 사용할 수 있습니다.")
      setIsLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.")
      setIsLoading(false)
      return
    }

    if (!name.trim()) {
      setError("이름을 입력해주세요.")
      setIsLoading(false)
      return
    }

    // 관리자 권한 설정 시 비밀번호 확인
    if (role !== "viewer" && adminPassword !== "221114") {
      setError("관리자 권한 설정을 위해 올바른 비밀번호를 입력해주세요.")
      setIsLoading(false)
      return
    }

    try {
      console.log("[v0] Creating Supabase client")
      const supabase = createClient()

      if (!supabase) {
        throw new Error("Supabase 클라이언트 생성에 실패했습니다.")
      }

      console.log("[v0] Creating auth user with metadata")
      console.log("[v0] Email:", email)
      console.log("[v0] Name:", name.trim())
      console.log("[v0] Role:", role)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
          data: {
            name: name.trim(),
            role: role,
          },
        },
      })

      console.log("[v0] Auth response:", { authData, authError })

      if (authError) {
        console.error("[v0] Supabase auth error:", authError)
        if (authError.message.includes("already registered")) {
          setError("이미 등록된 이메일입니다. 로그인을 시도해보세요.")
        } else if (authError.message.includes("weak password")) {
          setError("비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.")
        } else if (authError.message.includes("rate limit")) {
          setError("너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.")
        } else {
          setError(`회원가입 오류: ${authError.message}`)
        }
        setIsLoading(false)
        return
      }

      if (authData.user) {
        console.log("[v0] User created successfully, trigger will handle profile creation")
        console.log("[v0] User ID:", authData.user.id)
        router.push("/auth/sign-up-success")
      } else {
        console.error("[v0] No user data returned from auth signup")
        setError("사용자 생성에 실패했습니다. 다시 시도해주세요.")
        setIsLoading(false)
        return
      }
    } catch (error: unknown) {
      console.error("[v0] Registration error:", error)
      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          setError("네트워크 연결을 확인해주세요.")
        } else if (error.message.includes("timeout")) {
          setError("요청 시간이 초과되었습니다. 다시 시도해주세요.")
        } else {
          setError(`오류: ${error.message}`)
        }
      } else {
        setError("회원가입 중 알 수 없는 오류가 발생했습니다.")
      }
    } finally {
      setIsLoading(false)
    }
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
              <CardTitle className="text-2xl">회원가입</CardTitle>
              <CardDescription>새 계정을 만들어 시작하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name">이름</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="홍길동"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
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
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">권한</Label>
                    <Select value={role} onValueChange={(value: "viewer" | "admin" | "business_development") => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="권한을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">뷰어</SelectItem>
                        <SelectItem value="business_development">사업 개발</SelectItem>
                        <SelectItem value="admin">관리자</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      관리자 권한 설정 시 비밀번호가 필요합니다.
                    </p>
                  </div>
                  {role !== "viewer" && (
                    <div className="grid gap-2">
                      <Label htmlFor="adminPassword">관리자 비밀번호</Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        placeholder="관리자 비밀번호를 입력하세요"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="password">비밀번호</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">비밀번호 확인</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </div>
                  {error && <div className="text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-md">{error}</div>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "계정 생성 중..." : "회원가입"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  이미 계정이 있으신가요?{" "}
                  <Link href="/auth/login" className="underline underline-offset-4 text-primary hover:text-gray-600">
                    로그인
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

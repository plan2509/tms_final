"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email?: string
  name?: string
  role?: string
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        let { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single()

        // If profile doesn't exist, create it
        if (!profile) {
          console.log("[v0] Creating user profile for:", authUser.email)
          const { data: newProfile, error } = await supabase
            .from("users")
            .insert({
              id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "사용자",
              role: "viewer",
            })
            .select()
            .single()

          if (error) {
            console.error("[v0] Error creating user profile:", error)
          } else {
            profile = newProfile
            console.log("[v0] User profile created:", profile)
          }
        }

        setUser({
          id: authUser.id,
          email: authUser.email,
          name: profile?.name,
          role: profile?.role || "viewer",
        })
      }
      setLoading(false)
    }

    getUser()
  }, [supabase])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("새 비밀번호가 일치하지 않습니다.")
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("새 비밀번호는 최소 6자 이상이어야 합니다.")
      return
    }

    setPasswordChanging(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) {
        throw error
      }

      setPasswordSuccess(true)
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      })
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : "비밀번호 변경 중 오류가 발생했습니다.")
    } finally {
      setPasswordChanging(false)
    }
  }

  const handleRoleChange = async () => {
    if (!user) return

    // Admin 승격 시 비밀번호 확인
    if (user.role !== "admin") {
      const input = window.prompt("관리자로 변경하려면 비밀번호를 입력하세요")
      if (input !== "221114") {
        alert("비밀번호가 올바르지 않습니다.")
        return
      }
    }

    setUpdating(true)
    try {
      let newRole: "viewer" | "admin" | "business_development"
      if (user.role === "viewer") {
        newRole = "admin"
      } else if (user.role === "admin") {
        newRole = "business_development"
      } else {
        newRole = "viewer"
      }

      const { error } = await supabase.from("users").upsert({
        id: user.id,
        email: user.email,
        name: user.name || "사용자",
        role: newRole,
      })

      if (error) {
        console.error("[v0] Role update error:", error)
        alert("권한 변경 중 오류가 발생했습니다.")
      } else {
        console.log("[v0] Role changed successfully to:", newRole)
        setUser({ ...user, role: newRole })
        const roleNames = {
          admin: "관리자",
          business_development: "사업 개발",
          viewer: "뷰어"
        }
        alert(`권한이 ${roleNames[newRole]}로 변경되었습니다.`)
        router.refresh()
      }
    } catch (error) {
      console.error("[v0] Role change error:", error)
      alert("권한 변경 중 오류가 발생했습니다.")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">설정</h2>
          </div>
          <div className="bg-card p-8 rounded-lg border text-center">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">설정</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>사용자 프로필</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user?.name || "사용자"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Badge variant={user?.role === "admin" ? "default" : "secondary"}>
                {user?.role === "admin" ? "관리자" : 
                 user?.role === "business_development" ? "사업 개발" : "뷰어"}
              </Badge>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">권한 변경</p>
                  <p className="text-sm text-muted-foreground">
                    현재 권한: {user?.role === "admin" ? "관리자" : 
                               user?.role === "business_development" ? "사업 개발" : "뷰어"}
                  </p>
                </div>
                <Button onClick={handleRoleChange} disabled={updating} variant="outline">
                  {updating ? "변경 중..." : 
                   user?.role === "viewer" ? "관리자로 변경" :
                   user?.role === "admin" ? "사업 개발로 변경" : "뷰어로 변경"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>비밀번호 변경</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="최소 6자 이상"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </div>
              {passwordError && (
                <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="text-sm text-green-500 bg-green-500/10 p-3 rounded-md">
                  비밀번호가 성공적으로 변경되었습니다.
                </div>
              )}
              <Button type="submit" disabled={passwordChanging} className="w-full">
                {passwordChanging ? "변경 중..." : "비밀번호 변경"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>시스템 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">버전:</span> 1.0.0
              </p>
              <p className="text-sm">
                <span className="font-medium">도메인 제한:</span> watercharging.com
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

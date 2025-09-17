"use client"

import type React from "react"
import { useState, useEffect, memo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { TaxReminderSystem } from "@/components/tax-reminder-system"
import { Toaster } from "@/components/ui/toaster"

interface GlobalLayoutProps {
  children: React.ReactNode
}

interface AppUser {
  id: string
  email?: string
  name?: string
  role?: string
}

const textNavigation = [
  { name: "대시보드", href: "/dashboard" },
  { name: "충전소", href: "/stations" },
  { name: "세금", href: "/taxes" },
  { name: "사업 일정", href: "/station-schedules" },
  { name: "알림", href: "/notifications" },
  { name: "통계", href: "/statistics" },
  { name: "캘린더", href: "/calendar" },
  { name: "설정", href: "/settings" },
  { name: "메뉴얼", href: "/manual" },
]

const GlobalLayoutComponent = ({ children }: GlobalLayoutProps) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isAuthPage = pathname.startsWith("/auth") || pathname === "/"

  useEffect(() => {
    // 이미 초기화되었으면 다시 실행하지 않음
    if (isInitialized) return

    let mounted = true
    let subscription: any = null
    let timeoutId: NodeJS.Timeout | null = null

    const initializeAuth = async () => {
      try {
        // console.log("[v0] GlobalLayout: Initializing Supabase client")
        const supabase = createClient()

        if (!supabase) {
          throw new Error("Failed to create Supabase client")
        }

        if (!mounted) return

        setInitError(null)

        // console.log("[v0] GlobalLayout: Getting user authentication status")

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[v0] GlobalLayout: Session error:", sessionError.message)
          if (!sessionError.message.includes("session_not_found")) {
            throw sessionError
          }
        }

        if (!mounted) return

        if (session?.user) {
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split("@")[0],
            role: session.user.user_metadata?.role || "user",
          }
          // console.log("[v0] GlobalLayout: Setting user data from session:", userData)
          setUser(userData)
          
          // Fetch DB role to reflect latest permissions
          try {
            const { data: profile } = await supabase.from("users").select("role, name").eq("id", session.user.id).single()
            if (profile?.role && mounted) {
              setUser((prev) => (prev ? { ...prev, role: profile.role, name: profile.name || prev.name } : prev))
            }
          } catch {}
        } else {
          // console.log("[v0] GlobalLayout: No active session found")
          setUser(null)
        }

        // Set up auth state change listener (중복 이벤트 방지)
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
          if (!mounted) return
          
          // INITIAL_SESSION 이벤트는 무시 (이미 처리됨)
          if (event === 'INITIAL_SESSION') return
          
          try {
            // console.log("[v0] GlobalLayout: Auth state change event:", event)
            if (session?.user) {
              const userData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email?.split("@")[0],
                role: session.user.user_metadata?.role || "user",
              }
              // console.log("[v0] GlobalLayout: Auth state change - setting user:", userData)
              setUser(userData)
              try {
                const { data: profile } = await supabase.from("users").select("role, name").eq("id", session.user.id).single()
                if (profile?.role && mounted) {
                  setUser((prev) => (prev ? { ...prev, role: profile.role, name: profile.name || prev.name } : prev))
                }
              } catch {}
            } else {
              // console.log("[v0] GlobalLayout: Auth state change - clearing user")
              setUser(null)
            }
          } catch (error) {
            console.error("[v0] GlobalLayout: Error in auth state change:", error)
          }
        })

        subscription = authSubscription
      } catch (error) {
        console.error("[v0] GlobalLayout: Failed to initialize authentication:", error)
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : "Failed to initialize authentication"
          setInitError(errorMessage)
          setUser(null)
        }
      } finally {
        if (mounted) {
          // console.log("[v0] GlobalLayout: Setting loading to false")
          setLoading(false)
          setIsInitialized(true)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isInitialized])

  // 콘솔 로그를 줄여서 성능 개선
  // console.log(
  //   "[v0] GlobalLayout: Current state - loading:",
  //   loading,
  //   "user:",
  //   user ? "present" : "null",
  //   "pathname:",
  //   pathname,
  // )

  if (initError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-destructive">인증 시스템 오류</h1>
          <p className="text-muted-foreground mb-4">{initError}</p>
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-background border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center space-x-3">
                <div className="text-3xl font-black text-primary">TMS</div>
                <div className="hidden sm:block text-sm font-medium text-muted-foreground">세무 관리 시스템</div>
              </Link>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    )
  }

  if (!user || isAuthPage) {
    return (
      <div className="min-h-screen bg-background">
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {process.env.NEXT_PUBLIC_ENABLE_TAX_ALERTS === "1" && <TaxReminderSystem />}

      <div className="w-64 bg-black border-r border-border flex flex-col">
        <div className="p-6 bg-neutral-900">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="text-3xl font-black italic text-slate-400">TMS</div>
            <div className="font-medium text-muted-foreground text-sm">세무 관리 시스템</div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 bg-neutral-900">
          {(() => {
            const allowedForBD = new Set(["/dashboard", "/stations", "/station-schedules", "/statistics", "/settings"])
            const visibleNavigation = user?.role === "business_development"
              ? textNavigation.filter((i) => allowedForBD.has(i.href))
              : textNavigation
            return visibleNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "block px-4 py-3 font-medium transition-colors text-base leading-8 tracking-normal h-auto rounded-xl",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {item.name}
                </Link>
              )
            })
          })()}
          {user?.role === "admin" && (
            <Link
              href="/audit-logs"
              className={cn(
                "block px-4 py-3 font-medium transition-colors text-base leading-8 tracking-normal h-auto rounded-xl",
                pathname === "/audit-logs"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              이력 관리
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800 bg-neutral-900">
          <Button variant="ghost" size="sm" onClick={() => handleSignOut(router)} className="w-full justify-start">
            로그아웃
          </Button>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <img src="/logo-small.png" alt="Water" className="h-4 w-auto opacity-80" />
            <span>made by water</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">{children}</div>

      <Toaster />
    </div>
  )
}

export const GlobalLayout = memo(GlobalLayoutComponent)

const handleSignOut = async (router: any) => {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  } catch (error) {
    console.error("Error signing out:", error)
  }
}

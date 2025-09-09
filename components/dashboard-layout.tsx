"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Calendar, BarChart3, Building2, Receipt, Bell, Settings, LogOut, Menu, Home, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    id: string
    email?: string
    name?: string
    role?: string
  }
}

const navigation = [
  { name: "대시보드", href: "/dashboard", icon: Home, roles: ["admin", "viewer", "business_development"] },
  { name: "충전소", href: "/stations", icon: Building2, roles: ["admin", "viewer", "business_development"] },
  { name: "사업 일정", href: "/station-schedules", icon: Calendar, roles: ["admin", "business_development"] },
  { name: "세금", href: "/taxes", icon: Receipt, roles: ["admin", "viewer"] },
  { name: "알림", href: "/notifications", icon: Bell, roles: ["admin"] },
  { name: "통계", href: "/statistics", icon: BarChart3, roles: ["admin", "viewer", "business_development"] },
  { name: "캘린더", href: "/calendar", icon: Calendar, roles: ["admin", "viewer"] },
  { name: "설정", href: "/settings", icon: Settings, roles: ["admin", "viewer", "business_development"] },
]

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // 권한별 접근 가능한 메뉴 필터링
  const getAccessibleMenus = () => {
    const userRole = user.role || "viewer"
    return navigation.filter(item => item.roles.includes(userRole))
  }

  const accessibleMenus = getAccessibleMenus()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-background typo-grid">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-3">
                <div className="text-2xl font-bold typo-heading text-foreground">TMS</div>
                <div className="hidden sm:block text-sm typo-body text-muted-foreground">세금 일정 관리 시스템</div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {accessibleMenus.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "text-sm font-medium typo-body transition-colors duration-200 hover:text-accent",
                      isActive ? "text-accent border-b-2 border-accent pb-1" : "text-muted-foreground",
                    )}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* User Profile and Mobile Menu */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium typo-body text-foreground">{user.name || "사용자"}</p>
                  <p className="text-xs typo-body text-muted-foreground">
                    {user.role === "admin" ? "관리자" : 
                     user.role === "business_development" ? "사업 개발" : "뷰어"}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                  <User className="h-4 w-4 text-accent-foreground" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="flex flex-col h-full">
                    <div className="py-6 border-b border-border">
                      <h2 className="text-xl font-bold typo-heading">TMS</h2>
                      <p className="text-sm typo-body text-muted-foreground">세금 일정 관리 시스템</p>
                    </div>

                    <nav className="flex-1 py-6">
                      <div className="space-y-2">
                        {accessibleMenus.map((item) => {
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium typo-body transition-colors",
                                isActive
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                              )}
                            >
                              <item.icon className="h-5 w-5" />
                              {item.name}
                            </Link>
                          )
                        })}
                      </div>
                    </nav>

                    <div className="border-t border-border pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                          <User className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium typo-body">{user.name || "사용자"}</p>
                          <p className="text-xs typo-body text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSignOut}
                        className="w-full justify-start gap-2 bg-transparent"
                      >
                        <LogOut className="h-4 w-4" />
                        로그아웃
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}

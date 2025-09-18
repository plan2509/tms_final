import type React from "react"
import type { Metadata } from "next"
import { Montserrat, Open_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { GlobalLayout } from "@/components/global-layout"
import "./globals.css"

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  /* Reduced font weights to only commonly used ones to minimize preload */
  weight: ["400", "600", "700"],
})

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-open-sans",
  /* Reduced font weights to minimize preload */
  weight: ["400", "600"],
})

export const metadata: Metadata = {
  title: "TMS - 세무 관리 시스템",
  description: "충전소 세무 일정을 체계적으로 관리하는 시스템",
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/favicon_180x180.png", type: "image/png", sizes: "180x180" },
    ],
    shortcut: "/favicon_180x180.png",
    apple: "/favicon_180x180.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${openSans.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <GlobalLayout>{children}</GlobalLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand";
import { ThemeProvider } from "@/components/theme-provider";
import { TRPCProvider } from "@/lib/trpc/Provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${brand.name} — Dental ve Muhasebe Yönetim Yazılımı`,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
  keywords: [
    "dentasist",
    "diş kliniği yazılımı",
    "diş hekimi randevu programı",
    "diş kliniği muhasebe programı",
    "hasta takip sistemi",
    "klinik yönetim yazılımı",
    "dental yazılım",
  ],
  authors: [{ name: brand.name }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: brand.name,
    title: `${brand.name} — Dental ve Muhasebe Yönetim Yazılımı`,
    description: brand.tagline,
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: `${brand.name} — Dental ve Muhasebe Yönetim Yazılımı`,
    description: brand.tagline,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionProvider>
            <TRPCProvider>
              <TooltipProvider>
                {children}
                <Toaster position="top-center" richColors />
              </TooltipProvider>
            </TRPCProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

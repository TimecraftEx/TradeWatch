import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TradeWatch",
  description: "Stock trade monitor — track P&L, get alerts on lows",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "#000", color: "#fff" }}>
        {/* Top nav */}
        <header className="border-b border-[#1a1a1a] sticky top-0 z-50" style={{ background: "#000" }}>
          <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between">
            <Link href="/" className="text-sm sm:text-base font-bold tracking-tight shrink-0" style={{ color: "#00c805" }}>
              TradeWatch
            </Link>
            <nav className="flex gap-3 sm:gap-6 text-xs sm:text-sm font-medium" style={{ color: "#666" }}>
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/trades" className="hover:text-white transition-colors">Trades</Link>
              <Link href="/alerts" className="hover:text-white transition-colors">Alerts</Link>
              <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

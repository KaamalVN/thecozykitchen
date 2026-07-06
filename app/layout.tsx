import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#4e6e58",
};

export const metadata: Metadata = {
  title: "The Cozy Kitchen — Handcrafted Home Recipes",
  description: "A warm, personal home-cooking recipe website showcasing dishes made at home, with love.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cozy Kitchen",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <head>
        {/* Load Material Symbols Outlined for icons used in the design system */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full bg-background-cream dark:bg-dark-bg text-on-surface dark:text-surface-variant antialiased relative selection:bg-surface-dim selection:text-on-surface flex flex-col transition-colors duration-300">
        <div className="noise-overlay"></div>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}

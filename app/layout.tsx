import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "Ofek Radar",
  description: "מערכת ניהול מחזורי ראיונות ומיון מועמדים",
  icons: {
    icon: [{ url: "/ofek-radar-icon.svg", type: "image/svg+xml" }],
    shortcut: "/ofek-radar-icon.svg",
    apple: "/ofek-radar-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}

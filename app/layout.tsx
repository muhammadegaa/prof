import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", axes: ["opsz"] });

export const metadata: Metadata = {
  title: "profcareer",
  appleWebApp: { capable: true, title: "profcareer", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { ReactLenis } from "lenis/react";
import EdgeBlur from "@/components/EdgeBlur";
// Preloader temporarily disabled, see src/components/Preloader.tsx
// import Preloader from "@/components/Preloader";
import "lenis/dist/lenis.css";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://zaane.co"),
  title: "Zaane: Design, Development & MVPs",
  description:
    "Zaane is an independent studio for brand design, UI/UX, web and app development, MVPs, and lasting brand partnerships.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ReactLenis root options={{ lerp: 0.1, duration: 1.2 }}>
          {children}
        </ReactLenis>
        <EdgeBlur />
      </body>
    </html>
  );
}

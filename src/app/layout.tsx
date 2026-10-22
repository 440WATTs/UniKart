import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Pixelify_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-montserrat" });
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-pixelify" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  title: { default: "UniMart – Your Campus. Your Marketplace.", template: "%s · UniMart" },
  description: "Buy and sell with your campus community. Find what you need, sell what you no longer use.",
  icons: { icon: "/brand/unimart-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7ad1fe",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className={`${inter.variable} ${montserrat.variable} ${pixelify.variable} ${spaceMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

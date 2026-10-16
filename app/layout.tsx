import type { Metadata } from "next";
import { Bricolage_Grotesque, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-nastaliq" });

export const metadata: Metadata = {
  title: "Prime Mart",
  description: "Quality. Choice. Value.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${nastaliq.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

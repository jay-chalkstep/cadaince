import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aicomplice - Your AI Accomplice for Leadership Alignment",
  description: "Synthesize metrics, context, and updates into decision-ready intelligence. Built for teams running on EOS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

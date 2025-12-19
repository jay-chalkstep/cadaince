import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Force dynamic rendering for all pages (auth required)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aicomplice",
  description: "Your AI accomplice for leadership alignment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

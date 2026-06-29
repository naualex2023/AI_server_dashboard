import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Server Monitor",
  description:
    "Real-time GPU / CPU / fan monitoring dashboard for 4× Tesla P40 servers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}

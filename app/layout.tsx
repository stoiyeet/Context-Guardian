import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Context Guardian",
  description:
    "Internal operations dashboard prototype for pre-generated inference blueprints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="app-topnav">
          <p>Context Guardian</p>
          <nav>
            <Link href="/">Dashboard</Link>
            <Link href="/messages">Messages</Link>
            <Link href="/knowledge-base">Knowledge Base</Link>
          </nav>
        </header>
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ambient Operations Node (POC)",
  description:
    "Prototype AI sidecar for engineering workflow friction detection, incident classification, and institutional memory retrieval.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

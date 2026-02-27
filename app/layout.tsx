import type { Metadata } from "next";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}

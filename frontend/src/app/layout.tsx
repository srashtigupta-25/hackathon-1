import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autopsy Lab | AI Incident Reconstruction",
  description:
    "Turn raw logs into an evidence-backed incident timeline, root cause, and remediation plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

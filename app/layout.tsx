import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { EditionProvider } from "@/components/edition/edition";
import { editionCookie, readEdition } from "@/lib/edition";

import { firstPaintScript } from "@/lib/appearance/preferences";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "山笺 · 私人日记",
    template: "%s · 山笺",
  },
  description: "把不必与人说的日子，安静地留在这里。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4eee1",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const edition = readEdition((await cookies()).get(editionCookie)?.value);
  return (
    <html lang="zh-CN" data-edition={edition} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: firstPaintScript }} /></head>
      <body><EditionProvider initialEdition={edition}>{children}</EditionProvider></body>
    </html>
  );
}

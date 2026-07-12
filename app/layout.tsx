import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();
  const description = "식사 전후 사진으로 섭취 결과를 확인하고 다음 배식량을 안내받는 사용자 서비스";

  return {
    metadataBase,
    title: { default: "한끼로그 | 스마트 배식", template: "%s | 한끼로그" },
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "한끼로그 | 스마트 배식", description, type: "website", images: [{ url: socialImage, width: 1729, height: 910, alt: "한끼로그 스마트 배식 서비스" }] },
    twitter: { card: "summary_large_image", title: "한끼로그 | 스마트 배식", description, images: [socialImage] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}

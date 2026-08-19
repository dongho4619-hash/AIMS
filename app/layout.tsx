import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const title = "MATFLOW | 기술부 자재 신청";
  const description = "기술부 자재 신청부터 승인, 구매, 출고까지 한 곳에서 관리합니다.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "ko_KR", images: [{ url: image, width: 1200, height: 630, alt: "MATFLOW 기술부 자재 신청 서비스" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

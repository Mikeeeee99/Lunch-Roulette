import "./globals.css";
import { headers } from "next/headers";

const title = "Lunch Roulette AI｜今天中午吃什么？";
const description = "排除不想吃的，避开最近吃过的，用午餐转盘快速决定今天吃什么。";

export async function generateMetadata() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1680, height: 945 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

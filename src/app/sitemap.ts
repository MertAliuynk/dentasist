import type { MetadataRoute } from "next";
import { SIGNUP_OPEN } from "@/lib/signup";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/fiyatlandirma", priority: 0.9, changeFrequency: "weekly" },
    { path: "/sss", priority: 0.7, changeFrequency: "monthly" },
    ...(SIGNUP_OPEN ? [{ path: "/kayit", priority: 0.6, changeFrequency: "monthly" as const }] : []),
    { path: "/giris", priority: 0.3, changeFrequency: "monthly" },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

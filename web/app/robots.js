import { siteConfig } from "@/lib/site-config";

// Force dynamic rendering so APP_BASE_URL is read at runtime, not build time
export const dynamic = "force-dynamic";

export default function robots() {
  const baseUrl = siteConfig.siteUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/login",
        "/signup",
        "/favorites",
        "/saved",
        "/saved-searches",
        "/notifications",
        "/notification-settings",
        "/profile",
        "/my-events",
        "/my-results",
        "/reviews/new",
        "/compare",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

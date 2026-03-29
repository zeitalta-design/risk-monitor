import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import CompareBar from "@/components/CompareBar";
import DataTrackInit from "@/components/DataTrackInit";
import { siteConfig } from "@/lib/site-config";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: `${siteConfig.siteName} | ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.siteName}`,
  },
  description: siteConfig.siteDescription,
  openGraph: {
    siteName: siteConfig.siteName,
    locale: "ja_JP",
    type: "website",
    title: `${siteConfig.siteName} | ${siteConfig.tagline}`,
    description: siteConfig.siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.siteName} | ${siteConfig.tagline}`,
    description: siteConfig.siteDescription,
  },
  alternates: {
    canonical: siteConfig.siteUrl,
  },
};

// Phase222: 構造化データ（JSON-LD）
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteConfig.siteName,
      alternateName: siteConfig.siteNameEn,
      url: siteConfig.siteUrl,
      description: siteConfig.siteDescription,
      inLanguage: "ja",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteConfig.siteUrl}/platform/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
      description: siteConfig.siteDescription,
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} antialiased min-h-screen flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Analytics />
        <DataTrackInit />
        <Header />
        <main className="flex-1 pb-14">{children}</main>
        <Footer />
        <CompareBar />
      </body>
    </html>
  );
}

"use client";

import PlatformSection from "@/components/home/PlatformSection";
import PlatformNav from "@/components/platform/PlatformNav";

export default function PlatformPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <PlatformNav current="/platform" />
      </div>
      <PlatformSection />
    </div>
  );
}

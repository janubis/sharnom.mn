import * as React from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";

/**
 * Public site chrome: sticky header, page content, footer, and a mobile bottom
 * tab bar. Content gets `pb-16 md:pb-0` so it clears the fixed MobileNav.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}

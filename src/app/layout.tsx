import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { Providers } from "@/components/providers";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: "Mongol Local — Улаанбаатарын шилдэг газрууд",
    template: "%s | Mongol Local",
  },
  description:
    "Улаанбаатар хот болон Монгол даяарх ресторан, кафе, үйлчилгээ, дэлгүүрүүдийг сэтгэгдэл, үнэлгээ, газрын зурагтайгаар олж нээ.",
  applicationName: "Mongol Local",
  keywords: ["Монгол бизнес", "Улаанбаатар", "ресторан", "кафе", "сэтгэгдэл", "Mongol Local"],
  openGraph: {
    type: "website",
    locale: "mn_MN",
    siteName: "Mongol Local",
    title: "Mongol Local — Улаанбаатарын шилдэг газрууд",
    description: "Ресторан, кафе, үйлчилгээг сэтгэгдэл, үнэлгээтэйгээр олж нээ.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#181513" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={notoSans.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/lib/constants";
import { Container } from "@/components/layout/container";

type FooterLink = { href: string; label: string };
type FooterColumn = { heading: string; links: FooterLink[] };

/**
 * Site footer with three link columns, brand, language note and copyright.
 * Server component — reads the `footer.*` i18n namespace.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  const columns: FooterColumn[] = [
    {
      heading: t("about"),
      links: [
        { href: "/about", label: t("about") },
        { href: "/contact", label: t("contact") },
        { href: "/terms", label: t("terms") },
        { href: "/privacy", label: t("privacy") },
      ],
    },
    {
      heading: t("forBusiness"),
      links: [
        { href: "/owner/businesses/new", label: t("addBusiness") },
        { href: "/owner", label: "Бизнесийн самбар" },
        { href: "/claim", label: "Бизнесээ эзэмших" },
      ],
    },
    {
      heading: t("help"),
      links: [
        { href: "/help", label: t("help") },
        { href: "/search", label: "Хайх" },
        { href: "/contact", label: t("contact") },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="ulzii-rule" aria-hidden />
      <Container className="py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="" width={28} height={28} className="size-7" />
              <span className="font-display text-base font-bold tracking-tight text-foreground">
                {APP_NAME}
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Монголын шилдэг газруудыг нээ — ресторан, үйлчилгээ, дэлгүүрийг
              сэтгэгдэл, үнэлгээтэйгээр.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {col.heading}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            © {year} {APP_NAME}. {t("rights")}.
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <span aria-hidden>🇲🇳</span>
            Монгол хэл дээр
          </p>
        </div>
      </Container>
    </footer>
  );
}

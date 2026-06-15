import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Нэвтрэх",
  description: "Mongol Local-д нэвтэрч сэтгэгдэл бичих, газар хадгалаарай.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/** Only allow same-site relative callback URLs. */
function safeCallback(raw?: string): string {
  if (!raw) return "/";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const callbackUrl = safeCallback(sp.callbackUrl);

  // Already signed in — bounce to the callback (or home).
  if (user) redirect(callbackUrl);

  return (
    <main className="felt-surface relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-secondary/[0.05]"
        aria-hidden
      />

      {/* Back to home */}
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:left-6 sm:top-6"
      >
        <ArrowLeft className="size-4" />
        Нүүр хуудас
      </Link>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt=""
              width={40}
              height={40}
              className="size-10"
              priority
            />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </Link>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
            Mongol Local-д нэвтрэх
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Сэтгэгдэл бичих, газар хадгалах, бизнесээ эзэмших
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-card backdrop-blur">
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Үргэлжлүүлснээр та{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            үйлчилгээний нөхцөл
          </Link>{" "}
          болон{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            нууцлалын бодлогыг
          </Link>{" "}
          зөвшөөрнө.
        </p>
      </div>

      <div className="ulzii-rule mt-10 w-full max-w-sm" aria-hidden />
    </main>
  );
}

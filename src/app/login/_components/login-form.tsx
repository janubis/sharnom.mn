"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Provider = "google" | "facebook" | "apple" | "email";

/** Brand glyphs for the OAuth buttons (kept inline to avoid extra deps). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-[#1877F2]">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-foreground">
      <path d="M17.05 12.54c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.17-2.06-3.85-2.09-1.64-.17-3.2.96-4.03.96-.83 0-2.11-.94-3.47-.91-1.79.03-3.44 1.04-4.36 2.64-1.86 3.22-.48 7.99 1.33 10.6.88 1.28 1.93 2.71 3.31 2.66 1.33-.05 1.83-.86 3.44-.86 1.6 0 2.06.86 3.47.83 1.43-.02 2.34-1.3 3.22-2.59 1.01-1.49 1.43-2.93 1.45-3-.03-.02-2.78-1.07-2.81-4.24Zm-2.65-7.79c.73-.89 1.22-2.12 1.09-3.35-1.05.04-2.32.7-3.07 1.58-.67.78-1.26 2.03-1.1 3.23 1.17.09 2.36-.6 3.08-1.46Z" />
    </svg>
  );
}

const OAUTH: {
  id: Exclude<Provider, "email">;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "google", label: "Google-ээр үргэлжлүүлэх", icon: <GoogleIcon /> },
  { id: "facebook", label: "Facebook-ээр үргэлжлүүлэх", icon: <FacebookIcon /> },
  { id: "apple", label: "Apple-ээр үргэлжлүүлэх", icon: <AppleIcon /> },
];

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState<Provider | null>(null);
  const [sent, setSent] = React.useState(false);

  async function oauth(id: Exclude<Provider, "email">) {
    setPending(id);
    try {
      await signIn(id, { callbackUrl });
    } catch {
      setPending(null);
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: "Дахин оролдоно уу.",
      });
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending("email");
    try {
      const res = await signIn("nodemailer", {
        email: email.trim(),
        redirect: false,
        callbackUrl,
      });
      if (res?.error) throw new Error(res.error);
      setSent(true);
    } catch {
      toast({
        variant: "destructive",
        title: "Илгээж чадсангүй",
        description: "И-мэйл хаягаа шалгаад дахин оролдоно уу.",
      });
    } finally {
      setPending(null);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div>
          <p className="font-display font-semibold text-foreground">
            Нэвтрэх холбоосыг и-мэйлээр илгээлээ
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{email}</span> хаяг
            руу илгээсэн холбоосоор нэвтэрнэ үү.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
          Өөр хаягаар оролдох
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OAuth buttons */}
      <div className="space-y-2.5">
        {OAUTH.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            size="lg"
            className="w-full justify-center gap-3"
            disabled={pending !== null}
            onClick={() => oauth(p.id)}
          >
            {pending === p.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              p.icon
            )}
            {p.label}
          </Button>
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          эсвэл
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Email magic link */}
      <form onSubmit={magicLink} className="space-y-2.5">
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@email.com"
            aria-label="И-мэйл хаяг"
            className="pl-9"
            disabled={pending !== null}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className={cn("w-full")}
          disabled={pending !== null || !email.trim()}
        >
          {pending === "email" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          Холбоос илгээх
        </Button>
      </form>
    </div>
  );
}

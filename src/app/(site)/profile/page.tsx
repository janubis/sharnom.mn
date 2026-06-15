import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { PatternRule } from "@/components/common/pattern-rule";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/db/queries/users";
import { listSavedBusinesses } from "@/db/queries/saved";

import {
  ProfileTabs,
  type ProfileReview,
} from "./_components/profile-tabs";

export const metadata: Metadata = {
  title: "Миний профайл",
  description: "Таны сэтгэгдэл, хадгалсан газрууд, статистик.",
  robots: { index: false, follow: false },
};

function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email?.split("@")[0] || "";
  if (!base) return "?";
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function memberSince(iso: Date): string {
  try {
    return new Intl.DateTimeFormat("mn-MN", {
      year: "numeric",
      month: "long",
    }).format(iso);
  } catch {
    return String(iso.getFullYear());
  }
}

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const profile = await getUserProfile(sessionUser.id);
  if (!profile) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  // First page of saved businesses for the "Хадгалсан" tab.
  const saved = await listSavedBusinesses(sessionUser.id, 1, 9);

  const reviews: ProfileReview[] = profile.recentReviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    business: r.business,
  }));

  return (
    <Container className="py-8 sm:py-10">
      {/* Identity header */}
      <div className="flex items-center gap-4 sm:gap-5">
        <Avatar className="size-16 sm:size-20">
          {profile.user.image && (
            <AvatarImage
              src={profile.user.image}
              alt={profile.user.name ?? ""}
            />
          )}
          <AvatarFallback className="bg-primary/10 text-lg text-primary">
            {initials(profile.user.name, profile.user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {profile.user.name ?? "Хэрэглэгч"}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {profile.user.email}
          </p>
          {profile.user.bio && (
            <p className="mt-2 max-w-xl text-sm text-foreground/90">
              {profile.user.bio}
            </p>
          )}
        </div>
      </div>

      <PatternRule spacing="md" />

      <ProfileTabs
        reviews={reviews}
        saved={saved.items}
        savedIds={saved.items.map((b) => b.id)}
        stats={{
          reviewCount: profile.reviewCount,
          photoCount: profile.photoCount,
          savedCount: profile.savedCount,
          memberSince: memberSince(profile.user.createdAt),
        }}
      />
    </Container>
  );
}

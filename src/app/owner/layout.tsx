import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { OwnerSidebar, OwnerTopbar } from "./_components/owner-nav";

/**
 * Owner-area chrome: a fixed sidebar (desktop) + sticky topbar with a
 * back-to-site link and user menu. Middleware already gates /owner to OWNER+,
 * but we re-check on the server here as defence-in-depth and to redirect
 * gracefully when a session is missing.
 */
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user) {
    redirect("/login?callbackUrl=/owner");
  }
  if (!hasRole(role, "OWNER")) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <OwnerSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OwnerTopbar />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

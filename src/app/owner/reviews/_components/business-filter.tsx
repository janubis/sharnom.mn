"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

/** URL-driven business filter for the owner reviews list. */
export function BusinessFilter({
  businesses,
  value,
}: {
  businesses: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === ALL) {
      sp.delete("business");
    } else {
      sp.set("business", next);
    }
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={value || ALL} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="Бүх бизнес" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Бүх бизнес</SelectItem>
        {businesses.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

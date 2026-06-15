import { Store } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";

export default function BusinessNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 sm:px-6">
      <EmptyState
        icon={Store}
        title="Энэ бизнес олдсонгүй"
        description="Хайж буй газар устгагдсан, нэгтгэгдсэн эсвэл хаяг буруу байж магадгүй. Өөр газар хайж үзээрэй."
        action={{ label: "Хайлт хийх", href: "/search" }}
        secondaryAction={{ label: "Нүүр хуудас", href: "/" }}
      />
    </div>
  );
}

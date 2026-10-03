import Link from "next/link";
import type { MenuItem } from "@/content/types";
import { MenuList } from "./MenuList";

export function Nav({ siteName, items }: { siteName: string; items: MenuItem[] }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-semibold">
          {siteName}
        </Link>
        <nav aria-label="Primary">
          <MenuList items={items} className="flex flex-wrap gap-1" />
        </nav>
      </div>
    </header>
  );
}

import type { MenuItem } from "@/content/types";
import { MenuList } from "./MenuList";

export function Footer({ siteName, items }: { siteName: string; items: MenuItem[] }) {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
        <p>
          &copy; {new Date().getFullYear()} {siteName}
        </p>
        <nav aria-label="Footer">
          <MenuList items={items} className="flex flex-wrap gap-1" />
        </nav>
      </div>
    </footer>
  );
}

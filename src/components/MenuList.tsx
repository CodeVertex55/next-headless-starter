import Link from "next/link";
import type { MenuItem } from "@/content/types";

function Item({ item }: { item: MenuItem }) {
  const props = item.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <li className="relative">
      <Link href={item.href} {...props} className="px-3 py-2 hover:underline">
        {item.label}
      </Link>
      {item.children.length > 0 && (
        <ul className="ml-4 flex flex-col text-sm md:ml-0">
          {item.children.map((c) => (
            <Item key={`${c.href}|${c.label}`} item={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Plain nested lists, no client JS. Shared by Nav and Footer. */
export function MenuList({ items, className }: { items: MenuItem[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((i) => (
        <Item key={`${i.href}|${i.label}`} item={i} />
      ))}
    </ul>
  );
}

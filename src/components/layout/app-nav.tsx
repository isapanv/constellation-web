"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Главные вкладки личного кабинета. Профиль вынесен в иконку справа (ProfileMenu). */
export const mainTabs = [
  { href: "/projects", label: "Мои проекты" },
  { href: "/team-search", label: "Поиск команды" },
  { href: "/calendar", label: "Календарь" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Основные разделы" className="flex h-full">
      {mainTabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center whitespace-nowrap border-b-[3px] px-3 text-sm font-semibold transition-colors",
              active ? "border-accent text-accent" : "border-transparent text-muted hover:border-border hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

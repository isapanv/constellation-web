"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/api/use-me";
import { UserAvatar } from "@/components/ui/user-avatar";

/** Разделы, которые раньше были в боковом меню, теперь живут под иконкой профиля. */
const profileLinks = [
  { href: "/profile", label: "Профиль" },
  { href: "/work-style", label: "Стиль работы" },
  { href: "/portfolio", label: "Портфолио" },
];

export function ProfileMenu() {
  const pathname = usePathname();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name = me?.profile?.displayName ?? "";
  const inProfile = profileLinks.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"));

  // Закрываем по клику снаружи и по Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    setOpen(false);
    await api.logout().catch(() => undefined);
    // Полная перезагрузка на главную: сбрасывает всё состояние кабинета и не даёт ему увести на /login
    window.location.assign("/");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Мой профиль"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("block rounded-full transition-shadow", (open || inProfile) && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}
      >
        <UserAvatar name={name} src={me?.profile?.avatarUrl} size="md" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border-2 border-border bg-surface py-1 shadow-[0_4px_0_var(--border)]">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{name || "Профиль не заполнен"}</p>
            {/* TODO: ссылка «Публичный профиль →» на /u/{slug} для специалистов — когда публичная страница переедет на API */}
          </div>
          {me?.staffRole && (
            <div className="border-b border-border py-1">
              {pathname.startsWith("/admin") ? (
                <Link href="/projects" role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-surface-2">
                  Мои проекты
                </Link>
              ) : (
                <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm font-semibold hover:bg-surface-2">
                  Админка
                </Link>
              )}
            </div>
          )}
          {profileLinks.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn("block px-4 py-2 text-sm hover:bg-surface-2", active && "font-medium text-accent")}
              >
                {l.label}
              </Link>
            );
          })}
          <div className="mt-1 border-t border-border pt-1">
            <button type="button" role="menuitem" onClick={logout} className="block w-full px-4 py-2 text-left text-sm text-muted hover:bg-surface-2">
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { LinkButton } from "@/components/ui/button";
import { MascotState } from "@/components/ui/mascot";
import { type Permission, can, staffRoleLabel } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api/client";
import type { StaffMe } from "@/lib/api/admin-types";
import { StaffProvider } from "./staff-context";

const tabs: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "Сводка", perm: "dashboard.read" },
  { href: "/admin/queue", label: "Ручной подбор", perm: "queue.read" },
  { href: "/admin/projects", label: "Проекты", perm: "projects.read" },
  { href: "/admin/users", label: "Пользователи", perm: "users.read" },
  { href: "/admin/avatars", label: "Аватары", perm: "avatars.moderate" },
  { href: "/admin/staff", label: "Сотрудники", perm: "staff.manage" },
  { href: "/admin/audit", label: "Журнал", perm: "audit.read" },
];

type State = { status: "loading" } | { status: "ok"; staff: StaffMe } | { status: "denied" };

/**
 * Оболочка админки. Роль спрашиваем у сервера; не сотрудник (или гость) видит обычную «страницы нет».
 * Сама оболочка данных не содержит — их отдаёт только API после проверки роли.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const pathname = usePathname();

  useEffect(() => {
    api.admin
      .me()
      .then((r) => setState({ status: "ok", staff: r.staff }))
      .catch(() => setState({ status: "denied" }));
  }, []);

  if (state.status === "denied")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <Logo />
        <MascotState
          pose="think"
          title="Такой страницы нет"
          text="Возможно, ссылка устарела или профиль скрыт владельцем."
          action={
            <LinkButton href="/" variant="secondary">
              На главную
            </LinkButton>
          }
          className="w-full max-w-md"
        />
      </div>
    );

  const staff = state.status === "ok" ? state.staff : null;
  const visible = tabs.filter((t) => can(staff?.role, t.perm));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b-2 border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 px-4 sm:flex-nowrap sm:gap-x-6">
          <div className="flex h-16 shrink-0 items-center gap-2">
            <Logo href="/admin" />
            <span className="rounded-lg bg-fg px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-bg">Админка</span>
          </div>
          {/* На телефоне вкладки — второй строкой, на широком — в одной строке с логотипом */}
          <nav aria-label="Разделы админки" className="order-last -mx-4 flex h-12 w-[calc(100%+2rem)] min-w-0 overflow-x-auto px-2 sm:order-none sm:mx-0 sm:h-16 sm:w-auto sm:flex-1 sm:px-0">
            {visible.map((t) => {
              const active = t.href === "/admin" ? pathname === "/admin" : pathname === t.href || pathname.startsWith(t.href + "/");
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
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
            {staff && <span className="hidden text-xs text-muted lg:inline">{staffRoleLabel[staff.role]}</span>}
            <ProfileMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6">
        <StaffProvider value={staff}>{children}</StaffProvider>
      </main>
    </div>
  );
}

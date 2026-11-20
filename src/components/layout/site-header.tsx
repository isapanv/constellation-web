"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { useMe } from "@/lib/api/use-me";

/**
 * Шапка для публичных страниц (профиль /u/…, лендинг):
 * вошёл — шапка кабинета с вкладками, гость — «Войти» и «Регистрация».
 */
export function SiteHeader() {
  const { loading, me } = useMe();
  if (me?.profile) return <AppHeader />;
  return (
    <header className="border-b-2 border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        {/* Пока не знаем, вошёл ли человек, кнопки не показываем — чтобы не мигали */}
        {!loading && (
          <div className="flex gap-2">
            <LinkButton href="/login" variant="ghost">
              Войти
            </LinkButton>
            {/* На телефоне регистрация — через кнопки на странице, в шапке не помещается */}
            <span className="hidden sm:block">
              <LinkButton href="/signup">Регистрация</LinkButton>
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

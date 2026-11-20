import { AppNav } from "@/components/layout/app-nav";
import { Logo } from "@/components/layout/logo";
import { ProfileMenu } from "@/components/layout/profile-menu";

/**
 * Шапка вошедшего пользователя: логотип, вкладки, профиль справа.
 * Одна строка на любой ширине, без правил «скрыть на широком / показать на узком»:
 * на узком экране вкладки просто прокручиваются вбок.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-8">
        <div className="shrink-0">
          <Logo href="/projects" />
        </div>
        <div className="h-full min-w-0 flex-1 overflow-x-auto">
          <AppNav />
        </div>
        <div className="shrink-0">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

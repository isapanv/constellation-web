"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/api/use-me";

/**
 * Кабинет: сессия устарела — на вход с возвратом; профиль не создан — на онбординг.
 * Страницу рисуем сразу (у неё свои заглушки загрузки), чтобы не ломать мгновенные переходы Next.js.
 * Данные защищает сервер: без сессии API отвечает 401, гостя без cookie раньше уводит proxy.ts.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, me } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  const needLogin = !loading && !me;
  const needOnboarding = !loading && !!me && !me.profile && pathname !== "/onboarding";

  useEffect(() => {
    if (needLogin) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needOnboarding) router.replace("/onboarding");
  }, [needLogin, needOnboarding, pathname, router]);

  return <>{children}</>;
}

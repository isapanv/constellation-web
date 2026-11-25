import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Админка — Созвездие",
  robots: { index: false, follow: false },
};

/**
 * Режим администратора: сотрудники платформы. Права проверяет API, оболочка только прячет лишнее.
 * Вся админка рисуется в браузере (адрес, id из пути), поэтому с cacheComponents она внутри <Suspense>.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 h-48 w-full max-w-7xl animate-pulse rounded-3xl bg-surface-2" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

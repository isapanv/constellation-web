import { AppHeader } from "@/components/layout/app-header";
import { AuthGuard } from "@/components/layout/auth-guard";

/** Оболочка личного кабинета: шапка с вкладками и иконкой профиля справа. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}

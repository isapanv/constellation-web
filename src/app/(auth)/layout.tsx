import { Logo } from "@/components/layout/logo";

/** Оболочка страниц входа и регистрации: логотип и карточка по центру. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-3xl border-2 border-border bg-surface p-7">{children}</div>
    </div>
  );
}

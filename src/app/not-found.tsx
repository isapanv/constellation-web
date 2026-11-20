import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { MascotState } from "@/components/ui/mascot";

export default function NotFound() {
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
}

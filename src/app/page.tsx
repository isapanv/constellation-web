import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";

const steps = [
  { n: "01", title: "Опишите проект", text: "Формат, бюджет, даты, референсы и нужные роли." },
  { n: "02", title: "Получите три состава", text: "Эконом, оптимум и премиум — с объяснением, почему именно эти люди." },
  { n: "03", title: "Пригласите команду", text: "Специалисты подтверждают участие, контакты открываются после согласия." },
];

/** Пунктирные «созвездия» вокруг маскота. Чисто декор. */
function Stars() {
  return (
    <svg viewBox="0 0 460 520" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d="M40 120L118 52L214 78" className="stroke-lavender" strokeWidth="1.4" fill="none" strokeDasharray="3 5" />
      <path d="M360 70L420 150L392 250" className="stroke-lavender" strokeWidth="1.4" fill="none" strokeDasharray="3 5" />
      <circle cx="40" cy="120" r="4" className="fill-accent" />
      <circle cx="118" cy="52" r="5" className="fill-star stroke-fg" strokeWidth="1" />
      <circle cx="214" cy="78" r="3.5" className="fill-lavender" />
      <circle cx="360" cy="70" r="3.5" className="fill-lavender" />
      <circle cx="420" cy="150" r="5" className="fill-star stroke-fg" strokeWidth="1" />
      <circle cx="392" cy="250" r="4" className="fill-accent" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex gap-2">
          <LinkButton href="/login" variant="ghost">
            Войти
          </LinkButton>
          {/* На телефоне регистрация — через кнопки на странице, в шапке не помещается */}
            <span className="hidden sm:block">
              <LinkButton href="/signup">Регистрация</LinkButton>
            </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="grid items-center gap-8 py-10 md:grid-cols-[1.1fr_1fr] md:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-lavender-soft px-3.5 py-1.5 text-sm font-semibold text-accent">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path
                  d="M7 1l1.8 3.7 4 .6-2.9 2.8.7 4L7 10.2 3.4 12.1l.7-4L1.2 5.3l4-.6z"
                  className="fill-star stroke-fg"
                  strokeWidth=".9"
                  strokeLinejoin="round"
                />
              </svg>
              Санкт-Петербург · бета
            </p>
            <h1 className="mt-6 text-4xl leading-[1.1] font-bold md:text-[52px]">
              Творческая команда под ваш проект, <span className="text-accent">которая сработается</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Режиссёры, операторы, монтажёры, звукорежиссёры и художники, которые свободны в ваши даты и подходят
              друг другу по рабочему стилю.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" size="lg">
                Ищу команду
              </LinkButton>
              <LinkButton href="/signup" size="lg" variant="secondary">
                Я специалист
              </LinkButton>
            </div>
          </div>

          <div className="relative mx-auto aspect-[46/52] w-full max-w-[420px]">
            <div className="absolute inset-x-[7%] top-[11%] aspect-square rounded-full bg-lavender-soft" />
            <Stars />
            <Mascot
              pose="front"
              height={420}
              priority
              alt="Медведица — маскот Созвездия"
              className="absolute bottom-0 left-1/2 h-[90%] w-auto -translate-x-1/2"
            />
          </div>
        </section>

        <section className="py-12">
          <h2 className="text-3xl font-semibold">Как это работает</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-3xl border-2 border-border p-7">
                <span className="font-display text-sm font-semibold text-accent">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 py-12 md:grid-cols-2">
          <div className="flex flex-col items-start gap-4 rounded-3xl border-2 border-border p-8 md:p-10">
            <span className="rounded-full bg-lavender-soft px-3.5 py-1.5 text-sm font-semibold text-accent">Заказчикам</span>
            <h3 className="font-display text-2xl leading-tight font-semibold">Режиссёрам, продюсерам, брендам и агентствам</h3>
            <p className="leading-relaxed text-muted">
              Три готовых состава под бюджет вместо поиска людей по чатам. Видно, кто свободен в ваши даты.
            </p>
            <LinkButton href="/signup" className="mt-2">
              Собрать команду
            </LinkButton>
          </div>
          <div className="flex flex-col items-start gap-4 rounded-3xl bg-lavender-soft p-8 md:p-10">
            <span className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-accent">Специалистам</span>
            <h3 className="font-display text-2xl leading-tight font-semibold">
              Операторам, монтажёрам, художникам и всем, кто делает кино и рекламу
            </h3>
            <p className="leading-relaxed text-muted">
              Портфолио, календарь занятости и стиль работы в одном профиле. Приглашения — по вашему профилю.
            </p>
            <LinkButton href="/signup" variant="secondary" className="mt-2">
              Создать профиль
            </LinkButton>
          </div>
        </section>

        <section className="py-12">
          <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[36px] bg-accent px-8 pt-12 text-center md:flex-row md:items-end md:justify-between md:px-14 md:text-left">
            <div className="flex flex-col items-center gap-5 md:items-start md:pb-14">
              <h2 className="max-w-xl text-3xl leading-tight font-semibold text-accent-fg md:text-4xl">
                Есть проект? Покажем, кто подходит
              </h2>
              <p className="max-w-lg text-lg text-accent-fg/80">
                Заполните бриф — три варианта команды появятся сразу после него.
              </p>
              <LinkButton href="/signup" size="lg" variant="inverse">
                Собрать команду
              </LinkButton>
            </div>
            <Mascot pose="wave" height={280} className="shrink-0" />
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
          <span>© 2026 Созвездие</span>
          <a href="#" className="hover:text-fg">
            Пользовательское соглашение
          </a>
          <a href="#" className="hover:text-fg">
            Политика обработки персональных данных
          </a>
        </div>
      </footer>
    </div>
  );
}

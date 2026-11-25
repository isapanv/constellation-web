import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioCard } from "@/components/portfolio/portfolio-card";
import { Badge, Card } from "@/components/ui/card";
import { byId, cities, formatRub, publicProfiles, rateUnitLabels, roles, skillLevelLabels, yearsLabel } from "@/mocks/data";
import { SiteHeader } from "@/components/layout/site-header";
import { InviteButton } from "@/components/profile/invite-button";


/** Публичный профиль. Индексируется поисковиками — бесплатный канал привлечения. */

export function generateStaticParams() {
  return publicProfiles.map((p) => ({ slug: p.profile.slug }));
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const find = (slug: string) => publicProfiles.find((p) => p.profile.slug === slug);

/** «Имя Фамилия → Имя Ф.», если фамилию скрыли. */
const publicName = (name: string, full: boolean) => {
  if (full) return name;
  const [first, last] = name.split(" ");
  return last ? `${first} ${last[0]}.` : first;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = find(decode(slug));
  if (!p) return {};
  return {
    title: `${publicName(p.profile.displayName, p.profile.showFullLastName)} — Созвездие`,
    description: p.profile.bio,
  };
}

const workStyleSummary: Record<string, Record<string, string>> = {
  commChannel: { messenger: "на связи в мессенджере", calls: "предпочитает созвоны", email: "предпочитает почту", meetings: "любит встречи вживую" },
  pace: { sprint: "быстрый темп", steady: "равномерный темп", flexible: "гибкий темп" },
  briefPreference: { detailed: "любит подробный бриф", freedom: "любит творческую свободу" },
};

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = find(decode(slug));
  if (!p) notFound();

  const { profile, settings, workStyle, portfolio } = p;
  const sortedRoles = [...p.roles].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const published = portfolio.filter((x) => x.moderationStatus === "approved" && x.visibility === "public");
  const traits = [
    workStyleSummary.commChannel[workStyle.commChannel],
    workStyleSummary.pace[workStyle.pace],
    workStyleSummary.briefPreference[workStyle.briefPreference],
  ];

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        <section className="flex flex-col gap-6 py-8 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-20 shrink-0 place-items-center rounded-full bg-accent-soft text-2xl font-semibold text-accent">
              {profile.displayName[0]}
            </span>
            <div>
              <h1 className="text-2xl font-semibold">
                {publicName(profile.displayName, profile.showFullLastName)}
              </h1>
              <p className="mt-1 text-muted">
                {byId(roles, sortedRoles[0]?.roleId)?.name} · {byId(cities, profile.cityId)?.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.openToWork && <Badge tone="ok">Открыт(а) к проектам</Badge>}
                {settings.verificationLevel > 0 && <Badge tone="accent">Портфолио проверено</Badge>}
                {settings.travelReady && <Badge>Готов(а) к выездам</Badge>}
              </div>
            </div>
          </div>
          <Card className="md:w-72">
            <p className="text-sm text-muted">Контакты откроются, когда специалист примет приглашение в ваш проект.</p>
            <InviteButton slug={profile.slug} />
          </Card>
        </section>

        <p className="max-w-2xl text-lg">{profile.bio}</p>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">Роли и ставки</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {sortedRoles.map((r) => (
                <li key={r.id} className="flex justify-between gap-4">
                  <span>
                    {byId(roles, r.roleId)?.name}
                    <span className="text-muted">
                      {" "}
                      · {skillLevelLabels[r.level].toLowerCase()}, {yearsLabel(r.years)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    от {formatRub(r.rateMin)} {rateUnitLabels[r.rateUnit]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Как работает</h2>
            <div className="flex flex-wrap gap-2">
              {traits.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Портфолио</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((item) => (
              <PortfolioCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

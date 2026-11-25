import { notFound } from "next/navigation";
import { portfolioModeration } from "@/components/portfolio/portfolio-card";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { byId, formats, myPortfolio, roles, styleTags } from "@/mocks/data";
import { Suspense } from "react";

const visibilityLabel = {
  public: "Видно всем",
  link: "Доступно по ссылке",
  private: "Только мне",
} as const;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// С cacheComponents чтение searchParams должно быть внутри <Suspense>,
// иначе маршрут блокирует пререндер (ошибка «Blocking Route»).
export default function PortfolioViewPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PortfolioViewSkeleton />}>
      <PortfolioView searchParams={searchParams} />
    </Suspense>
  );
}

function PortfolioViewSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-6 h-9 w-64 animate-pulse rounded-xl bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="aspect-video animate-pulse rounded-3xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface-2" />
      </div>
    </div>
  );
}

async function PortfolioView({ searchParams }: { searchParams: SearchParams }) {
  const { id } = await searchParams;

  const item = typeof id === "string" ? myPortfolio.find((p) => p.id === id) : undefined;
  if (!item) notFound();

  const m = portfolioModeration[item.moderationStatus];

  return (
    <div>
      <PageHeader
        title={item.title}
        description={`${byId(formats, item.formatId)?.name} · ${item.year} · ${byId(roles, item.myRoleId)?.name}`}
        actions={
          <LinkButton href="/portfolio" variant="secondary">
            ← Все работы
          </LinkButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative aspect-video overflow-hidden rounded-3xl" style={{ background: item.coverColor }}>
          {item.isFeatured && (
            <span className="absolute left-4 top-4 rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white">★ Избранное</span>
          )}
        </div>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={m.tone}>{m.label}</Badge>
            <Badge>{visibilityLabel[item.visibility]}</Badge>
          </div>

          {item.description && <p className="text-sm">{item.description}</p>}

          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted">Заказчик</dt>
              <dd>{item.clientHidden ? "Скрыт" : item.clientName || "—"}</dd>
            </div>
          </dl>

          {item.styleTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.styleTagIds.map((tagId) => (
                <Badge key={tagId}>{byId(styleTags, tagId)?.name}</Badge>
              ))}
            </div>
          )}

          {item.externalUrl && (
            <LinkButton href={item.externalUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
              Смотреть работу ↗
            </LinkButton>
          )}
        </Card>
      </div>
    </div>
  );
}

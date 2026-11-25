import { Badge } from "@/components/ui/card";
import type { PortfolioItem } from "@/lib/types";
import { byId, formats, roles, styleTags } from "@/mocks/data";

const moderation = {
  approved: { tone: "ok", label: "Опубликовано" },
  pending: { tone: "warn", label: "На проверке" },
  rejected: { tone: "danger", label: "Отклонено" },
} as const;

export function PortfolioCard({ item, showStatus = false }: { item: PortfolioItem; showStatus?: boolean }) {
  const m = moderation[item.moderationStatus];
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-border bg-surface">
      <div className="relative aspect-video" style={{ background: item.coverColor }}>
        {item.isFeatured && (
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">★ Избранное</span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{item.title}</h3>
          {showStatus && <Badge tone={m.tone}>{m.label}</Badge>}
        </div>
        <p className="text-sm text-muted">
          {byId(formats, item.formatId)?.name} · {item.year} · {byId(roles, item.myRoleId)?.name}
        </p>
        {!item.clientHidden && item.clientName && <p className="text-sm">Заказчик: {item.clientName}</p>}
        <div className="flex flex-wrap gap-1.5">
          {item.styleTagIds.map((id) => (
            <Badge key={id}>{byId(styleTags, id)?.name}</Badge>
          ))}
        </div>
      </div>
    </article>
  );
}

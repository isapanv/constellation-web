"use client";

import Link from "next/link";
import { useState } from "react";
import { FilterTabs, Skeleton, Table, Td, auditDetailsText, errText, fmtDateTime, useLoad, useUrlParams } from "@/components/admin/admin-ui";
import { StaffOnly } from "@/components/admin/staff-context";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { auditActionLabel } from "@/lib/admin";
import { api } from "@/lib/api/client";
import type { AuditEntry } from "@/lib/api/admin-types";

/** Куда ведёт запись журнала */
function entityLink(e: AuditEntry): string | null {
  if (!e.entityId) return null;
  if (e.entityType === "user" || e.entityType === "staff" || e.entityType === "avatar") return `/admin/users/${e.entityId}`;
  if (e.entityType === "project") return `/admin/projects/${e.entityId}`;
  if (e.entityType === "match_request") return `/admin/queue/${e.entityId}`;
  return null;
}

function AuditPage() {
  const [p, setP, ready] = useUrlParams({ views: "0", actorId: "" });
  const key = `${p.views}|${p.actorId}`;
  const first = useLoad(() => api.admin.audit({ views: p.views as "0" | "1", actorId: p.actorId || undefined }), [p.views, p.actorId], ready);
  // Догруженные страницы привязаны к фильтру: сменили фильтр — начинаем заново
  const [more, setMore] = useState<{ key: string; entries: AuditEntry[]; next: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreErr, setMoreErr] = useState("");

  const extra = more?.key === key ? more : null;
  const entries = first.data ? [...first.data.entries, ...(extra?.entries ?? [])] : null;
  const next = extra ? extra.next : (first.data?.nextBefore ?? null);
  const error = first.error || moreErr;

  const loadMore = async () => {
    if (!next) return;
    setBusy(true);
    setMoreErr("");
    try {
      const r = await api.admin.audit({ views: p.views as "0" | "1", actorId: p.actorId || undefined, before: next });
      setMore({ key, entries: [...(extra?.entries ?? []), ...r.entries], next: r.nextBefore });
    } catch (e) {
      setMoreErr(errText(e, "Не получилось загрузить журнал"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Журнал действий" description="Что делали сотрудники. Записи нельзя исправить или удалить — ни через интерфейс, ни в базе." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <FilterTabs
          label="Какие записи"
          value={p.views}
          options={[
            { id: "0", label: "Изменения" },
            { id: "1", label: "Изменения и просмотры" },
          ]}
          onChange={(views) => setP({ views })}
        />
        {p.actorId && (
          <Button size="sm" variant="ghost" onClick={() => setP({ actorId: "" })}>
            Все сотрудники ✕
          </Button>
        )}
      </div>
      {error && <p className="text-danger">{error}</p>}
      {!entries && !error && <Skeleton />}
      {entries &&
        (entries.length === 0 ? (
          <Card className="text-sm text-muted">Записей нет.</Card>
        ) : (
          <>
            <Table head={["Когда", "Сотрудник", "Действие", "Подробности"]}>
              {entries.map((e) => {
                const href = entityLink(e);
                return (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-muted">{fmtDateTime(e.at)}</Td>
                    <Td>
                      {e.actor ? (
                        <button type="button" className="font-semibold hover:underline" onClick={() => setP({ actorId: e.actor!.id })} title="Показать только этого сотрудника">
                          {e.actor.name}
                        </button>
                      ) : (
                        "Консоль"
                      )}
                    </Td>
                    <Td>{href ? <Link href={href} className="text-accent hover:underline">{auditActionLabel[e.action] ?? e.action}</Link> : (auditActionLabel[e.action] ?? e.action)}</Td>
                    <Td className="text-muted">{auditDetailsText(e) || "—"}</Td>
                  </tr>
                );
              })}
            </Table>
            {next && (
              <Button className="mt-4" variant="secondary" size="sm" disabled={busy} onClick={loadMore}>
                {busy ? "Загружаю…" : "Показать ещё"}
              </Button>
            )}
          </>
        ))}
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <AuditPage />
    </StaffOnly>
  );
}

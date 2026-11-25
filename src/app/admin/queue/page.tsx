"use client";

import { FilterTabs, RequestStatusBadge, RowLink, Skeleton, Table, Td, fmtDateTime, levelLabel, timeLeft, useLoad, useNow, useUrlParams } from "@/components/admin/admin-ui";
import { StaffOnly } from "@/components/admin/staff-context";
import { Card, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api/client";
import type { MatchQueueFilter } from "@/lib/api/admin-types";

const filters: { id: MatchQueueFilter; label: string }[] = [
  { id: "active", label: "Открытые" },
  { id: "mine", label: "Мои" },
  { id: "closed", label: "Закрытые" },
];

function QueuePage() {
  const [params, setParams, ready] = useUrlParams({ filter: "active" as MatchQueueFilter });
  const { data, error } = useLoad(() => api.admin.queue(params.filter), [params.filter], ready);
  const now = useNow();

  return (
    <>
      <PageHeader title="Ручной подбор" description="Сначала — те, у кого срок ближе. Возьмите заявку, найдите людей, пригласите их и закройте заявку с итогом." />
      <div className="mb-5">
        <FilterTabs label="Фильтр заявок" value={params.filter} options={filters} onChange={(filter) => setParams({ filter })} />
      </div>
      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <Skeleton />}
      {data &&
        (data.requests.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{params.filter === "closed" ? "Закрытых заявок пока нет." : params.filter === "mine" ? "У вас нет заявок в работе." : "Очередь пуста — алгоритм справился сам."}</p>
          </Card>
        ) : (
          <Table head={["Роль", "Проект", "Срок", "Статус", "Подборщик"]}>
            {data.requests.map((r) => {
              const left = now && r.status !== "done" && r.status !== "cancelled" ? timeLeft(r.dueAt, now) : null;
              return (
                <tr key={r.id}>
                  <Td>
                    <RowLink href={`/admin/queue/${r.id}`}>{r.slot.role}</RowLink>
                    <p className="text-xs text-muted">
                      {r.slot.qty > 1 ? `${r.slot.qty} чел. · ` : ""}
                      {r.slot.levelMin ? `от ${levelLabel[r.slot.levelMin]}` : "любой уровень"}
                      {!r.slot.current && " · бриф изменён"}
                    </p>
                  </Td>
                  <Td>
                    <p>{r.project.title}</p>
                    <p className="text-xs text-muted">
                      {r.project.clientName}
                      {r.project.city ? ` · ${r.project.city}` : ""}
                    </p>
                  </Td>
                  <Td>
                    {left ? (
                      <span className={cn("font-semibold", left.overdue ? "text-danger" : left.soon ? "text-warn" : "")}>{left.text}</span>
                    ) : (
                      <span className="text-muted">закрыта {fmtDateTime(r.closedAt)}</span>
                    )}
                    <p className="text-xs text-muted">до {fmtDateTime(r.dueAt)}</p>
                  </Td>
                  <Td>
                    <RequestStatusBadge status={r.status} />
                  </Td>
                  <Td className="text-muted">{r.assignee?.name ?? "—"}</Td>
                </tr>
              );
            })}
          </Table>
        ))}
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <QueuePage />
    </StaffOnly>
  );
}

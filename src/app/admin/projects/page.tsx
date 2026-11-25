"use client";

import { useState } from "react";
import { Pager, ProjectStatusBadge, RowLink, Skeleton, Table, Td, fmtDate, fmtDateTime, useLoad, useUrlParams } from "@/components/admin/admin-ui";
import { StaffOnly } from "@/components/admin/staff-context";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import type { ProjectStatus } from "@/lib/api/types";
import { statusLabel } from "@/lib/project-status";

const STATUSES = Object.keys(statusLabel) as ProjectStatus[];

function AdminProjectsPage() {
  const [p, setP, ready] = useUrlParams({ q: "", status: "all", page: "0" });
  // null — пользователь ещё не печатал, показываем запрос из адреса
  const [text, setText] = useState<string | null>(null);
  const page = Number(p.page) || 0;
  const { data, error } = useLoad(() => api.admin.projects({ q: p.q, status: p.status, page }), [p.q, p.status, page], ready);


  return (
    <>
      <PageHeader title="Проекты" description="Все проекты платформы, свежие сверху." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setP({ q: (text ?? p.q).trim(), page: "0" });
        }}
        className="mb-5 flex flex-wrap items-end gap-2"
      >
        <Input value={text ?? p.q} onChange={(e) => setText(e.target.value)} placeholder="Название или заказчик" className="sm:max-w-sm" aria-label="Поиск" />
        <Select value={p.status} onChange={(e) => setP({ status: e.target.value, page: "0" })} className="sm:max-w-56" aria-label="Статус">
          <option value="all">Любой статус</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </Select>
        <Button type="submit">Найти</Button>
      </form>

      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <Skeleton />}
      {data &&
        (data.projects.length === 0 ? (
          <Card className="text-sm text-muted">Проектов не нашли.</Card>
        ) : (
          <>
            <Table head={["Проект", "Заказчик", "Статус", "Команда", "Съёмка", "Создан"]}>
              {data.projects.map((x) => (
                <tr key={x.id}>
                  <Td>
                    <RowLink href={`/admin/projects/${x.id}`}>{x.title}</RowLink>
                    <p className="text-xs text-muted">{[x.format, x.city].filter(Boolean).join(" · ")}</p>
                  </Td>
                  <Td>{x.clientName}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <ProjectStatusBadge status={x.status} />
                      {x.manualOpen > 0 && <Badge tone="warn">ручной подбор: {x.manualOpen}</Badge>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{x.slots ? `${x.filled} из ${x.slots}` : "—"}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDate(x.shootFrom)}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDateTime(x.createdAt)}</Td>
                </tr>
              ))}
            </Table>
            <Pager page={page} hasMore={data.hasMore} onPage={(n) => setP({ page: String(n) })} />
          </>
        ))}
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <AdminProjectsPage />
    </StaffOnly>
  );
}

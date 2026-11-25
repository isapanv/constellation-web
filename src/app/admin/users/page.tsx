"use client";

import { useState } from "react";
import { Pager, RowLink, Skeleton, Table, Td, UserStatusBadge, fmtDateTime, useLoad, useUrlParams } from "@/components/admin/admin-ui";
import { StaffOnly } from "@/components/admin/staff-context";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { staffRoleLabel } from "@/lib/admin";
import { api } from "@/lib/api/client";

function UsersPage() {
  const [p, setP, ready] = useUrlParams({ q: "", status: "all", kind: "all", page: "0" });
  // null — пользователь ещё не печатал, показываем запрос из адреса
  const [text, setText] = useState<string | null>(null);
  const page = Number(p.page) || 0;
  const { data, error } = useLoad(() => api.admin.users({ q: p.q, status: p.status, kind: p.kind, page }), [p.q, p.status, p.kind, page], ready);


  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setP({ q: (text ?? p.q).trim(), page: "0" });
  };

  return (
    <>
      <PageHeader title="Пользователи" description="В списке телефоны скрыты. Полный номер — в карточке; каждое открытие карточки записывается в журнал." />
      <form onSubmit={search} className="mb-5 flex flex-wrap items-end gap-2">
        <Input value={text ?? p.q} onChange={(e) => setText(e.target.value)} placeholder="Имя, адрес профиля или цифры телефона" className="sm:max-w-sm" aria-label="Поиск" />
        <Select value={p.status} onChange={(e) => setP({ status: e.target.value, page: "0" })} className="sm:max-w-56" aria-label="Статус">
          <option value="all">Любой статус</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
          <option value="deleted">Удалённые</option>
        </Select>
        <Select value={p.kind} onChange={(e) => setP({ kind: e.target.value, page: "0" })} className="sm:max-w-56" aria-label="Кто">
          <option value="all">Все</option>
          <option value="client">Заказчики</option>
          <option value="specialist">Специалисты</option>
          <option value="staff">Сотрудники</option>
        </Select>
        <Button type="submit">Найти</Button>
      </form>

      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <Skeleton />}
      {data &&
        (data.users.length === 0 ? (
          <Card className="text-sm text-muted">Никого не нашли.</Card>
        ) : (
          <>
            <Table head={["Имя", "Телефон", "Кто", "Статус", "Регистрация", "Был на сайте"]}>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <RowLink href={`/admin/users/${u.id}`}>{u.name ?? "Без профиля"}</RowLink>
                    {u.primaryRole && <p className="text-xs text-muted">{u.primaryRole}</p>}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{u.phoneMasked}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.staffRole && <Badge tone="accent">{staffRoleLabel[u.staffRole]}</Badge>}
                      {u.client && <Badge>Заказчик</Badge>}
                      {u.specialist && <Badge>Специалист</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <UserStatusBadge status={u.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDateTime(u.createdAt)}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDateTime(u.lastSeenAt)}</Td>
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
      <UsersPage />
    </StaffOnly>
  );
}

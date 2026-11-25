"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AuditList,
  InvitationBadge,
  ProjectStatusBadge,
  ReasonAction,
  RequestStatusBadge,
  Skeleton,
  Table,
  Td,
  fmtDate,
  fmtDateTime,
  fmtRub,
  levelLabel,
  useLoad,
} from "@/components/admin/admin-ui";
import { StaffOnly, useCan } from "@/components/admin/staff-context";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { formatPhone } from "@/lib/admin";
import { api } from "@/lib/api/client";
import type { ProjectStatus } from "@/lib/api/types";
import { statusLabel } from "@/lib/project-status";

const slotStatus: Record<string, string> = { open: "Открыта", manual: "Ручной подбор", filled: "Закрыта", cancelled: "Отменена" };

/** Что произойдёт при переходе — показываем до подтверждения. */
const transitionHint: Partial<Record<ProjectStatus, string>> = {
  in_progress: "Договорились и начали работу.",
  delivered: "Материал сдан заказчику. После этого можно собирать отзывы.",
  cancelled: "Отменит проект: приглашения без ответа отзываются, принятые — отменяются с вашей причиной, даты в календарях специалистов освобождаются, заявки ручного подбора закрываются.",
};

function AdminProjectPage() {
  const { id } = useParams<{ id: string }>();
  const canStatus = useCan("projects.status");
  const { data, setData, error } = useLoad(() => api.admin.project(id), [id]);
  const [target, setTarget] = useState<ProjectStatus | null>(null);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <Skeleton />;
  const p = data.project;
  const byslot = (slotId: string) => p.invitations.filter((i) => i.slotId === slotId);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/projects" className="text-muted hover:text-fg">
          ← Проекты
        </Link>
      </p>
      <PageHeader
        title={p.title}
        description={`${[p.format, p.city].filter(Boolean).join(" · ")} · версия брифа ${p.version}`}
        actions={<ProjectStatusBadge status={p.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
              <dt className="text-muted">Съёмка</dt>
              <dd>{p.shootDates.length ? p.shootDates.map(fmtDate).join(", ") : "—"}</dd>
              <dt className="text-muted">Сдача</dt>
              <dd>{fmtDate(p.deliveryDate)}</dd>
              <dt className="text-muted">Бюджет</dt>
              <dd>
                {p.budgetMin ? `${fmtRub(p.budgetMin)} – ` : "до "}
                {fmtRub(p.budgetMax)}
              </dd>
              <dt className="text-muted">Создан</dt>
              <dd>{fmtDateTime(p.createdAt)}</dd>
            </dl>
            {p.goal && <p className="mt-3 text-sm text-muted">{p.goal}</p>}
          </Card>

          <section>
            <h2 className="mb-2 font-semibold">Роли и приглашения</h2>
            {p.slots.length === 0 ? (
              <Card className="text-sm text-muted">Ролей ещё нет — бриф в черновике.</Card>
            ) : (
              <Table head={["Роль", "Закрыто", "Приглашения", "Ручной подбор"]}>
                {p.slots.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <p className="font-semibold">{s.role}</p>
                      <p className="text-xs text-muted">
                        {s.levelMin ? `от ${levelLabel[s.levelMin]}` : "любой уровень"} · {s.budget ? fmtRub(s.budget) : "рассчитаем"} · {slotStatus[s.status] ?? s.status}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {s.accepted} из {s.qty}
                    </Td>
                    <Td>
                      <ul className="flex flex-col gap-1">
                        {byslot(s.id).map((i) => (
                          <li key={i.id} className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/users/${i.specialistId}`} className="hover:underline">
                              {i.specialistName}
                            </Link>
                            <InvitationBadge status={i.status} />
                            <span className="text-xs text-muted">{fmtRub(i.cost)}</span>
                            {i.reason && <span className="w-full text-xs text-muted">{i.reason}</span>}
                          </li>
                        ))}
                        {byslot(s.id).length === 0 && <li className="text-muted">—</li>}
                      </ul>
                    </Td>
                    <Td>
                      {s.manual ? (
                        <Link href={`/admin/queue/${s.manual.id}`}>
                          <RequestStatusBadge status={s.manual.status} />
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-1 text-sm">
            <h2 className="mb-1 font-semibold">Заказчик</h2>
            <Link href={`/admin/users/${p.client.id}`} className="hover:underline">
              {p.client.name}
            </Link>
            {p.client.phone && (
              <a href={`tel:${p.client.phone}`} className="text-muted hover:underline">
                {formatPhone(p.client.phone)}
              </a>
            )}
          </Card>

          {canStatus && p.nextStatuses.length > 0 && (
            <Card className="flex flex-col gap-3">
              <h2 className="font-semibold">Статус проекта</h2>
              <p className="text-sm text-muted">Пока нет договоров и оплаты, эти переходы делает админ вручную.</p>
              <div className="flex flex-wrap gap-2">
                {p.nextStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTarget(target === s ? null : s)}
                    className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${target === s ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-border-strong"}`}
                  >
                    → {statusLabel[s]}
                  </button>
                ))}
              </div>
              {target && (
                <>
                  <p className="text-sm">{transitionHint[target]}</p>
                  <ReasonAction
                    key={target}
                    label={`Перевести в «${statusLabel[target]}»`}
                    variant={target === "cancelled" ? "danger" : "primary"}
                    placeholder="Причина или основание: договорились по телефону, заказчик отменил съёмку…"
                    onConfirm={async (reason) => {
                      setData(await api.admin.setProjectStatus(id, target, reason));
                      setTarget(null);
                    }}
                  />
                </>
              )}
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold">История действий сотрудников</h2>
            <AuditList entries={p.history} />
          </Card>
          {p.invitations.some((i) => i.status === "accepted") && (
            <p className="px-2 text-xs text-muted">
              <Badge tone="ok">Принято</Badge> — у этих людей даты съёмки заблокированы в календаре.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <AdminProjectPage />
    </StaffOnly>
  );
}

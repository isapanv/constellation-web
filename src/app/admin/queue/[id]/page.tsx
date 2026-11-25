"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  InvitationBadge,
  ProjectStatusBadge,
  ReasonAction,
  RequestStatusBadge,
  Skeleton,
  Table,
  Td,
  errText,
  fmtDate,
  fmtDateTime,
  fmtRub,
  levelLabel,
  rateUnitLabel,
  timeLeft,
  useLoad,
  useNow,
} from "@/components/admin/admin-ui";
import { StaffOnly, useCan, useStaff } from "@/components/admin/staff-context";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { formatPhone } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { type AdminQueueAction, api } from "@/lib/api/client";

function MatchRequestPage() {
  const { id } = useParams<{ id: string }>();
  const staff = useStaff();
  const canWork = useCan("queue.work");
  const now = useNow();
  const { data, setData, error } = useLoad(() => api.admin.matchRequest(id), [id]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <Skeleton />;
  const r = data.request;

  const act = async (body: AdminQueueAction, key: string) => {
    setBusy(key);
    setErr("");
    try {
      setData(await api.admin.actOnRequest(id, body));
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy("");
    }
  };
  /** Для ReasonAction: ошибку покажет сама форма */
  const close = async (action: "done" | "cancel", note: string) => setData(await api.admin.actOnRequest(id, { action, note }));

  const active = r.status === "open" || r.status === "in_progress";
  const mine = r.status === "in_progress" && r.assignee?.id === staff.userId;
  const left = now && active ? timeLeft(r.dueAt, now) : null;
  const shoot = r.brief.shootDates.length ? `${fmtDate(r.brief.shootDates[0])}${r.brief.shootDates.length > 1 ? ` – ${fmtDate(r.brief.shootDates[r.brief.shootDates.length - 1])}` : ""}` : "—";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/queue" className="text-muted hover:text-fg">
          ← Ручной подбор
        </Link>
      </p>
      <PageHeader
        title={`${r.slot.role}${r.slot.qty > 1 ? ` × ${r.slot.qty}` : ""}`}
        description={`${r.project.title} · ${r.reason}`}
        actions={<RequestStatusBadge status={r.status} />}
      />

      {!r.slot.current && active && (
        <Card className="mb-4 border-warn bg-warn-soft text-sm">
          Заказчик изменил бриф после того, как заявка появилась. Этот слот устарел — закройте заявку как отменённую; если роль осталась, новая заявка появится при следующем подборе.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Кто работает и что сделать */}
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {left ? (
                  <p className={cn("text-lg font-semibold", left.overdue ? "text-danger" : left.soon ? "text-warn" : "")}>{left.text}</p>
                ) : (
                  <p className="text-lg font-semibold">Закрыта {fmtDateTime(r.closedAt)}</p>
                )}
                <p className="text-sm text-muted">
                  Обещали заказчику до {fmtDateTime(r.dueAt)} · {r.assignee ? `в работе у ${r.assignee.id === staff.userId ? "вас" : r.assignee.name}` : "никто не взял"}
                </p>
              </div>
              {canWork && active && (
                <div className="flex flex-wrap gap-2">
                  {!mine && (
                    <Button onClick={() => act({ action: "take" }, "take")} disabled={!!busy}>
                      {r.status === "in_progress" ? "Забрать себе" : "Взять в работу"}
                    </Button>
                  )}
                  {mine && (
                    <Button variant="secondary" onClick={() => act({ action: "release" }, "release")} disabled={!!busy}>
                      Вернуть в очередь
                    </Button>
                  )}
                </div>
              )}
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            {canWork && active && (mine || staff.role === "admin" || r.status === "open") && (
              <div className="flex flex-wrap items-start gap-2 border-t border-border pt-4">
                <ReasonAction
                  label="Закрыть: подобрали"
                  variant="primary"
                  minLength={5}
                  placeholder="Итог: кого пригласили, кто согласился, что сказали заказчику"
                  onConfirm={(note) => close("done", note)}
                />
                <ReasonAction
                  label="Закрыть: отменить"
                  minLength={5}
                  placeholder="Почему: заказчик передумал, бриф изменён, никого нет в эти даты…"
                  onConfirm={(note) => close("cancel", note)}
                />
              </div>
            )}
            {r.resultNote && (
              <p className="rounded-2xl bg-surface-2 p-3 text-sm">
                <span className="font-semibold">Итог: </span>
                {r.resultNote}
              </p>
            )}
          </Card>

          {/* Уже приглашённые в эту роль */}
          <section>
            <h2 className="mb-2 font-semibold">Приглашения в эту роль</h2>
            {r.invitations.length === 0 ? (
              <p className="text-sm text-muted">Пока никого не приглашали.</p>
            ) : (
              <Table head={["Специалист", "Гонорар", "Отправлено", "Статус"]}>
                {r.invitations.map((i) => (
                  <tr key={i.id}>
                    <Td>{i.specialistName}</Td>
                    <Td>{fmtRub(i.cost)}</Td>
                    <Td className="text-muted">{fmtDateTime(i.sentAt)}</Td>
                    <Td>
                      <InvitationBadge status={i.status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          {/* Кандидаты */}
          <section>
            <h2 className="font-semibold">Кандидаты на платформе</h2>
            <p className="mb-2 text-sm text-muted">
              Те же жёсткие фильтры, что у автоматического подбора, но уровень можно понизить до любого. Сначала — подходящие без ослабления и свободные. Позвоните человеку, прежде чем приглашать.
            </p>
            {r.candidates.length === 0 ? (
              <Card className="text-sm text-muted">На платформе нет свободных людей с этой ролью в даты проекта. Ищите вне платформы и попросите человека зарегистрироваться.</Card>
            ) : (
              <Table head={["Специалист", "Уровень", "Гонорар", "Занятость", ""]}>
                {r.candidates.map((c) => {
                  const full = c.openInvitations >= 3;
                  const invited = c.invited && ["sent", "viewed", "accepted"].includes(c.invited);
                  return (
                    <tr key={c.specialistId}>
                      <Td>
                        <Link href={`/admin/users/${c.specialistId}`} className="font-semibold hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted">
                          <a href={`tel:${c.phone}`} className="hover:underline">
                            {formatPhone(c.phone)}
                          </a>
                        </p>
                      </Td>
                      <Td>
                        {levelLabel[c.level] ?? c.level}
                        {c.relaxed && (
                          <span className="ml-2">
                            <Badge tone="warn">ниже запрошенного</Badge>
                          </span>
                        )}
                      </Td>
                      <Td>
                        {fmtRub(c.cost)}
                        <p className="text-xs text-muted">
                          от {fmtRub(c.rateMin)} / {rateUnitLabel[c.rateUnit] ?? c.rateUnit}
                        </p>
                      </Td>
                      <Td className="text-muted">
                        {c.busyShare > 0 ? `занят ${Math.round(c.busyShare * 100)}% дней` : "свободен"}
                        {c.openInvitations > 0 && <p className="text-xs">открытых приглашений: {c.openInvitations}</p>}
                      </Td>
                      <Td className="text-right">
                        {c.invited ? (
                          <InvitationBadge status={c.invited} />
                        ) : null}
                        {canWork && mine && !invited && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="ml-2"
                            disabled={!!busy || full}
                            title={full ? "У специалиста уже 3 открытых приглашения" : undefined}
                            onClick={() => act({ action: "invite", specialistId: c.specialistId }, c.specialistId)}
                          >
                            {busy === c.specialistId ? "Отправляю…" : "Пригласить"}
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
            {canWork && active && !mine && r.candidates.length > 0 && <p className="mt-2 text-xs text-muted">Чтобы приглашать, сначала возьмите заявку в работу.</p>}
          </section>
        </div>

        {/* Бриф и заказчик */}
        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Проект</h2>
              <ProjectStatusBadge status={r.project.status} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Формат</dt>
              <dd>{r.brief.format ?? "—"}</dd>
              <dt className="text-muted">Город</dt>
              <dd>{r.project.city ?? "—"}</dd>
              <dt className="text-muted">Съёмка</dt>
              <dd>{shoot}</dd>
              <dt className="text-muted">Сдача</dt>
              <dd>{fmtDate(r.brief.deliveryDate)}</dd>
              <dt className="text-muted">Бюджет</dt>
              <dd>до {fmtRub(r.brief.budgetMax)}</dd>
              <dt className="text-muted">На роль</dt>
              <dd>{r.slot.budget ? fmtRub(r.slot.budget) : "рассчитаем"}</dd>
              <dt className="text-muted">Уровень</dt>
              <dd>{r.slot.levelMin ? `от ${levelLabel[r.slot.levelMin]}` : "любой"}</dd>
              <dt className="text-muted">Закрыто</dt>
              <dd>
                {r.slot.accepted} из {r.slot.qty}
              </dd>
            </dl>
            {r.brief.goal && <p className="text-sm text-muted">{r.brief.goal}</p>}
            <Link href={`/admin/projects/${r.project.id}`} className="text-sm font-semibold text-accent hover:underline">
              Весь проект →
            </Link>
          </Card>
          <Card className="flex flex-col gap-1 text-sm">
            <h2 className="mb-1 font-semibold">Заказчик</h2>
            <Link href={`/admin/users/${r.client.id}`} className="hover:underline">
              {r.client.name}
            </Link>
            <a href={`tel:${r.client.phone}`} className="text-muted hover:underline">
              {formatPhone(r.client.phone)}
            </a>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <MatchRequestPage />
    </StaffOnly>
  );
}

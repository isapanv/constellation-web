"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AuditList, ProjectStatusBadge, ReasonAction, Skeleton, UserStatusBadge, fmtDateTime, fmtRub, levelLabel, rateUnitLabel, useLoad } from "@/components/admin/admin-ui";
import { StaffOnly, useCan, useStaff } from "@/components/admin/staff-context";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatPhone, staffRoleLabel } from "@/lib/admin";
import { api } from "@/lib/api/client";

function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const me = useStaff();
  const canBlock = useCan("users.block");
  const { data, setData, error } = useLoad(() => api.admin.user(id), [id]);
  const [note, setNote] = useState("");

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <Skeleton />;
  const u = data.user;

  const block = async (reason: string) => {
    const r = await api.admin.blockUser(id, reason);
    setData({ user: r.user });
    setNote(r.withdrawn ? `Отозвано открытых приглашений: ${r.withdrawn}. Заказчики увидят это в своих проектах.` : "");
  };
  const unblock = async (reason: string) => {
    setData(await api.admin.unblockUser(id, reason));
    setNote("");
  };

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/users" className="text-muted hover:text-fg">
          ← Пользователи
        </Link>
      </p>
      <PageHeader title={u.name ?? "Без профиля"} description={u.slug ? `/u/${u.slug}` : undefined} actions={<UserStatusBadge status={u.status} />} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-wrap items-start gap-5">
            <UserAvatar name={u.name ?? "?"} src={u.avatarUrl} size="lg" />
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted">Телефон</dt>
              <dd>{u.phone ? <a href={`tel:${u.phone}`} className="hover:underline">{formatPhone(u.phone)}</a> : "—"}</dd>
              <dt className="text-muted">Кто</dt>
              <dd className="flex flex-wrap gap-1">
                {u.staffRole && <Badge tone="accent">{staffRoleLabel[u.staffRole]}</Badge>}
                {u.client && <Badge>Заказчик</Badge>}
                {u.specialist && <Badge>Специалист</Badge>}
                {!u.client && !u.specialist && !u.staffRole && "—"}
              </dd>
              <dt className="text-muted">Город</dt>
              <dd>{u.city ?? "—"}</dd>
              <dt className="text-muted">Регистрация</dt>
              <dd>
                {fmtDateTime(u.createdAt)}
                {u.signupSource ? ` · ${u.signupSource}` : ""}
              </dd>
              <dt className="text-muted">Был на сайте</dt>
              <dd>{fmtDateTime(u.lastSeenAt)}</dd>
              <dt className="text-muted">Сессий</dt>
              <dd>{u.stats.activeSessions}</dd>
            </dl>
          </Card>

          {u.blocked && (
            <Card className="border-danger bg-danger-soft text-sm">
              <p className="font-semibold text-danger">Заблокирован {fmtDateTime(u.blocked.at)}</p>
              <p>Причина: {u.blocked.reason}</p>
              {u.blocked.by && <p className="text-muted">Кто: {u.blocked.by}</p>}
            </Card>
          )}

          {u.roles.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Роли специалиста</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {u.roles.map((r) => (
                  <li key={r.name} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {r.name} · {levelLabel[r.level] ?? r.level}
                      {r.isPrimary && <span className="ml-2 text-xs text-muted">основная</span>}
                    </span>
                    <span className="text-muted">
                      от {fmtRub(r.rateMin)} / {rateUnitLabel[r.rateUnit] ?? r.rateUnit}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="mb-1 font-semibold">Проекты</h2>
            <p className="mb-3 text-sm text-muted">
              Создал: {u.stats.projectsOwned} · приглашений: {u.stats.invitations}, принято {u.stats.accepted}, ждут ответа {u.stats.openInvitations}
            </p>
            {u.projects.length === 0 ? (
              <p className="text-sm text-muted">Пока нет.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {u.projects.map((p) => (
                  <li key={`${p.part}-${p.id}`} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/projects/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                    <span className="flex gap-1">
                      <Badge>{p.part === "client" ? "заказчик" : "в команде"}</Badge>
                      <ProjectStatusBadge status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          {canBlock && u.status !== "deleted" && (
            <Card className="flex flex-col items-start gap-3">
              <h2 className="font-semibold">Доступ</h2>
              {u.status === "active" ? (
                u.id === me.userId ? (
                  <p className="text-sm text-muted">Это вы.</p>
                ) : u.staffRole ? (
                  <p className="text-sm text-muted">Это сотрудник. Чтобы заблокировать, сначала отзовите роль в разделе «Сотрудники».</p>
                ) : (
                  <>
                    <p className="text-sm text-muted">Блокировка сразу выкидывает из всех сессий и отзывает приглашения, на которые человек ещё не ответил. Принятые приглашения остаются.</p>
                    <ReasonAction label="Заблокировать" placeholder="Причина: жалоба, спам, фейковый профиль… Её увидят другие сотрудники" onConfirm={block} />
                  </>
                )
              ) : (
                <ReasonAction label="Разблокировать" variant="primary" placeholder="Почему снимаем блокировку" onConfirm={unblock} />
              )}
              {note && <p className="text-sm text-ok">{note}</p>}
            </Card>
          )}
          <Card>
            <h2 className="mb-3 font-semibold">История действий сотрудников</h2>
            <AuditList entries={u.history} />
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <AdminUserPage />
    </StaffOnly>
  );
}

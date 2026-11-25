"use client";

import Link from "next/link";
import { Skeleton, useLoad } from "@/components/admin/admin-ui";
import { StaffOnly, useCan, useStaff } from "@/components/admin/staff-context";
import { Card, PageHeader } from "@/components/ui/card";
import { staffRoleHint, staffRoleLabel } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api/client";
import type { ProjectStatus } from "@/lib/api/types";
import { statusLabel } from "@/lib/project-status";

function Stat({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "danger" | "warn" }) {
  const body = (
    <>
      <p className={cn("font-display text-3xl font-semibold", tone === "danger" && value > 0 && "text-danger", tone === "warn" && value > 0 && "text-warn")}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl bg-surface-2 p-4 transition-colors hover:bg-lavender-soft">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl bg-surface-2 p-4">{body}</div>
  );
}

const ORDER: ProjectStatus[] = ["draft", "matching", "team_selected", "in_progress", "delivered", "cancelled"];

function AdminHome() {
  const staff = useStaff();
  const canAvatars = useCan("avatars.moderate");
  const { data, error } = useLoad(() => api.admin.summary(), []);

  return (
    <>
      <PageHeader title={`Здравствуйте, ${staff.displayName.split(" ")[0]}`} description={`${staffRoleLabel[staff.role]}: ${staffRoleHint[staff.role].toLowerCase()}.`} />
      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <Skeleton />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-1 font-semibold">Ручной подбор</h2>
            <p className="mb-4 text-sm text-muted">Роли, для которых алгоритм не нашёл двух кандидатов. Заказчику обещан ответ за 24 часа.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="ждут подборщика" value={data.summary.queue.open} href="/admin/queue" tone="warn" />
              <Stat label="в работе" value={data.summary.queue.inProgress} href="/admin/queue" />
              <Stat label="просрочено" value={data.summary.queue.overdue} href="/admin/queue" tone="danger" />
              <Stat label="у меня" value={data.summary.queue.mine} href="/admin/queue?filter=mine" />
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">Проекты</h2>
            <p className="mb-4 text-sm text-muted">«Команда собрана → В работе → Сдан» пока переводит админ вручную: договоров и оплаты ещё нет.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ORDER.map((s) => (
                <Stat key={s} label={statusLabel[s].toLowerCase()} value={data.summary.projects[s]} href={`/admin/projects?status=${s}`} />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold">Пользователи</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="всего" value={data.summary.users.total} href="/admin/users" />
              <Stat label="новых за 7 дней" value={data.summary.users.new7d} href="/admin/users" />
              <Stat label="заблокировано" value={data.summary.users.blocked} href="/admin/users?status=blocked" />
              <Stat label="сотрудников" value={data.summary.users.staff} href="/admin/users?kind=staff" />
            </div>
          </Card>

          {canAvatars && (
            <Card>
              <h2 className="mb-1 font-semibold">Аватары</h2>
              <p className="mb-4 text-sm text-muted">Своё фото публикуется сразу. Здесь — новые фото, которые ещё никто не смотрел.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="на проверке" value={data.summary.avatarsPending} href="/admin/avatars" tone="warn" />
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <AdminHome />
    </StaffOnly>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { MascotState } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { ApiError, api } from "@/lib/api/client";
import type { ProjectListItem, ProjectStatus } from "@/lib/api/types";
import { teamActions } from "@/lib/team-search/store";
import { formatRub } from "@/mocks/data";
import { type ProjectBucket, projectBucket, statusLabel } from "@/lib/project-status";

const tabs: { id: ProjectBucket; label: string; empty: string }[] = [
  { id: "current", label: "Текущие", empty: "Сейчас нет проектов в работе." },
  { id: "past", label: "Прошедшие", empty: "Здесь появятся сданные и отменённые проекты." },
  { id: "upcoming", label: "Предстоящие", empty: "Нет запланированных проектов." },
];

const statusTone: Record<ProjectStatus, "neutral" | "accent" | "ok" | "warn" | "danger"> = {
  draft: "neutral",
  matching: "warn",
  team_selected: "accent",
  in_progress: "ok",
  delivered: "neutral",
  cancelled: "danger",
};

// Даты без времени; форматируем в UTC, чтобы сервер и браузер показали одно и то же.
const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
const d = (iso: string) => fmt.format(new Date(iso + "T00:00:00Z")).replace(".", "");

function shootRange(dates: string[]) {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return sorted.length === 1 ? d(sorted[0]) : `${d(sorted[0])} – ${d(sorted[sorted.length - 1])}`;
}

/** «Мои проекты» из API: где я заказчик и куда меня пригласили специалистом. */
export function ProjectsView() {
  const [tab, setTab] = useState<ProjectBucket>("current");
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .projects()
      .then((r) => alive && setProjects(r.projects))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Не получилось загрузить проекты"));
    return () => {
      alive = false;
    };
  }, [reload]);
  const load = () => setReload((n) => n + 1);

  if (error) return <p className="text-danger">{error}</p>;
  if (!projects) return <div className="h-48 animate-pulse rounded-3xl bg-surface-2" />;

  const counts = { current: 0, past: 0, upcoming: 0 } as Record<ProjectBucket, number>;
  projects.forEach((p) => counts[projectBucket(p.status)]++);
  const list = projects.filter((p) => projectBucket(p.status) === tab);
  const active = tabs.find((t) => t.id === tab)!;

  return (
    <div>
      <div role="tablist" aria-label="Проекты по времени" className="mb-5 flex w-full rounded-2xl bg-surface-2 p-1 sm:inline-flex sm:w-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 h-10 text-sm font-semibold transition-colors sm:flex-none sm:px-4",
              tab === t.id ? "bg-surface text-accent shadow-[0_2px_0_var(--border-strong)]" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            <span className="text-xs text-muted">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        projects.length === 0 ? (
          <MascotState
            pose="wave"
            title="Пока нет проектов"
            text="Заполните бриф — и мы покажем три варианта команды под ваш бюджет."
            action={<LinkButton href="/team-search">Собрать команду</LinkButton>}
            className="mx-auto max-w-md"
          />
        ) : (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">{active.empty}</p>
            <LinkButton href="/team-search" variant="secondary">
              Собрать команду
            </LinkButton>
          </Card>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <ProjectCard key={`${p.myPart}-${p.id}`} p={p} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ p, onChanged }: { p: ProjectListItem; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const shoot = shootRange(p.shootDates);
  const teamPct = p.teamTotal ? Math.round((p.teamFilled / p.teamTotal) * 100) : 0;
  const inv = p.myInvitation;
  const waitingMe = inv && (inv.status === "sent" || inv.status === "viewed");

  const answer = async (accept: boolean) => {
    if (!inv) return;
    setBusy(true);
    setErr("");
    try {
      await api.respond(inv.id, accept, accept ? undefined : "Не могу в эти даты");
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Не получилось ответить");
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {waitingMe ? <Badge tone="warn">Вас пригласили</Badge> : <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>}
        <Badge tone={p.myPart === "client" ? "accent" : "neutral"}>{p.myPart === "client" ? "Я заказчик" : `В команде: ${p.myRole ?? "участник"}`}</Badge>
      </div>

      <div>
        <h3 className="font-semibold leading-snug">{p.title}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {p.format} · {p.city}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">Съёмка</dt>
        <dd>{shoot ?? "даты не выбраны"}</dd>
        {p.deliveryDate && (
          <>
            <dt className="text-muted">Сдача</dt>
            <dd>{d(p.deliveryDate)}</dd>
          </>
        )}
        {p.myPart === "client" && p.budgetMax && (
          <>
            <dt className="text-muted">Бюджет</dt>
            <dd>до {formatRub(p.budgetMax)}</dd>
          </>
        )}
      </dl>

      {p.status !== "cancelled" && p.teamTotal > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Команда</span>
            <span>
              {p.teamFilled} из {p.teamTotal}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-lavender-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${teamPct}%` }} />
          </div>
        </div>
      )}

      {p.myPart === "client" && p.status === "draft" && (
        <button
          type="button"
          onClick={() => {
            teamActions.openProject(p.id);
            router.push("/team-search");
          }}
          className="self-start text-sm font-bold text-accent hover:underline"
        >
          Дозаполнить бриф →
        </button>
      )}
      {p.myPart === "client" && p.status !== "draft" && (
        <button
          type="button"
          onClick={() => {
            teamActions.openProject(p.id);
            router.push(p.teamFilled > 0 || p.status !== "matching" ? "/team-search/sent" : "/team-search/results");
          }}
          className="self-start text-sm font-bold text-accent hover:underline"
        >
          {p.status === "matching" ? "Подборка и приглашения →" : "Команда →"}
        </button>
      )}
      {waitingMe && (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => answer(true)}>
            Принять
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => answer(false)}>
            Отказаться
          </Button>
        </div>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}
    </Card>
  );
}

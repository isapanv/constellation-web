"use client";

/** Мелкие общие куски админки: даты, статусы, таблицы, форма с причиной, загрузка. */
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { auditActionLabel } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/client";
import type { AuditEntry, MatchRequestStatus, UserStatus } from "@/lib/api/admin-types";
import type { ProjectStatus } from "@/lib/api/types";
import { statusLabel } from "@/lib/project-status";
import type { InvitationStatus } from "@/lib/team-search/types";

// ---------- Даты ----------

/** PostgreSQL отдаёт «2026-11-25 19:17:16.77+03» — приводим к ISO, чтобы понимали все браузеры. */
export function parseTs(ts: string): Date {
  const iso = ts.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  return new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
}

const dtFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
const dFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const fmtDateTime = (ts: string | null) => (ts ? dtFmt.format(parseTs(ts)).replace(".", "") : "—");
/** Дата без времени (YYYY-MM-DD) */
export const fmtDate = (d: string | null) => (d ? dFmt.format(new Date(d.slice(0, 10) + "T00:00:00Z")).replace(" г.", "") : "—");
export const fmtRub = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("ru-RU").format(n) + " ₽");

/** «через 5 ч 20 мин» / «просрочено на 2 ч» */
export function timeLeft(ts: string, now: number): { text: string; overdue: boolean; soon: boolean } {
  const diff = parseTs(ts).getTime() - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = h >= 24 ? `${Math.floor(h / 24)} д ${h % 24} ч` : h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  return diff < 0 ? { text: `просрочено на ${span}`, overdue: true, soon: false } : { text: `осталось ${span}`, overdue: false, soon: diff < 4 * 3_600_000 };
}

/** Текущее время, обновляется раз в минуту (для обратного отсчёта). null до монтирования — без расхождений с сервером. */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * Фильтры в адресе (?status=blocked), чтобы ссылкой можно было поделиться.
 * Не useSearchParams: с cacheComponents он требует <Suspense> вокруг страницы.
 * На сервере адреса нет — ready = false, данные до этого не грузим.
 */
const URL_EVENT = "sz:url";
const subscribeUrl = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  window.addEventListener(URL_EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(URL_EVENT, cb);
  };
};

export function useUrlParams<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void, boolean] {
  const search = useSyncExternalStore(
    subscribeUrl,
    () => window.location.search,
    () => null,
  );
  const sp = new URLSearchParams(search ?? "");
  const state = { ...defaults };
  for (const k of Object.keys(defaults)) {
    const v = sp.get(k);
    if (v !== null) (state as Record<string, string>)[k] = v;
  }
  const update = (patch: Partial<T>) => {
    const next = { ...state, ...patch };
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && v !== defaults[k]) out.set(k, v);
    const q = out.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (q ? `?${q}` : ""));
    window.dispatchEvent(new Event(URL_EVENT));
  };
  return [state, update, search !== null];
}

/** Переключатель вкладок-фильтров в стиле «Моих проектов». */
export function FilterTabs<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors",
            value === o.id ? "bg-surface text-accent shadow-[0_2px_0_var(--border-strong)]" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="text-xs text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Статусы ----------

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const projectTone: Record<ProjectStatus, Tone> = {
  draft: "neutral",
  matching: "warn",
  team_selected: "accent",
  in_progress: "ok",
  delivered: "neutral",
  cancelled: "danger",
};
export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => <Badge tone={projectTone[status]}>{statusLabel[status]}</Badge>;

const userTone: Record<UserStatus, [Tone, string]> = { active: ["ok", "Активен"], blocked: ["danger", "Заблокирован"], deleted: ["neutral", "Удалён"] };
export const UserStatusBadge = ({ status }: { status: UserStatus }) => <Badge tone={userTone[status][0]}>{userTone[status][1]}</Badge>;

const requestTone: Record<MatchRequestStatus, [Tone, string]> = {
  open: ["warn", "Ждёт подборщика"],
  in_progress: ["accent", "В работе"],
  done: ["ok", "Подобрали"],
  cancelled: ["neutral", "Отменена"],
};
export const RequestStatusBadge = ({ status }: { status: MatchRequestStatus }) => <Badge tone={requestTone[status][0]}>{requestTone[status][1]}</Badge>;

const invTone: Record<InvitationStatus, [Tone, string]> = {
  sent: ["warn", "Отправлено"],
  viewed: ["warn", "Просмотрено"],
  accepted: ["ok", "Принято"],
  declined: ["danger", "Отказ"],
  expired: ["neutral", "Истекло"],
  withdrawn: ["neutral", "Отозвано"],
  cancelled: ["danger", "Отменено"],
};
export const InvitationBadge = ({ status }: { status: InvitationStatus }) => <Badge tone={invTone[status][0]}>{invTone[status][1]}</Badge>;

export const levelLabel: Record<string, string> = { junior: "Junior", middle: "Middle", senior: "Senior", lead: "Lead" };
export const rateUnitLabel: Record<string, string> = { shift: "смена", day: "день", project: "проект", hour: "час" };

// ---------- Таблица ----------

export function Table({ head, children, className }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-3xl border-2 border-border bg-surface", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b-2 border-border text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;

/** Строка-ссылка: вся строка кликабельна, но остаётся настоящей ссылкой для клавиатуры. */
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-accent hover:underline">
      {children}
    </Link>
  );
}

/** Листалка по страницам для списков с hasMore. */
export function Pager({ page, hasMore, onPage }: { page: number; hasMore: boolean; onPage: (n: number) => void }) {
  if (page === 0 && !hasMore) return null;
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ← Назад
      </Button>
      <span className="text-sm text-muted">Страница {page + 1}</span>
      <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Дальше →
      </Button>
    </div>
  );
}

// ---------- Загрузка и ошибки ----------

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("h-48 animate-pulse rounded-3xl bg-surface-2", className)} />;

export const errText = (e: unknown, fallback = "Не получилось. Попробуйте ещё раз") => (e instanceof ApiError ? e.message : fallback);

/** Загрузка данных с перезапросом: const { data, error, reload } = useLoad(() => api.admin.summary(), []). enabled = false — пока не грузить. */
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fn()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError("");
      })
      .catch((e) => alive && setError(errText(e, "Не получилось загрузить данные")));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n, enabled]);
  return { data, setData, error, reload: () => setN((x) => x + 1) };
}

// ---------- Действие с обязательной причиной ----------

/**
 * Опасные действия (блокировка, отмена проекта, сброс фото) — только с причиной:
 * она уходит в журнал и помогает разобраться потом.
 */
export function ReasonAction({
  label,
  confirmLabel,
  placeholder,
  variant = "danger",
  onConfirm,
  minLength = 3,
}: {
  label: string;
  confirmLabel?: string;
  placeholder: string;
  variant?: "danger" | "primary" | "secondary";
  onConfirm: (reason: string) => Promise<void>;
  minLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open)
    return (
      <Button type="button" variant={variant === "danger" ? "danger" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason("");
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 rounded-2xl border-2 border-border bg-surface-2 p-3">
      <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} maxLength={1000} className="min-h-20 bg-surface" />
      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant={variant} disabled={busy || reason.trim().length < minLength}>
          {busy ? "Сохраняю…" : (confirmLabel ?? label)}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

// ---------- История действий ----------

function detailsText(e: AuditEntry): string {
  const d = e.details as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.reason === "string") parts.push(`причина: ${d.reason}`);
  if (typeof d.note === "string") parts.push(d.note);
  if (d.from && d.to) parts.push(`${statusLabel[d.from as ProjectStatus] ?? d.from} → ${statusLabel[d.to as ProjectStatus] ?? d.to}`);
  if (typeof d.role === "string") parts.push(`роль: ${d.role}`);
  if (typeof d.withdrawnInvitations === "number" && d.withdrawnInvitations > 0) parts.push(`отозвано приглашений: ${d.withdrawnInvitations}`);
  return parts.join(" · ");
}

export function AuditList({ entries, empty = "Действий пока не было" }: { entries: AuditEntry[]; empty?: string }) {
  if (!entries.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((e) => (
        <li key={e.id} className="text-sm">
          <p>
            <span className="font-semibold">{e.actor?.name ?? "Консоль"}</span> · {auditActionLabel[e.action] ?? e.action}
          </p>
          {detailsText(e) && <p className="text-muted">{detailsText(e)}</p>}
          <p className="text-xs text-muted">{fmtDateTime(e.at)}</p>
        </li>
      ))}
    </ul>
  );
}

export { detailsText as auditDetailsText };

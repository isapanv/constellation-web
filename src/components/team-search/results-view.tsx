"use client";

import { buttonClass } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatName, levelName, roleName, shortDateRange } from "@/lib/team-search/dictionaries";
import { ApiError, api } from "@/lib/api/client";
import type { MatchingResponse } from "@/lib/api/types";
import { evaluateConfiguration, flexPct, fmtK, fmtRub } from "@/lib/team-search/matching";
import type { Candidate, Configuration, SlotResult, Tier } from "@/lib/team-search/types";
import { Avatar, FlagNote } from "./controls";
import { SpecialistDrawer } from "./specialist-drawer";

export const tierName: Record<Tier, string> = { economy: "Экономичная", optimum: "Оптимальная", premium: "Премиальная" };
const tiers: Tier[] = ["economy", "optimum", "premium"];

type Overrides = Record<Tier, Record<string, Candidate[]>>;

/** Подборка, посчитанная сервером (POST /api/projects/:id/matching). Замены считаются тут же, на клиенте. */
export function ResultsView({ data, onReload }: { data: MatchingResponse; onReload: () => void }) {
  const router = useRouter();
  const { brief, results, configs: base, recommended: rec, projectId } = data;
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [active, setActive] = useState<Tier>(rec);
  const [overrides, setOverrides] = useState<Overrides>({ economy: {}, optimum: {}, premium: {} });
  const [drawer, setDrawer] = useState<{ c: Candidate; tier: Tier } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);

  const configs = useMemo(() => {
    const out = {} as Record<Tier, Configuration>;
    for (const t of tiers) {
      const o = overrides[t];
      out[t] = Object.keys(o).length ? evaluateConfiguration(t, { ...base[t].members, ...o }, results, brief) : base[t];
    }
    return out;
  }, [base, overrides, results, brief]);

  const current = configs[active];
  const teamIds = Object.values(current.members)
    .flat()
    .map((c) => c.specialist.id);
  const manualSlots = results.filter((r) => r.manual);
  const people = teamIds.length;

  /** Поставить кандидата в роль: заменяем участника с самым низким баллом. */
  const putIn = (tier: Tier, c: Candidate) => {
    const members = configs[tier].members[c.slotKey] ?? [];
    const slot = results.find((r) => r.slot.key === c.slotKey)!.slot;
    let next: Candidate[];
    if (members.length < slot.qty) next = [...members, c];
    else {
      const worst = [...members].sort((a, b) => a.score - b.score)[0];
      next = members.map((m) => (m === worst ? c : m));
    }
    setOverrides((o) => ({ ...o, [tier]: { ...o[tier], [c.slotKey]: next } }));
  };

  /** Убрать необязательную роль, ушедшую в ручной подбор, и пересобрать подборку. */
  const removeSlot = async (key: string) => {
    try {
      await api.saveProject(projectId, { ...brief, slots: brief.slots.filter((s) => s.key !== key) });
      onReload();
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : "Не получилось убрать роль");
    }
  };

  const send = async () => {
    setSending(true);
    setSendError("");
    try {
      const members = Object.entries(current.members).flatMap(([slotKey, list]) => list.map((c) => ({ slotKey, specialistId: c.specialist.id })));
      await api.sendInvitations(projectId, { tier: active, members });
      router.push("/team-search/sent");
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : "Не получилось отправить приглашения");
      setSending(false);
    }
  };

  const limit = (brief.budgetMax ?? 0) * (1 + flexPct[brief.budgetFlex]);
  const budgetChip = `Бюджет ${brief.budgetMin ? `${Math.round(brief.budgetMin / 1000)}–` : "до "}${Math.round((brief.budgetMax ?? 0) / 1000)} тыс. ₽${brief.budgetFlex === "pm15" ? " ±15%" : brief.budgetFlex === "negotiable" ? ", обсуждается" : ""}`;

  return (
    <div className="pb-28">
      <Link href="/team-search" className="text-sm text-accent hover:underline">
        ← Вернуться к брифу
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Шаг 2 из 2 · Подборка команды</p>
          <h1 className="mt-1 text-2xl font-semibold">{brief.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {[formatName(brief.formatId), brief.city, `Съёмка ${shortDateRange(brief.shootDates)}`, budgetChip, `${brief.slots.length} ролей`].map((t) => (
              <span key={t} className="rounded-full border-2 border-border bg-surface px-3 py-1 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
        <Link href="/team-search" className={buttonClass("secondary", "md")}>
          Изменить бриф
        </Link>
      </div>

      {manualSlots.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {manualSlots.map((r) => (
            <FlagNote key={r.slot.key} tone="warn">
              <b>{roleName(r.slot.roleId)} — подбираем вручную.</b> В ваши даты свободно меньше двух подходящих кандидатов. Команда «Созвездия» пришлёт
              варианты в течение суток. Остальные роли можно согласовывать уже сейчас.
            </FlagNote>
          ))}
        </div>
      )}

      {/* Три состава */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {tiers.map((t) => (
          <TierCard
            key={t}
            config={configs[t]}
            results={results}
            recommended={t === rec}
            active={t === active}
            diff={configs[t].totalCost - configs.optimum.totalCost}
            onOpen={(c) => setDrawer({ c, tier: t })}
            onSelect={() => setActive(t)}
          />
        ))}
      </div>

      {/* Таблица по ролям */}
      <section className="mt-6 overflow-hidden rounded-3xl border-2 border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <h2 className="font-semibold">{tierName[active]} команда по ролям</h2>
          <span className="text-xs text-muted">Замените любого участника — стоимость и балл команды пересчитаются</span>
        </div>
        <div className="hidden grid-cols-[180px_220px_1fr_240px] gap-5 bg-surface-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
          <span>Роль</span>
          <span>Кандидат</span>
          <span>Почему в подборке</span>
          <span>Альтернативы</span>
        </div>
        {results.map((r) => (
          <RoleRow
            key={r.slot.key}
            r={r}
            members={current.members[r.slot.key] ?? []}
            teamIds={teamIds}
            expanded={expanded.includes(r.slot.key)}
            onExpand={() => setExpanded((e) => (e.includes(r.slot.key) ? e.filter((x) => x !== r.slot.key) : [...e, r.slot.key]))}
            onOpen={(c) => setDrawer({ c, tier: active })}
            onPut={(c) => putIn(active, c)}
            onRemoveSlot={() => removeSlot(r.slot.key)}
          />
        ))}
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Балл кандидата 0–100 считается по портфолио, роли, бюджету, надёжности, занятости и рабочему стилю. Он показывает соответствие этому брифу, а не
          общий рейтинг человека.
        </p>
      </section>

      {/* Отправка приглашений */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm">
            <div className="font-semibold">
              {tierName[active]} · {people} {people === 1 ? "человек" : people < 5 ? "человека" : "человек"} · {fmtRub(current.totalCost)}
            </div>
            <div className={cn("text-xs", brief.budgetMax && current.totalCost > limit ? "text-warn" : "text-muted")}>
              {brief.budgetMax && current.totalCost > limit
                ? `Выше бюджета с учётом гибкости на ${fmtK(current.totalCost - limit)}`
                : "Специалисты получат SMS и письмо; на ответ 48 часов. Контакты откроются после согласия."}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button type="button" disabled={people === 0 || sending} onClick={send} className={buttonClass("primary", "md")}>
              {sending ? "Отправляем…" : "Отправить приглашения"}
            </button>
            {sendError && (
              <span role="alert" className="max-w-sm text-right text-xs text-danger">
                {sendError}
              </span>
            )}
          </div>
        </div>
      </div>

      {drawer && (
        <SpecialistDrawer
          candidate={drawer.c}
          brief={brief}
          inTeam={Object.values(configs[drawer.tier].members)
            .flat()
            .some((m) => m.specialist.id === drawer.c.specialist.id)}
          inTeamIds={Object.values(configs[drawer.tier].members)
            .flat()
            .map((m) => m.specialist.id)}
          onClose={() => setDrawer(null)}
          onPut={() => {
            putIn(drawer.tier, drawer.c);
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
}

function TierCard({
  config,
  results,
  recommended,
  active,
  diff,
  onOpen,
  onSelect,
}: {
  config: Configuration;
  results: SlotResult[];
  recommended: boolean;
  active: boolean;
  diff: number;
  onOpen: (c: Candidate) => void;
  onSelect: () => void;
}) {
  const list = results.flatMap((r) => (config.members[r.slot.key] ?? []).map((c) => ({ c, r })));
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border bg-surface p-5", active ? "border-2 border-accent ring-4 ring-accent-soft" : "border-border")}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{tierName[config.tier]}</h2>
        {recommended ? (
          <span className="rounded-full bg-star px-2.5 py-1 text-xs font-bold text-[#18151f]">рекомендуем</span>
        ) : (
          <span className="text-xs text-muted">балл команды {config.teamScore}</span>
        )}
      </div>
      <div>
        <div className="text-2xl font-semibold">{fmtRub(config.totalCost)}</div>
        <div className="text-xs text-muted">
          гонорары {list.length} чел.
          {config.tier === "optimum" ? ` · балл команды ${config.teamScore}` : diff !== 0 ? ` · ${diff > 0 ? "+" : "−"}${fmtK(Math.abs(diff))} к оптимальной` : " · как оптимальная"}
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {list.map(({ c, r }) => (
          <li key={c.specialist.id + r.slot.key}>
            <button type="button" onClick={() => onOpen(c)} className="grid w-full grid-cols-[40px_1fr_auto] items-center gap-3 rounded-lg text-left hover:bg-surface-2">
              <Avatar name={c.specialist.name} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {c.specialist.name}
                  {c.specialist.platformProjects === 0 && <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">новичок</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {roleName(r.slot.roleId)} · {levelName(c.specialist.level)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold">{new Intl.NumberFormat("ru-RU").format(c.cost)}</span>
                <span className="block text-xs text-muted">{c.score}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {config.flags.length > 0 && (
        <div className="flex flex-col gap-2">
          {config.flags.slice(0, 3).map((f) => (
            <FlagNote key={f.text} tone={f.tone}>
              {f.text}
            </FlagNote>
          ))}
          {config.flags.length > 3 && <span className="text-xs text-muted">и ещё {config.flags.length - 3} замечания — в таблице ниже</span>}
        </div>
      )}
      <button
        type="button"
        onClick={onSelect}
        className={buttonClass(active ? "primary" : "secondary", "md", "mt-auto")}
      >
        {active ? "Выбрана" : "Выбрать"}
      </button>
    </section>
  );
}

function RoleRow({
  r,
  members,
  teamIds,
  expanded,
  onExpand,
  onOpen,
  onPut,
  onRemoveSlot,
}: {
  r: SlotResult;
  members: Candidate[];
  teamIds: string[];
  expanded: boolean;
  onExpand: () => void;
  onOpen: (c: Candidate) => void;
  onPut: (c: Candidate) => void;
  onRemoveSlot: () => void;
}) {
  const others = r.candidates.filter((c) => !teamIds.includes(c.specialist.id));
  const shown = expanded ? others : others.slice(0, 2);
  const ref = members[0];
  const budgetLabel = r.budgetEstimated ? `≈ ${fmtK(r.slotBudget)} (рассчитали)` : fmtRub(r.slotBudget);

  return (
    <div className={cn("grid gap-3 border-t border-border px-5 py-4 lg:grid-cols-[180px_220px_1fr_240px] lg:gap-5", r.manual && "bg-warn-soft/40")}>
      <div>
        <div className="font-semibold">
          {roleName(r.slot.roleId)}
          {r.slot.qty > 1 && ` × ${r.slot.qty}`}
        </div>
        <div className="text-xs text-muted">бюджет роли {budgetLabel}</div>
        {!r.slot.mustHave && <div className="text-xs text-muted">необязательная</div>}
      </div>

      {r.manual ? (
        <>
          <div className="text-sm font-semibold text-warn">Подбираем вручную</div>
          <div className="text-sm text-muted">
            Подходящих свободных кандидатов: {r.candidates.length}. Пришлём варианты в течение суток — отправить приглашения остальной команде можно уже сейчас.
          </div>
          <div>
            {!r.slot.mustHave && (
              <button type="button" onClick={onRemoveSlot} className={buttonClass("secondary", "sm")}>
                Убрать роль из состава
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {members.map((c) => (
              <button key={c.specialist.id} type="button" onClick={() => onOpen(c)} className="flex items-center gap-3 rounded-lg text-left hover:bg-surface-2">
                <Avatar name={c.specialist.name} />
                <span>
                  <span className="block text-sm font-semibold">
                    {c.specialist.name} · {c.score}
                  </span>
                  <span className="block text-xs text-muted">
                    {fmtRub(c.cost)} · даты свободны
                  </span>
                </span>
              </button>
            ))}
          </div>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted">
            {(ref?.reasons ?? []).slice(0, 3).map((x) => (
              <li key={x}>{x}</li>
            ))}
            {r.relaxedLevel && <li>Мало кандидатов нужного уровня — добавили на ступень ниже</li>}
          </ul>
          <div className="flex flex-col gap-1.5 text-sm">
            {shown.length === 0 && <span className="text-muted">Других кандидатов нет</span>}
            {shown.map((c) => {
              const d = ref ? c.cost - ref.cost : 0;
              return (
                <div key={c.specialist.id} className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onOpen(c)} className="min-w-0 text-left hover:underline">
                    <span className="block truncate">
                      {c.specialist.name} · {c.score}
                    </span>
                    <span className={cn("block text-xs", d > 0 ? "text-warn" : "text-ok")}>
                      {d === 0 ? "та же цена" : `${d > 0 ? "+" : "−"}${fmtK(Math.abs(d))}`}
                    </span>
                  </button>
                  <button type="button" onClick={() => onPut(c)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
                    Заменить
                  </button>
                </div>
              );
            })}
            {others.length > 2 && (
              <button type="button" onClick={onExpand} className="self-start text-xs text-accent hover:underline">
                {expanded ? "Свернуть" : `Лучшие кандидаты (${others.length}${r.totalCandidates && r.totalCandidates > r.candidates.length ? ` из ${r.totalCandidates}` : ""})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

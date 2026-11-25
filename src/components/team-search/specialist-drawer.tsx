"use client";

import { buttonClass } from "@/components/ui/button";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  channelOptions,
  formatName,
  involvementOptions,
  legalShort,
  levelName,
  paceOptions,
  revisionsOptions,
  roleName,
  shortDateRange,
  tagName,
} from "@/lib/team-search/dictionaries";
import { fmtRub, WEIGHT_LABELS, WEIGHTS } from "@/lib/team-search/matching";
import type { Brief, Candidate, ScoreBreakdown } from "@/lib/team-search/types";
import { Avatar } from "./controls";

const nameOf = <T extends string>(opts: { id: T; name: string }[], id: T) => opts.find((o) => o.id === id)?.name ?? id;

/**
 * Карточка специалиста в шторке поверх подборки (макет «Карточка специалиста»).
 * inTeamIds — кто сейчас в выбранном составе: подсвечиваем совместный опыт.
 */
export function SpecialistDrawer({
  candidate,
  brief,
  inTeam,
  inTeamIds,
  onClose,
  onPut,
}: {
  candidate: Candidate;
  brief: Brief;
  inTeam: boolean;
  inTeamIds: string[];
  onClose: () => void;
  onPut?: () => void;
}) {
  const s = candidate.specialist;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const rows: [string, string][] = [
    ["Ставка", `от ${fmtRub(s.rate)} / ${s.rateUnit === "shift" ? "смена" : "проект"}`],
    ["В этом проекте", fmtRub(candidate.cost)],
    ["Даты", brief.shootDates.length ? `${shortDateRange(brief.shootDates)}: свободны` : "—"],
    ["Отвечает на приглашения", s.platformProjects ? `обычно за ${Math.round(s.medianResponseH)} ч` : "пока нет данных"],
  ];
  if (s.extraRoles.length) rows.push(["Дополнительные роли", s.extraRoles.join(", ")]);
  if (s.equipment) rows.push(["Своя техника", s.equipment]);

  const style: { q: string; mine: string; theirs: string; same: boolean }[] = [
    { q: "Круги правок", mine: nameOf(revisionsOptions, brief.workStyle.revisions), theirs: nameOf(revisionsOptions, s.workStyle.revisions), same: brief.workStyle.revisions === s.workStyle.revisions },
    { q: "Канал связи", mine: nameOf(channelOptions, brief.workStyle.channel), theirs: nameOf(channelOptions, s.workStyle.channel), same: brief.workStyle.channel === s.workStyle.channel },
    { q: "Участие заказчика", mine: nameOf(involvementOptions, brief.workStyle.involvement), theirs: nameOf(involvementOptions, s.workStyle.involvement), same: brief.workStyle.involvement === s.workStyle.involvement },
    { q: "Темп", mine: nameOf(paceOptions, brief.workStyle.pace), theirs: nameOf(paceOptions, s.workStyle.pace), same: brief.workStyle.pace === s.workStyle.pace },
  ];

  const colleagues = s.colleagues ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Профиль: ${s.name}`}>
      <button type="button" aria-label="Закрыть" onClick={onClose} className="absolute inset-0 bg-fg/30" />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-bg shadow-[-8px_0_0_var(--border)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-3">
          <span className="text-sm text-muted">Карточка специалиста</span>
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-sm font-semibold hover:bg-surface-2">
            Закрыть ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Шапка */}
          <section className="rounded-3xl border-2 border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <Avatar name={s.name} src={s.avatarUrl} size="lg" />
              <div>
                <h2 className="text-xl font-semibold">{s.name}</h2>
                <p className="text-sm">
                  {roleName(s.roleId)} · {levelName(s.level)}
                </p>
                <p className="text-xs text-muted">
                  {s.years} лет в профессии · {s.city}
                  {s.travelReady && " · готов(а) к выездам"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              {s.portfolioVerified && <span className="rounded-full bg-ok-soft px-2.5 py-1 text-ok">✓ Портфолио проверено</span>}
              {s.platformProjects > 0 ? (
                <span className="rounded-full bg-ok-soft px-2.5 py-1 text-ok">✓ {s.platformProjects} проекта на платформе</span>
              ) : (
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">Новичок на платформе</span>
              )}
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">{legalShort(s.legal)}</span>
            </div>
            <dl className="mt-4 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-t border-border py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted">Телефон и почта откроются, когда специалист примет приглашение.</p>
            {onPut && !inTeam && (
              <button type="button" onClick={onPut} className={buttonClass("primary", "md", "mt-4 w-full")}>
                Поставить в команду вместо текущего
              </button>
            )}
            {inTeam && <p className="mt-4 rounded-xl bg-lavender-soft px-3 py-2 text-center text-sm font-medium text-accent">В выбранном составе</p>}
          </section>

          {/* Почему в подборке */}
          <section className="rounded-3xl border-2 border-accent bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Почему {s.name.split(" ")[0]} в подборке</h3>
                <p className="mt-1 text-xs text-muted">Соответствие вашему брифу, а не общий рейтинг специалиста</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-semibold leading-none text-accent">{candidate.score}</div>
                <div className="text-xs text-muted">из 100</div>
              </div>
            </div>
            {candidate.reasons.length > 0 && (
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
                {candidate.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-col gap-2.5">
              {(Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).map((k) => {
                const v = candidate.breakdown[k];
                return (
                  <div key={k} className="grid grid-cols-[1fr_1.2fr_32px] items-center gap-3 text-sm sm:grid-cols-[190px_1fr_32px]">
                    <span>
                      {WEIGHT_LABELS[k]} <span className="text-xs text-muted">· {Math.round(WEIGHTS[k] * 100)}%</span>
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={cn("h-full rounded-full", v < 65 ? "bg-warn" : "bg-accent")} style={{ width: `${v}%` }} />
                    </div>
                    <span className="text-right font-medium">{v}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Портфолио */}
          <section className="rounded-3xl border-2 border-border bg-surface p-5">
            <h3 className="font-semibold">Портфолио</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s.portfolio.map((w, i) => (
                <div key={i} className="flex h-28 items-end rounded-xl bg-surface-2 p-2">
                  <div className="rounded-md bg-surface/90 px-2 py-1 text-xs leading-tight">
                    <b>{formatName(w.formatId)}</b>
                    <br />
                    {w.year}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.styleTags.map((t) => (
                <span
                  key={t}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    brief.styleTagIds.includes(t) ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
                  )}
                >
                  {tagName(t)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Выделены теги, совпавшие с брифом</p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Рабочий стиль */}
            <section className="rounded-3xl border-2 border-border bg-surface p-5">
              <h3 className="font-semibold">Рабочий стиль и ваш бриф</h3>
              <div className="mt-3 flex flex-col text-sm">
                {style.map((r) => (
                  <div key={r.q} className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0">
                    <div>
                      <div>{r.q}</div>
                      <div className="text-xs text-muted">
                        {r.theirs}
                        {!r.same && ` · у вас: ${r.mine}`}
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", r.same ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
                      {r.same ? "совпадает" : "обсудить"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Заполнено самим специалистом. Это предпочтения, а не оценка личности.</p>
            </section>

            {/* С кем работал */}
            <section className="rounded-3xl border-2 border-border bg-surface p-5">
              <h3 className="font-semibold">С кем уже работал(а)</h3>
              <div className="mt-3 flex flex-col gap-2">
                {colleagues.length === 0 && <p className="text-sm text-muted">Совместных проектов на платформе пока нет.</p>}
                {colleagues.map((c) => {
                  const here = inTeamIds.includes(c.id);
                  return (
                    <div key={c.id} className={cn("flex items-center gap-3 rounded-xl p-2.5", here ? "bg-ok-soft" : "bg-surface-2")}>
                      <Avatar name={c.name} size="sm" tone={here ? "ok" : "neutral"} />
                      <div>
                        <div className="text-sm font-medium">
                          {c.name} · {roleName(c.roleId).toLowerCase()}
                        </div>
                        <div className={cn("text-xs", here ? "text-ok" : "text-muted")}>{here ? "в этой команде" : "общий проект"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">Показываем только факт совместной работы. Личные оценки участников друг другу не публикуются.</p>
            </section>
          </div>

          {/* Отзывы */}
          <section className="rounded-3xl border-2 border-border bg-surface p-5">
            <h3 className="font-semibold">Отзывы</h3>
            {s.rating ? (
              <>
                <div className="mt-3 grid grid-cols-3 text-center">
                  {(
                    [
                      ["качество", s.rating.quality],
                      ["сроки", s.rating.deadlines],
                      ["коммуникация", s.rating.communication],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-2xl font-semibold">{v.toFixed(1).replace(".", ",")}</div>
                      <div className="text-xs text-muted">{k}</div>
                    </div>
                  ))}
                </div>
                {s.reviewQuote && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">«{s.reviewQuote}»</p>}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Отзывов пока нет: специалист недавно на платформе. В подборке надёжность для новичков считается нейтральной, чтобы они тоже получали
                проекты.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

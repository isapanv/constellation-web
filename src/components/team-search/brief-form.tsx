"use client";

import { buttonClass } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import {
  channelOptions,
  cities,
  emptyBrief,
  exampleBrief,
  formatName,
  formats,
  involvementOptions,
  legalStatuses,
  levelName,
  levels,
  makeSlot,
  paceOptions,
  revisionsOptions,
  roleUnit,
  roles,
  styleTags,
  templateSlots,
} from "@/lib/team-search/dictionaries";
import { fmtRub } from "@/lib/team-search/matching";
import { ApiError, api } from "@/lib/api/client";
import { teamActions } from "@/lib/team-search/store";
import type { Brief, Level, RoleSlot } from "@/lib/team-search/types";
import { CheckRow, Hint, inputCls, Label, MoneyInput, MultiPills, Pill, Pills, Section, shortDate } from "./controls";

type Check = { label: string; ok: boolean };

function checks(b: Brief): Check[] {
  const lastShoot = [...b.shootDates].sort().at(-1);
  const explicit = b.slots.reduce((s, x) => s + (x.budget ?? 0), 0);
  return [
    { label: "Название, город и формат", ok: !!b.title.trim() && !!b.city && !!b.formatId },
    { label: "Дни съёмки", ok: b.shootDates.length > 0 },
    { label: "Сдача не раньше последнего дня съёмки", ok: !!b.deliveryDate && (!lastShoot || b.deliveryDate >= lastShoot) },
    { label: b.slots.length ? `${b.slots.length} ${plural(b.slots.length, "роль", "роли", "ролей")} в составе` : "Хотя бы одна роль", ok: b.slots.length > 0 },
    {
      label: "Бюджет и документы",
      ok: !!b.budgetMax && (b.budgetMin == null || b.budgetMin <= b.budgetMax) && explicit <= (b.budgetMax ?? 0) && b.legal.length > 0,
    },
    { label: "Согласие на обработку данных", ok: b.consent },
  ];
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function BriefForm({ initial, projectId }: { initial: Brief; projectId: string | null }) {
  const router = useRouter();
  const [b, setB] = useState<Brief>(initial);
  const [busy, setBusy] = useState<"save" | "match" | null>(null);
  const [apiError, setApiError] = useState("");

  /** Сохранить бриф на сервере: новый проект или правка существующего. Возвращает id проекта. */
  const persist = async (): Promise<string | null> => {
    setApiError("");
    try {
      if (projectId) {
        const detail = await api.saveProject(projectId, b);
        // у слотов теперь серверные id — подменяем локальный черновик
        setB(detail.brief);
        teamActions.saveDraft(detail.brief);
        return projectId;
      }
      const { id } = await api.createProject(b);
      teamActions.setProjectId(id);
      return id;
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : "Не получилось сохранить бриф");
      return null;
    }
  };
  const [newDay, setNewDay] = useState("");
  const [addRole, setAddRole] = useState(roles[0].id);
  const [savedNote, setSavedNote] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Каждое изменение сразу сохраняется как черновик (до API — в браузере)
  const update = (patch: Partial<Brief>) => {
    const next = { ...b, ...patch };
    setB(next);
    teamActions.saveDraft(next);
    setSavedNote(false);
  };
  const updateSlot = (key: string, patch: Partial<RoleSlot>) => update({ slots: b.slots.map((s) => (s.key === key ? { ...s, ...patch } : s)) });

  const list = checks(b);
  const ready = list.filter((c) => c.ok).length;
  const canMatch = ready === list.length;
  const explicitBudget = b.slots.reduce((s, x) => s + (x.budget ?? 0), 0);

  const addDay = () => {
    if (!newDay || b.shootDates.includes(newDay)) return;
    update({ shootDates: [...b.shootDates, newDay].sort() });
    setNewDay("");
  };

  const applyTemplate = () => update({ slots: templateSlots(b.formatId, b.shootDates.length) });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Шаг 1 из 2 · Бриф → Подборка команды</p>
          <h1 className="mt-1 text-2xl font-semibold">Расскажите о проекте</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            По брифу соберём три варианта команды под ваш бюджет. Обязательные поля отмечены звёздочкой, остальное повышает точность подбора.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              const ex = exampleBrief();
              teamActions.reset();
              setB(ex);
              teamActions.saveDraft(ex);
            }}
            className="h-9 rounded-xl px-3 font-semibold text-accent hover:bg-surface-2">
            Заполнить примером
          </button>
          <button
            type="button"
            onClick={() => {
              teamActions.reset();
              setB(emptyBrief());
            }}
            className="h-9 rounded-xl px-3 font-semibold text-muted hover:bg-surface-2">
            Очистить
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* 01 */}
          <Section n="01" title="О проекте">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="b-title" required>
                  Название
                </Label>
                <input id="b-title" className={inputCls} value={b.title} onChange={(e) => update({ title: e.target.value })} placeholder="Например, ролик к запуску коллекции" />
              </div>
              <div>
                <Label htmlFor="b-city" required>
                  Город съёмки
                </Label>
                <select id="b-city" className={inputCls} value={b.city} onChange={(e) => update({ city: e.target.value })}>
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label required>Формат</Label>
              <Pills value={b.formatId} options={formats} onChange={(formatId) => update({ formatId })} />
            </div>
            <div>
              <Label htmlFor="b-goal">Задача и идея</Label>
              <textarea
                id="b-goal"
                rows={4}
                className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
                value={b.goal}
                onChange={(e) => update({ goal: e.target.value })}
              />
              <Hint>Пишите как коллеге: что снимаем, для кого, где покажем. Этот текст увидят приглашённые специалисты.</Hint>
            </div>
          </Section>

          {/* 02 */}
          <Section n="02" title="Сроки">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="b-prep">Начало подготовки</Label>
                <input id="b-prep" type="date" className={inputCls} value={b.prepStart} onChange={(e) => update({ prepStart: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="b-day" required>
                  Дни съёмки
                </Label>
                <div className="flex gap-2">
                  <input id="b-day" type="date" className={inputCls} value={newDay} onChange={(e) => setNewDay(e.target.value)} />
                  <button type="button" onClick={addDay} disabled={!newDay} className={buttonClass("secondary", "md", "shrink-0")}>
                    + день
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="b-deliv" required>
                  Сдача результата
                </Label>
                <input id="b-deliv" type="date" className={inputCls} value={b.deliveryDate} onChange={(e) => update({ deliveryDate: e.target.value })} />
              </div>
            </div>
            {b.shootDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {b.shootDates.map((d) => (
                  <span key={d} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft pl-3 pr-1.5 text-sm font-medium text-accent">
                    {shortDate(d)}
                    <button
                      type="button"
                      aria-label={`Убрать ${shortDate(d)}`}
                      onClick={() => update({ shootDates: b.shootDates.filter((x) => x !== d) })}
                      className="grid size-5 place-items-center rounded-full hover:bg-surface"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Hint className="mt-0">
              По дням съёмки исключаем занятых специалистов. Монтаж и цвет проверяем по окну между последним днём съёмки и сдачей.
            </Hint>
          </Section>

          {/* 03 */}
          <Section n="03" title="Кто нужен в команду">
            {b.formatId && (
              <div className="flex flex-col gap-3 rounded-2xl bg-lavender-soft p-4 text-sm text-accent sm:flex-row sm:items-center sm:justify-between">
                <span>Не уверены в составе? Подставим типовую команду для формата «{formatName(b.formatId)}», её можно поправить.</span>
                <button type="button" onClick={applyTemplate} className={buttonClass("secondary", "sm", "shrink-0")}>
                  Подставить состав
                </button>
              </div>
            )}

            {b.slots.length > 0 && (
              <div className="overflow-hidden rounded-2xl border-2 border-border">
                <div className="hidden grid-cols-[2fr_1.2fr_.7fr_.7fr_1.3fr_.9fr_32px] gap-3 bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
                  <span>Роль</span>
                  <span>Мин. уровень</span>
                  <span>Кол-во</span>
                  <span>Смен</span>
                  <span>Бюджет роли, ₽</span>
                  <span>Обязательна</span>
                  <span />
                </div>
                {b.slots.map((s) => (
                  <SlotRow key={s.key} slot={s} onChange={(p) => updateSlot(s.key, p)} onRemove={() => update({ slots: b.slots.filter((x) => x.key !== s.key) })} />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Роль для добавления" className={cn(inputCls.replace("w-full ", ""), "w-full sm:w-72")} value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => update({ slots: [...b.slots, makeSlot(addRole, { shifts: roleUnit(addRole) === "shift" ? Math.max(1, b.shootDates.length) : 0 })] })}
                className={buttonClass("secondary", "md")}
              >
                + Добавить роль
              </button>
            </div>
            <Hint className="mt-0">Пустой бюджет роли — «рассчитаем»: распределим общий бюджет по типовым долям.</Hint>
          </Section>

          {/* 04 */}
          <Section n="04" title="Бюджет">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="b-min">Бюджет от, ₽</Label>
                <MoneyInput id="b-min" value={b.budgetMin} onChange={(budgetMin) => update({ budgetMin })} />
              </div>
              <div>
                <Label htmlFor="b-max" required>
                  Бюджет до, ₽
                </Label>
                <MoneyInput id="b-max" value={b.budgetMax} onChange={(budgetMax) => update({ budgetMax })} />
              </div>
            </div>
            {b.budgetMax != null && explicitBudget > b.budgetMax && (
              <p className="text-sm text-danger">Бюджеты ролей ({fmtRub(explicitBudget)}) больше общего бюджета.</p>
            )}
            {b.budgetMin != null && b.budgetMax != null && b.budgetMin > b.budgetMax && <p className="text-sm text-danger">«От» больше, чем «до».</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Насколько бюджет гибкий</Label>
                <Pills
                  value={b.budgetFlex}
                  options={[
                    { id: "strict", name: "Жёсткий" },
                    { id: "pm15", name: "±15%" },
                    { id: "negotiable", name: "Обсуждается" },
                  ]}
                  onChange={(budgetFlex) => update({ budgetFlex })}
                />
              </div>
              <div>
                <Label>Что входит в сумму</Label>
                <Pills
                  value={b.budgetScope}
                  options={[
                    { id: "fees", name: "Только гонорары" },
                    { id: "fees_equipment", name: "Гонорары, техника, аренда" },
                  ]}
                  onChange={(budgetScope) => update({ budgetScope })}
                />
              </div>
            </div>
            <div>
              <Label required>С кем можете работать по документам</Label>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {legalStatuses
                  .filter((l) => l.id !== "ooo")
                  .map((l) => (
                    <CheckRow
                      key={l.id}
                      checked={b.legal.includes(l.id)}
                      onChange={(on) => update({ legal: on ? [...b.legal, l.id] : b.legal.filter((x) => x !== l.id) })}
                    >
                      {l.id === "ip" ? "ИП и компании" : l.name}
                    </CheckRow>
                  ))}
              </div>
              <Hint>Агентствам обычно нужны закрывающие документы — это жёсткий фильтр подбора.</Hint>
            </div>
          </Section>

          {/* 05 */}
          <Section n="05" title="Стиль и референсы">
            <div>
              <Label>Стилистика — до 5 тегов</Label>
              <MultiPills value={b.styleTagIds} options={styleTags} max={5} onChange={(styleTagIds) => update({ styleTagIds })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Референсы</Label>
              {b.references.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_32px]">
                  <input
                    aria-label="Ссылка на референс"
                    className={inputCls}
                    placeholder="Ссылка на VK Видео, Rutube, Behance…"
                    value={r.url}
                    onChange={(e) => update({ references: b.references.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                  />
                  <input
                    aria-label="Что нравится в референсе"
                    className={inputCls}
                    placeholder="Что нравится"
                    value={r.comment}
                    onChange={(e) => update({ references: b.references.map((x, j) => (j === i ? { ...x, comment: e.target.value } : x)) })}
                  />
                  <button
                    type="button"
                    aria-label="Удалить референс"
                    onClick={() => update({ references: b.references.filter((_, j) => j !== i) })}
                    className="h-10 text-lg text-muted hover:text-fg"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update({ references: [...b.references, { url: "", comment: "" }] })}
                className={buttonClass("secondary", "sm", "self-start")}
              >
                + Добавить референс
              </button>
            </div>
          </Section>

          {/* 06 */}
          <Section
            n="06"
            title="Как вы любите работать"
            description="Сравниваем с рабочими предпочтениями специалистов, чтобы заранее увидеть, о чём договориться. Специалисты видят эти ответы в брифе."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label>Сколько кругов правок ожидаете</Label>
                <Pills value={b.workStyle.revisions} options={revisionsOptions} onChange={(revisions) => update({ workStyle: { ...b.workStyle, revisions } })} />
              </div>
              <div>
                <Label>Ваше участие в процессе</Label>
                <Pills value={b.workStyle.involvement} options={involvementOptions} onChange={(involvement) => update({ workStyle: { ...b.workStyle, involvement } })} />
              </div>
              <div>
                <Label>Удобный канал связи</Label>
                <Pills value={b.workStyle.channel} options={channelOptions} onChange={(channel) => update({ workStyle: { ...b.workStyle, channel } })} />
              </div>
              <div>
                <Label>Темп работы</Label>
                <Pills value={b.workStyle.pace} options={paceOptions} onChange={(pace) => update({ workStyle: { ...b.workStyle, pace } })} />
              </div>
            </div>
          </Section>

          <div className="flex flex-col gap-4 py-2 md:flex-row md:items-center md:justify-between">
            <CheckRow checked={b.consent} onChange={(consent) => update({ consent })}>
              <span className="text-muted">
                Даю <Link href="#consent" className="text-accent underline">согласие на обработку персональных данных</Link> для подбора команды
              </span>
            </CheckRow>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  setBusy("save");
                  if (await persist()) setSavedNote(true);
                  setBusy(null);
                }}
                className={buttonClass("secondary", "md", "flex-1 md:flex-none")}
              >
                {busy === "save" ? "Сохраняем…" : "Сохранить черновик"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  if (!canMatch) {
                    setShowErrors(true);
                    return;
                  }
                  setBusy("match");
                  const id = await persist();
                  if (id) router.push("/team-search/results");
                  else setBusy(null);
                }}
                className={buttonClass("primary", "md", cn("flex-1 md:flex-none", (!canMatch || busy) && "opacity-60"))}
              >
                {busy === "match" ? "Подбираем…" : "Подобрать команду"}
              </button>
            </div>
          </div>
          {apiError && (
            <p role="alert" className="-mt-2 text-sm text-danger">
              {apiError}
            </p>
          )}
          {savedNote && (
            <p role="status" className="-mt-2 text-sm text-ok">
              Черновик сохранён — он есть в «Моих проектах» → Предстоящие.
            </p>
          )}
          {showErrors && !canMatch && (
            <p role="alert" className="-mt-2 text-sm text-danger">
              Не хватает: {list.filter((c) => !c.ok).map((c) => c.label.toLowerCase()).join(", ")}.
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
          <div className="relative rounded-3xl border-2 border-border bg-surface p-5 lg:mt-32">
            {/* Маскот «выглядывает» из-за карточки готовности — только на широком экране */}
            <Mascot pose="think" height={150} className="absolute -top-32 left-1/2 hidden h-[150px] w-auto -translate-x-1/2 lg:block" />
            <h2 className="font-semibold">Готовность брифа</h2>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-lavender-soft">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((ready / list.length) * 100)}%` }} />
            </div>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {list.map((c) => (
                <li key={c.label} className={cn("flex gap-2.5", !c.ok && "text-warn")}>
                  <span className={cn("font-bold", c.ok && "text-ok")}>{c.ok ? "✓" : "!"}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border-2 border-border bg-surface p-5 text-sm">
            <h2 className="font-semibold">Что будет дальше</h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 leading-relaxed text-muted">
              <li>Покажем три варианта команды: экономичный, оптимальный и премиальный</li>
              <li>Вы выберете команду или замените отдельных людей</li>
              <li>Специалисты получат приглашение и подтвердят занятость</li>
            </ol>
            <p className="mt-3 text-xs text-muted">Если на роль мало кандидатов, подберём вручную и ответим в течение суток.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SlotRow({ slot, onChange, onRemove }: { slot: RoleSlot; onChange: (p: Partial<RoleSlot>) => void; onRemove: () => void }) {
  const perShift = roleUnit(slot.roleId) === "shift";
  const m = "text-xs text-muted md:hidden"; // подписи полей на телефоне
  return (
    <div className="grid grid-cols-2 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 md:grid-cols-[2fr_1.2fr_.7fr_.7fr_1.3fr_.9fr_32px] md:first:border-t">
      <div className="col-span-2 flex items-center justify-between md:col-span-1">
        <select aria-label="Роль" className={cn(inputCls, "font-medium")} value={slot.roleId} onChange={(e) => onChange({ roleId: e.target.value, shifts: roleUnit(e.target.value) === "shift" ? Math.max(1, slot.shifts) : 0 })}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" aria-label="Удалить роль" onClick={onRemove} className="ml-2 text-lg text-muted hover:text-fg md:hidden">
          ×
        </button>
      </div>
      <label>
        <span className={m}>Мин. уровень</span>
        <select aria-label="Минимальный уровень" className={inputCls} value={slot.levelMin} onChange={(e) => onChange({ levelMin: e.target.value as Level | "any" })}>
          <option value="any">{levelName("any")}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={m}>Кол-во</span>
        <input aria-label="Количество" type="number" min={1} max={5} className={inputCls} value={slot.qty} onChange={(e) => onChange({ qty: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
      <label>
        <span className={m}>Смен</span>
        {perShift ? (
          <input aria-label="Смен" type="number" min={1} max={30} className={inputCls} value={slot.shifts} onChange={(e) => onChange({ shifts: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} />
        ) : (
          <input aria-label="Смен: за проект" title="Оплата за проект" disabled className={inputCls} value="—" />
        )}
      </label>
      <label>
        <span className={m}>Бюджет роли, ₽</span>
        <MoneyInput ariaLabel="Бюджет роли" value={slot.budget} placeholder="рассчитаем" onChange={(budget) => onChange({ budget })} />
      </label>
      <div className="flex h-10 items-center">
        <Pill on={slot.mustHave} onClick={() => onChange({ mustHave: !slot.mustHave })}>
          {slot.mustHave ? "Да" : "Нет"}
        </Pill>
      </div>
      <button type="button" aria-label="Удалить роль" onClick={onRemove} className="hidden text-lg text-muted hover:text-fg md:block">
        ×
      </button>
    </div>
  );
}

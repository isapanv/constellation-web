"use client";

import { buttonClass } from "@/components/ui/button";
import { useState } from "react";
import { CheckRow, Hint, inputCls, Label, MoneyInput, Pill, Section } from "@/components/team-search/controls";
import { cn } from "@/lib/cn";
import { ApiError, api } from "@/lib/api/client";
import type { MyWorkStyle } from "@/lib/api/types";
import { channelOptions, involvementOptions, paceOptions, revisionsOptions } from "@/lib/team-search/dictionaries";

/** Один вопрос: варианты-«таблетки», повторное нажатие снимает выбор (можно не отвечать). */
function Choice<T extends string>({ value, options, onChange }: { value: T | null; options: { id: T; name: string }[]; onChange: (v: T | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o.id} on={value === o.id} onClick={() => onChange(value === o.id ? null : o.id)}>
          {o.name}
        </Pill>
      ))}
    </div>
  );
}

const POLICIES: { id: NonNullable<MyWorkStyle["testTask"]["policy"]>; name: string; hint: string }[] = [
  { id: "no_test", name: "Не делаю тестовых", hint: "Заказчик смотрит портфолио" },
  { id: "free_small", name: "Небольшой бесплатно", hint: "Короткое задание в пределах часов ниже" },
  { id: "paid_only", name: "Только платно", hint: "С ценой и, если хотите, зачётом в гонорар" },
  { id: "discuss", name: "Обсуждаем отдельно", hint: "Договоритесь с заказчиком в проекте" },
];

/**
 * Стиль работы. Варианты — те же, что у заказчика в брифе: так подбор сравнивает ответы напрямую.
 * Это заявленные предпочтения, а не оценка личности.
 */
export function WorkStyleForm({ initial }: { initial: MyWorkStyle }) {
  const [w, setW] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (patch: Partial<MyWorkStyle>) => {
    setW((x) => ({ ...x, ...patch }));
    setNote(null);
  };
  const setTest = (patch: Partial<MyWorkStyle["testTask"]>) => set({ testTask: { ...w.testTask, ...patch } });
  const t = w.testTask;
  const answered = [w.revisions, w.involvement, w.channel, w.pace].filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      setW((await api.saveMyWorkStyle(w)).workStyle);
      setNote({ ok: true, text: "Сохранено" });
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : "Не получилось сохранить" });
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string, max: number) => (v ? Math.max(1, Math.min(max, Number(v.replace(/\D/g, "")) || 1)) : null);

  return (
    <div className="flex max-w-3xl flex-col gap-5 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">Стиль работы</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Здесь нет правильных ответов. Мы сравниваем их с брифом заказчика и заранее подсказываем обеим сторонам, о чём договориться. Заказчик видит общее
          описание, а не отдельные ответы.
        </p>
      </div>

      {answered < 4 && (
        <div className="rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-accent">
          Отвечено {answered} из 4 вопросов. Без ответов подбор считает рабочий стиль нейтральным.
        </div>
      )}

      <Section n="01" title="Как вам удобно работать">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Сколько кругов правок закладываете</Label>
            <Choice value={w.revisions} options={revisionsOptions} onChange={(revisions) => set({ revisions })} />
          </div>
          <div>
            <Label>Участие заказчика</Label>
            <Choice value={w.involvement} options={involvementOptions} onChange={(involvement) => set({ involvement })} />
          </div>
          <div>
            <Label>Удобный канал связи</Label>
            <Choice value={w.channel} options={channelOptions} onChange={(channel) => set({ channel })} />
          </div>
          <div>
            <Label>Темп</Label>
            <Choice value={w.pace} options={paceOptions} onChange={(pace) => set({ pace })} />
          </div>
        </div>
      </Section>

      <Section n="02" title="График">
        <div className="flex flex-col gap-2.5">
          <CheckRow checked={w.nightShiftsOk} onChange={(nightShiftsOk) => set({ nightShiftsOk })}>
            Готов(а) к ночным сменам
          </CheckRow>
          <CheckRow checked={w.weekendsOk} onChange={(weekendsOk) => set({ weekendsOk })}>
            Готов(а) работать в выходные
          </CheckRow>
        </div>
      </Section>

      <Section n="03" title="Тестовые задания" description="Заказчик увидит ваши условия до того, как попросит тест.">
        <div className="grid gap-2 sm:grid-cols-2">
          {POLICIES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={t.policy === o.id}
              onClick={() => setTest({ policy: t.policy === o.id ? null : o.id })}
              className={cn("rounded-xl border-2 bg-surface p-3 text-left transition-colors", t.policy === o.id ? "border-accent" : "border-border hover:border-muted")}
            >
              <span className="text-sm font-medium">{o.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{o.hint}</span>
            </button>
          ))}
        </div>

        {t.policy && t.policy !== "no_test" && (
          <div className="grid gap-4 md:grid-cols-3">
            {t.policy === "paid_only" && (
              <div>
                <Label htmlFor="tt-price" required>
                  Цена теста, ₽
                </Label>
                <MoneyInput id="tt-price" value={t.price} onChange={(price) => setTest({ price })} placeholder="например, 5 000" />
              </div>
            )}
            <div>
              <Label htmlFor="tt-hours">Объём, часов до</Label>
              <input id="tt-hours" inputMode="numeric" className={inputCls} placeholder="например, 4" value={t.maxHours ?? ""} onChange={(e) => setTest({ maxHours: num(e.target.value, 80) })} />
            </div>
            <div>
              <Label htmlFor="tt-days">Срок, дней до</Label>
              <input id="tt-days" inputMode="numeric" className={inputCls} placeholder="например, 3" value={t.maxDays ?? ""} onChange={(e) => setTest({ maxDays: num(e.target.value, 30) })} />
            </div>
          </div>
        )}
        {t.policy === "paid_only" && (
          <CheckRow checked={!!t.credited} onChange={(credited) => setTest({ credited })}>
            Засчитываю оплату теста в гонорар, если меня берут в проект
          </CheckRow>
        )}
        <div>
          <Label htmlFor="tt-note">Что важно знать заказчику</Label>
          <textarea
            id="tt-note"
            rows={3}
            maxLength={1000}
            className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
            value={t.note}
            onChange={(e) => setTest({ note: e.target.value })}
            placeholder="Например: делаю тест на ваших исходниках, права на результат остаются у меня, пока нет договора"
          />
          <Hint>Права на тестовую работу — вопрос, который стоит обсудить с юристом платформы до пилота.</Hint>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span role="status" className={cn("text-sm", note?.ok ? "text-ok" : "text-danger")}>
            {note?.text}
          </span>
          <button type="button" onClick={save} disabled={saving} className={buttonClass("primary", "md", "px-6")}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

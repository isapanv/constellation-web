"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SavedNote } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { AvailabilityStatus } from "@/lib/types";
import { useToday } from "@/lib/use-today";
import { myAvailability } from "@/mocks/data";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const statusStyle: Record<AvailabilityStatus, string> = {
  free: "bg-surface hover:bg-surface-2",
  tentative: "bg-warn-soft text-warn",
  busy: "bg-danger-soft text-danger",
};
const statusLabel: Record<AvailabilityStatus, string> = {
  free: "Свободен",
  tentative: "Под вопросом",
  busy: "Занят",
};
const next: Record<AvailabilityStatus, AvailabilityStatus> = { free: "busy", busy: "tentative", tentative: "free" };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Разворачивает интервалы из availability в словарь «дата → статус». */
function expand() {
  const map: Record<string, { status: AvailabilityStatus; locked: boolean }> = {};
  for (const a of myAvailability) {
    const d = new Date(a.dateFrom + "T00:00:00");
    const end = new Date(a.dateTo + "T00:00:00");
    while (d <= end) {
      map[iso(d)] = { status: a.status, locked: a.source === "platform_project" };
      d.setDate(d.getDate() + 1);
    }
  }
  return map;
}

export default function CalendarPage() {
  // Текущую дату знаем только в браузере; до этого календарь пустой
  const today = useToday();
  const [monthShift, setMonthShift] = useState(0);
  const month = useMemo(
    () => (today ? new Date(today.getFullYear(), today.getMonth() + monthShift, 1) : null),
    [today, monthShift],
  );
  const todayIso = today ? iso(today) : "";
  const [days, setDays] = useState(expand);
  const [saved, setSaved] = useState(false);

  const cells = useMemo(() => {
    if (!month) return [];
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // понедельник — первый день
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const title = month?.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) ?? "";
  const shift = (delta: number) => setMonthShift((m) => m + delta);

  const toggle = (d: Date) => {
    const key = iso(d);
    const cur = days[key];
    if (cur?.locked) return;
    const status = next[cur?.status ?? "free"];
    setDays((prev) => {
      const copy = { ...prev };
      if (status === "free") delete copy[key];
      else copy[key] = { status, locked: false };
      return copy;
    });
    setSaved(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Календарь занятости"
        description="Нажимайте на день, чтобы менять статус. Дни проектов с платформы отмечаются автоматически и не редактируются."
      />
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            ←
          </Button>
          <h2 className="font-semibold capitalize">{title}</h2>
          <Button variant="ghost" onClick={() => shift(1)} aria-label="Следующий месяц">
            →
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {WEEKDAYS.map((w) => (
            <span key={w} className="pb-1 text-xs text-muted">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const key = iso(d);
            const info = days[key];
            const status = info?.status ?? "free";
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(d)}
                title={info?.locked ? "Проект на платформе" : statusLabel[status]}
                className={cn(
                  "relative aspect-square rounded-xl border-2 border-border text-sm transition-colors sm:aspect-4/3",
                  statusStyle[status],
                  info?.locked && "cursor-not-allowed",
                  key === todayIso && "ring-2 ring-accent",
                )}
              >
                {d.getDate()}
                {info?.locked && <span className="absolute right-1 top-0.5 text-[10px]">★</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
          {(Object.keys(statusLabel) as AvailabilityStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded border border-border", statusStyle[s])} />
              {statusLabel[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">★ Проект на платформе</span>
        </div>
      </Card>
      <div className="flex items-center gap-4">
        {/* TODO(API): отправлять изменения интервалами, а не по дням */}
        <Button onClick={() => setSaved(true)}>Сохранить</Button>
        <SavedNote show={saved} />
      </div>
    </div>
  );
}

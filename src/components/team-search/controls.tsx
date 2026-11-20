"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Небольшие элементы формы брифа. Стили — на токенах проекта (globals.css). */

export const inputCls =
  "w-full rounded-xl border-2 border-border bg-surface-2 px-3.5 h-11 text-sm placeholder:text-muted transition-colors hover:border-border-strong focus:bg-surface focus:outline-none focus:border-accent disabled:text-muted disabled:hover:border-border";

export function Label({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  );
}

export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-1.5 text-xs leading-relaxed text-muted", className)}>{children}</p>;
}

export function Section({ n, title, children, description }: { n: string; title: string; children: React.ReactNode; description?: string }) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border-2 border-border bg-surface p-5 md:p-7">
      <div>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xs font-semibold text-accent">{n}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Pill({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center rounded-full border-2 px-4 text-sm font-medium transition-colors disabled:opacity-40",
        on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

export function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | "";
  options: { id: T; name: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o.id} on={value === o.id} onClick={() => onChange(o.id)}>
          {o.name}
        </Pill>
      ))}
    </div>
  );
}

export function MultiPills({
  value,
  options,
  onChange,
  max,
}: {
  value: string[];
  options: { id: string; name: string }[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <Pill
            key={o.id}
            on={on}
            disabled={!on && !!max && value.length >= max}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
          >
            {o.name}
          </Pill>
        );
      })}
    </div>
  );
}

export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
      <span>{children}</span>
    </label>
  );
}

/**
 * Число с разрядами: «600 000». Пустое поле — null.
 * Пока поле в фокусе, показываем цифры как есть (без пробелов) — так курсор не прыгает и ввод не сбивается
 * ни в одном браузере; разряды расставляем, когда человек уходит с поля.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
  ariaLabel,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const shown = value == null ? "" : focused ? String(value) : new Intl.NumberFormat("ru-RU").format(value);
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn(inputCls, className)}
      placeholder={placeholder}
      value={shown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
        onChange(digits ? Number(digits) : null);
      }}
    />
  );
}

export function Avatar({ name, size = "md", tone = "accent" }: { name: string; size?: "sm" | "md" | "lg"; tone?: "accent" | "ok" | "neutral" }) {
  const initials = name
    .replace(/\./g, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-16 text-xl",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "neutral" && "bg-surface-2 text-muted",
      )}
    >
      {initials}
    </span>
  );
}

export function FlagNote({ tone, children }: { tone: "good" | "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed",
        tone === "good" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "info" && "bg-surface-2 text-muted",
      )}
    >
      <span className="font-bold">{tone === "good" ? "✓" : tone === "warn" ? "!" : "i"}</span>
      <span>{children}</span>
    </div>
  );
}

export { shortDate } from "@/lib/team-search/dictionaries";

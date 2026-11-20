import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border-2 border-border bg-surface-2 px-3.5 h-11 text-sm placeholder:text-muted transition-colors hover:border-border-strong focus:bg-surface focus:outline-none focus:border-accent disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "h-auto min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "pr-8", className)} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-accent" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Кнопки-переключатели для выбора одного значения из короткого списка. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border-2 px-4 h-10 text-sm font-medium transition-colors",
            value === o.value
              ? "border-accent bg-accent-soft text-accent font-semibold"
              : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Выбор нескольких тегов с ограничением по количеству. */
export function TagPicker({
  options,
  selected,
  onChange,
  max,
}: {
  options: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
  max?: number;
}) {
  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (!max || selected.length < max) onChange([...selected, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id);
        const blocked = !on && !!max && selected.length >= max;
        return (
          <button
            key={o.id}
            type="button"
            disabled={blocked}
            onClick={() => toggle(o.id)}
            className={cn(
              "rounded-full border-2 px-3.5 h-9 text-sm font-medium transition-colors disabled:opacity-40",
              on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
            )}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

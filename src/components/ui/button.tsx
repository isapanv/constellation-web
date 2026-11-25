import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";

/**
 * Объёмные кнопки: плотная нижняя тень без размытия, при нажатии кнопка «проседает».
 * Высоту и отступы можно переопределить через className (h-12, px-6 и т. п.).
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl border-2 font-bold transition-[transform,box-shadow,background-color] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variants: Record<Variant, string> = {
  primary: "border-accent bg-accent text-accent-fg shadow-[0_4px_0_var(--accent-shadow)] hover:bg-accent-hover hover:border-accent-hover",
  secondary: "border-border-strong bg-surface text-accent shadow-[0_4px_0_var(--border-strong)] hover:bg-surface-2",
  ghost: "border-transparent text-fg hover:bg-surface-2 active:translate-y-0",
  /** Белая кнопка на кобальтовом блоке */
  inverse: "border-white bg-white text-[#18151f] shadow-[0_4px_0_var(--accent-shadow)] hover:opacity-95",
  danger: "border-danger-soft bg-danger-soft text-danger shadow-[0_4px_0_color-mix(in_srgb,var(--danger)_30%,transparent)] hover:opacity-90",
};

type Size = "sm" | "md" | "lg";
const sizes: Record<Size, string> = { sm: "h-9 px-3.5 text-xs", md: "h-11 px-5 text-sm", lg: "h-13 px-7 text-base" };

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(base, sizes[size], variants[variant], className)} {...props} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={cn(base, sizes[size], variants[variant], className)} {...props} />;
}

/** Те же стили для ссылок и кнопок, которые нельзя заменить на <Button> (например, <Link> с prefetch). */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, sizes[size], variants[variant], className);
}

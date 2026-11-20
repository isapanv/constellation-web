import Link from "next/link";

/** Логотип: созвездие из трёх звёзд, верхняя — лаймовая, как заколка у маскота. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-display text-lg font-semibold">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <path d="M5 22 L14 8 L25 16" className="stroke-lavender" strokeWidth="1.6" fill="none" />
        <circle cx="5" cy="22" r="3" className="fill-accent" />
        <circle cx="25" cy="16" r="3" className="fill-accent" />
        <path
          d="M14 3.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
          className="fill-star stroke-fg"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      Созвездие
    </Link>
  );
}

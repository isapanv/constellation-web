import Image from "next/image";
import { cn } from "@/lib/cn";

const sizes = { xs: 32, sm: 36, md: 40, lg: 64, xl: 112 } as const;
const text = { xs: "text-xs", sm: "text-xs", md: "text-sm", lg: "text-xl", xl: "text-3xl" } as const;

export function initials(name: string) {
  return (
    name
      .replace(/\./g, "")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "•"
  );
}

/**
 * Аватар человека: картинка (готовая медведица или своя) на лавандовом круге, иначе — инициалы.
 * Картинки уже сжаты на сервере, поэтому оптимизатор Next.js не нужен (unoptimized).
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  return (
    <span
      aria-hidden
      style={{ width: px, height: px }}
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-lavender-soft font-bold text-accent", text[size], className)}
    >
      {src ? <Image src={src} alt="" width={px} height={px} unoptimized className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

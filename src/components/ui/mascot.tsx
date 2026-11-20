import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Маскот «Созвездия» — медведица. Позы вырезаны из листа персонажа, фон прозрачный.
 *
 * Где показываем: главная, пустые состояния, моменты результата, ошибки и 404.
 * Где НЕ показываем: карточки специалистов, сравнение команд, смета, договор, оплата.
 * Не больше одного маскота на экран.
 *
 * Исходники 400–520 px по высоте: крупнее ~420 px не растягивайте — станет мыльно.
 * Для крупных размеров нужен рендер в большем разрешении от иллюстратора.
 */
const poses = {
  front: { src: "/mascot/front.webp", w: 329, h: 524 }, // в полный рост, нейтрально
  wink: { src: "/mascot/wink.webp", w: 269, h: 524 }, // подмигивает — «всё получилось»
  wave: { src: "/mascot/wave.webp", w: 375, h: 406 }, // машет — приветствие, пусто
  think: { src: "/mascot/think.webp", w: 320, h: 405 }, // задумалась — подсказка, ошибка, 404
  wow: { src: "/mascot/wow.webp", w: 340, h: 397 }, // удивлена — результат готов
} as const;

export type MascotPose = keyof typeof poses;

export function Mascot({
  pose,
  height,
  alt = "",
  priority,
  className,
}: {
  pose: MascotPose;
  /** Высота в px; ширина считается по пропорциям позы. */
  height: number;
  /** Пустая строка — картинка декоративная и скринридер её пропустит. */
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  const p = poses[pose];
  const width = Math.round((p.w / p.h) * height);
  return (
    <Image
      src={p.src}
      width={width}
      height={height}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      priority={priority}
      className={cn("pointer-events-none select-none", className)}
    />
  );
}

/** Пустое состояние или итог действия: маскот на лавандовой подложке, заголовок, текст, кнопка. */
export function MascotState({
  pose,
  title,
  text,
  action,
  className,
}: {
  pose: MascotPose;
  title: string;
  text?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center overflow-hidden rounded-3xl border-2 border-border bg-surface px-6 pb-8 text-center",
        className,
      )}
    >
      <div className="-mx-6 mb-5 flex h-48 w-[calc(100%+3rem)] items-end justify-center rounded-b-[48px] bg-lavender-soft">
        <Mascot pose={pose} height={180} />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {text && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

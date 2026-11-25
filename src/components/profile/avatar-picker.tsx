"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AVATAR_PRESETS, type AvatarPresetId, type AvatarRef, UPLOAD_LIMITS } from "@/lib/avatars";
import { cn } from "@/lib/cn";
import { ApiError, api } from "@/lib/api/client";
import { refreshMe } from "@/lib/api/use-me";

/**
 * Выбор аватара: своё фото или одна из 12 медведиц. Сохраняется сразу, отдельно от кнопки «Сохранить» профиля.
 */
export function AvatarPicker({
  name,
  avatar,
  url,
  onChange,
}: {
  name: string;
  avatar: AvatarRef;
  url: string | null;
  onChange: (avatar: AvatarRef, url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | AvatarPresetId | "remove" | null>(null);
  const [error, setError] = useState("");

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<{ avatar: AvatarRef; avatarUrl: string | null }>) => {
    setBusy(kind);
    setError("");
    try {
      const res = await fn();
      onChange(res.avatar, res.avatarUrl);
      void refreshMe(); // обновить кружок в шапке
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не получилось сохранить аватар");
    } finally {
      setBusy(null);
    }
  };

  const onFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ""; // чтобы тот же файл можно было выбрать ещё раз
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.maxBytes) {
      setError(`Файл больше ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} МБ. Подойдут ${UPLOAD_LIMITS.hint}`);
      return;
    }
    void run("upload", () => api.uploadAvatar(file));
  };

  const selected = avatar?.kind === "preset" ? avatar.preset : null;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <UserAvatar name={name || "?"} src={url} size="xl" className={cn(busy && "opacity-60")} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {busy === "upload" ? "Загружаем…" : "Загрузить фото"}
          </Button>
          {avatar && (
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => run("remove", () => api.setAvatarPreset(null))}>
              Убрать
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={UPLOAD_LIMITS.accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Или выберите медведицу</p>
        <p className="mt-0.5 text-xs text-muted">
          Фото: {UPLOAD_LIMITS.hint}. Обрежем до квадрата, данные о месте съёмки удалим. Аватар сохраняется сразу.
        </p>
        <div role="radiogroup" aria-label="Готовые аватары" className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {AVATAR_PRESETS.map((p) => {
            const on = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={p.label}
                title={p.label}
                disabled={!!busy}
                onClick={() => !on && run(p.id, () => api.setAvatarPreset(p.id))}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-2xl border-2 p-1.5 transition-colors disabled:opacity-60",
                  on ? "border-accent bg-accent-soft" : "border-transparent hover:border-border",
                )}
              >
                <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-lavender-soft">
                  <Image src={`/avatars/${p.id}.webp`} alt="" fill sizes="80px" unoptimized className="object-cover" />
                </span>
                <span className={cn("truncate text-[11px] leading-tight", on ? "font-semibold text-accent" : "text-muted")}>{p.label}</span>
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

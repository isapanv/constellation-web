/**
 * Аватары: 12 готовых медведиц (public/avatars/<id>.webp) или своя картинка.
 * Список общий для сервера и фронта. Новый пресет = файл в public/avatars + строка здесь
 * + значение в CHECK profiles.avatar_preset (миграция).
 */
export const AVATAR_PRESETS = [
  { id: "director", label: "Режиссёр" },
  { id: "camera", label: "Оператор" },
  { id: "producer", label: "Продюсер" },
  { id: "writer", label: "Сценарист" },
  { id: "editor", label: "Монтажёр" },
  { id: "colorist", label: "Колорист" },
  { id: "sound", label: "Звукорежиссёр" },
  { id: "gaffer", label: "Осветитель" },
  { id: "art", label: "Художник" },
  { id: "makeup", label: "Гримёр" },
  { id: "actor", label: "Актёр" },
  { id: "clapper", label: "Площадка" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];
export const AVATAR_PRESET_IDS = AVATAR_PRESETS.map((p) => p.id) as [AvatarPresetId, ...AvatarPresetId[]];

/** Что стоит в аватаре: готовая медведица, своя картинка или ничего (тогда показываем инициалы). */
export type AvatarRef = { kind: "preset"; preset: AvatarPresetId } | { kind: "upload"; mediaId: string } | null;

export function avatarUrl(a: AvatarRef): string | null {
  if (!a) return null;
  return a.kind === "preset" ? `/avatars/${a.preset}.webp` : `/api/media/${a.mediaId}`;
}

/** Из колонок profiles.avatar_preset / avatar_media_id. */
export function avatarFromRow(preset: string | null, mediaId: string | null): AvatarRef {
  if (mediaId) return { kind: "upload", mediaId };
  if (preset && AVATAR_PRESET_IDS.includes(preset as AvatarPresetId)) return { kind: "preset", preset: preset as AvatarPresetId };
  return null;
}

/** Ограничения загрузки — показываем их и в интерфейсе. */
export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  accept: "image/jpeg,image/png,image/webp,image/avif",
  hint: "JPG, PNG, WebP или AVIF, до 10 МБ",
};

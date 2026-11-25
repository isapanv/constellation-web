/**
 * Медиафайлы: приём, обработка, хранение в PostgreSQL (таблица media_files, миграция 0005).
 *
 * Каждую картинку пересобираем на сервере через sharp:
 *  - тип определяем по содержимому, а не по имени файла и не по заголовку браузера;
 *  - поворачиваем по EXIF и выбрасываем все метаданные (в фото с телефона бывают GPS-координаты — это ПДн);
 *  - уменьшаем и сохраняем в WebP. Подделанный «файл с картинкой» после пересборки становится обычной картинкой.
 *
 * Переезд в объектное хранилище: заменить putBytes/getBytes, остальной код не меняется.
 */
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import type { PoolClient } from "pg";
import { UPLOAD_LIMITS } from "@/lib/avatars";
import { one, q } from "./db";
import { fail } from "./http";

export type MediaPurpose = "avatar" | "portfolio";

const INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const UPLOADS_PER_HOUR = 30;
const PORTFOLIO_FILES_MAX = 100;
const STORED_MAX = 2 * 1024 * 1024; // CHECK в media_files

type Processed = { data: Buffer; width: number; height: number };

/** Достаём файл из multipart-запроса. Размер проверяем до чтения тела, чтобы не тащить в память гигабайты. */
export async function readUpload(req: Request): Promise<{ bytes: Buffer; form: FormData }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > UPLOAD_LIMITS.maxBytes + 64 * 1024) fail(413, `Файл больше ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} МБ`, "too_large");
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) fail(415, "Ожидается файл (multipart/form-data)");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    fail(400, "Не получилось прочитать файл");
  }
  const file = form!.get("file");
  if (!(file instanceof File) || file.size === 0) fail(400, "Выберите файл", "no_file");
  if ((file as File).size > UPLOAD_LIMITS.maxBytes) fail(413, `Файл больше ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} МБ`, "too_large");
  return { bytes: Buffer.from(await (file as File).arrayBuffer()), form: form! };
}

/** Проверка и пересборка картинки. */
export async function processImage(input: Buffer, purpose: MediaPurpose): Promise<Processed> {
  let meta: Metadata;
  try {
    // limitInputPixels — защита от «картинки-бомбы» 50 000 × 50 000 px в маленьком файле
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    return fail(415, "Это не картинка или файл повреждён. Подойдут " + UPLOAD_LIMITS.hint, "bad_image");
  }
  if (!meta.format || !INPUT_FORMATS.has(meta.format)) fail(415, "Формат не подходит. Подойдут " + UPLOAD_LIMITS.hint, "bad_format");
  if ((meta.pages ?? 1) > 1) fail(415, "Анимированные картинки не подходят", "animated");

  const base = () => sharp(input, { limitInputPixels: 50_000_000, failOn: "error" }).rotate(); // rotate() — по EXIF
  const encode = async (quality: number): Promise<Processed> => {
    const img =
      purpose === "avatar"
        ? base().resize(512, 512, { fit: "cover", position: "attention" }) // квадрат, кадрируем по самому «заметному» месту
        : base().resize(2000, 2000, { fit: "inside", withoutEnlargement: true });
    try {
      const { data, info } = await img.webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    } catch {
      return fail(415, "Не получилось обработать картинку. Попробуйте другой файл", "bad_image");
    }
  };

  let out = await encode(purpose === "avatar" ? 85 : 82);
  if (out.data.length > STORED_MAX) out = await encode(65);
  if (out.data.length > STORED_MAX) fail(413, "Картинка слишком детальная даже после сжатия. Попробуйте другой файл", "too_large");
  return out;
}

/** Лимиты на пользователя: защита от ботов и от разрастания базы. */
export async function assertCanUpload(ownerId: string, purpose: MediaPurpose) {
  const r = await one<{ last_hour: number; portfolio: number }>(
    `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
            count(*) FILTER (WHERE purpose = 'portfolio')::int AS portfolio
     FROM media_files WHERE owner_id = $1`,
    [ownerId],
  );
  if ((r?.last_hour ?? 0) >= UPLOADS_PER_HOUR) fail(429, "Слишком много загрузок. Попробуйте через час", "too_many");
  if (purpose === "portfolio" && (r?.portfolio ?? 0) >= PORTFOLIO_FILES_MAX)
    fail(422, `В портфолио не больше ${PORTFOLIO_FILES_MAX} картинок. Удалите лишние`, "quota");
}

/** Сохранить обработанную картинку. Возвращает id файла. */
export async function insertMedia(c: PoolClient, ownerId: string, purpose: MediaPurpose, img: Processed): Promise<string> {
  const sha = createHash("sha256").update(img.data).digest();
  const r = await c.query<{ id: string }>(
    `INSERT INTO media_files (owner_id, purpose, mime, size_bytes, width, height, sha256, data)
     VALUES ($1, $2, 'image/webp', $3, $4, $5, $6, $7) RETURNING id`,
    [ownerId, purpose, img.data.length, img.width, img.height, sha, img.data],
  );
  return r.rows[0].id;
}

export type StoredMedia = { ownerId: string; purpose: MediaPurpose; mime: string; data: Buffer; etag: string };

export async function getMedia(id: string): Promise<StoredMedia | null> {
  const r = await one<{ owner_id: string; purpose: MediaPurpose; mime: string; data: Buffer | null; sha: string }>(
    `SELECT owner_id, purpose, mime, data, encode(sha256, 'hex') AS sha FROM media_files WHERE id = $1`,
    [id],
  );
  if (!r || !r.data) return null; // data = NULL → файл уже в объектном хранилище (пока не реализовано)
  return { ownerId: r.owner_id, purpose: r.purpose, mime: r.mime, data: r.data, etag: `"${r.sha}"` };
}

/** Удалить свой файл. Аватар, который на него ссылался, обнулится сам (ON DELETE SET NULL). */
export async function deleteMedia(ownerId: string, id: string) {
  const rows = await q(`DELETE FROM media_files WHERE id = $1 AND owner_id = $2 RETURNING id`, [id, ownerId]);
  if (!rows.length) fail(404, "Файл не найден");
}

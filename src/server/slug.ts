/** Адрес профиля из имени: «Мария Ковалёва» → maria-kovaleva, при совпадении — maria-kovaleva-2. */
import type { PoolClient } from "pg";

const tr: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugBase(name: string): string {
  const s = name
    .toLowerCase()
    .split("")
    .map((ch) => tr[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "-"))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28)
    .replace(/-$/, "");
  return s.length >= 3 ? s : `user-${s || "x"}`;
}

/** Свободный адрес: проверяем и текущие, и старые адреса (profile_slug_history). */
export async function uniqueSlug(c: PoolClient, name: string): Promise<string> {
  const base = slugBase(name);
  for (let i = 1; i < 1000; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const r = await c.query(
      `SELECT 1 FROM profiles WHERE lower(slug) = $1 UNION ALL SELECT 1 FROM profile_slug_history WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if (!r.rowCount) return slug;
  }
  throw new Error("Не удалось подобрать адрес профиля");
}

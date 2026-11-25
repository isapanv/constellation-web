"use client";

import { buttonClass } from "@/components/ui/button";
import { useState } from "react";
import { AvatarPicker } from "./avatar-picker";
import { CheckRow, Hint, inputCls, Label, MoneyInput, MultiPills, Pill, Section } from "@/components/team-search/controls";
import { cn } from "@/lib/cn";
import { ApiError, api } from "@/lib/api/client";
import type { MyProfile, RateUnitDb } from "@/lib/api/types";
import { setMe } from "@/lib/api/use-me";
import { cities, formats, legalStatuses, levels, roles, styleTags } from "@/lib/team-search/dictionaries";

type Role = MyProfile["specialist"]["roles"][number];
/** Строка роли в форме: пока не выбрано — пустые значения */
type RoleDraft = Omit<Role, "roleId" | "rateMin" | "years"> & { roleId: string; rateMin: number | null; years: number | null };

const UNIT_NAMES: Record<RateUnitDb, string> = { shift: "за смену", day: "за день", project: "за проект", hour: "за час" };
const MAX_ROLES = 4;

/** Чего не хватает, чтобы попадать в подбор (те же условия, что у жёстких фильтров на сервере). */
function missingForMatching(p: MyProfile, rs: RoleDraft[]): string[] {
  const out: string[] = [];
  if (!rs.some((r) => r.roleId && r.rateMin)) out.push("роль и ставка");
  if (!p.specialist.legalStatus) out.push("статус для документов");
  if (!p.city) out.push("город");
  if (!p.specialist.openToWork) out.push("включить «Открыт(а) к работе»");
  return out;
}

export function ProfileForm({ initial }: { initial: MyProfile }) {
  const [p, setP] = useState(initial);
  const [rs, setRs] = useState<RoleDraft[]>(initial.specialist.roles);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (patch: Partial<MyProfile>) => {
    setP((x) => ({ ...x, ...patch }));
    setNote(null);
  };
  const setSpec = (patch: Partial<MyProfile["specialist"]>) => set({ specialist: { ...p.specialist, ...patch } });
  const setRole = (i: number, patch: Partial<RoleDraft>) => {
    setRs((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setNote(null);
  };

  const addRole = () => {
    setRs((list) => [...list, { roleId: "", level: "middle", years: null, isPrimary: list.length === 0, rateMin: null, rateUnit: "shift" }]);
    setNote(null);
  };
  const removeRole = (i: number) => {
    setRs((list) => {
      const next = list.filter((_, j) => j !== i);
      if (next.length && !next.some((r) => r.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
    setNote(null);
  };

  const save = async () => {
    const incomplete = rs.findIndex((r) => !r.roleId || !r.rateMin);
    if (incomplete >= 0) {
      setNote({ ok: false, text: `Роль ${incomplete + 1}: выберите роль и укажите ставку — или удалите строку` });
      return;
    }
    setSaving(true);
    setNote(null);
    try {
      const res = await api.saveMyProfile({
        displayName: p.displayName,
        showFullLastName: p.showFullLastName,
        city: p.city,
        bio: p.bio,
        links: p.links,
        clientMode: p.clientMode,
        specialistMode: p.specialistMode,
        specialist: { ...p.specialist, roles: rs.map((r) => ({ ...r, roleId: r.roleId, rateMin: r.rateMin!, years: r.years ?? 0 })) },
      });
      setP(res.profile);
      setRs(res.profile.specialist.roles);
      setMe(res.me);
      setNote({ ok: true, text: "Сохранено" });
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : "Не получилось сохранить" });
    } finally {
      setSaving(false);
    }
  };

  const missing = p.specialistMode ? missingForMatching(p, rs) : [];
  const usedRoles = rs.map((r) => r.roleId);

  return (
    <div className="flex max-w-3xl flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Профиль</h1>
          <p className="mt-1 text-sm text-muted">
            Так вас видят заказчики и команда.
            {/* TODO: ссылка на /u/{slug}, когда публичная страница переедет на API */}
          </p>
        </div>
        {p.specialistMode && (
          <div className="w-48">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Заполненность</span>
              <span>{p.completeness}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${p.completeness}%` }} />
            </div>
          </div>
        )}
      </div>

      {p.specialistMode && missing.length > 0 && (
        <div className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <b>Чтобы попадать в подбор, добавьте:</b> {missing.join(", ")}.
        </div>
      )}

      <Section n="01" title="Основное">
        <AvatarPicker
          name={p.displayName}
          avatar={p.avatar}
          url={p.avatarUrl}
          onChange={(avatar, avatarUrl) => setP((x) => ({ ...x, avatar, avatarUrl }))}
        />
        <div className="grid gap-4 border-t-2 border-border pt-5 md:grid-cols-2">
          <div>
            <Label htmlFor="pf-name" required>
              Имя и фамилия или псевдоним
            </Label>
            <input id="pf-name" className={inputCls} value={p.displayName} maxLength={80} onChange={(e) => set({ displayName: e.target.value })} placeholder="Например, Анна Миронова" />
            <div className="mt-2">
              <CheckRow checked={p.showFullLastName} onChange={(showFullLastName) => set({ showFullLastName })}>
                <span className="text-muted">Показывать фамилию полностью (иначе — только первую букву)</span>
              </CheckRow>
            </div>
          </div>
          <div>
            <Label htmlFor="pf-city">Город</Label>
            <select id="pf-city" className={cn(inputCls, !p.city && "text-muted")} value={p.city ?? ""} onChange={(e) => set({ city: e.target.value || null })}>
              <option value="">Выберите город</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="pf-bio">О себе</Label>
          <textarea
            id="pf-bio"
            rows={4}
            maxLength={2000}
            className={cn(inputCls, "h-auto py-2.5 leading-relaxed")}
            value={p.bio}
            onChange={(e) => set({ bio: e.target.value })}
            placeholder="Пара абзацев: чем занимаетесь, с какими проектами работали, что любите снимать"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="pf-tg">Telegram</Label>
            <input id="pf-tg" className={inputCls} value={p.links.telegram} onChange={(e) => set({ links: { ...p.links, telegram: e.target.value } })} placeholder="@username" />
          </div>
          <div>
            <Label htmlFor="pf-vk">VK</Label>
            <input id="pf-vk" className={inputCls} value={p.links.vk} onChange={(e) => set({ links: { ...p.links, vk: e.target.value } })} placeholder="vk.com/…" />
          </div>
          <div>
            <Label htmlFor="pf-site">Сайт или портфолио</Label>
            <input id="pf-site" className={inputCls} value={p.links.site} onChange={(e) => set({ links: { ...p.links, site: e.target.value } })} placeholder="https://" />
          </div>
        </div>
        <Hint className="mt-0">Телефон и почта скрыты от всех, пока вы не примете приглашение в проект.</Hint>
      </Section>

      <Section n="02" title="Как вы пользуетесь Созвездием">
        <div className="flex flex-wrap gap-2">
          <Pill on={p.specialistMode} onClick={() => set({ specialistMode: !p.specialistMode })}>
            Я специалист
          </Pill>
          <Pill on={p.clientMode} onClick={() => set({ clientMode: !p.clientMode })}>
            Я ищу команду
          </Pill>
        </div>
      </Section>

      {p.specialistMode && (
        <>
          <Section n="03" title="Роли и ставки" description="Одна основная роль и до трёх дополнительных. Ставка — минимальная, точную сумму обсуждаете в проекте.">
            {rs.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted">Пока ни одной роли. Начните с основной.</div>
            )}
            {rs.map((r, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-2xl border-2 border-border p-4">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <div className="min-w-0">
                    <Label>{r.isPrimary ? "Основная роль" : "Дополнительная роль"}</Label>
                    <select
                      aria-label="Роль"
                      className={cn(inputCls, !r.roleId && "text-muted")}
                      value={r.roleId}
                      onChange={(e) => {
                        const unit = roles.find((x) => x.id === e.target.value)?.unit ?? "shift";
                        setRole(i, { roleId: e.target.value, rateUnit: unit });
                      }}
                    >
                      <option value="">Выберите роль</option>
                      {roles.map((x) => (
                        <option key={x.id} value={x.id} disabled={x.id !== r.roleId && usedRoles.includes(x.id)}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <Label>Уровень</Label>
                    <select aria-label="Уровень" className={inputCls} value={r.level} onChange={(e) => setRole(i, { level: e.target.value as Role["level"] })}>
                      {levels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <Label>Лет опыта</Label>
                    <MoneyInput ariaLabel="Лет опыта" placeholder="0" value={r.years} onChange={(years) => setRole(i, { years: years == null ? null : Math.min(70, years) })} />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <Label>Ставка от, ₽</Label>
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <MoneyInput ariaLabel="Ставка" placeholder="Введите бюджет" value={r.rateMin} onChange={(rateMin) => setRole(i, { rateMin })} />
                      </div>
                      <div className="w-36 shrink-0">
                        <select aria-label="За что ставка" className={inputCls} value={r.rateUnit} onChange={(e) => setRole(i, { rateUnit: e.target.value as RateUnitDb })}>
                          {(Object.keys(UNIT_NAMES) as RateUnitDb[]).map((u) => (
                            <option key={u} value={u}>
                              {UNIT_NAMES[u]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!r.isPrimary && (
                      <button
                        type="button"
                        onClick={() => setRs((list) => list.map((x, j) => ({ ...x, isPrimary: j === i })))}
                        className="h-10 whitespace-nowrap rounded-lg px-2 text-xs text-accent hover:bg-accent-soft"
                      >
                        Сделать основной
                      </button>
                    )}
                    <button type="button" aria-label="Удалить роль" onClick={() => removeRole(i)} className="h-10 px-2 text-lg text-muted hover:text-fg">
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {rs.length < MAX_ROLES && (
              <button type="button" onClick={addRole} className={buttonClass("secondary", "md", "self-start")}>
                + {rs.length === 0 ? "Добавить основную роль" : "Добавить роль"}
              </button>
            )}
          </Section>

          <Section n="04" title="Работа и документы">
            <div className="flex flex-col gap-2.5">
              <CheckRow checked={p.specialist.openToWork} onChange={(openToWork) => setSpec({ openToWork })}>
                Открыт(а) к работе <span className="text-muted">— выключите, если сейчас не берёте проекты: профиль останется виден по ссылке</span>
              </CheckRow>
              <CheckRow checked={p.specialist.travelReady} onChange={(travelReady) => setSpec({ travelReady })}>
                Готов(а) к выездам в другие города
              </CheckRow>
            </div>
            <div className="max-w-sm">
              <Label htmlFor="pf-legal">Как вы оформляете работу</Label>
              <select
                id="pf-legal"
                className={cn(inputCls, !p.specialist.legalStatus && "text-muted")}
                value={p.specialist.legalStatus ?? ""}
                onChange={(e) => setSpec({ legalStatus: (e.target.value || null) as MyProfile["specialist"]["legalStatus"] })}
              >
                <option value="">Выберите статус</option>
                {legalStatuses.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.short}
                  </option>
                ))}
              </select>
              <Hint>Агентствам важно, кто сможет выдать закрывающие документы.</Hint>
            </div>
          </Section>

          <Section n="05" title="Форматы и стиль" description="По ним сравниваем вас с брифами заказчиков.">
            <div>
              <Label>Форматы, в которых работаете</Label>
              <MultiPills value={p.specialist.formatIds} options={formats} onChange={(formatIds) => setSpec({ formatIds })} />
            </div>
            <div>
              <Label>Стилистика — до 5 тегов</Label>
              <MultiPills value={p.specialist.styleTagIds} options={styleTags} max={5} onChange={(styleTagIds) => setSpec({ styleTagIds })} />
            </div>
          </Section>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span role="status" className={cn("text-sm", note?.ok ? "text-ok" : "text-danger")}>
            {note?.text}
          </span>
          <button type="button" onClick={save} disabled={saving} className={buttonClass("primary", "md", "px-6")}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

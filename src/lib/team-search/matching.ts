/**
 * Упрощённая копия конвейера подбора из db-structure.md (раздел 4) для демонстрации на фронте.
 * Шаг 1 — жёсткие фильтры, Шаг 2 — скоринг из 6 компонентов (0–100),
 * Шаг 3 — ослабление уровня на одну ступень, если кандидатов < 3; если < 2 — ручной подбор.
 * TODO(API): на backend — POST /projects/:id/matching → team_configurations + configuration_members.
 * Скоринг здесь — правила и веса, без LLM, как и решено для MVP.
 */

import { levelIndex, legalShort, revisionsOptions, roleName, roles, tagName, formatName } from "./dictionaries";
import type {
  Brief,
  BudgetFlex,
  Candidate,
  Configuration,
  Flag,
  RoleSlot,
  ScoreBreakdown,
  SlotResult,
  Specialist,
  Tier,
} from "./types";

export const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  portfolio: 0.25,
  role: 0.2,
  budget: 0.15,
  reliability: 0.15,
  availability: 0.1,
  workStyle: 0.15,
};

export const WEIGHT_LABELS: Record<keyof ScoreBreakdown, string> = {
  portfolio: "Портфолио под бриф",
  role: "Роль и уровень",
  budget: "Бюджет",
  reliability: "Надёжность",
  availability: "Занятость",
  workStyle: "Рабочий стиль",
};

export const flexPct: Record<BudgetFlex, number> = { strict: 0, pm15: 0.15, negotiable: 0.25 };

const SPB = ["Санкт-Петербург", "Ленинградская область"];
const sameCity = (a: string, b: string) => a === b || (SPB.includes(a) && SPB.includes(b));

function daysBetween(fromExclusive: string, toInclusive: string): string[] {
  const out: string[] = [];
  const d = new Date(fromExclusive + "T00:00:00Z");
  const end = new Date(toInclusive + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end && out.length < 120) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Окно постпродакшна: день после последней съёмки — сдача. */
function postWindow(brief: Brief): string[] {
  if (!brief.deliveryDate || brief.shootDates.length === 0) return [];
  const last = [...brief.shootDates].sort().at(-1)!;
  return daysBetween(last, brief.deliveryDate);
}

const isPostRole = (roleId: string) => roles.find((r) => r.id === roleId)?.unit === "project";

/** Занятость специалиста: доля занятых дней в нужном окне (0 — свободен). */
function busyShare(s: Specialist, brief: Brief, roleId: string): number {
  const days = isPostRole(roleId) ? postWindow(brief) : brief.shootDates;
  if (days.length === 0) return 0;
  return days.filter((d) => s.busy.includes(d)).length / days.length;
}

export function costFor(s: Specialist, slot: RoleSlot): number {
  return s.rateUnit === "shift" ? s.rate * Math.max(1, slot.shifts) : s.rate;
}

/** Бюджет роли на одного человека: явный или из типовых долей. */
export function slotBudgets(brief: Brief): Record<string, { perPerson: number; estimated: boolean }> {
  const out: Record<string, { perPerson: number; estimated: boolean }> = {};
  const total = brief.budgetMax ?? 0;
  const fixed = brief.slots.reduce((s, x) => s + (x.budget ?? 0), 0);
  const shareOf = (roleId: string) => roles.find((r) => r.id === roleId)?.share ?? 8;
  // Доли считаем от всего состава, чтобы «рассчитаем» не забирал весь остаток бюджета
  const shares = brief.slots.reduce((s, x) => s + shareOf(x.roleId) * x.qty, 0);
  const freeShares = brief.slots.filter((x) => x.budget == null).reduce((s, x) => s + shareOf(x.roleId) * x.qty, 0);
  const rest = Math.max(0, total - fixed);
  // Если остатка не хватает на типовые доли — делим остаток пропорционально
  const scale = shares > 0 && (total * freeShares) / shares > rest ? rest / ((total * freeShares) / shares) : 1;
  for (const slot of brief.slots) {
    if (slot.budget != null) {
      out[slot.key] = { perPerson: Math.round(slot.budget / slot.qty), estimated: false };
    } else {
      const val = shares > 0 ? ((total * shareOf(slot.roleId)) / shares) * scale : 0;
      out[slot.key] = { perPerson: Math.round(val / 1000) * 1000, estimated: true };
    }
  }
  return out;
}

// ---------- Шаг 1. Жёсткие фильтры ----------

function passesHard(s: Specialist, slot: RoleSlot, brief: Brief, minLevel: number): boolean {
  if (s.roleId !== slot.roleId && !s.extraRoles.includes(slot.roleId)) return false; // H1 роль
  if (!s.openToWork) return false; // D: открыт к работе
  if (!sameCity(s.city, brief.city) && !s.travelReady) return false; // H2 город или выезд
  const legalOk = brief.legal.includes(s.legal) || (s.legal === "ooo" && brief.legal.includes("ip"));
  if (!legalOk) return false; // H3 документы
  if (levelIndex(s.level) < minLevel) return false; // H4 уровень
  const share = busyShare(s, brief, slot.roleId);
  if (isPostRole(slot.roleId) ? share > 0.5 : share > 0) return false; // H5 даты
  return true;
}

// ---------- Шаг 2. Скоринг ----------

const revIdx = (r: string) => revisionsOptions.findIndex((x) => x.id === r);
const invOrder = ["freedom", "stages", "every_step"];

function scoreCandidate(s: Specialist, slot: RoleSlot, brief: Brief, perPersonBudget: number, minLevel: number, relaxed: boolean): Candidate {
  const reasons: string[] = [];
  const cost = costFor(s, slot);

  // Портфолио: совпадение тегов стиля (70) + работы в нужном формате (30)
  const matched = s.styleTags.filter((t) => brief.styleTagIds.includes(t));
  const tagPart = brief.styleTagIds.length === 0 ? 0.5 : Math.min(1, matched.length / Math.min(4, brief.styleTagIds.length));
  const sameFormat = s.portfolio.filter((w) => w.formatId === brief.formatId).length;
  const portfolio = Math.round(tagPart * 70 + (sameFormat >= 2 ? 30 : sameFormat === 1 ? 15 : 0));
  if (matched.length >= 2) reasons.push(`Стиль совпадает с брифом: ${matched.slice(0, 3).map(tagName).join(", ").toLowerCase()}`);
  if (sameFormat >= 2) reasons.push(`${sameFormat} работы в формате «${formatName(brief.formatId)}»`);

  // Роль и уровень
  const diff = levelIndex(s.level) - minLevel;
  const role = relaxed ? 55 : diff <= 0 ? 80 : diff === 1 ? 95 : 100;
  if (relaxed) reasons.push("Уровень на ступень ниже запрошенного");

  // Бюджет
  const ratio = perPersonBudget > 0 ? cost / perPersonBudget : 1;
  const budget = Math.round(ratio <= 1 ? 100 : Math.max(0, 100 - (ratio - 1) * 250));
  if (perPersonBudget > 0) {
    if (ratio <= 1) reasons.push(ratio < 0.8 ? `Дешевле бюджета роли на ${Math.round((1 - ratio) * 100)}%` : "Ставка в бюджете роли");
    else reasons.push(`Выше бюджета роли на ${Math.round((ratio - 1) * 100)}%`);
  }

  // Надёжность: доля ответов + оценки; у новичка нейтральные 60, чтобы не загонять его вниз навсегда
  let reliability: number;
  if (s.platformProjects === 0 || !s.rating) {
    reliability = 60;
    reasons.push("Новичок на платформе: оценок пока нет");
  } else {
    const avg = (s.rating.quality + s.rating.deadlines + s.rating.communication) / 3;
    reliability = Math.round(s.responseRate * 50 + (avg / 5) * 50 - (s.medianResponseH > 12 ? 10 : 0));
  }

  // Занятость: свежесть календаря и загрузка в окне постпродакшна
  const share = busyShare(s, brief, slot.roleId);
  let availability = Math.round(100 - share * 80);
  if (s.calendarUpdatedDaysAgo > 30) {
    availability = Math.min(availability, 60);
    reasons.push("Календарь давно не обновлялся — занятость лучше уточнить");
  }

  // Рабочий стиль: 4 вопроса по 25
  const a = brief.workStyle;
  const b = s.workStyle;
  let workStyle = 0;
  const rd = Math.abs(revIdx(a.revisions) - revIdx(b.revisions));
  workStyle += rd === 0 ? 25 : rd === 1 ? 12 : 0;
  const idf = Math.abs(invOrder.indexOf(a.involvement) - invOrder.indexOf(b.involvement));
  workStyle += idf === 0 ? 25 : idf === 1 ? 12 : 0;
  workStyle += a.channel === b.channel ? 25 : 10;
  workStyle += a.pace === b.pace ? 25 : 10;
  if (rd > 0) {
    const name = (id: string) => revisionsOptions.find((x) => x.id === id)!.name;
    reasons.push(`Обычно закладывает ${name(b.revisions)} круг(а) правок, вы указали ${name(a.revisions)} — обсудите заранее`);
  }

  const breakdown: ScoreBreakdown = { portfolio, role, budget, reliability, availability, workStyle };
  const score = Math.round(
    (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).reduce((sum, k) => sum + breakdown[k] * WEIGHTS[k], 0),
  );
  return { specialist: s, slotKey: slot.key, cost, score, breakdown, reasons, relaxed };
}

// ---------- Шаг 3. Подбор по слоту с ослаблением ----------

export function matchSlots(brief: Brief, pool: Specialist[]): SlotResult[] {
  const budgets = slotBudgets(brief);
  return brief.slots.map((slot) => {
    const min = slot.levelMin === "any" ? 0 : levelIndex(slot.levelMin);
    const { perPerson, estimated } = budgets[slot.key];
    const strict = pool.filter((s) => passesHard(s, slot, brief, min));
    let list = strict.map((s) => scoreCandidate(s, slot, brief, perPerson, min, false));
    let relaxedLevel = false;
    const need = Math.max(3, slot.qty + 1);
    if (strict.length < need && min > 0) {
      const extra = pool.filter((s) => !strict.includes(s) && passesHard(s, slot, brief, min - 1));
      if (extra.length > 0) {
        relaxedLevel = true;
        list = list.concat(extra.map((s) => scoreCandidate(s, slot, brief, perPerson, min, true)));
      }
    }
    list.sort((x, y) => y.score - x.score);
    const manual = list.length < Math.max(2, slot.qty);
    return { slot, slotBudget: perPerson * slot.qty, budgetEstimated: estimated, candidates: list, manual, relaxedLevel };
  });
}

// ---------- Сборка трёх конфигураций ----------

function pick(result: SlotResult, tier: Tier, used: Set<string>): Candidate[] {
  if (result.manual) return [];
  const per = result.slotBudget / result.slot.qty;
  const free = result.candidates.filter((c) => !used.has(c.specialist.id));
  let ordered: Candidate[];
  if (tier === "economy") {
    const ok = free.filter((c) => c.score >= 55);
    ordered = [...(ok.length ? ok : free)].sort((a, b) => a.cost - b.cost || b.score - a.score);
  } else if (tier === "premium") {
    // Премиум: самый опытный уровень и лучшие оценки в пределах +40% к бюджету роли
    const ok = free.filter((c) => per <= 0 || c.cost <= per * 1.4);
    const rating = (c: Candidate) => {
      const r = c.specialist.rating;
      return r ? (r.quality + r.deadlines + r.communication) / 3 : 0;
    };
    ordered = [...(ok.length ? ok : free)].sort(
      (a, b) => levelIndex(b.specialist.level) - levelIndex(a.specialist.level) || rating(b) - rating(a) || b.score - a.score,
    );
  } else {
    const inBudget = (c: Candidate) => per <= 0 || c.cost <= per * 1.1;
    ordered = [...free].sort((a, b) => Number(inBudget(b)) - Number(inBudget(a)) || b.score - a.score);
  }
  const chosen = ordered.slice(0, result.slot.qty);
  chosen.forEach((c) => used.add(c.specialist.id));
  return chosen;
}

export function evaluateConfiguration(tier: Tier, members: Record<string, Candidate[]>, results: SlotResult[], brief: Brief): Configuration {
  const all = Object.values(members).flat();
  const totalCost = all.reduce((s, c) => s + c.cost, 0);
  const flags: Flag[] = [];

  // Пары, уже работавшие вместе (collaboration_edges)
  const pairs: string[] = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i].specialist;
      const b = all[j].specialist;
      if (a.workedWith.includes(b.id) || b.workedWith.includes(a.id)) pairs.push(`${a.name} и ${b.name}`);
    }
  if (pairs.length) flags.push({ tone: "good", text: `${pairs.join("; ")} уже работали вместе` });
  else if (all.length > 1) flags.push({ tone: "info", text: "Участники раньше не работали вместе" });

  for (const r of results) {
    const per = r.slotBudget / r.slot.qty;
    for (const c of members[r.slot.key] ?? []) {
      if (per > 0 && c.cost > per * 1.05)
        flags.push({ tone: "warn", text: `${c.specialist.name} (${roleName(r.slot.roleId).toLowerCase()}) выше бюджета роли на ${Math.round((c.cost / per - 1) * 100)}%` });
      if (c.breakdown.workStyle < 70)
        flags.push({ tone: "warn", text: `${c.specialist.name}: рабочий стиль заметно отличается от брифа — обсудите правки и темп` });
      if (c.relaxed) flags.push({ tone: "warn", text: `${c.specialist.name}: уровень ниже запрошенного для роли` });
    }
  }
  const newbies = all.filter((c) => c.specialist.platformProjects === 0).length;
  if (newbies) flags.push({ tone: "info", text: `${newbies} ${newbies === 1 ? "новичок" : "новичка"} на платформе — портфолио проверено, отзывов ещё нет` });

  const limit = (brief.budgetMax ?? 0) * (1 + flexPct[brief.budgetFlex]);
  if (brief.budgetMax && totalCost > limit)
    flags.unshift({ tone: "warn", text: `Сумма выше вашего бюджета с учётом гибкости на ${fmtK(totalCost - limit)}` });

  const mean = all.length ? all.reduce((s, c) => s + c.score, 0) / all.length : 0;
  const teamScore = Math.min(100, Math.round(mean + Math.min(6, pairs.length * 3)));
  return { tier, members, totalCost, teamScore, flags };
}

export function buildConfigurations(results: SlotResult[], brief: Brief): Record<Tier, Configuration> {
  const tiers: Tier[] = ["economy", "optimum", "premium"];
  const out = {} as Record<Tier, Configuration>;
  for (const tier of tiers) {
    const used = new Set<string>();
    const members: Record<string, Candidate[]> = {};
    // Сначала обязательные роли, чтобы им достались лучшие люди
    const order = [...results].sort((a, b) => Number(b.slot.mustHave) - Number(a.slot.mustHave));
    for (const r of order) members[r.slot.key] = pick(r, tier, used);
    out[tier] = evaluateConfiguration(tier, members, results, brief);
  }
  return out;
}

export function recommendedTier(configs: Record<Tier, Configuration>, brief: Brief): Tier {
  const limit = (brief.budgetMax ?? Infinity) * (1 + flexPct[brief.budgetFlex]);
  if (configs.optimum.totalCost <= limit) return "optimum";
  if (configs.economy.totalCost <= limit) return "economy";
  return "optimum";
}

export const fmtRub = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
export const fmtK = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n / 1000) * 1000) + " ₽";
export { legalShort };

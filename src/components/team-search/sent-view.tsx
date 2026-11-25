"use client";

import { buttonClass } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ApiError, api } from "@/lib/api/client";
import type { InvitationView, ProjectDetail } from "@/lib/api/types";
import { roleName, shortDateRange } from "@/lib/team-search/dictionaries";
import { fmtRub } from "@/lib/team-search/matching";
import type { InvitationStatus } from "@/lib/team-search/types";
import { MascotState } from "@/components/ui/mascot";
import { Avatar, FlagNote } from "./controls";
import { tierName } from "./results-view";

const statusView: Record<InvitationStatus, { label: string; cls: string }> = {
  sent: { label: "Отправлено", cls: "bg-surface-2 text-muted" },
  viewed: { label: "Просмотрено", cls: "bg-accent-soft text-accent" },
  accepted: { label: "Принято", cls: "bg-ok-soft text-ok" },
  declined: { label: "Отказ", cls: "bg-danger-soft text-danger" },
  expired: { label: "Истекло", cls: "bg-warn-soft text-warn" },
  withdrawn: { label: "Отозвано", cls: "bg-surface-2 text-muted" },
  cancelled: { label: "Отменено", cls: "bg-danger-soft text-danger" },
};

const timeFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const isDev = process.env.NODE_ENV !== "production";

/** Статусы приглашений проекта. Всё приходит с сервера; после каждого действия — свежий ProjectDetail. */
export function SentView({ initial }: { initial: ProjectDetail }) {
  const [project, setProject] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { brief } = project;

  const run = async (fn: () => Promise<ProjectDetail | unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      setProject(res && typeof res === "object" && "invitations" in res ? (res as ProjectDetail) : await api.project(project.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  const live = (slotKey: string) => project.invitations.filter((i) => i.slotKey === slotKey && ["sent", "viewed", "accepted"].includes(i.status)).length;
  const bySlot = brief.slots.map((slot) => ({ slot, invs: project.invitations.filter((i) => i.slotKey === slot.key) }));
  const accepted = project.invitations.filter((i) => i.status === "accepted");
  const open = project.invitations.filter((i) => i.status === "sent" || i.status === "viewed");
  const filledAll = bySlot.every(({ slot, invs }) => project.manualSlots.includes(slot.key) || invs.filter((i) => i.status === "accepted").length >= slot.qty);
  const deadline = open[0] ? new Date(open[0].expiresAt) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted">Приглашения</p>
      <h1 className="mt-1 text-2xl font-semibold">{brief.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {project.tier && `${tierName[project.tier]} команда · `}съёмка {shortDateRange(brief.shootDates)}
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {project.status === "team_selected" ? (
          <MascotState
            pose="wink"
            title="Команда собрана"
            text="Даты заблокированы в календарях участников, контакты открыты. Проект — в «Моих проектах»."
          />
        ) : open.length > 0 ? (
          <FlagNote tone="info">
            Специалисты получили приглашения. Ждём ответы до {deadline ? timeFmt.format(deadline) : "—"}. Если кто-то откажется, пригласите замену.
          </FlagNote>
        ) : null}
        {project.manualSlots.map((key) => (
          <FlagNote key={key} tone="warn">
            {roleName(brief.slots.find((s) => s.key === key)?.roleId ?? "")}: подбираем вручную, варианты пришлём в течение суток.
          </FlagNote>
        ))}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <section className="mt-5 overflow-hidden rounded-3xl border-2 border-border bg-surface">
        {bySlot
          .filter(({ invs }) => invs.length > 0)
          .map(({ slot, invs }) => (
            <div key={slot.key} className="border-t border-border px-5 py-4 first:border-t-0">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{roleName(slot.roleId)}</div>
              <div className="flex flex-col gap-3">
                {invs.map((inv) => (
                  <Row key={inv.id} inv={inv} canReplace={live(slot.key) < slot.qty} busy={busy} onReplace={() => run(() => api.replaceInvitation(inv.id))} />
                ))}
              </div>
            </div>
          ))}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isDev && open.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => api.simulateResponses(project.id))}
            className="h-10 rounded-2xl border-2 border-dashed border-border px-4 text-sm text-muted hover:bg-surface-2"
          >
            Демо: ответы за специалистов
          </button>
        )}
        {filledAll && project.status === "matching" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => api.confirmTeam(project.id))}
            className={buttonClass("primary", "md")}
          >
            Зафиксировать команду
          </button>
        )}
        <Link href="/projects" className={buttonClass("secondary", "md")}>
          Мои проекты
        </Link>
        <span className="text-sm text-muted">
          Приняли {accepted.length} из {brief.slots.reduce((s, x) => s + x.qty, 0)}
        </span>
      </div>
      <p className="mt-4 text-xs text-muted">
        У специалиста может быть не больше трёх открытых приглашений одновременно. Договоры и оплата появятся в следующих версиях.
      </p>
    </div>
  );
}

function Row({ inv, canReplace, busy, onReplace }: { inv: InvitationView; canReplace: boolean; busy: boolean; onReplace: () => void }) {
  const st = statusView[inv.status];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar name={inv.specialistName} src={inv.specialistAvatarUrl} tone={inv.status === "accepted" ? "ok" : "accent"} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{inv.specialistName}</div>
        <div className="text-xs text-muted">
          {fmtRub(inv.cost)}
          {inv.declineReason && ` · ${inv.declineReason.toLowerCase()}`}
          {inv.phone && (
            <>
              {" · "}
              <a href={`tel:${inv.phone}`} className="text-accent">
                {inv.phone}
              </a>
            </>
          )}
        </div>
      </div>
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", st.cls)}>{st.label}</span>
      {["declined", "expired", "cancelled"].includes(inv.status) && canReplace && (
        <button type="button" disabled={busy} onClick={onReplace} className={buttonClass("secondary", "sm")}>
          Пригласить замену
        </button>
      )}
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- картинки уже сжаты сервером, оптимизатор не нужен */
import Link from "next/link";
import { useState } from "react";
import { FilterTabs, ReasonAction, Skeleton, errText, fmtDateTime, useLoad, useUrlParams } from "@/components/admin/admin-ui";
import { StaffOnly } from "@/components/admin/staff-context";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { api } from "@/lib/api/client";

function AvatarsPage() {
  const [p, setP, ready] = useUrlParams({ show: "pending" });
  const { data, error, reload } = useLoad(() => api.admin.avatars(p.show === "all"), [p.show], ready);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const approve = async (userId: string) => {
    setBusy(userId);
    setErr("");
    try {
      await api.admin.approveAvatar(userId);
      reload();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader
        title="Аватары"
        description="Своё фото публикуется сразу, без проверки. Здесь его смотрит модератор: «Оставить» — фото в порядке, «Убрать» — фото удаляется навсегда, вместо него — инициалы."
      />
      <div className="mb-5">
        <FilterTabs
          label="Какие фото"
          value={p.show}
          options={[
            { id: "pending", label: "Не проверены" },
            { id: "all", label: "Все свои фото" },
          ]}
          onChange={(show) => setP({ show })}
        />
      </div>
      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <Skeleton />}
      {data &&
        (data.avatars.length === 0 ? (
          <Card className="text-sm text-muted">{p.show === "all" ? "Своих фото пока никто не загружал." : "Всё проверено."}</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.avatars.map((a) => (
              <Card key={a.userId} className="flex flex-col gap-3 p-4">
                <img src={a.url} alt={`Аватар: ${a.name}`} width={512} height={512} className="aspect-square w-full rounded-2xl bg-surface-2 object-cover" />
                <div>
                  <Link href={`/admin/users/${a.userId}`} className="font-semibold hover:underline">
                    {a.name}
                  </Link>
                  <p className="text-xs text-muted">Загружено {fmtDateTime(a.uploadedAt)}</p>
                </div>
                {a.decision === "approve" ? (
                  <Badge tone="ok">Проверено</Badge>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={busy === a.userId} onClick={() => approve(a.userId)}>
                      Оставить
                    </Button>
                  </div>
                )}
                <ReasonAction
                  label="Убрать фото"
                  placeholder="Причина: чужое лицо, логотип, неприличное…"
                  onConfirm={async (reason) => {
                    await api.admin.resetAvatar(a.userId, reason);
                    reload();
                  }}
                />
              </Card>
            ))}
          </div>
        ))}
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <AvatarsPage />
    </StaffOnly>
  );
}

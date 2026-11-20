"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { ResultsView } from "@/components/team-search/results-view";
import { ApiError, api } from "@/lib/api/client";
import type { MatchingResponse } from "@/lib/api/types";
import { useHydrated, useTeamStore } from "@/lib/team-search/store";

/** Поиск команды, шаг 2: сервер подбирает три состава по сохранённому брифу. */
export default function TeamSearchResultsPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { projectId } = useTeamStore();
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{ id: string; res: MatchingResponse } | { id: string; error: string } | null>(null);

  useEffect(() => {
    if (!hydrated || !projectId) return;
    let alive = true;
    api
      .matching(projectId)
      .then((res) => alive && setData({ id: projectId, res }))
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === "invited") router.replace("/team-search/sent");
        else setData({ id: projectId, error: e instanceof ApiError ? e.message : "Не получилось подобрать команду" });
      });
    return () => {
      alive = false;
    };
  }, [hydrated, projectId, router, reload]);

  if (hydrated && !projectId)
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <h1 className="text-2xl font-semibold">Сначала заполните бриф</h1>
        <p className="text-muted">Подборка строится по брифу: формату, датам, бюджету и составу ролей.</p>
        <LinkButton href="/team-search">К брифу</LinkButton>
      </div>
    );
  if (!data || data.id !== projectId)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Подбираем команду…</p>
        <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />
      </div>
    );
  if ("error" in data)
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <h1 className="text-2xl font-semibold">Подбор не получился</h1>
        <p className="text-danger">{data.error}</p>
        <LinkButton href="/team-search">Вернуться к брифу</LinkButton>
      </div>
    );
  return (
    <ResultsView
      key={reload}
      data={data.res}
      onReload={() => {
        setData(null);
        setReload((n) => n + 1);
      }}
    />
  );
}

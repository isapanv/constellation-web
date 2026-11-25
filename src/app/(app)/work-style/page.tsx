"use client";

import { useEffect, useState } from "react";
import { WorkStyleForm } from "@/components/profile/work-style-form";
import { ApiError, api } from "@/lib/api/client";
import type { MyWorkStyle } from "@/lib/api/types";

/** Мой стиль работы — данные с сервера (/api/me/work-style). */
export default function WorkStylePage() {
  const [data, setData] = useState<MyWorkStyle | { error: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .myWorkStyle()
      .then((r) => alive && setData(r.workStyle))
      .catch((e) => alive && setData({ error: e instanceof ApiError ? e.message : "Не получилось загрузить" }));
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <div className="h-96 max-w-3xl animate-pulse rounded-3xl bg-surface-2" />;
  if ("error" in data) return <p className="text-danger">{data.error}</p>;
  return <WorkStyleForm initial={data} />;
}

"use client";

import { useEffect, useState } from "react";
import { ProfileForm } from "@/components/profile/profile-form";
import { ApiError, api } from "@/lib/api/client";
import type { MyProfile } from "@/lib/api/types";

/** Мой профиль — данные с сервера (/api/me/profile). */
export default function ProfilePage() {
  const [data, setData] = useState<MyProfile | { error: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .myProfile()
      .then((r) => alive && setData(r.profile))
      .catch((e) => alive && setData({ error: e instanceof ApiError ? e.message : "Не получилось загрузить профиль" }));
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <div className="h-96 max-w-3xl animate-pulse rounded-3xl bg-surface-2" />;
  if ("error" in data) return <p className="text-danger">{data.error}</p>;
  return <ProfileForm initial={data} />;
}

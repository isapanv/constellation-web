"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ApiError, api } from "@/lib/api/client";
import { setMe, useMe } from "@/lib/api/use-me";
import { getNextPath } from "@/lib/next-path";

/** Имя и режимы: profiles.display_name, client_mode / specialist_mode. Можно оба. */
export default function OnboardingPage() {
  const router = useRouter();
  const { me } = useMe();
  const [name, setName] = useState(me?.profile?.displayName ?? "");
  const [client, setClient] = useState(me?.profile?.clientMode ?? false);
  const [specialist, setSpecialist] = useState(me?.profile?.specialistMode ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const options = [
    { on: specialist, set: setSpecialist, title: "Я специалист", text: "Заполню профиль и портфолио, буду получать приглашения в проекты." },
    { on: client, set: setClient, title: "Я ищу команду", text: "Опишу проект и получу варианты состава команды." },
  ];

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.onboarding({ displayName: name.trim(), client, specialist });
      setMe(r.me);
      router.push(getNextPath(client && !specialist ? "/team-search" : "/profile"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось сохранить");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Как вы будете пользоваться Созвездием?" description="Можно выбрать оба варианта и поменять позже." />
      <Field label="Как вас зовут" hint="Имя и фамилия или творческий псевдоним — так вас увидят в проектах" className="mb-5 max-w-sm">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            onClick={() => o.set(!o.on)}
            aria-pressed={o.on}
            className={cn("rounded-2xl border-2 bg-surface p-5 text-left transition-colors", o.on ? "border-accent" : "border-border hover:border-muted")}
          >
            <span className="font-semibold">{o.title}</span>
            <p className="mt-1 text-sm text-muted">{o.text}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <Button className="mt-6" disabled={(!client && !specialist) || name.trim().length < 2 || busy} onClick={submit}>
        {busy ? "Сохраняем…" : "Продолжить"}
      </Button>
    </div>
  );
}

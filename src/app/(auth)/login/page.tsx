"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CodeStep, formatPhone, isPhoneComplete } from "@/components/auth/code-step";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api/client";
import { refreshMe } from "@/lib/api/use-me";
import { getNextPath, withNext } from "@/lib/next-path";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (step === "code") {
    return (
      <CodeStep
        phone={phone}
        purpose="login"
        devCode={devCode}
        onBack={() => setStep("phone")}
        onSuccess={async (res) => {
          await refreshMe();
          window.location.assign(res.needsOnboarding ? withNext("/onboarding") : getNextPath("/projects"));
        }}
      />
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api.sendOtp(phone, "login");
          setDevCode(r.devCode);
          setStep("code");
        } catch (err) {
          setError(err instanceof ApiError ? { message: err.message, code: err.code } : { message: "Не получилось отправить код" });
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Вход</h1>
      <Field label="Телефон" error={error?.message}>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 (900) 123-45-67"
          value={phone}
          onChange={(e) => setPhone(e.target.value ? formatPhone(e.target.value) : "")}
          autoFocus
        />
      </Field>
      {error?.code === "no_account" && (
        <Link href={withNext("/signup")} className="-mt-2 text-sm text-accent">
          Зарегистрироваться с этим номером →
        </Link>
      )}
      <Button type="submit" disabled={!isPhoneComplete(phone) || busy}>
        {busy ? "Отправляем…" : "Получить код"}
      </Button>
      <p className="text-center text-sm text-muted">
        Нет аккаунта?{" "}
        <Link href="/signup" className="text-accent">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CodeStep, formatPhone, isPhoneComplete } from "@/components/auth/code-step";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api/client";
import { refreshMe } from "@/lib/api/use-me";
import { withNext } from "@/lib/next-path";

/**
 * Регистрация. Согласия — отдельные чекбоксы, по умолчанию не отмечены.
 * Согласие на обработку ПДн — отдельный документ (требование с 01.09.2025).
 * Тексты документов и ссылки даёт юрист — сейчас стоят заглушки «#».
 */
export default function SignupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [pdn, setPdn] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [step, setStep] = useState<"form" | "code">("form");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = isPhoneComplete(phone) && adult && terms && pdn;

  if (step === "code") {
    return (
      <CodeStep
        phone={phone}
        purpose="signup"
        consents={{ adult, terms, pdn, marketing }}
        devCode={devCode}
        onBack={() => setStep("form")}
        onSuccess={async () => {
          await refreshMe();
          window.location.assign(withNext("/onboarding"));
        }}
      />
    );
  }

  const check = (checked: boolean, set: (v: boolean) => void, label: React.ReactNode) => (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
      <span>{label}</span>
    </label>
  );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
          const r = await api.sendOtp(phone, "signup");
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
      <h1 className="text-xl font-semibold">Регистрация</h1>
      <Field label="Телефон" hint="Пришлём код подтверждения" error={error?.message}>
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
      {error?.code === "already_registered" && (
        <Link href={withNext("/login")} className="-mt-2 text-sm text-accent">
          Войти с этим номером →
        </Link>
      )}
      <div className="flex flex-col gap-2.5">
        {check(adult, setAdult, "Мне исполнилось 18 лет")}
        {check(
          terms,
          setTerms,
          <>
            Принимаю{" "}
            <a href="#terms" className="text-accent underline">
              пользовательское соглашение
            </a>
          </>,
        )}
        {check(
          pdn,
          setPdn,
          <>
            Даю{" "}
            <a href="#consent" className="text-accent underline">
              согласие на обработку персональных данных
            </a>
          </>,
        )}
        {check(marketing, setMarketing, <span className="text-muted">Хочу получать новости и предложения (необязательно)</span>)}
      </div>
      <Button type="submit" disabled={!canSubmit || busy}>
        {busy ? "Отправляем…" : "Получить код"}
      </Button>
      <p className="text-center text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-accent">
          Войти
        </Link>
      </p>
    </form>
  );
}

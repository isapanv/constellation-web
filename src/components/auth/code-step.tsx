"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api/client";
import type { OtpPurpose, VerifyResponse } from "@/lib/api/types";

const RESEND_SECONDS = 60;

type Consents = { adult: boolean; terms: boolean; pdn: boolean; marketing: boolean };

/** Второй шаг входа и регистрации: ввод кода из SMS. Код проверяет сервер (/api/auth/verify). */
export function CodeStep({
  phone,
  purpose,
  consents,
  devCode,
  onBack,
  onSuccess,
}: {
  phone: string;
  purpose: OtpPurpose;
  consents?: Consents;
  /** Только в режиме разработки: код, который «пришёл» по SMS */
  devCode?: string;
  onBack: () => void;
  onSuccess: (res: VerifyResponse) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [hintCode, setHintCode] = useState(devCode);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      onSuccess(await api.verify({ phone, code, purpose, consents }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось проверить код");
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      const r = await api.sendOtp(phone, purpose);
      setLeft(r.resendIn);
      setHintCode(r.devCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось отправить код");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Код из SMS</h1>
        <p className="mt-1 text-sm text-muted">Отправили на {phone}</p>
      </div>
      <Field label="Код" error={error} hint={hintCode ? `Режим разработки: код ${hintCode}` : undefined}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError("");
          }}
          autoFocus
        />
      </Field>
      <Button type="submit" disabled={code.length < 4 || busy}>
        {busy ? "Проверяем…" : "Подтвердить"}
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted hover:text-fg">
          ← Изменить номер
        </button>
        {left > 0 ? (
          <span className="text-muted">Повторно через {left} с</span>
        ) : (
          <button type="button" onClick={resend} className="text-accent">
            Отправить ещё раз
          </button>
        )}
      </div>
    </form>
  );
}

/** Маска российского номера: +7 (900) 123-45-67 */
export function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = "+7";
  if (p.length > 0) out += " (" + p.slice(0, 3);
  if (p.length >= 3) out += ")";
  if (p.length > 3) out += " " + p.slice(3, 6);
  if (p.length > 6) out += "-" + p.slice(6, 8);
  if (p.length > 8) out += "-" + p.slice(8, 10);
  return out;
}

export const isPhoneComplete = (formatted: string) => formatted.replace(/\D/g, "").length === 11;

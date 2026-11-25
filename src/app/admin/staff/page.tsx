"use client";

import Link from "next/link";
import { useState } from "react";
import { Skeleton, Table, Td, errText, fmtDateTime, useLoad } from "@/components/admin/admin-ui";
import { StaffOnly, useStaff } from "@/components/admin/staff-context";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { STAFF_ROLES, type StaffRole, staffRoleHint, staffRoleLabel } from "@/lib/admin";
import { api } from "@/lib/api/client";

function StaffPage() {
  const me = useStaff();
  const { data, setData, error } = useLoad(() => api.admin.staff(), []);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("matcher");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      setData(await api.admin.grantRole(phone, role));
      setPhone("");
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (userId: string, name: string) => {
    if (!window.confirm(`Отозвать роль у ${name}? Человек сразу потеряет доступ к админке.`)) return;
    setRowErr(null);
    try {
      setData(await api.admin.revokeRole(userId));
    } catch (x) {
      setRowErr({ id: userId, text: errText(x) });
    }
  };

  const active = data?.staff.filter((s) => !s.revokedAt) ?? [];
  const past = data?.staff.filter((s) => s.revokedAt) ?? [];

  return (
    <>
      <PageHeader title="Сотрудники" description="Кто работает в админке. Сотрудники видят телефоны и проекты пользователей — по 152-ФЗ их список должен совпадать с приказом о допуске к персональным данным." />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {error && <p className="text-danger">{error}</p>}
          {!data && !error && <Skeleton />}
          {data && (
            <Table head={["Сотрудник", "Роль", "Выдана", ""]}>
              {active.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <Link href={`/admin/users/${s.userId}`} className="font-semibold hover:underline">
                      {s.name ?? "Без профиля"}
                    </Link>
                    <p className="text-xs text-muted">{s.phoneMasked}</p>
                  </Td>
                  <Td>
                    <Badge tone="accent">{staffRoleLabel[s.role]}</Badge>
                  </Td>
                  <Td className="text-muted">
                    {fmtDateTime(s.grantedAt)}
                    <p className="text-xs">{s.grantedBy}</p>
                  </Td>
                  <Td className="text-right">
                    {s.userId === me.userId ? (
                      <span className="text-xs text-muted">это вы</span>
                    ) : (
                      <Button size="sm" variant="danger" onClick={() => revoke(s.userId, s.name ?? "сотрудника")}>
                        Отозвать
                      </Button>
                    )}
                    {rowErr?.id === s.userId && <p className="mt-1 text-xs text-danger">{rowErr.text}</p>}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          {past.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Прошлые роли ({past.length})</summary>
              <ul className="mt-2 flex flex-col gap-1 text-muted">
                {past.map((s) => (
                  <li key={s.id}>
                    {s.name ?? "Без профиля"} — {staffRoleLabel[s.role]}, {fmtDateTime(s.grantedAt)} → {fmtDateTime(s.revokedAt)}
                    {s.revokedBy ? `, отозвал ${s.revokedBy}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <Card>
          <form onSubmit={grant} className="flex flex-col gap-4">
            <h2 className="font-semibold">Выдать или поменять роль</h2>
            <p className="text-sm text-muted">Человек должен сначала зарегистрироваться на сайте по своему номеру.</p>
            <Field label="Телефон">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 123-45-67" inputMode="tel" required />
            </Field>
            <Field label="Роль" hint={staffRoleHint[role]}>
              <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {staffRoleLabel[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {err && <p className="text-sm text-danger">{err}</p>}
            <Button type="submit" disabled={busy || phone.trim().length < 10}>
              {busy ? "Сохраняю…" : "Выдать роль"}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <StaffOnly>
      <StaffPage />
    </StaffOnly>
  );
}

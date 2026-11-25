"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, TagPicker, Textarea } from "@/components/ui/field";
import { useToday } from "@/lib/use-today";
import { formats, roles, styleTags } from "@/mocks/data";

const MAX_FILE_MB = 500;

export default function NewPortfolioItemPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [formatId, setFormatId] = useState(formats[0].id);
  const today = useToday();
  // Пока пользователь не ввёл год, подставляем текущий (известен только в браузере)
  const [yearInput, setYear] = useState<number | null>(null);
  const year = yearInput ?? today?.getFullYear() ?? "";
  const [roleId, setRoleId] = useState(roles[1].id);
  const [roleNote, setRoleNote] = useState("");
  const [client, setClient] = useState("");
  const [clientHidden, setClientHidden] = useState(false);
  const [tags, setTags] = useState<number[]>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    setFileError(tooBig ? `«${tooBig.name}» больше ${MAX_FILE_MB} МБ. Для длинных видео дайте ссылку.` : "");
    setFiles((prev) => [...prev, ...arr.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)]);
  };

  const canSubmit = title.trim().length > 0 && (files.length > 0 || url.trim().length > 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // TODO(API): POST /me/portfolio, затем загрузка файлов (способ согласовать с backend)
        router.push("/portfolio");
      }}
      className="flex max-w-3xl flex-col gap-5"
    >
      <PageHeader title="Новая работа" description="Нужно название и хотя бы файл или ссылка." />

      <Card>
        <SectionTitle title="Основное" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название" className="sm:col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, «Северный ветер»" />
          </Field>
          <Field label="Формат">
            <Select value={formatId} onChange={(e) => setFormatId(Number(e.target.value))}>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Год">
            <Input type="number" min={1990} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </Field>
          <Field label="Моя роль">
            <Select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Что делал(а) конкретно" hint="Необязательно">
            <Input value={roleNote} onChange={(e) => setRoleNote(e.target.value)} placeholder="Свет и камера, без цветокора" />
          </Field>
          <Field label="Заказчик" hint="Необязательно">
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label="Не показывать заказчика (NDA)" checked={clientHidden} onChange={(e) => setClientHidden(e.target.checked)} />
          </div>
          <Field label="Описание" className="sm:col-span-2">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Стилистика" description="До 5 тегов. Позже теги будет предлагать ИИ, а вы — подтверждать." />
        <TagPicker options={styleTags} selected={tags} onChange={setTags} max={5} />
      </Card>

      <Card>
        <SectionTitle title="Медиа" />
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border p-8 text-center hover:bg-surface-2">
            <span className="font-medium">Выберите файлы</span>
            <span className="text-sm text-muted">Фото или видео до {MAX_FILE_MB} МБ</span>
            <input type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {fileError && <p className="text-sm text-danger">{fileError}</p>}
          {files.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {files.map((f, i) => (
                <li key={f.name + i} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="text-danger" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    Убрать
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Или ссылка" hint="VK Видео, RUTUBE, Vimeo, YouTube, Behance">
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={!canSubmit}>
          Отправить на проверку
        </Button>
        <LinkButton href="/portfolio" variant="ghost">
          Отмена
        </LinkButton>
      </div>
    </form>
  );
}

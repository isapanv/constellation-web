"use client";

import { LinkButton } from "@/components/ui/button";
import { useMe } from "@/lib/api/use-me";

/**
 * Кнопка на публичном профиле. Три случая:
 * гость — регистрация с возвратом на этот профиль; владелец — редактирование;
 * вошедший заказчик — к подбору команды.
 * TODO: выбор своего проекта и роли, куда пригласить (нужен API приглашения конкретного человека).
 */
export function InviteButton({ slug }: { slug: string }) {
  const { loading, me } = useMe();
  if (loading) return <div className="h-10 w-48" aria-hidden />;
  if (!me) return <LinkButton href={`/signup?next=${encodeURIComponent(`/u/${slug}`)}`}>Пригласить в проект</LinkButton>;
  if (me.profile?.slug === slug)
    return (
      <LinkButton href="/profile" variant="secondary">
        Это ваш профиль · Редактировать
      </LinkButton>
    );
  return <LinkButton href="/team-search">Пригласить в проект</LinkButton>;
}

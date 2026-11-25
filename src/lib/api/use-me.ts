"use client";

/**
 * Кто вошёл — один запрос /api/me на всё приложение, общий для шапки, меню и страниц.
 * После входа, выхода и онбординга вызывайте refreshMe().
 */
import { useSyncExternalStore } from "react";
import { api } from "./client";
import type { Me } from "./types";

type State = { loading: boolean; me: Me | null };

let state: State = { loading: true, me: null };
let started = false;
const listeners = new Set<() => void>();
const SERVER: State = { loading: true, me: null };

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshMe(): Promise<Me | null> {
  try {
    const { me } = await api.me();
    set({ loading: false, me });
    return me;
  } catch {
    set({ loading: false, me: null });
    return null;
  }
}

export function setMe(me: Me | null) {
  set({ loading: false, me });
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!started) {
    started = true;
    void refreshMe();
  }
  return () => listeners.delete(l);
}

/** { loading: true } — ещё не знаем; дальше me = данные или null (гость). */
export function useMe(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  );
}

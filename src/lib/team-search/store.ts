"use client";

/**
 * Локальное состояние «Поиска команды»: черновик, который печатается прямо сейчас,
 * и id проекта на сервере, с которым работаем. Сами проекты и приглашения живут в API.
 * Черновик держим в браузере, чтобы не слать запрос на каждый символ и не терять ввод при перезагрузке.
 */

import { useSyncExternalStore } from "react";
import type { Brief } from "./types";

type State = {
  draft: Brief | null;
  /** Проект на сервере, который сейчас редактируется в брифе (null — новый) */
  projectId: string | null;
};

const KEY = "sozvezdie.team-search.v2";
const initial: State = { draft: null, projectId: null };

let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
    window.localStorage.removeItem("sozvezdie.team-search.v1"); // старая версия хранилища до API
  } catch {
    // повреждённые данные или запрет на хранилище — начинаем с пустого состояния
  }
}

function set(patch: Partial<State>) {
  load();
  state = { ...state, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // хранилище недоступно — состояние живёт до перезагрузки
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTeamStore(): State {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => initial,
  );
}

/** true после гидрации — чтобы не мигать пустым состоянием на сервере. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export const teamActions = {
  saveDraft(draft: Brief) {
    set({ draft });
  },
  /** Открыть существующий проект: бриф придёт с сервера */
  openProject(projectId: string) {
    set({ projectId, draft: null });
  },
  /** Новый бриф с нуля */
  reset() {
    set({ projectId: null, draft: null });
  },
  setProjectId(projectId: string) {
    set({ projectId });
  },
};

"use client";

import { useSyncExternalStore } from "react";

/**
 * Текущая дата, известная только в браузере.
 * При сборке страницы (prerender) возвращает null — Next.js не разрешает
 * «замораживать» new Date() в статическом HTML.
 */
let cached: Date | null = null;
const getNow = () => (cached ??= new Date());
const subscribe = () => () => {};

export function useToday(): Date | null {
  return useSyncExternalStore(subscribe, getNow, () => null);
}

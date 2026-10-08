"use client";

import { useMemo, useSyncExternalStore } from "react";

/** Solo nombre y usuario. La contraseña nunca se guarda. */
export type SavedUser = {
  name: string;
  usuario: string;
};

const STORAGE_KEY = "lromero.saved-users.v1";
const MAX_SAVED = 4;
const EMPTY = "[]";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeUsers(users: SavedUser[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Almacenamiento bloqueado o lleno: el login sigue funcionando sin recordar.
  }
  notify();
}

function parse(raw: string): SavedUser[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (item): item is SavedUser =>
          typeof item?.name === "string" && typeof item?.usuario === "string",
      )
      .map(({ name, usuario }) => ({ name, usuario }));
  } catch {
    return [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveUser(user: SavedUser) {
  const usuario = user.usuario.toLowerCase();
  const others = parse(readRaw()).filter((u) => u.usuario.toLowerCase() !== usuario);
  writeUsers([{ name: user.name, usuario }, ...others].slice(0, MAX_SAVED));
}

export function removeSavedUser(usuario: string) {
  const target = usuario.toLowerCase();
  writeUsers(parse(readRaw()).filter((u) => u.usuario.toLowerCase() !== target));
}

export function useSavedUsers(): SavedUser[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY);
  return useMemo(() => parse(raw), [raw]);
}

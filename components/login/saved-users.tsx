"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { SavedUser } from "@/lib/saved-users";

type SavedUsersProps = {
  users: SavedUser[];
  onSelect: (user: SavedUser) => void;
  onRemove: (usuario: string) => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || name.slice(0, 2)).toUpperCase();
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function SavedUsers({ users, onSelect, onRemove }: SavedUsersProps) {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <AnimatePresence initial={false}>
      {users.length > 0 ? (
        <motion.section
          key="saved-users"
          aria-labelledby="saved-users-title"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <h2 id="saved-users-title" className="type-label pb-2 text-ice-100 desk:pb-1.5">
            Usuarios guardados
          </h2>

          <ul
            role="list"
            className="thin-scroll -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {users.map((user) => {
                const isConfirming = confirming === user.usuario;
                return (
                  <motion.li
                    key={user.usuario}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className="w-63 max-desk:w-[min(100%,calc(var(--u)*75))] shrink-0 snap-start"
                  >
                    {isConfirming ? (
                      <div
                        role="group"
                        aria-label={`Confirmar quitar a ${user.name}`}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setConfirming(null);
                        }}
                        className="flex h-14.5 desk:h-13 items-center justify-between gap-2 rounded-[14px] bg-white/10 px-3 ring-1 ring-white/30"
                      >
                        <p className="min-w-0 truncate text-(length:--login-label) font-medium text-white">
                          ¿Quitar a {firstName(user.name)}?
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            autoFocus
                            onClick={() => setConfirming(null)}
                            className="rounded-lg px-2 py-1.5 pointer-coarse:min-h-11 pointer-coarse:px-3 type-meta font-semibold text-ice-100 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-white"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirming(null);
                              onRemove(user.usuario);
                            }}
                            className="rounded-lg bg-white px-2.5 py-1.5 pointer-coarse:min-h-11 pointer-coarse:px-4 type-meta font-semibold text-navy-900 transition-[transform,scale,background-color] duration-150 hover:bg-ice-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative rounded-[14px] bg-white/10 ring-1 ring-white/20 transition-[background-color,box-shadow] duration-200 [@media(hover:hover)]:hover:bg-white/[0.16] [@media(hover:hover)]:hover:ring-white/35">
                        <button
                          type="button"
                          onClick={() => onSelect(user)}
                          aria-label={`Ingresar como ${user.name}, usuario ${user.usuario}`}
                          className="flex h-14.5 desk:h-13 w-full min-w-0 items-center gap-3 rounded-[14px] pl-2.5 pr-11 pointer-coarse:pr-14 text-left transition-transform duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          <span
                            aria-hidden
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-white font-display text-(length:--login-label) font-bold text-brand-600"
                          >
                            {initials(user.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-(length:--login-label) font-semibold leading-tight tracking-[0.005em] text-white">
                              {user.name}
                            </span>
                            <span className="type-meta block truncate text-ice-100">
                              {user.usuario}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(user.usuario)}
                          aria-label={`Quitar a ${user.name} de usuarios guardados`}
                          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full pointer-coarse:size-11 pointer-coarse:right-0.5 text-ice-100 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                        >
                          <X aria-hidden className="size-4" strokeWidth={2.25} />
                        </button>
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

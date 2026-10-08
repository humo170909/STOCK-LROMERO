"use client";

import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import { LoginForm } from "./login-form";
import { EASE_OUT_EXPO, itemVariants, panelVariants } from "./motion";

/**
 * Foto estática: solo aparece con un fade al cargar. Sin parallax ni reacción al mouse.
 * Solo en escritorio (desk:). Es el LCP de la pantalla, por eso carga eager (la foto pesa ~220 KB).
 */
function HeroImage() {
  return (
    <motion.div
      className="relative hidden min-w-0 self-stretch overflow-hidden bg-navy-900 desk:block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Espaciador: mantiene la altura de la tarjeta (la de una foto 1550/1014 al 70% del ancho) sin ensanchar la celda. */}
      <div aria-hidden className="pb-[71.5%]" />
      <Image
        src="/imagen-login.jpg"
        alt="Colaborador de Grupo LRomero con un tablero de inventario en un almacén"
        fill
        loading="eager"
        sizes="(min-width: 1500px) 960px, 64vw"
        className="object-cover saturate-[0.6] brightness-95"
        style={{ objectPosition: "0% 50%" }}
      />
      {/* Velo neutro: baja la intensidad de los colores de la foto. */}
      <div aria-hidden className="absolute inset-0 bg-black/25" />
    </motion.div>
  );
}

export function LoginScreen() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="page-bg login-scope min-h-dvh">
        <main className="grid min-h-dvh place-items-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] max-sm:pl-[max(1.25rem,env(safe-area-inset-left))] max-sm:pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-[clamp(1.5rem,4vw,2.5rem)] desk:px-10">
          <motion.section
            aria-label="Acceso a Grupo LRomero Importaciones"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            className="grid w-full max-w-(--login-card-max) grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[28px] bg-navy-900 shadow-[0_0_0_1px_rgb(20_70_160/0.08),0_40px_80px_-28px_rgb(20_70_160/0.38),0_14px_28px_-14px_rgb(20_70_160/0.28)] desk:max-w-[1500px] desk:grid-cols-[minmax(0,64fr)_minmax(360px,36fr)]"
          >
            <HeroImage />

            <div className="brand-panel relative isolate flex items-center justify-center">
              <div
                aria-hidden
                className="brand-grain pointer-events-none absolute inset-0 -z-10"
              />
              {/* Borde interior translúcido y línea de luz en el corte con la imagen. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.10)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-linear-to-b from-transparent via-white/25 to-transparent desk:block"
              />

              <motion.div
                variants={panelVariants}
                initial="hidden"
                animate="show"
                className="flex w-full flex-col items-center px-(--login-pad-x) py-(--login-pad-y) desk:px-12 desk:py-8 2xl:px-14"
              >
                <motion.div
                  variants={itemVariants}
                  className="relative aspect-[220/65] w-(--login-logo-w) max-w-full shrink-0 overflow-hidden"
                >
                  {/* El PNG trae margen transparente: se recorta con el contenedor, sin deformar. */}
                  <Image
                    src="/logo.png"
                    alt="Grupo LRomero Importaciones"
                    width={239}
                    height={102}
                    priority
                    className="absolute left-[-5%] top-[-32.3%] h-auto w-[108.64%] max-w-none"
                  />
                </motion.div>

                <div className="mt-6 w-full max-w-[calc(var(--u)*95)]">
                  <LoginForm />
                </div>
              </motion.div>
            </div>
          </motion.section>
        </main>
      </div>
    </MotionConfig>
  );
}

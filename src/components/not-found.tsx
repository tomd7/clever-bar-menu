import { Link, useRouterState } from '@tanstack/react-router'

import { ActionButton } from '#/components/buttons/action-button'

import type { ReactNode } from 'react'

/**
 * The screen behind every 404 — a line struck off the bar's slate.
 *
 * The metaphor is the product's own. This application writes a bar's menu, and
 * the gesture a patron sees when something runs out is a chalk line drawn
 * through the row. A URL that leads nowhere is exactly that: an address that
 * was on the board and no longer is. So the page renders the requested path as
 * a menu line — name, leader, "price" — and strikes it out.
 *
 * Animating it is deliberate here and would be wrong almost anywhere else: a
 * 404 is seen once in a blue moon, and a screen seen that rarely is the one
 * that can afford a beat of delight. The writing gesture is the one
 * `skeleton.css` already performs (a left-to-right `clip-path` reveal), so the
 * two read as the same hand at work rather than as two unrelated effects.
 *
 * The board is `--board`, the chalkboard surface that does not flip with the
 * theme — this screen therefore looks the same to a manager correcting a price
 * at noon and to a customer scanning a stale QR code at midnight.
 */
export function NotFound({
  title = 'Cette page n’est pas à la carte.',
  children = 'L’adresse que vous avez suivie ne mène nulle part : un lien périmé, une faute de frappe, ou une page retirée depuis.',
  action = (
    <ActionButton asChild surface="page">
      <Link to="/">Retour à l’accueil</Link>
    </ActionButton>
  ),
}: {
  title?: string
  children?: ReactNode
  /** Way out of the dead end. `null` for a screen that has none to offer. */
  action?: ReactNode
}) {
  /*
    The address is read from the router rather than received as a prop: this
    component is mounted by a `notFoundComponent`, where the route's loader
    data is undefined by construction and the failing path is the one piece of
    information the screen actually has.
  */
  const path = useRouterState({ select: (state) => state.location.pathname })

  return (
    <main className="page-wrap flex min-h-dvh flex-col justify-center py-16">
      <div className="rise-in mx-auto w-full max-w-xl">
        {/*
          The board holds one row and nothing else.

          A « Ardoise du jour » label and a « 404 » sat above it at first, and
          both had to be worked out before the row underneath could be read —
          two lines of setup for a joke that lands in one. What the board is
          made of is the drawing's job, not a caption's.

          The row itself is two parts where a product row on the customer menu
          is three: the name, the dotted leader that carries the eye across,
          the price. Here the chalk stroke does the leader's job on its way
          through — drawing both put two near-parallel rules a few pixels
          apart, which reads as a double border rather than as a struck row.
        */}
        <div className="slate rounded-2xl px-5 py-8 sm:px-7 sm:py-9">
          <p className="chalk-line flex items-baseline justify-between gap-4 text-lg text-on-board sm:text-xl">
            <span className="min-w-0 truncate font-semibold">{path}</span>
            <span className="shrink-0 font-semibold">404</span>
          </p>
        </div>

        <h1 className="display-title mt-9 text-3xl leading-[1.1] text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
          {children}
        </p>

        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </main>
  )
}

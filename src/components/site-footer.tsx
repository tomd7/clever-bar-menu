import { env } from '#/env'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-wrap flex flex-col gap-1 py-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>{env.VITE_APP_TITLE}</p>
        <p>Projet en cours de développement.</p>
      </div>
    </footer>
  )
}

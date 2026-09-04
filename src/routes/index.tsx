import { createFileRoute } from '@tanstack/react-router'

import { HomeHero } from '#/components/home/home-hero'
import { HomeSteps } from '#/components/home/home-steps'
import { SiteFooter } from '#/components/site-footer'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="page-wrap flex-1 py-12 sm:py-20">
        <HomeHero />
        <HomeSteps />
      </main>

      <SiteFooter />
    </div>
  )
}

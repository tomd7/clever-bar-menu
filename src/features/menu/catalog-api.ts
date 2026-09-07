import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { tryNormalizeBarcode } from '#/features/menu/barcode'
import { lookupCatalog } from '#/features/menu/catalog.server'

import type { CatalogLookup } from '#/features/menu/catalog'

/**
 * The catalogue's query key stays here rather than in `lib/query-keys.ts`: one
 * feature reads it and one invalidates it, which is that file's own condition
 * for taking a key in.
 */
const DRINK_CATALOG_QUERY_KEY = ['drink-catalog'] as const

/**
 * The code must arrive **already canonical**.
 *
 * A `createServerFn` is an HTTP entry point — its URL ships in the bundle, and
 * anyone can call it with anything. Unchecked, that value would go into a URL
 * aimed at a third party (the shape of an SSRF) and into a Drizzle `eq()`. The
 * rule is not restated here, it is *called*: `barcode.ts` stays the only place
 * that decides what a valid code is, check digit included.
 */
const lookupInput = z.object({
  gtin: z
    .string()
    .refine(
      (value) => tryNormalizeBarcode(value) === value,
      'Code-barres invalide.',
    ),
})

/**
 * Looks a barcode up in the shared drink catalogue.
 *
 * `GET`, because it is a read and the payload is fourteen digits.
 *
 * The import of `catalog.server.ts` is static, which is the documented shape —
 * the plugin strips the handler's body, and everything only it reached, out of
 * the client bundle. That module reaches `client.server.ts` and therefore
 * `@tanstack/react-start/server-only`, so a stripping failure is loud rather
 * than silent: the page throws on load instead of quietly shipping Drizzle and
 * a connection string to the browser. `npm run build` is where that gets
 * checked, not a reading of this file.
 */
export const lookupDrink = createServerFn({ method: 'GET' })
  .validator(lookupInput)
  .handler(({ data }): Promise<CatalogLookup> => lookupCatalog(data.gtin))

/**
 * `staleTime: Infinity`, because this is the cache of a cache: within a scanning
 * session the answer cannot usefully change, and a refetch on window focus
 * would put a phone coming out of a pocket straight back on the network.
 *
 * `retry: false`, because the function does not throw for the expected cases —
 * it answers `unavailable`. An exception means *our* server is down, which the
 * scan screen already treats the same way. Retrying would only delay the panel.
 */
export function drinkQueryOptions(gtin: string) {
  return queryOptions({
    queryKey: [...DRINK_CATALOG_QUERY_KEY, gtin],
    queryFn: () => lookupDrink({ data: { gtin } }),
    staleTime: Infinity,
    retry: false,
  })
}

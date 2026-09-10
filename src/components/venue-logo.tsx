import { cn } from '#/lib/utils.ts'

/**
 * Class sets per placement. `bare` sizes the image alone; `plated` sizes it
 * inside the plate, whose padding brings the whole back to the `bare` height —
 * so turning the plate on never moves what sits below.
 */
const SIZES = {
  menu: {
    bare: 'h-14 max-w-48 sm:h-16 sm:max-w-56',
    plate: 'p-2',
    plated: 'h-10 max-w-44 sm:h-12 sm:max-w-52',
  },
  preview: {
    bare: 'h-8 max-w-32',
    plate: 'p-1',
    plated: 'h-6 max-w-30',
  },
} as const

/**
 * A venue's logo, the way the board carries it.
 *
 * Here rather than in a feature because two of them draw it — the customer menu
 * (`features/menu`) and the settings preview (`features/venues`) — and neither
 * may import the other. It takes a URL, not a storage path, for the same kind
 * of reason: the preview shows a file picked a second ago, which has no path
 * yet.
 *
 * **The height is fixed and the width is free.** The box's height is in the
 * SSR'd HTML, so nothing below moves when the image lands; only its own width
 * grows, and nothing sits beside it. `object-contain` under a `max-w-*` keeps a
 * long wordmark in proportion instead of letting it push the carte down.
 *
 * **`plate` lays it on a chalk plate.** The board is dark in every theme and at
 * every hour, and the commonest logo file is dark ink on a transparent
 * background: bare, it vanishes. The venue's row says which — the browser
 * guesses it from the file, the manager can flip it.
 *
 * `alt=""`: the venue's name is set in full right below, and naming the image
 * too would have a screen reader announce the bar twice — the same call the
 * carte makes for its product photos.
 */
export function VenueLogo({
  src,
  plate,
  size = 'menu',
  className,
}: {
  src: string
  plate: boolean
  size?: keyof typeof SIZES
  className?: string
}) {
  const sizes = SIZES[size]

  return (
    <span
      className={cn(
        'flex w-fit max-w-full',
        plate && ['rounded-xl bg-on-board', sizes.plate],
        className,
      )}
    >
      <img
        src={src}
        alt=""
        decoding="async"
        className={cn(
          'w-auto rounded-md object-contain',
          plate ? sizes.plated : sizes.bare,
        )}
      />
    </span>
  )
}

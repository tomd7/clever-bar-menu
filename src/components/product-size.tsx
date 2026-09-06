import { cn } from '#/lib/utils.ts'

/**
 * The serving format of a product, drawn next to its name.
 *
 * It lives here rather than in `features/menu` because a ticket names its
 * lines the way the menu does: the customer's cart, the counter's queue and the
 * order they are following all render it, and `features/orders` may not import
 * from `features/menu`. Same move as `formatPrice` before it.
 *
 * **A qualifier, not a badge.** « 50cl » is part of what the product *is*, so it
 * is set in the flow of the name — softer ink, a shade smaller — and never in a
 * pill. The bordered pill in the back office is `StockBadge`, and it means
 * something is wrong; a format that borrowed its shape would raise an alarm
 * about a bottle being a bottle. It also sits *inside* the name's line box on
 * purpose: on the customer menu the leader rule then starts after the format,
 * which is how a printed carte sets it — « Blonde 50cl ······ 5,50 € ».
 */
export function ProductSize({
  size,
  className,
}: {
  size: string | null
  className?: string
}) {
  if (!size) return null

  return (
    <span
      /*
        `em` and not `rem`: this span is rendered inside a 14px ticket line and
        inside a 16px menu row, and in both it must read one notch below the
        name it follows. A fixed `text-sm` would be exactly the name's size in
        the first case and would stop being a subordinate.

        `whitespace-nowrap` keeps « au fût » from breaking across two lines —
        the format is one word for the eye, whatever its spaces.
      */
      className={cn(
        'ml-1.5 text-[0.875em] font-normal whitespace-nowrap text-ink-soft',
        className,
      )}
    >
      {size}
    </span>
  )
}

/**
 * The product's name and format as one string, for the places that can hold no
 * markup — an `aria-label`, mostly.
 *
 * A screen reader announcing « Ajouter Blonde » on two adjacent buttons of a
 * menu that lists a 25cl and a 50cl gives no way to tell them apart, which is
 * precisely the ambiguity the format exists to remove.
 */
export function productLabel(name: string, size: string | null): string {
  return size ? `${name} ${size}` : name
}

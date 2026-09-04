import { useId } from 'react'

import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps, ReactNode } from 'react'

/**
 * Champ de saisie multiligne libellé.
 *
 * Pas de `surface` ici : une zone de texte se dimensionne par ses `rows` et
 * grandit avec son contenu, elle n'a pas de hauteur au repos à accorder avec
 * les boutons voisins.
 *
 * Comme `TextField`, `className` habille le bloc et `textareaClassName` la
 * saisie — sans cette distinction, un `mt-3` destiné au bloc se retrouverait
 * entre le libellé et son champ.
 */
export function TextAreaField({
  label,
  hint,
  className,
  textareaClassName,
  ...props
}: {
  label: ReactNode
  hint?: ReactNode
  className?: string
  textareaClassName?: string
} & Omit<ComponentProps<typeof Textarea>, 'id' | 'className'>) {
  const id = useId()

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} className={textareaClassName} {...props} />
      {hint ? <p className="mt-2 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}

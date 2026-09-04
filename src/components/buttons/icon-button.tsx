import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils.ts'

import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Bouton réduit à son icône : monter, descendre, modifier, supprimer.
 *
 * Deux règles du projet sont ici structurelles plutôt que recopiées à chaque
 * appel :
 *
 * - **44×44px sur mobile**, la cible tactile minimale, resserrée à 36px à
 *   partir de `lg` où le pointeur est précis. C'était `size-11 lg:size-9`
 *   retapé à cinq endroits, donc cinq occasions de diverger.
 * - **`label` est obligatoire.** Sans texte visible, un bouton n'existe pas
 *   pour un lecteur d'écran ; le rendre impossible à omettre vaut mieux que le
 *   rappeler en revue.
 *
 * Le retour au maintien (`scale(0.97)`, 150 ms) est appliqué ici alors que ces
 * boutons-là ne l'avaient pas : un élément pressable doit se voir répondre, et
 * l'exception n'était qu'un oubli.
 */
export function IconButton({
  icon: Icon,
  label,
  tone = 'default',
  className,
  ...props
}: {
  icon: LucideIcon
  label: string
  tone?: 'default' | 'destructive'
} & Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'aria-label'>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn(
        'size-11 transition-transform duration-150 ease-out active:scale-[0.97] lg:size-9',
        tone === 'destructive' &&
          'text-destructive hover:bg-destructive/10 hover:text-destructive',
        className,
      )}
      {...props}
    >
      <Icon className="size-4" />
    </Button>
  )
}

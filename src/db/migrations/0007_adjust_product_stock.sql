-- Décompte atomique du stock d'un produit.
--
-- Migration écrite à la main (drizzle-kit generate --custom) : drizzle-kit ne
-- décrit pas les fonctions Postgres, et src/db/schema.ts n'a donc rien à en
-- dire. Même raison qu'en 0004 pour les policies du Storage.
--
-- Pourquoi une fonction plutôt qu'un simple `update` depuis le navigateur :
-- PostgREST ne sait pas écrire `stock_quantity = stock_quantity - 1`. Le client
-- devrait donc lire la valeur puis écrire la suivante, et deux appareils
-- derrière le même bar — le téléphone du gérant et la tablette du comptoir —
-- perdraient un décompte sur deux. C'est le « lost update » du manuel, et sur
-- un inventaire il se voit. `update ... returning` fait les deux en une seule
-- instruction, donc sous un seul verrou de ligne.
--
-- C'est aussi le point d'accroche de la commande à table : quand une commande
-- sera validée, elle appellera cette fonction et rien d'autre.
--
-- `security invoker` (le défaut, écrit ici pour qu'on ne l'enlève pas par
-- inadvertance) : la fonction s'exécute avec les droits de l'appelant, donc
-- sous le RLS. Une fonction `security definer` court-circuiterait les policies
-- de `products` et laisserait n'importe quel compte décompter le stock d'un
-- établissement qui n'est pas le sien.
--
-- `set search_path = ''` ferme la porte au détournement de résolution de noms :
-- sans lui, un schéma placé en tête du `search_path` de l'appelant pourrait
-- fournir sa propre table `products`. Le prix est que tout doit être qualifié,
-- `public.products` compris.
create or replace function public.adjust_product_stock(
  product_id uuid,
  delta integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  remaining integer;
begin
  -- `greatest(..., 0)` plafonne par le bas dans l'instruction elle-même. La
  -- contrainte `products_stock_quantity_non_negative` reste le garde-fou, mais
  -- un double appui sur « −1 » d'un produit déjà épuisé ne doit pas remonter
  -- une erreur de contrainte à un gérant : il ne reste rien, c'est tout.
  update public.products as p
     set stock_quantity = greatest(p.stock_quantity + delta, 0)
   where p.id = product_id
     -- Un produit non suivi (`stock_quantity is null`) n'est pas décompté : lui
     -- inventer un niveau au premier appui activerait un suivi que personne n'a
     -- demandé.
     and p.stock_quantity is not null
  returning p.stock_quantity into remaining;

  if not found then
    -- Le message part tel quel dans l'interface : `describeError` laisse passer
    -- ce qu'il ne sait pas traduire, et une fonction du domaine est le seul
    -- endroit où un message PostgREST est déjà écrit pour un lecteur français.
    raise exception 'Ce produit n''a pas de suivi de stock.';
  end if;

  return remaining;
end;
$$;
--> statement-breakpoint

-- Postgres accorde `execute` à `public` sur toute nouvelle fonction : le
-- révoquer est donc le geste qui compte, la suite ne fait que rouvrir pour le
-- rôle attendu. Le RLS refuserait déjà l'écriture à `anon`, mais une fonction
-- exécutable par tout le monde est une surface qu'on ne laisse pas ouverte pour
-- la seule raison qu'elle est actuellement sans effet.
revoke execute on function public.adjust_product_stock(uuid, integer) from public;--> statement-breakpoint
grant execute on function public.adjust_product_stock(uuid, integer) to authenticated;--> statement-breakpoint

-- Supabase recharge normalement le cache de schéma de PostgREST tout seul, via
-- un event trigger sur les DDL. La notification explicite est l'assurance que
-- la fonction est appelable dans la seconde qui suit la migration, plutôt que
-- de renvoyer un « Could not find the function in the schema cache » que rien
-- dans le code ne permettrait de diagnostiquer.
notify pgrst, 'reload schema';

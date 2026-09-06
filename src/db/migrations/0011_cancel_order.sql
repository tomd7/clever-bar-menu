-- Le client annule sa propre commande, tant que le bar ne l'a pas prise.
--
-- Migration écrite à la main : drizzle-kit ne décrit pas les fonctions. Même
-- raison qu'en 0004, 0007 et 0009.
--
-- Troisième porte ouverte à `anon`, et construite comme les deux autres :
-- `security definer` parce que `orders` ne lui accorde aucune policy, couple
-- identifiant + jeton pour toute authentification, `set search_path = ''` et
-- noms de paramètres qu'aucune colonne ne porte.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Pourquoi seulement `received`
--
-- Une commande acceptée est en train d'être servie, et son stock a déjà été
-- décompté par `accept_order`. L'annulation ne recrédite rien — décision
-- assumée, parce qu'un produit à moitié versé ne revient pas en cave — et
-- laisser un client déclencher cela à distance creuserait dans l'inventaire un
-- écart que personne au comptoir n'aurait vu passer.
--
-- Avant l'acceptation, en revanche, rien n'a bougé : ni stock, ni verre. La
-- fenêtre d'annulation du client est donc exactement celle où elle est gratuite.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- La course avec le bar
--
-- Le comptoir peut appuyer sur « Accepter » à l'instant où le client appuie sur
-- « Annuler ». Les deux fonctions filtrent sur `status = 'received'` **dans le
-- `where`** : c'est le verrou de ligne qui arbitre, et exactement une des deux
-- gagne. Le perdant lève, avec un message déjà juste des deux côtés — « trop
-- tard » ici, « cette commande n'est plus en attente » dans `accept_order`.
create or replace function public.cancel_order(
  lookup_id uuid,
  lookup_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders o
     set status = 'cancelled',
         cancelled_by = 'guest',
         updated_at = now()
   where o.id = lookup_id
     and o.access_token = lookup_token
     and o.status = 'received';

  if not found then
    -- Un seul message pour trois cas — commande déjà prise en charge, jeton qui
    -- ne correspond pas, commande inexistante. Les distinguer dirait à qui
    -- essaie des identifiants au hasard lesquels valent la peine d'insister, et
    -- pour le client réel il n'y a de toute façon qu'une lecture possible.
    raise exception 'Trop tard : le bar a déjà pris cette commande en charge.';
  end if;
end;
$$;
--> statement-breakpoint

revoke execute on function public.cancel_order(uuid, uuid) from public;--> statement-breakpoint
grant execute on function public.cancel_order(uuid, uuid) to anon, authenticated;--> statement-breakpoint

notify pgrst, 'reload schema';

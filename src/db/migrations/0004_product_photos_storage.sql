-- Photos des produits : bucket Supabase Storage et ses règles d'accès.
--
-- Migration écrite à la main (drizzle-kit generate --custom) : elle touche le
-- schéma `storage`, qui appartient à Supabase et n'est pas décrit par
-- src/db/schema.ts. La laisser générer reviendrait à demander à drizzle-kit de
-- prendre en charge des tables qu'il ne connaît pas.
--
-- Le bucket est **public en lecture**. La carte est faite pour être ouverte au
-- QR code, sur données mobiles : une URL publique passe par le CDN et se met en
-- cache, là où une URL signée impose un aller-retour authentifié par image et
-- expire. Rien de confidentiel ne transite ici — ce sont les photos d'une carte
-- affichée en salle.
--
-- L'écriture, elle, reste réservée au propriétaire de l'établissement. Le
-- chemin d'un fichier commence par l'identifiant de l'établissement
-- (`<venue_id>/<product_id>/<aléa>.<ext>`), ce qui permet aux policies de
-- retrouver le propriétaire par jointure.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  -- 5 Mo : le client réduit déjà les images avant l'envoi, cette limite est un
  -- garde-fou serveur contre un appel direct à l'API qui contournerait le
  -- navigateur.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint

-- Postgres n'a pas de `create policy if not exists` : on retire d'abord, ce qui
-- rend la migration rejouable sans erreur.
drop policy if exists "product_photos_public_read" on storage.objects;--> statement-breakpoint
drop policy if exists "product_photos_owner_insert" on storage.objects;--> statement-breakpoint
drop policy if exists "product_photos_owner_update" on storage.objects;--> statement-breakpoint
drop policy if exists "product_photos_owner_delete" on storage.objects;--> statement-breakpoint

create policy "product_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-photos');--> statement-breakpoint

-- `storage.foldername(...)` découpe le chemin ; son premier élément est donc
-- l'identifiant de l'établissement. Le cast passe par `text` et non par `uuid` :
-- un dossier au nom non conforme ferait échouer la conversion et donc la
-- requête entière, au lieu de simplement ne correspondre à aucune ligne.
--
-- Deux précautions d'écriture, et la première n'est pas cosmétique :
--   * `storage.objects.name` est qualifié en entier. Écrit `name` tout court,
--     Postgres le résout d'abord dans la portée du sous-select, donc sur
--     `venues.name` — la policy comparerait alors le nom de l'établissement au
--     lieu du chemin du fichier, et refuserait silencieusement tout envoi.
--   * `venues` est aliasé en `v`, pour que l'ambiguïté ne puisse pas revenir.
create policy "product_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[1]
        and v.owner_id = (select auth.uid())
    )
  );--> statement-breakpoint

create policy "product_photos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[1]
        and v.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[1]
        and v.owner_id = (select auth.uid())
    )
  );--> statement-breakpoint

create policy "product_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-photos'
    and exists (
      select 1 from public.venues v
      where v.id::text = (storage.foldername(storage.objects.name))[1]
        and v.owner_id = (select auth.uid())
    )
  );

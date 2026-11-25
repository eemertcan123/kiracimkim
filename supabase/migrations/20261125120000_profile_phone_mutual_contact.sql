-- KiracımKim: karşılıklı telefon, yalnızca onaylı kiralamada.
-- Bu dosyayı Supabase SQL Editor'da (veya supabase db push ile) çalıştırın.
-- Uygulama bu migration'ı üretim veritabanına kendisi uygulamaz.
--
-- Migration öncesi: kayıt ve "kendi numaram" auth user_metadata üzerinden durur;
-- karşı tarafın telefonu görünmez.
-- Migration sonrası: profiles.phone ulusal biçimde saklanır (05XXXXXXXXX).
-- authenticated rolü bu sütunu doğrudan SELECT edemez.
-- profile_contact_phones() numarayı yalnızca çağıranın kendisine
-- ve status'u aktif/onaylı bir rentals kaydındaki karşı tarafa döndürür.
-- Davet henüz pending iken karşı tarafın numarası dönmez.
-- landlord_approved (teslim tutanağı) bu görünürlüğü açmaz; eşleşmenin
-- kabul edilmiş olması gerekir (status active/accepted/approved).

alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  drop constraint if exists profiles_phone_tr_mobile;

alter table public.profiles
  add constraint profiles_phone_tr_mobile
  check (phone is null or phone ~ '^05[0-9]{9}$');

comment on column public.profiles.phone is
  'Turkish mobile in national form 05XXXXXXXXX. Direct SELECT is revoked; read it through profile_contact_phones().';

revoke select (phone) on table public.profiles from public, anon, authenticated;

create or replace function public.profile_contact_phones(target_ids uuid[])
returns table (id uuid, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.phone
  from public.profiles p
  where auth.uid() is not null
    and p.id = any (coalesce(target_ids, array[]::uuid[]))
    and p.phone is not null
    and (
      p.id = auth.uid()
      or exists (
        select 1
        from public.rentals r
        where lower(coalesce(r.status, '')) in (
          'active',
          'accepted',
          'approved',
          'onaylandi',
          'onaylandı'
        )
          and (
            (r.landlord_id::text = auth.uid()::text and r.tenant_id::text = p.id::text)
            or (r.tenant_id::text = auth.uid()::text and r.landlord_id::text = p.id::text)
          )
      )
    );
$$;

comment on function public.profile_contact_phones(uuid[]) is
  'Returns profile phones for the caller and for counterparts on an approved rental only.';

revoke all on function public.profile_contact_phones(uuid[]) from public, anon;
grant execute on function public.profile_contact_phones(uuid[]) to authenticated;

notify pgrst, 'reload schema';

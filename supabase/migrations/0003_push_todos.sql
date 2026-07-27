-- VYP — Suscripciones push para cualquier usuario con cuenta, no solo miembros
--
-- Motivo: la política original exigía `private.es_miembro()` para poder registrar
-- el dispositivo. Eso dejaba fuera justo al caso que más lo necesita: alguien que
-- acaba de registrarse y está esperando a que la directiva lo apruebe — no podía
-- suscribirse, así que nunca recibiría el aviso de "ya eres miembro".
--
-- La suscripción es del DISPOSITIVO; quién recibe cada aviso se decide en el
-- servidor al enviarlo (ver src/lib/push.ts), que sí filtra por rol. Guardar un
-- endpoint no da acceso a nada.

drop policy if exists push_subs_insert on public.push_subs;
create policy push_subs_insert on public.push_subs
  for insert to authenticated
  with check ( user_id = auth.uid() );

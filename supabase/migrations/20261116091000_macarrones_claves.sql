-- «mac» excluía también «macarrones»: se excluye por «cheese»/«gratinados».
update public.recetario
   set claves = jsonb_set(claves, '{0,x}', '["cheese", "gratinados", "bacon"]'::jsonb)
 where slug = 'macarrones-tomate-chorizo';

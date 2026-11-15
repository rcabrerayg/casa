-- Recetas de la casa y platos escritos a mano en el menú.

-- 1. El solomillo y el risotto pasan a ser las versiones de la casa.
update public.recetario set
  titulo = 'Solomillo de cerdo en salsa de cerveza',
  minutos = 45,
  aparato = 'Vitrocerámica o inducción (olla con tapa)',
  etiquetas = array['De la casa', 'Receta de la casa', 'Cerdo'],
  ingredientes = array[
    '1 solomillo de cerdo (unos 500 g)',
    '2 cebollas medianas',
    '½ cucharada de mostaza (mejor la antigua, en grano)',
    '1 lata de cerveza, rubia o negra',
    '½ taza de salsa de soja',
    '½ vaso de agua (unos 100 ml)',
    '1 hoja de laurel (o una ramita de tomillo o de romero)',
    '2 dientes de ajo muy picados',
    '1 cucharada de miel',
    '1 cucharada de azúcar moreno',
    '2 rodajas de jengibre (o un poco rallado)',
    'Ralladura de limón',
    '2 cucharadas de aceite de oliva, sal y pimienta'
  ],
  pasos = array[
    'Corta las cebollas en juliana y pochalas en una olla mediana con un poco de aceite hasta que estén transparentes. Sácalas a un bol.',
    'Salpimienta el solomillo y úntalo con la mostaza.',
    'En la misma olla, a fuego fuerte y con un buen chorro de aceite, dora el solomillo por todos lados. Pon las cebollas alrededor.',
    'Echa la cerveza, la soja, el agua, el laurel, la miel, el jengibre, el ajo, el azúcar moreno y la ralladura de limón.',
    'Tapa y cuece 30-35 minutos a fuego medio, sin subirlo, para que no se pegue el fondo.',
    'Apaga y deja reposar la carne 10 minutos antes de cortarla en medallones. Sírvela con la cebolla y la salsa por encima.'
  ],
  truco = 'Si queréis cero alcohol por la lactancia, usa cerveza sin alcohol: la salsa queda igual de rica. Unas patatas o arroz blanco al lado aprovechan la salsa.',
  conservacion = 'Aguanta 2-3 días en la nevera en su salsa; recalienta tapado a fuego suave.',
  sobras = true,
  congela = true,
  coste = 'medio',
  claves = '[{"q": "cerdo solomillo", "u": "kg", "x": ["relleno", "boletus"], "cant": 0.5},
             {"q": "cebolla", "u": "kg", "x": ["troceada", "frita", "crujiente"], "cant": 0.3},
             {"q": "cerveza", "u": "l", "cant": 0.33},
             {"q": "salsa soja", "u": "l", "cant": 0.12}]'::jsonb
where slug = 'solomillo-cerveza';

update public.recetario set
  titulo = 'Risotto de boletus',
  minutos = 30,
  aparato = 'Vitrocerámica o inducción',
  etiquetas = array['De la casa', 'Receta de la casa', 'Pasta y arroz', 'Vegetariano'],
  ingredientes = array[
    '200 g de arroz redondo (tipo bomba)',
    '90 g de boletus (frescos o congelados; si son secos, 20 g hidratados)',
    '¼ de cebolla dulce',
    '1 l de caldo de verduras caliente',
    'Un chorrito de vino blanco',
    'Mantequilla: un trozo para sofreír y 3 daditos para el final',
    'Aceite de oliva',
    'Queso pecorino romano rallado, al gusto',
    'Perejil fresco picado'
  ],
  pasos = array[
    'Pon el caldo a calentar en un cazo: tiene que entrar caliente al arroz.',
    'Sofríe la cebolla picada en aceite con un poco de mantequilla hasta que esté transparente. Añade el boletus en trocitos y deja que se dore un poco.',
    'Desglasa con el vino blanco y, cuando se evapore, echa el arroz y remueve un minuto.',
    'Ve añadiendo el caldo poco a poco, cazo a cazo, sin dejar de remover, hasta que el arroz suelte el almidón y quede meloso (unos 18 minutos).',
    'Con el arroz al dente, apaga el fuego, añade los 3 daditos de mantequilla y el queso, y mezcla con energía. Termina con perejil y sirve enseguida.'
  ],
  truco = 'Es la mitad de la receta original (para 4), para dos. Sin alcohol: cambia el vino por un cazo más de caldo con unas gotas de limón. El boletus no está en el catálogo de Mercadona ni HiperDino: búscalo congelado o seco en otra tienda, o usa champiñones y setas.',
  conservacion = 'Mejor recién hecho; si sobra, al día siguiente sirve para croquetas o arancini.',
  sobras = false,
  congela = false,
  coste = 'medio'
where slug = 'risotto-boletus';

-- 2. Macarrones con tomate, chorizo y queso.
insert into public.recetario (slug, titulo, cocina, momento, raciones, minutos, aparato, etiquetas, ingredientes, pasos, truco, conservacion, sobras, congela, coste, claves)
values (
  'macarrones-tomate-chorizo',
  'Macarrones con tomate, chorizo y queso gratinado',
  'española', 'almuerzo', 2, 30, 'Vitrocerámica y horno (o solo vitro)',
  array['De la casa', 'Pasta y arroz', 'Cerdo'],
  array[
    '200 g de macarrones',
    '100 g de chorizo dulce',
    '1 cebolla',
    '1 diente de ajo',
    '400 g de tomate triturado (o 300 g de tomate frito)',
    '1 cucharadita de orégano y una pizca de azúcar',
    '60 g de queso rallado para gratinar'
  ],
  array[
    'Pon a hervir agua con sal para la pasta.',
    'Pica la cebolla y el ajo y pochalos 8 minutos a fuego medio con un poco de aceite.',
    'Añade el chorizo en dados pequeños y deja que suelte su grasa roja 2 minutos: eso da el color y el sabor a la salsa.',
    'Echa el tomate, el orégano y la pizca de azúcar (le quita la acidez) y deja que se haga 10 minutos a fuego suave.',
    'Cuece los macarrones un minuto menos de lo que diga el paquete, escúrrelos y mézclalos con la salsa.',
    'Pásalos a una fuente, cubre con el queso y gratina 5 minutos con el grill del horno. Sin horno: tapa la sartén con el queso encima 3 minutos a fuego mínimo.'
  ],
  'Si usas tomate frito ya hecho, la salsa está en 5 minutos.',
  'Aguantan 2-3 días en la nevera; recalienta con un chorrito de agua.',
  true, false, 'barato',
  '[{"q": "macarrones", "u": "kg", "x": ["mac", "cheese", "gratinados"], "cant": 0.2},
    {"q": "chorizo", "u": "kg", "x": ["sobrasada", "parrillero", "vaca", "pollo"], "cant": 0.1},
    {"q": "tomate triturado", "u": "kg", "cant": 0.4},
    {"q": "queso rallado", "u": "kg", "x": ["sin lactosa"], "cant": 0.06}]'::jsonb
)
on conflict (slug) do nothing;

-- 3. Cambiar un plato del menú por lo que escribáis, o por «comemos fuera».
create function public.poner_plato(p_menu uuid, p_dia int, p_momento text, p_titulo text, p_fuera boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  plato jsonb;
  t text := trim(coalesce(p_titulo, ''));
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 then
    raise exception 'Día o momento no válido';
  end if;
  if char_length(t) < 2 or char_length(t) > 120 then
    raise exception 'Escribe el plato (de 2 a 120 letras)';
  end if;
  plato := jsonb_build_object(
    'titulo', t, 'minutos', 0, 'aparato', '',
    'etiquetas', case when p_fuera then '["Fuera"]'::jsonb else '["A mano"]'::jsonb end,
    'ingredientes', '[]'::jsonb);
  update public.menus m
     set plan = jsonb_set(m.plan, array['dias', p_dia::text, p_momento], plato)
   where m.id = p_menu
     and m.household_id = public.my_household()
     and m.estado = 'listo'
     and jsonb_array_length(m.plan -> 'dias') > p_dia;
  if not found then raise exception 'No encuentro ese menú'; end if;
  return plato;
end;
$$;
revoke execute on function public.poner_plato(uuid, int, text, text, boolean) from public, anon;
grant execute on function public.poner_plato(uuid, int, text, text, boolean) to authenticated;

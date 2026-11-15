"""Recetario de la casa: platos caseros con técnica de cocinero, baratos y no genéricos.

Texto propio (no copiado de ninguna web). Cantidades para 2. Respeta la lactancia:
sin pez espada, tiburón, atún rojo ni lucio; huevo siempre bien cuajado; el alcohol que
aparece se cuece hasta evaporarse y siempre hay alternativa sin él.

Uso: python3 scripts/recetario.py > supabase/migrations/<ts>_recetario_datos.sql
"""
import json
import sys

R = []


def r(slug, titulo, cocina, momento, minutos, aparato, etiquetas, ingredientes, pasos, truco,
      conservacion, sobras=False, congela=False, coste="barato", meses=None):
    R.append(dict(slug=slug, titulo=titulo, cocina=cocina, momento=momento, minutos=minutos, aparato=aparato,
                  etiquetas=etiquetas, ingredientes=ingredientes, pasos=pasos, truco=truco,
                  conservacion=conservacion, sobras=sobras, congela=congela, coste=coste, meses=meses))


VITRO, HORNO, AIRE, ARROCERA, FRIO = "Vitrocerámica o inducción", "Horno", "Freidora de aire", "Arrocera", "Sin cocinar"
OTONO = [10, 11, 12, 1, 2, 3]

# ═══════════════════════ ALMUERZOS · los de la casa ═══════════════════════

r("secreto-pimienta", "Secreto ibérico con salsa de pimienta y arroz blanco", "española", "almuerzo", 30, VITRO,
  ["De la casa", "Plato de cocinero", "Cerdo"],
  ["400 g de secreto (el ibérico es lo suyo; el de cerdo blanco cuesta un tercio y queda muy bien)", "150 g de arroz largo", "1 chalota o media cebolla pequeña", "1 cucharada de pimienta negra en grano",
   "200 ml de nata para cocinar", "100 ml de caldo de carne o de pollo", "30 ml de brandy (opcional, ver truco)", "10 g de mantequilla"],
  ["Saca el secreto de la nevera 20 minutos antes y sécalo bien con papel: carne fría y húmeda no se dora, se cuece.",
   "Pon el arroz en la arrocera (o cuécelo 11 minutos en agua con sal) y déjalo tapado reposando.",
   "Machaca la pimienta en el mortero, que quede gruesa, no en polvo. Calienta la sartén a fuego fuerte, sin aceite: el secreto suelta su propia grasa.",
   "Marca el secreto entero 3 minutos por cara sin moverlo, hasta que tenga costra tostada. Sálalo al darle la vuelta y sácalo a una tabla a reposar 5 minutos tapado con papel de aluminio flojo.",
   "En la misma sartén, a fuego medio, pocha la chalota picada con la mantequilla 2 minutos y añade la pimienta 30 segundos para que suelte aroma.",
   "Desglasa con el brandy (o directamente con el caldo) rascando el fondo: ese tostado pegado es la salsa. Deja hervir 2-3 minutos hasta que no huela a alcohol, añade el caldo y reduce a la mitad.",
   "Echa la nata, cuece 3-4 minutos hasta que napa la cuchara y ajusta de sal. Filetea el secreto en tiras al bies, echa su jugo del reposo a la salsa y sirve con el arroz."],
  "El reposo y el jugo que suelta van a la salsa: no lo tires. Si queréis cero alcohol por la lactancia, sustituye el brandy por caldo con unas gotas de salsa Perrins.",
  "Mejor recién hecho; la salsa aguanta 2 días en la nevera.", coste="medio")

r("solomillo-cerveza", "Solomillo de cerdo a la cerveza con cebolla confitada y patatas panaderas", "española", "almuerzo", 50, HORNO,
  ["De la casa", "Plato de cocinero", "Cerdo"],
  ["1 solomillo de cerdo (unos 450 g)", "2 patatas medianas", "2 cebollas", "330 ml de cerveza tostada (o sin alcohol)",
   "1 cucharadita de miel", "1 cucharadita de mostaza", "1 hoja de laurel", "Tomillo seco"],
  ["Horno a 190 °C. Corta las patatas en rodajas de medio centímetro y una cebolla en juliana; mézclalas con aceite, sal y tomillo en una fuente y hornea 25 minutos.",
   "Mientras, quita al solomillo la telilla plateada con la punta del cuchillo (si no, se encoge y se arquea). Salpimiéntalo.",
   "Dóralo en una sartén muy caliente con un hilo de aceite, 1 minuto por cada lado, hasta que esté tostado por todas partes. Ponlo sobre las patatas.",
   "En la misma sartén, pocha la otra cebolla en juliana a fuego medio 10 minutos con una pizca de sal, hasta que esté dorada y dulce.",
   "Vierte la cerveza, añade el laurel, la miel y la mostaza y deja hervir a borbotones 10-12 minutos, hasta que reduzca a la mitad y espese.",
   "Hornea el solomillo 12-14 minutos (debe quedar ligeramente rosado en el centro). Sácalo y déjalo reposar 5 minutos antes de cortarlo en medallones gruesos.",
   "Sirve los medallones sobre las patatas con la cebolla y la salsa por encima."],
  "La telilla plateada fuera y el reposo después: así el solomillo queda jugoso y no seco. La cerveza hierve más de 10 minutos y pierde casi todo el alcohol; si queréis cero, usad cerveza sin alcohol, que funciona igual.",
  "Aguanta 2 días en nevera; recalienta suave con la salsa para que no se seque.", sobras=True, coste="medio")

r("lentejas-riojana", "Lentejas a la riojana con chorizo", "española", "almuerzo", 60, VITRO,
  ["De la casa", "Legumbres", "Guisos de cuchara", "Para dejar hecho"],
  ["250 g de lentejas pardinas", "1 chorizo para cocinar (unos 150 g)", "1 cebolla", "1 pimiento verde", "1 zanahoria", "1 patata",
   "2 dientes de ajo", "1 tomate maduro", "1 cucharadita de pimentón dulce de la Vera", "1 hoja de laurel"],
  ["Lava las lentejas y ponlas en la olla con agua fría que las cubra tres dedos, el laurel, la zanahoria entera y media cebolla. Arranca el hervor y baja a fuego suave.",
   "Mientras, en una sartén, pocha la otra media cebolla, el pimiento y los ajos muy picados 10 minutos a fuego bajo: el sofrito tiene que estar blando y dulce, no tostado.",
   "Añade el tomate rallado y deja que pierda el agua, 5 minutos. Aparta del fuego, echa el pimentón y remueve 20 segundos: el pimentón se quema enseguida y amarga.",
   "Echa el sofrito a las lentejas junto con el chorizo en rodajas gruesas y la patata chascada (rompe el trozo con el cuchillo en vez de cortarlo limpio: suelta almidón y espesa el caldo).",
   "Cuece a fuego muy suave 30-35 minutos, sin que hierva fuerte (las lentejas se pelan). Si hace falta, añade agua fría poco a poco.",
   "Saca la zanahoria y la media cebolla cocidas, aplástalas con un cacillo de caldo y devuélvelas a la olla: espesa sin harina. Sal al final y reposa 10 minutos antes de servir."],
  "Patata chascada y verdura cocida aplastada: así el caldo queda trabado y meloso. Al día siguiente están aún mejores.",
  "4 días en nevera; se congelan muy bien (mejor sin la patata).", sobras=True, congela=True, meses=OTONO)

r("risotto-boletus", "Risotto de boletus", "italiana", "almuerzo", 40, VITRO,
  ["De la casa", "Plato de cocinero", "Pasta y arroz", "Vegetariano"],
  ["160 g de arroz arborio o carnaroli (o bomba si no hay)", "20 g de boletus secos", "200 g de champiñones o setas frescas", "1 chalota",
   "800 ml de caldo de verduras o de pollo", "40 g de parmesano rallado", "30 g de mantequilla fría", "50 ml de vino blanco (opcional)"],
  ["Hidrata los boletus en 300 ml de agua caliente 20 minutos. Escúrrelos (pícalos) y cuela el agua con un papel de cocina: va al caldo, es puro sabor. Calienta caldo y agua juntos y mantenlos al fuego mínimo.",
   "Saltea las setas frescas laminadas a fuego fuerte con un hilo de aceite hasta que se doren, sal al final, y resérvalas.",
   "En la misma cazuela, a fuego suave, pocha la chalota picada fina con un poco de aceite 4 minutos. Sube el fuego, echa el arroz y tuéstalo 2 minutos removiendo, hasta que el grano esté brillante y suene.",
   "Si usas vino, échalo y deja que se evapore del todo (1-2 minutos, sin olor a alcohol). Añade los boletus picados.",
   "Ve añadiendo el caldo caliente cucharón a cucharón, removiendo a menudo y esperando a que el arroz lo beba antes del siguiente. Unos 17-18 minutos, hasta que esté al dente.",
   "Fuera del fuego, echa las setas salteadas, la mantequilla fría en dados y el parmesano y remueve con energía 1 minuto: eso es la «mantecatura», lo que lo hace cremoso. Deja reposar 1 minuto tapado y sirve en plato llano: debe extenderse como una ola."],
  "El caldo siempre caliente y la mantequilla fría al final, fuera del fuego. Si el vino os preocupa, sustitúyelo por un chorrito de agua de los boletus con unas gotas de limón.",
  "Mejor recién hecho; lo que sobre se convierte en croquetas o en tortitas de arroz a la sartén.")

r("filete-ternera-padron", "Filete de ternera a la plancha con patatas al horno y pimientos de Padrón", "española", "almuerzo", 35, HORNO,
  ["De la casa", "Carne de oferta"],
  ["2 filetes de ternera gruesos (entrecot, lomo bajo o cadera, unos 400 g)", "2 patatas", "150 g de pimientos de Padrón", "Romero", "Sal en escamas"],
  ["Saca la carne de la nevera 30 minutos antes. Horno a 200 °C: patatas en gajos con piel, aceite, sal y romero, 30 minutos (o 20 en la freidora de aire a 200 °C).",
   "Seca muy bien los filetes con papel. Calienta la sartén o plancha hasta que humee ligeramente y unta la carne, no la sartén, con un poco de aceite.",
   "Marca 2 minutos por cara sin tocar (para un filete de 2 cm, al punto menos). Dale la vuelta una sola vez.",
   "Saca la carne a un plato caliente y deja que repose 4 minutos: las fibras se relajan y el jugo se queda dentro.",
   "En la misma sartén, saltea los pimientos de Padrón con un hilo de aceite a fuego fuerte hasta que se ampollen, 3 minutos. Sal gorda al final.",
   "Sirve la carne con sal en escamas por encima, las patatas y los pimientos."],
  "Sal la carne justo antes de la sartén o justo después, nunca media hora antes. Solo cuando la ternera buena esté de oferta.",
  "Mejor al momento.", coste="oferta")

# ═══════════════════════ ALMUERZOS · casera española ═══════════════════════

r("garbanzos-espinacas", "Garbanzos con espinacas a la sevillana", "española", "almuerzo", 30, VITRO,
  ["Legumbres", "Guisos de cuchara", "Vegetariano", "Rápido"],
  ["1 bote de garbanzos cocidos (400 g)", "300 g de espinacas (frescas o congeladas)", "2 rebanadas de pan del día anterior", "3 dientes de ajo",
   "1 cucharadita de comino molido", "1 cucharadita de pimentón dulce", "1 cucharada de vinagre de Jerez o de vino", "300 ml de caldo de verduras"],
  ["Fríe en una cazuela, con un buen chorro de aceite, el pan y los ajos laminados hasta que estén dorados. Sácalos al mortero o al vaso de la batidora.",
   "Añade el comino, el pimentón, el vinagre y un poco de caldo y machaca o tritura hasta tener una pasta espesa: es la majada que da cuerpo al guiso.",
   "En el mismo aceite, saltea las espinacas hasta que se marchiten y pierdan el agua.",
   "Echa los garbanzos lavados, la majada y el resto del caldo. Cuece 10 minutos a fuego suave, hasta que el caldo espese.",
   "Ajusta de sal y deja reposar 5 minutos antes de servir."],
  "La majada de pan frito, ajo y comino es lo que convierte cuatro ingredientes en un plato andaluz de verdad. Espinacas y garbanzos dan hierro, que viene bien en la lactancia.",
  "3 días en nevera; se congela.", sobras=True, congela=True)

r("pollo-ajillo", "Pollo al ajillo con patatas a lo pobre", "española", "almuerzo", 45, VITRO,
  ["Pollo", "Clásico"],
  ["4 contramuslos de pollo con piel y hueso, troceados en dos", "1 cabeza de ajos", "2 patatas", "1 pimiento verde", "Media cebolla", "1 hoja de laurel",
   "100 ml de vino blanco o de caldo de pollo", "Perejil"],
  ["Salpimienta el pollo. En una cazuela amplia con aceite a fuego medio-alto, dóralo con la piel hacia abajo 8 minutos sin tocarlo, hasta que la piel esté crujiente; dale la vuelta 3 minutos más.",
   "Baja el fuego, añade los ajos sin pelar, golpeados con el cuchillo, y el laurel. Tápalo y cocina 15 minutos a fuego suave, girando las piezas de vez en cuando.",
   "Mientras, haz las patatas a lo pobre: patatas en láminas finas, cebolla y pimiento en tiras, en sartén con aceite a fuego medio y tapadas 15 minutos; destapa al final para que se doren.",
   "Destapa el pollo, sube el fuego, añade el vino (o caldo) y deja que hierva 3-4 minutos rascando el fondo hasta que la salsa se reduzca y ya no huela a alcohol.",
   "Termina con perejil picado y sirve con las patatas."],
  "El ajo con piel se confita sin quemarse y queda dulce: aplástalo sobre el pollo al comerlo.",
  "3 días en nevera.", sobras=True)

r("albondigas-almendras", "Albóndigas en salsa de almendras", "española", "almuerzo", 50, VITRO,
  ["Para dejar hecho", "Clásico"],
  ["400 g de carne picada mixta", "1 huevo", "1 rebanada de pan remojada en leche", "2 dientes de ajo", "Perejil", "Harina para rebozar",
   "1 cebolla", "30 g de almendras crudas", "400 ml de caldo de pollo", "Hebras de azafrán o colorante"],
  ["Mezcla la carne con el huevo, el pan escurrido, un ajo y el perejil picados, sal y pimienta. Amasa solo lo justo: si se amasa mucho, quedan duras.",
   "Forma bolas del tamaño de una nuez con las manos húmedas, pásalas por harina y dóralas por tandas en una sartén con aceite. No tienen que hacerse por dentro.",
   "En una cazuela con un poco de ese aceite, dora las almendras y el otro ajo, sácalos. Pocha ahí la cebolla picada 10 minutos.",
   "Tritura las almendras y el ajo con un poco de caldo y el azafrán. Échalo a la cazuela con el resto del caldo y hierve 5 minutos.",
   "Añade las albóndigas y cuece 15-20 minutos a fuego suave, moviendo la cazuela en círculos en lugar de usar la cuchara para que no se rompan. Tritura la salsa si la quieres fina."],
  "La harina del rebozado espesa la salsa sola. Mejor de un día para otro.",
  "4 días en nevera; se congelan en su salsa.", sobras=True, congela=True)

r("arroz-horno", "Arroz al horno con costilla, morcilla y garbanzos", "española", "almuerzo", 60, HORNO,
  ["Pasta y arroz", "Plato de cocinero", "Cerdo"],
  ["160 g de arroz redondo", "250 g de costilla de cerdo troceada", "1 morcilla de cebolla", "Medio bote de garbanzos cocidos", "1 patata",
   "1 tomate", "1 cabeza de ajos pequeña", "400 ml de caldo de pollo", "1 cucharadita de pimentón dulce", "Azafrán o colorante"],
  ["Horno a 220 °C. Calienta el caldo. En una cazuela de barro o una fuente que pueda ir al fuego, dora la costilla salpimentada con aceite. Sácala.",
   "Dora la patata en rodajas gruesas y medio tomate en rodajas. Sácalos. Marca la morcilla en rodajas gruesas 1 minuto y sácala.",
   "Ralla el otro medio tomate, sofríelo 3 minutos, aparta del fuego, añade el pimentón y el arroz y remueve para que se impregne.",
   "Pasa todo a la fuente (si tu cazuela no va al horno): el arroz en una capa fina, los garbanzos, la costilla, y encima las patatas, el tomate, la morcilla y la cabeza de ajos en el centro.",
   "Vierte el caldo hirviendo con el azafrán (el doble de volumen que de arroz) y mete al horno 18-20 minutos, sin tocar.",
   "Saca y deja reposar 5 minutos tapado con un paño."],
  "El caldo tiene que entrar hirviendo y el arroz en capa fina: así queda suelto y con costra arriba.",
  "2 días en nevera; recalienta con un chorrito de caldo.", sobras=True)

r("merluza-verde", "Merluza en salsa verde con patatas", "española", "almuerzo", 30, VITRO,
  ["Pescado", "Rápido", "Clásico"],
  ["4 rodajas de merluza (frescas o congeladas y descongeladas)", "2 patatas", "3 dientes de ajo", "1 cucharada de harina", "250 ml de caldo de pescado o agua",
   "Mucho perejil", "Un puñado de guisantes congelados"],
  ["Cuece las patatas en rodajas de 1 cm en agua con sal 12 minutos, que queden enteras. Escúrrelas guardando un poco del agua.",
   "En una cazuela baja, a fuego suave, dora los ajos picados en aceite sin que cojan color oscuro. Echa la harina y remueve 1 minuto.",
   "Añade el caldo caliente poco a poco sin dejar de remover, y deja que hierva 3 minutos: es la base de la salsa.",
   "Coloca las rodajas de merluza saladas y los guisantes y cocina 3 minutos por cada lado moviendo la cazuela en vaivén: la gelatina del pescado liga la salsa.",
   "Añade las patatas y mucho perejil picado, 1 minuto más, y sirve."],
  "Menear la cazuela en vez de remover: así la salsa engorda con la gelatina de la merluza sin romperla.",
  "Mejor al momento.")

r("carrilleras-vino", "Carrilleras de cerdo al vino tinto con puré de patata", "española", "almuerzo", 150, VITRO,
  ["Plato de cocinero", "Para dejar hecho", "Cerdo"],
  ["4 carrilleras de cerdo (unos 600 g)", "1 cebolla", "1 zanahoria", "1 puerro", "2 dientes de ajo", "250 ml de vino tinto", "250 ml de caldo de carne",
   "1 cucharada de tomate concentrado", "Laurel y tomillo", "Para el puré: 3 patatas, 30 g de mantequilla, leche caliente"],
  ["Limpia las carrilleras de grasa y telillas, salpimiéntalas y enharínalas ligeramente. Dóralas en una cazuela con aceite a fuego fuerte hasta que estén bien tostadas. Sácalas.",
   "Baja el fuego y pocha en la misma grasa la verdura picada en dados 15 minutos, hasta que esté blanda y algo caramelizada. Añade el tomate concentrado y tuéstalo 2 minutos.",
   "Vierte el vino, sube el fuego y deja que hierva 5 minutos rascando el fondo, hasta que se reduzca a la mitad y no huela a alcohol.",
   "Vuelve a meter las carrilleras, cubre con el caldo, añade laurel y tomillo, tapa y cuece a fuego mínimo 2 horas (o 40 minutos en olla a presión), hasta que se deshagan con una cuchara.",
   "Saca la carne, tritura la salsa y redúcela si está líquida hasta que brille y napa.",
   "Para el puré, cuece las patatas, pásalas por el pasapurés (la batidora las vuelve chicle) y monta con la mantequilla fría y la leche caliente."],
  "Dos horas de guiso: el alcohol se ha ido por completo y queda solo el sabor del vino. Se hacen mejor en cantidad doble: la mitad, al congelador.",
  "4 días en nevera; se congelan perfectamente en su salsa.", sobras=True, congela=True, meses=OTONO)

r("judias-costilla", "Alubias blancas estofadas con costilla y verduras", "española", "almuerzo", 90, VITRO,
  ["Legumbres", "Guisos de cuchara", "Para dejar hecho"],
  ["200 g de alubias blancas secas (en remojo la noche antes)", "250 g de costilla de cerdo adobada o fresca", "1 cebolla", "1 pimiento rojo",
   "1 zanahoria", "2 dientes de ajo", "1 cucharadita de pimentón", "1 hoja de laurel"],
  ["Pon las alubias escurridas en agua fría con la costilla, media cebolla, el laurel y la zanahoria. Arranca el hervor y espuma bien.",
   "Cuando hierva, «asústalas» dos veces con un vaso de agua fría: así la piel no se rompe y quedan tiernas por igual.",
   "Mientras, pocha la otra media cebolla, el pimiento y el ajo picados 12 minutos a fuego bajo; fuera del fuego, el pimentón. Añádelo a la olla.",
   "Cuece tapado a fuego mínimo 1 hora, hasta que estén tiernas (o 25 minutos en olla a presión).",
   "Sala al final, aplasta unas cuantas alubias contra la pared de la olla para espesar y deja reposar."],
  "Hervor mínimo, sin remover con cuchara (mueve la olla): alubia entera y caldo cremoso.",
  "4 días en nevera; se congelan.", sobras=True, congela=True, meses=OTONO)

r("caballa-horno", "Caballa al horno con patatas, pimiento y limón", "española", "almuerzo", 40, HORNO,
  ["Pescado", "Barato"],
  ["2 caballas limpias y abiertas en lomos", "2 patatas", "1 pimiento rojo", "1 cebolla", "1 limón", "Ajo y perejil", "Orégano"],
  ["Horno a 200 °C. Patatas en rodajas finas, cebolla y pimiento en tiras, con aceite, sal y orégano en una fuente. Hornea 25 minutos.",
   "Haz un ajillo: 2 ajos y perejil picados con 3 cucharadas de aceite y el zumo de medio limón.",
   "Seca los lomos de caballa, sálalos y colócalos sobre las patatas con la piel hacia arriba. Unos cortes en la piel evitan que se encoja.",
   "Hornea 8-10 minutos, solo hasta que la carne se separe en lascas.",
   "Al sacar, riega con el ajillo y sirve con el resto del limón."],
  "La caballa es pescado azul con omega 3 y poco mercurio: ideal en la lactancia y de las más baratas.",
  "Mejor al momento; lo que sobre, desmigado, sirve para unas tostas.")

r("arroz-meloso-setas", "Arroz meloso de pollo y setas", "española", "almuerzo", 45, VITRO,
  ["Pasta y arroz", "Pollo", "De temporada"],
  ["160 g de arroz redondo o bomba", "2 contramuslos de pollo deshuesados", "250 g de setas variadas o champiñones", "1 cebolla", "1 pimiento verde",
   "1 tomate", "2 dientes de ajo", "1 l de caldo de pollo", "Tomillo"],
  ["Trocea el pollo en dados, salpimienta y dóralo bien en la cazuela con aceite. Sácalo.",
   "Saltea las setas a fuego fuerte hasta que se doren, sin sal hasta el final para que no suelten agua y se cuezan. Sácalas.",
   "Haz el sofrito: cebolla, pimiento y ajo picados 10 minutos a fuego suave, luego el tomate rallado hasta que se oscurezca.",
   "Añade el arroz, remueve 1 minuto, vuelve a meter el pollo y las setas y echa tres cuartas partes del caldo caliente con el tomillo.",
   "Cuece 18 minutos a fuego medio moviendo de vez en cuando y añadiendo caldo si se seca: debe quedar suelto pero con caldo espeso, como una ola.",
   "Deja reposar 2 minutos y sirve."],
  "Setas doradas aparte y sal solo al final: si no, sueltan agua y saben a hervido.",
  "Mejor recién hecho.", meses=OTONO)

r("pisto-huevo", "Pisto manchego con huevo a la plancha bien hecho", "española", "almuerzo", 50, VITRO,
  ["Verduras", "Vegetariano", "Para dejar hecho"],
  ["1 calabacín", "1 berenjena", "1 pimiento rojo", "1 pimiento verde", "1 cebolla", "400 g de tomate triturado", "1 cucharadita de azúcar", "2 huevos", "Pan"],
  ["Corta todas las verduras en dados del mismo tamaño, de 1 cm.",
   "Pocha la cebolla 10 minutos a fuego suave, añade los pimientos y cocina 10 minutos más.",
   "Añade el calabacín y la berenjena con sal y cocina 10 minutos: cada verdura entra según lo que tarda.",
   "Echa el tomate y el azúcar (le quita la acidez) y deja que se haga a fuego mínimo 20 minutos, hasta que el aceite se separe y brille.",
   "Haz los huevos a la plancha con la yema bien cuajada (tapa la sartén 1 minuto) y sírvelos encima, con pan."],
  "Cuanto más lento, mejor: el pisto rápido sabe a verdura cocida; el lento, a mermelada salada.",
  "4 días en nevera; se congela (sin el huevo).", sobras=True, congela=True)

# ═══════════════════════ ALMUERZOS · italiana ═══════════════════════

r("amatriciana", "Pasta all'amatriciana", "italiana", "almuerzo", 25, VITRO,
  ["Pasta y arroz", "Rápido"],
  ["200 g de bucatini, espaguetis o rigatoni", "120 g de panceta o bacon en taco", "400 g de tomate triturado", "Media guindilla (opcional)",
   "40 g de queso pecorino o parmesano rallado"],
  ["Corta la panceta en tiras gruesas y ponla en una sartén fría a fuego medio: la grasa se funde poco a poco y la carne queda crujiente por fuera y tierna por dentro.",
   "Cuando esté dorada, añade la guindilla y el tomate. Cuece 12 minutos a fuego suave, hasta que espese.",
   "Cuece la pasta en agua con bastante sal 1 minuto menos de lo que dice el paquete. Guarda un vaso del agua de cocción.",
   "Pasa la pasta a la salsa con un chorro del agua de cocción y saltea 1 minuto a fuego fuerte, moviendo, para que el almidón ligue la salsa.",
   "Fuera del fuego, el queso, y sirve."],
  "Terminar la pasta en la salsa con su agua es lo que la diferencia de «pasta con tomate por encima».",
  "La salsa se congela; la pasta, mejor al momento.", congela=True)

r("ragu-bolones", "Ragú a la boloñesa de cocción lenta con tagliatelle", "italiana", "almuerzo", 150, VITRO,
  ["Pasta y arroz", "Plato de cocinero", "Para dejar hecho"],
  ["250 g de carne picada de ternera", "150 g de carne picada de cerdo", "1 cebolla", "1 zanahoria", "1 rama de apio", "400 g de tomate triturado",
   "1 cucharada de tomate concentrado", "200 ml de leche entera", "250 g de tagliatelle (o 160 g por ración del día)", "Parmesano"],
  ["Pica cebolla, zanahoria y apio muy finos (el «soffritto») y póchalos 15 minutos a fuego suave con aceite y una nuez de mantequilla.",
   "Sube el fuego, añade la carne y no la remuevas hasta que se dore por debajo; después desmenúzala y dórala bien. Que se tueste, no que se cueza en su jugo.",
   "Añade la leche y deja que se evapore casi del todo: suaviza la carne y le da la textura tierna de la receta de Bolonia.",
   "Añade el tomate concentrado, tuéstalo 1 minuto, y luego el tomate triturado y un vaso de agua. Sal.",
   "Cuece destapado a fuego mínimo 2 horas, removiendo de vez en cuando y añadiendo agua si se seca. Tiene que quedar espeso y brillante.",
   "Mezcla con la pasta recién escurrida y un poco de su agua, y sirve con parmesano."],
  "Leche antes que el tomate y dos horas de fuego mínimo: es lo que convierte una boloñesa normal en un ragú. Haced el doble y congelad la mitad.",
  "4 días en nevera; se congela muy bien.", sobras=True, congela=True)

r("pasta-ceci", "Pasta e ceci (pasta con garbanzos a la romana)", "italiana", "almuerzo", 30, VITRO,
  ["Legumbres", "Pasta y arroz", "Barato", "Vegetariano"],
  ["1 bote de garbanzos cocidos (400 g)", "120 g de pasta corta (ditalini, coditos)", "2 dientes de ajo", "1 rama de romero", "1 cucharada de tomate concentrado",
   "600 ml de caldo de verduras", "Parmesano"],
  ["Dora a fuego suave los ajos laminados y el romero en un buen chorro de aceite, 2 minutos: el aceite se perfuma.",
   "Añade el tomate concentrado y tuéstalo 1 minuto. Echa los garbanzos lavados y el caldo, y cuece 10 minutos.",
   "Saca el romero, tritura la mitad de la olla con la batidora y vuelve a mezclar: queda un caldo espeso y cremoso.",
   "Echa la pasta en crudo y cuécela ahí mismo, removiendo, el tiempo del paquete. Añade agua si espesa demasiado.",
   "Sirve con un hilo de aceite crudo, pimienta y parmesano."],
  "La pasta cocida en la propia crema suelta almidón y lo liga todo: plato de cuchara italiano por menos de 2 €.",
  "2 días en nevera (la pasta absorbe: añade agua al recalentar).", sobras=True)

r("pollo-cacciatora", "Pollo a la cacciatora con polenta o pan", "italiana", "almuerzo", 55, VITRO,
  ["Pollo", "Para dejar hecho"],
  ["4 contramuslos de pollo con hueso", "1 cebolla", "1 pimiento rojo", "150 g de champiñones", "2 dientes de ajo", "400 g de tomate troceado",
   "Un puñado de aceitunas negras", "Romero y orégano", "100 ml de vino tinto o caldo"],
  ["Salpimienta el pollo y dóralo con la piel hacia abajo hasta que esté muy tostado. Sácalo.",
   "En la grasa, sofríe la cebolla, el pimiento y los champiñones 10 minutos y el ajo al final.",
   "Echa el vino (o caldo) y deja que hierva 3 minutos hasta que reduzca.",
   "Añade el tomate, las hierbas y las aceitunas, y vuelve a meter el pollo con la piel hacia arriba, sin cubrirla.",
   "Cuece semitapado a fuego suave 30 minutos, hasta que la carne se separe del hueso y la salsa espese.",
   "Sirve con polenta cremosa o con pan para mojar."],
  "Piel fuera de la salsa: así no se reblandece y aporta sabor tostado.",
  "4 días en nevera; se congela.", sobras=True, congela=True)

r("orecchiette-brocoli", "Pasta con brócoli y salchicha", "italiana", "almuerzo", 25, VITRO,
  ["Pasta y arroz", "Rápido"],
  ["200 g de orecchiette u otra pasta corta", "1 brócoli pequeño", "3 salchichas frescas de cerdo", "2 dientes de ajo", "Guindilla (opcional)", "Parmesano", "Ralladura de limón"],
  ["Cuece los ramilletes de brócoli en el agua de la pasta 4 minutos y sácalos con una espumadera. En esa misma agua, cuece la pasta.",
   "Quita la piel a las salchichas y desmigaja la carne en la sartén con un hilo de aceite; dórala bien a fuego medio-alto.",
   "Añade el ajo laminado y la guindilla 1 minuto, luego el brócoli, y aplástalo un poco con la cuchara para que se haga crema.",
   "Pasa la pasta a la sartén con un cucharón del agua y saltea 1 minuto a fuego fuerte.",
   "Termina con parmesano y ralladura de limón."],
  "El brócoli aplastado hace de salsa: no hace falta nata.",
  "Mejor al momento.")

# ═══════════════════════ ALMUERZOS · mexicana ═══════════════════════

r("tinga-pollo", "Tinga de pollo con tortillas, frijoles y aguacate", "mexicana", "almuerzo", 45, VITRO,
  ["Pollo", "Para dejar hecho"],
  ["2 pechugas o 4 contramuslos de pollo", "1 cebolla grande", "400 g de tomate triturado", "1-2 chiles chipotle en adobo (o 1 cucharadita de pimentón ahumado y una pizca de cayena)",
   "1 cucharadita de orégano", "1 bote de frijoles negros (o alubias rojas)", "1 aguacate", "Tortillas de maíz o trigo", "Lima o limón"],
  ["Cuece el pollo 20 minutos en agua con sal, media cebolla y un ajo. Desmígalo con dos tenedores y guarda el caldo.",
   "Pocha la otra cebolla en juliana 8 minutos, sin dorar del todo.",
   "Tritura el tomate con el chipotle y el orégano, échalo a la sartén y cuece 8 minutos hasta que oscurezca.",
   "Añade el pollo desmigado y un cucharón del caldo; cocina 10 minutos hasta que el pollo se empape y quede jugoso, no aguado.",
   "Calienta los frijoles con un poco de su caldo y aplástalos. Sirve con las tortillas calientes, aguacate y lima."],
  "El pollo cocido en caldo y luego guisado en la salsa queda jugoso; si lo haces a la plancha, se seca.",
  "4 días en nevera; se congela. Las sobras son burritos para la cena.", sobras=True, congela=True)

r("chili-carne", "Chili con carne con arroz", "mexicana", "almuerzo", 70, VITRO,
  ["Legumbres", "Para dejar hecho"],
  ["300 g de carne picada de ternera", "1 bote de alubias rojas", "1 cebolla", "1 pimiento rojo", "2 dientes de ajo", "400 g de tomate triturado",
   "1 cucharadita de comino", "1 cucharadita de pimentón ahumado", "Una pizca de cayena", "1 onza de chocolate negro", "150 g de arroz"],
  ["Dora la carne en una cazuela muy caliente sin removerla al principio, para que se tueste. Sácala.",
   "Pocha la cebolla, el pimiento y el ajo 10 minutos. Añade las especias y tuéstalas 30 segundos.",
   "Vuelve a meter la carne, añade el tomate y un vaso de agua, y cuece 40 minutos a fuego suave.",
   "Añade las alubias lavadas y el chocolate y cuece 10 minutos más: el chocolate redondea, no se nota.",
   "Sirve con arroz blanco y, si hay, yogur o queso rallado."],
  "Especias tostadas en la grasa antes del tomate: el sabor se multiplica.",
  "4 días en nevera; se congela.", sobras=True, congela=True)

r("tacos-pastor", "Tacos de cerdo al pastor con piña a la plancha", "mexicana", "almuerzo", 35, VITRO,
  ["Cerdo", "Rápido"],
  ["400 g de cinta de lomo o presa de cerdo en filetes finos", "2 rodajas de piña natural o en su jugo", "1 cebolla morada", "Cilantro",
   "Tortillas de maíz", "Adobo: 1 cucharada de pimentón, 1 cucharadita de comino, orégano, 1 ajo, zumo de naranja y vinagre"],
  ["Mezcla los ingredientes del adobo y unta la carne. Déjala al menos 20 minutos (mejor desde la noche anterior).",
   "Pica la cebolla morada fina y cúbrela con zumo de lima y sal: en 10 minutos se vuelve rosa y suave.",
   "Marca la piña en una sartén muy caliente hasta que se caramelice. Pícala.",
   "En la misma sartén, a fuego fuerte, haz la carne por tandas, 2 minutos por cara, para que se tueste. Pícala en tiras.",
   "Calienta las tortillas y monta: carne, piña, cebolla encurtida y cilantro."],
  "Sartén por tandas: si la llenas, la carne se cuece en su jugo y no se tuesta.",
  "La carne adobada se congela cruda.", congela=True)

# ═══════════════════════ ALMUERZOS · asiática e india ═══════════════════════

r("pollo-teriyaki", "Pollo teriyaki con arroz y brócoli", "asiática", "almuerzo", 30, VITRO,
  ["Pollo", "Rápido"],
  ["4 contramuslos de pollo deshuesados", "150 g de arroz", "1 brócoli pequeño", "4 cucharadas de salsa de soja", "2 cucharadas de miel o azúcar moreno",
   "1 trozo de jengibre", "1 ajo", "Sésamo"],
  ["Pon el arroz en la arrocera. Mezcla la soja, la miel, el jengibre rallado, el ajo rallado y 2 cucharadas de agua.",
   "Pon los contramuslos con la piel (o el lado liso) hacia abajo en la sartén fría con una gota de aceite, enciende a fuego medio y déjalos 8 minutos: se dora y se hace la grasa.",
   "Dales la vuelta, 4 minutos más. Retira la grasa sobrante con papel.",
   "Vierte la salsa y deja que burbujee 2-3 minutos girando el pollo hasta que la salsa se vuelva un lacado brillante.",
   "Cuece el brócoli al vapor 4 minutos. Corta el pollo en tiras y sirve con arroz, brócoli, la salsa y sésamo."],
  "Contramuslo, no pechuga: aguanta el fuego sin secarse y la salsa se pega mejor.",
  "2 días en nevera.", sobras=True)

r("curry-rojo", "Curry rojo tailandés de pollo con leche de coco", "asiática", "almuerzo", 30, VITRO,
  ["Pollo", "Rápido"],
  ["2 pechugas o 4 contramuslos en tiras", "1 lata de leche de coco (400 ml)", "1-2 cucharadas de pasta de curry rojo", "1 pimiento rojo",
   "1 calabacín o un puñado de judías verdes", "1 cucharada de salsa de pescado o de soja", "1 cucharadita de azúcar", "Lima y albahaca o cilantro", "150 g de arroz"],
  ["Pon el arroz. Abre la lata sin agitarla y saca la parte espesa de arriba.",
   "Calienta esa crema de coco en la sartén hasta que hierva y empiece a soltar aceite; añade la pasta de curry y fríela 2 minutos: así se abre el aroma.",
   "Añade el pollo y saltéalo hasta que pierda el color crudo.",
   "Echa el resto de la leche de coco, la verdura, la salsa de pescado y el azúcar. Cuece 8 minutos, sin que hierva a borbotones.",
   "Prueba: debe estar salado, dulce y picante a la vez; corrige con lima. Sirve con hierbas y arroz."],
  "Freír la pasta de curry en la crema de coco es el gesto que la hace sonar a Tailandia y no a sopa.",
  "3 días en nevera; se congela.", sobras=True, congela=True)

r("arroz-frito", "Arroz frito con cerdo, huevo y verduras", "asiática", "almuerzo", 20, VITRO,
  ["Pasta y arroz", "Rápido", "Aprovechamiento"],
  ["300 g de arroz cocido del día anterior (frío)", "200 g de lomo de cerdo o pollo en dados", "2 huevos", "1 zanahoria", "Un puñado de guisantes",
   "2 cebolletas", "3 cucharadas de salsa de soja", "1 cucharadita de aceite de sésamo"],
  ["Ten todo cortado antes de empezar: esto va muy rápido.",
   "Sartén o wok muy caliente con aceite: dora la carne 3 minutos y sácala.",
   "Bate los huevos y haz un revuelto bien cuajado; sácalo.",
   "Saltea la zanahoria en dados y los guisantes 2 minutos, añade el arroz frío y saltea sin parar 3-4 minutos, hasta que el grano se tueste un poco.",
   "Vuelve a meter carne y huevo, la soja alrededor del borde (no encima) y la cebolleta. 1 minuto más y el aceite de sésamo al final."],
  "Arroz de la víspera, frío y seco: el recién hecho se apelmaza.",
  "2 días en nevera.")

r("cerdo-jengibre", "Cerdo salteado con jengibre y cebolleta", "asiática", "almuerzo", 25, VITRO,
  ["Cerdo", "Rápido"],
  ["400 g de lomo o secreto de cerdo en tiras finas", "1 trozo de jengibre de 4 cm", "1 manojo de cebolletas", "1 pimiento verde",
   "3 cucharadas de salsa de soja", "1 cucharada de vinagre de arroz o de manzana", "1 cucharadita de azúcar", "1 cucharadita de maicena", "150 g de arroz"],
  ["Mezcla la carne con 1 cucharada de soja y la maicena: esa capa la protege y queda tierna.",
   "Mezcla aparte el resto de la soja, el vinagre, el azúcar, el jengibre rallado y 3 cucharadas de agua.",
   "Sartén a fuego máximo con aceite: saltea la carne en una capa, 2 minutos sin tocar, otros 2 removiendo. Sácala.",
   "Saltea el pimiento y la parte blanca de la cebolleta 2 minutos.",
   "Vuelve la carne, echa la salsa y remueve 1 minuto hasta que brille. Termina con lo verde de la cebolleta y sirve con arroz."],
  "La maicena en la carne («velveting») es el truco de restaurante chino para que no quede seca.",
  "2 días en nevera.")

r("dal-lentejas", "Dal de lentejas rojas con arroz basmati", "india", "almuerzo", 35, VITRO,
  ["Legumbres", "Vegetariano", "Barato"],
  ["200 g de lentejas rojas", "1 cebolla", "2 dientes de ajo", "1 trozo de jengibre", "1 tomate", "1 cucharadita de cúrcuma", "1 cucharadita de comino en grano o molido",
   "1 cucharadita de garam masala o curry en polvo", "200 ml de leche de coco (opcional)", "150 g de arroz basmati", "Limón y cilantro"],
  ["Lava las lentejas hasta que el agua salga clara. Cuécelas con 700 ml de agua y la cúrcuma 15 minutos, hasta que se deshagan.",
   "Mientras, pocha la cebolla picada 8 minutos hasta que esté dorada, añade el ajo y el jengibre rallados y el tomate picado, 5 minutos más.",
   "Echa el sofrito a las lentejas con la leche de coco y sal. Cuece 5 minutos más.",
   "El «tadka»: en una sartén pequeña, calienta 2 cucharadas de aceite o mantequilla, echa el comino y el garam masala 20 segundos y vierte ese aceite chisporroteante sobre el dal.",
   "Termina con limón y cilantro y sirve con el basmati."],
  "El tadka al final, especias fritas en grasa caliente, es lo que hace que sepa a la India y no a puré de lentejas.",
  "4 días en nevera; se congela.", sobras=True, congela=True)

r("tikka-masala", "Pollo tikka masala con arroz basmati", "india", "almuerzo", 45, VITRO,
  ["Pollo", "Plato de cocinero"],
  ["2 pechugas de pollo en dados", "1 yogur natural", "2 cucharaditas de garam masala o curry", "1 cucharadita de pimentón", "1 cebolla",
   "2 dientes de ajo", "1 trozo de jengibre", "400 g de tomate triturado", "100 ml de nata", "150 g de arroz basmati"],
  ["Marina el pollo con el yogur, la mitad de las especias, sal y un ajo rallado al menos 30 minutos (o desde la mañana).",
   "Dóralo en la freidora de aire 12 minutos a 200 °C o en sartén muy caliente, que se tueste en los bordes. Reserva.",
   "Pocha la cebolla 10 minutos hasta que esté dorada; añade ajo, jengibre y el resto de las especias 1 minuto.",
   "Echa el tomate y cuece 15 minutos, tritura si la quieres fina y añade la nata.",
   "Mete el pollo en la salsa 5 minutos y sirve con el arroz."],
  "El yogur ablanda el pollo y el tostado en la freidora imita al horno tandoor.",
  "3 días en nevera; se congela.", sobras=True, congela=True)

# ═══════════════════════ ALMUERZOS · Oriente Medio ═══════════════════════

r("shawarma-pollo", "Shawarma de pollo con arroz, ensalada y salsa de yogur", "oriente medio", "almuerzo", 40, HORNO,
  ["Pollo"],
  ["4 contramuslos de pollo deshuesados", "1 cucharadita de comino", "1 cucharadita de pimentón", "Media cucharadita de canela", "Media de cúrcuma",
   "1 limón", "2 dientes de ajo", "1 yogur griego", "1 pepino", "2 tomates", "Media cebolla morada", "150 g de arroz"],
  ["Marina el pollo con las especias, el zumo de medio limón, un ajo rallado, aceite y sal (mínimo 30 minutos).",
   "Hornea a 220 °C 25 minutos, o 15 en la freidora de aire, hasta que tenga los bordes casi quemados.",
   "Salsa: yogur con el otro ajo rallado, un poco de pepino rallado, sal y aceite.",
   "Ensalada: tomate, pepino y cebolla morada en dados pequeños con limón y aceite.",
   "Deja reposar el pollo 5 minutos y córtalo en tiras finas. Sirve con el arroz, la ensalada y la salsa."],
  "La canela es la nota que da sabor a puesto de shawarma; una pizca, no más.",
  "3 días en nevera. Las sobras, en pan de pita, son cena.", sobras=True)

r("kofta-cuscus", "Kofta de carne con cuscús y yogur con menta", "oriente medio", "almuerzo", 35, AIRE,
  ["Rápido"],
  ["400 g de carne picada (cordero o mixta)", "Media cebolla rallada", "Perejil y menta frescos", "1 cucharadita de comino", "1 cucharadita de pimentón",
   "150 g de cuscús", "1 yogur griego", "1 limón", "1 tomate y 1 pepino"],
  ["Mezcla la carne con la cebolla rallada y escurrida, las hierbas picadas, las especias y sal. Amasa bien, aquí sí: así quedan compactas.",
   "Forma salchichas alargadas alrededor de brochetas o a mano, y déjalas 10 minutos en la nevera para que se asienten.",
   "Hazlas en la freidora de aire a 200 °C 10-12 minutos, o en sartén a fuego medio-alto, girándolas.",
   "Cuscús: viértele el mismo volumen de agua hirviendo con sal y aceite, tapa 5 minutos y suéltalo con un tenedor.",
   "Sirve con yogur con menta picada y limón y una ensalada de tomate y pepino."],
  "La cebolla rallada (no picada) mantiene la kofta jugosa sin deshacerla.",
  "Crudas se congelan; hechas, 2 días en nevera.", congela=True)

r("shakshuka", "Shakshuka con pan y queso fresco", "oriente medio", "almuerzo", 30, VITRO,
  ["Vegetariano", "Rápido"],
  ["4 huevos", "1 cebolla", "2 pimientos rojos", "2 dientes de ajo", "400 g de tomate triturado", "1 cucharadita de comino", "1 cucharadita de pimentón",
   "Queso feta o fresco", "Pan"],
  ["Pocha la cebolla y los pimientos en tiras 12 minutos, hasta que estén blandos.",
   "Añade el ajo y las especias 30 segundos, luego el tomate. Cuece 10 minutos hasta que espese.",
   "Haz 4 huecos y casca un huevo en cada uno. Tapa y cocina a fuego suave 8-10 minutos, hasta que la clara y también la yema estén cuajadas (por la lactancia, mejor bien hechas).",
   "Desmigaja el queso por encima y sirve en la sartén, con pan para mojar."],
  "Tapa y fuego suave: el huevo se hace al vapor sin que la salsa se queme.",
  "La salsa se puede dejar hecha y congelar.", congela=True)

# ═══════════════════════ ALMUERZOS · bistró francés ═══════════════════════

r("pollo-mostaza", "Pollo a la mostaza con arroz o patatas", "francesa", "almuerzo", 35, VITRO,
  ["Pollo", "Plato de cocinero"],
  ["4 contramuslos de pollo", "1 chalota", "2 cucharadas de mostaza de Dijon", "1 cucharada de mostaza antigua", "150 ml de nata", "150 ml de caldo de pollo",
   "Tomillo o estragón", "150 g de arroz o 2 patatas"],
  ["Salpimienta el pollo y dóralo bien por ambos lados. Sácalo.",
   "Baja el fuego y pocha la chalota picada 2 minutos en la grasa.",
   "Desglasa con el caldo rascando el fondo, añade las dos mostazas y el tomillo.",
   "Vuelve a meter el pollo y cuece tapado 15 minutos a fuego suave.",
   "Saca el pollo, añade la nata a la salsa y redúcela 3 minutos hasta que napa la cuchara. Sirve con arroz o patatas."],
  "Dos mostazas: la de Dijon da el picor, la antigua da textura y aspecto de bistró.",
  "3 días en nevera.", sobras=True)

r("ternera-borgona", "Ternera guisada a la borgoñona", "francesa", "almuerzo", 150, VITRO,
  ["Plato de cocinero", "Para dejar hecho"],
  ["500 g de morcillo o aguja de ternera en dados grandes", "100 g de bacon en taco", "200 g de champiñones", "10 cebollitas o 1 cebolla", "2 zanahorias",
   "2 dientes de ajo", "1 cucharada de harina", "300 ml de vino tinto", "300 ml de caldo de carne", "Laurel y tomillo"],
  ["Seca bien la carne y dórala por tandas en una cazuela con aceite a fuego fuerte. Sácala.",
   "Dora el bacon en tiras, luego la cebolla y la zanahoria en trozos grandes, y el ajo.",
   "Vuelve la carne, espolvorea la harina y remueve 1 minuto. Vierte el vino y deja que hierva 5 minutos.",
   "Cubre con el caldo, añade las hierbas, tapa y cuece a fuego mínimo 2 horas (o 45 minutos en olla a presión).",
   "En los últimos 15 minutos, añade los champiñones dorados aparte en mantequilla. Sirve con puré o pan."],
  "Cortes baratos con colágeno (morcillo, aguja) en un guiso largo quedan mejor que los caros. El alcohol del vino se va con la cocción.",
  "4 días en nevera; se congela muy bien.", sobras=True, congela=True, meses=OTONO)

r("hachis-parmentier", "Hachis parmentier (pastel de carne con puré gratinado)", "francesa", "almuerzo", 60, HORNO,
  ["Para dejar hecho", "Aprovechamiento"],
  ["350 g de carne picada (o sobras de guiso desmigadas)", "1 cebolla", "1 zanahoria", "1 cucharada de tomate concentrado", "500 g de patatas",
   "30 g de mantequilla", "Leche", "Nuez moscada", "Queso rallado"],
  ["Cuece las patatas peladas en agua con sal 20 minutos y haz un puré con la mantequilla, leche caliente, sal y nuez moscada.",
   "Pocha la cebolla y la zanahoria picadas 10 minutos. Añade la carne y dórala bien.",
   "Añade el tomate concentrado y un vaso de agua o caldo, y deja que se reduzca 10 minutos hasta que quede jugoso.",
   "En una fuente, la carne abajo y el puré encima; marca surcos con un tenedor y espolvorea queso.",
   "Gratina a 220 °C 15-20 minutos, hasta que los surcos estén dorados."],
  "Los surcos del tenedor no son decoración: crean puntas que se doran y crujen.",
  "3 días en nevera; se congela entero.", sobras=True, congela=True)

r("quiche-lorraine", "Quiche lorraine con ensalada verde", "francesa", "almuerzo", 55, HORNO,
  ["Para dejar hecho"],
  ["1 lámina de masa quebrada", "150 g de bacon en taco", "3 huevos", "200 ml de nata", "100 ml de leche", "80 g de queso emmental rallado", "Nuez moscada", "Lechuga"],
  ["Horno a 190 °C. Forra un molde con la masa, pínchala con un tenedor y hornéala 10 minutos con peso encima (garbanzos sobre papel): así la base no queda cruda.",
   "Dora el bacon en tiras en una sartén sin aceite.",
   "Bate los huevos con la nata, la leche, pimienta y nuez moscada (sal poca, el bacon ya sala).",
   "Reparte bacon y queso sobre la base y vierte la mezcla.",
   "Hornea 30-35 minutos, hasta que el centro esté firme al moverlo (bien cuajado). Deja templar 10 minutos y sirve con ensalada."],
  "Cocer la base antes del relleno es la diferencia entre quiche y masa mojada.",
  "3 días en nevera; se congela en porciones.", sobras=True, congela=True)

r("salmon-mostaza-miel", "Salmón al horno con mostaza y miel, y verduras asadas", "francesa", "almuerzo", 30, HORNO,
  ["Pescado", "Rápido"],
  ["2 lomos de salmón", "1 cucharada de mostaza", "1 cucharada de miel", "1 calabacín", "1 pimiento rojo", "1 cebolla morada", "Limón"],
  ["Horno a 200 °C. Verduras en trozos con aceite y sal, 15 minutos.",
   "Mezcla mostaza y miel con unas gotas de limón.",
   "Coloca el salmón sobre las verduras, píntalo con la mezcla y hornea 10-12 minutos: el centro debe quedar jugoso.",
   "Sirve con limón."],
  "El salmón se pasa enseguida: sácalo cuando la lasca se separe pero aún brille en el centro.",
  "2 días en nevera; frío está buenísimo en ensalada.")

# ═══════════════════════ CENAS LIGERAS ═══════════════════════

r("hummus-casero", "Hummus casero con palitos de zanahoria y pepino", "oriente medio", "cena", 10, FRIO,
  ["Ligero", "Picoteo", "Vegetariano"],
  ["1 bote de garbanzos cocidos", "1 cucharada de tahini (o de crema de cacahuete en su defecto)", "1 limón", "1 diente de ajo pequeño",
   "Comino y pimentón", "2 zanahorias", "1 pepino", "Pan de pita o regañás"],
  ["Lava los garbanzos y guarda 3 cucharadas del líquido del bote.",
   "Tritura los garbanzos con el tahini, el zumo de medio limón, el ajo, comino, sal y el líquido del bote, añadiendo un cubito de hielo: queda más fino y claro.",
   "Tritura 2 minutos largos, hasta que esté sedoso.",
   "Sírvelo con un hilo de aceite, pimentón y los palitos de zanahoria y pepino, con pan de pita."],
  "El hielo al triturar hace el hummus esponjoso, como el de los buenos libaneses.",
  "4 días en nevera.", sobras=True)

r("tosta-pimiento-cabra", "Tostas de pimiento asado, queso de cabra y miel", "española", "cena", 15, HORNO,
  ["Ligero", "Rápido"],
  ["Pan de hogaza o barra", "1 bote de pimientos asados (o 2 pimientos rojos asados)", "Rulo de queso de cabra", "Miel", "Tomillo"],
  ["Tuesta el pan.",
   "Pon encima tiras de pimiento asado y una rodaja de queso de cabra.",
   "Gratina 3-4 minutos en el horno o freidora de aire a 200 °C, hasta que el queso se dore.",
   "Termina con un hilo de miel y tomillo."],
  "La miel contra el queso de cabra salado es el equilibrio: no te pases, un hilo.",
  "Al momento.")

r("burritos-frijoles", "Burritos de pollo, arroz y frijoles negros", "mexicana", "cena", 15, VITRO,
  ["Ligero", "Aprovechamiento"],
  ["Tortillas de trigo grandes", "Pollo desmigado o sobras de tinga", "Arroz cocido", "Medio bote de frijoles negros", "Queso rallado", "Lechuga y tomate", "Lima"],
  ["Calienta los frijoles con una pizca de comino y aplástalos un poco.",
   "Calienta las tortillas 20 segundos por lado en sartén seca.",
   "Pon en el centro arroz, frijoles, pollo, queso, lechuga y tomate, y unas gotas de lima.",
   "Dobla los lados hacia dentro y enrolla apretando. Dóralos 1 minuto por cara en la sartén para sellar."],
  "Sellarlos en la sartén con el cierre hacia abajo evita que se abran.",
  "Al momento; rellenos sin verdura se congelan envueltos en film.")

r("quesadillas-champi", "Quesadillas de champiñón y queso", "mexicana", "cena", 15, VITRO,
  ["Ligero", "Vegetariano", "Rápido"],
  ["4 tortillas de trigo", "200 g de champiñones", "Media cebolla", "Queso rallado para fundir", "Pimentón ahumado", "Tomate y cebolla para un pico de gallo rápido"],
  ["Saltea los champiñones laminados con la cebolla a fuego fuerte hasta que estén dorados y secos. Sal y pimentón.",
   "Sobre media tortilla, queso, champiñones y más queso. Dobla.",
   "Dora en sartén seca a fuego medio 2 minutos por cara, aplastando con la espátula.",
   "Corta en triángulos y sirve con un pico de gallo de tomate y cebolla picados con lima."],
  "Queso abajo y arriba del relleno: hace de pegamento.",
  "Al momento.")

r("sandwich-club", "Sándwich club de pollo", "americana", "cena", 15, VITRO,
  ["Ligero"],
  ["6 rebanadas de pan de molde", "1 pechuga de pollo a la plancha (o sobras)", "4 lonchas de bacon", "Lechuga", "1 tomate", "Mayonesa"],
  ["Haz el bacon crujiente en la sartén y la pechuga a la plancha si no tienes sobras; fíletéala fina.",
   "Tuesta el pan.",
   "Monta en dos pisos: pan, mayonesa, lechuga, tomate, pollo; pan, bacon, lechuga; pan.",
   "Pincha con palillos y corta en diagonal."],
  "Mayonesa de bote: la casera lleva huevo crudo, mejor evitarla mientras Rut da el pecho.",
  "Al momento.")

r("tostas-champi-jamon", "Tostas de champiñones al ajillo con jamón", "española", "cena", 15, VITRO,
  ["Ligero", "Rápido"],
  ["Pan de hogaza", "250 g de champiñones", "2 dientes de ajo", "Perejil", "Unas lonchas de jamón serrano"],
  ["Lamina los champiñones y saltéalos a fuego fuerte hasta que se doren.",
   "Añade el ajo laminado y el perejil 1 minuto, sal y pimienta.",
   "Tuesta el pan, frótalo con ajo, pon encima los champiñones y una loncha de jamón."],
  "Sartén muy caliente y en una sola capa: champiñón dorado, no hervido.",
  "Al momento.")

r("tabla-picoteo", "Tabla de picoteo con pan con tomate", "española", "cena", 10, FRIO,
  ["Ligero", "Picoteo"],
  ["Queso curado o semicurado", "Jamón serrano o lomo embuchado", "Aceitunas", "Pan de barra", "2 tomates maduros", "Picos o regañás"],
  ["Ralla los tomates y aliña la pulpa con sal y aceite.",
   "Tuesta el pan y úntalo con el tomate.",
   "Saca el queso y el embutido 15 minutos antes, a temperatura ambiente saben el doble.",
   "Monta la tabla con aceitunas y picos."],
  "Queso y embutido a temperatura ambiente: la grasa se suaviza y se nota todo el sabor.",
  "Lo que sobre, envuelto, vuelve a la nevera.")

r("tortilla-patatas", "Tortilla de patatas bien cuajada", "española", "cena", 40, VITRO,
  ["Ligero", "Vegetariano", "Clásico"],
  ["4 huevos", "3 patatas medianas", "Media cebolla (opcional)", "Aceite de oliva abundante"],
  ["Corta las patatas en láminas finas e irregulares y la cebolla en juliana. Confítalas en abundante aceite a fuego medio-bajo 20 minutos: tienen que quedar tiernas, no fritas.",
   "Escúrrelas muy bien y mézclalas con los huevos batidos y sal. Deja reposar 5 minutos: la patata absorbe el huevo.",
   "Sartén con una cucharada de aceite a fuego medio: echa la mezcla, 4 minutos moviendo la sartén.",
   "Dale la vuelta con un plato y cocina 3-4 minutos más, hasta que esté cuajada por dentro (por la lactancia, mejor sin centro líquido)."],
  "El reposo de la patata en el huevo es lo que la hace jugosa aunque esté bien cuajada.",
  "2 días en nevera; fría, en bocadillo, es otra cena.", sobras=True)

r("ensalada-garbanzos", "Ensalada de garbanzos con atún claro, pimiento y huevo duro", "española", "cena", 15, FRIO,
  ["Ligero", "Legumbres"],
  ["1 bote de garbanzos", "2 latas de atún claro", "2 huevos", "1 pimiento rojo asado o crudo", "Media cebolla morada", "Aceitunas", "Vinagre de Jerez"],
  ["Cuece los huevos 10 minutos y enfríalos en agua.",
   "Lava los garbanzos. Pica la cebolla fina y deja que repose en el vinagre 5 minutos: pierde el picor.",
   "Mezcla garbanzos, pimiento en tiras, atún escurrido y aceitunas.",
   "Aliña con la cebolla y su vinagre, aceite y sal. Pon encima los huevos en cuartos."],
  "Atún claro de lata, sí; atún rojo, no, durante la lactancia.",
  "2 días en nevera (sin aliñar).")

r("wrap-cesar", "Wraps de pollo César con salsa de yogur", "americana", "cena", 20, AIRE,
  ["Ligero", "Pollo"],
  ["1 pechuga de pollo", "Tortillas de trigo", "Lechuga romana", "Parmesano", "Picatostes o pan tostado", "1 yogur griego", "1 cucharadita de mostaza", "2 anchoas (opcional)", "Limón"],
  ["Haz la pechuga en la freidora de aire a 200 °C 12 minutos con aceite, sal y pimienta. Reposa y corta en tiras.",
   "Salsa: yogur, mostaza, las anchoas machacadas, parmesano rallado, limón y pimienta.",
   "Mezcla la lechuga picada con la salsa.",
   "Rellena las tortillas con lechuga, pollo, picatostes y más parmesano, y enrolla."],
  "Salsa César con yogur en vez de huevo crudo: igual de sabrosa y segura en la lactancia.",
  "Al momento.")

r("croque-monsieur", "Croque monsieur", "francesa", "cena", 20, HORNO,
  ["Ligero"],
  ["4 rebanadas de pan de molde grueso", "4 lonchas de jamón cocido", "Queso emmental rallado", "Para la bechamel rápida: 15 g de mantequilla, 15 g de harina, 200 ml de leche, nuez moscada"],
  ["Bechamel: funde la mantequilla, añade la harina 1 minuto y la leche poco a poco, sin dejar de remover, hasta que espese. Sal y nuez moscada.",
   "Unta las rebanadas con un poco de bechamel, pon jamón y queso y cierra.",
   "Cubre la tapa con más bechamel y queso.",
   "Gratina a 220 °C 8-10 minutos (o freidora de aire 6 minutos) hasta que esté dorado y burbujeante."],
  "La bechamel encima es lo que lo separa de un mixto: crujiente por fuera, cremoso dentro.",
  "Al momento.")

r("falafel-pita", "Pitas de falafel al aire con salsa de yogur", "oriente medio", "cena", 30, AIRE,
  ["Ligero", "Vegetariano"],
  ["1 bote de garbanzos cocidos bien escurridos y secos", "Media cebolla", "1 diente de ajo", "Perejil y cilantro", "1 cucharadita de comino",
   "2 cucharadas de harina", "Pan de pita", "Tomate, pepino, lechuga", "Yogur griego con ajo y limón"],
  ["Tritura los garbanzos, la cebolla, el ajo, las hierbas, el comino y sal a pulsos: debe quedar granulado, no puré.",
   "Añade la harina y forma bolitas aplastadas. Déjalas 15 minutos en la nevera.",
   "Píntalas con aceite y hazlas en la freidora de aire a 200 °C 12 minutos, girando a mitad.",
   "Rellena las pitas calientes con falafel, verdura y salsa de yogur."],
  "Garbanzos muy secos y triturado grueso: así no se deshacen.",
  "Crudos se congelan.", congela=True)

r("crema-calabaza", "Crema de calabaza asada con picatostes", "francesa", "cena", 40, HORNO,
  ["Ligero", "Vegetariano", "De temporada"],
  ["600 g de calabaza", "1 zanahoria", "1 cebolla", "1 patata pequeña", "500 ml de caldo de verduras", "Una pizca de nuez moscada o jengibre", "Pan para picatostes"],
  ["Horno a 200 °C: calabaza, zanahoria y cebolla en trozos con aceite y sal, 30 minutos, hasta que se tuesten los bordes.",
   "Pásalo a una olla con la patata en trozos y el caldo, y cuece 10 minutos.",
   "Tritura muy fino y ajusta la textura con caldo o leche. Nuez moscada o jengibre.",
   "Sirve con picatostes dorados en sartén y un hilo de aceite."],
  "Asar la calabaza antes en vez de hervirla concentra el dulzor: cambia la crema por completo.",
  "4 días en nevera; se congela.", sobras=True, congela=True, meses=OTONO)

r("tostas-salmon", "Tostas de salmón ahumado, queso crema y eneldo", "nórdica", "cena", 10, FRIO,
  ["Ligero", "Pescado", "Rápido"],
  ["Pan de centeno o de molde integral", "100 g de salmón ahumado", "Queso crema", "Eneldo", "Limón", "Pepino"],
  ["Tuesta el pan.",
   "Unta queso crema con eneldo picado y ralladura de limón.",
   "Pon láminas de pepino y encima el salmón. Pimienta y unas gotas de limón."],
  "La ralladura de limón en el queso aligera el conjunto.",
  "Al momento.")

r("baba-ganoush", "Baba ganoush con pan de pita y crudités", "oriente medio", "cena", 40, HORNO,
  ["Ligero", "Vegetariano"],
  ["2 berenjenas", "1 cucharada de tahini", "1 diente de ajo", "1 limón", "Comino", "Pan de pita", "Zanahoria y pepino"],
  ["Pincha las berenjenas y ásalas enteras a 220 °C 35 minutos (o en la freidora de aire 25), hasta que estén arrugadas y blandas. Si tienes fuego de gas, quémalas un poco: sabor ahumado.",
   "Ábrelas, saca la pulpa y escúrrela 5 minutos en un colador.",
   "Machácala con tenedor con el tahini, el ajo rallado, limón, comino y sal.",
   "Sirve con aceite, pimentón y pan de pita tostado."],
  "Escurrir la pulpa evita que quede aguado.",
  "3 días en nevera.", sobras=True)

r("nachos-horno", "Nachos al horno con frijoles, queso y guacamole", "mexicana", "cena", 20, HORNO,
  ["Ligero", "Picoteo"],
  ["1 bolsa de nachos", "Medio bote de frijoles", "Queso rallado", "1 aguacate", "1 tomate", "Cebolla", "Lima", "Jalapeños (opcional)"],
  ["Extiende los nachos en una bandeja y reparte por encima los frijoles y el queso.",
   "Hornea a 200 °C 6-8 minutos, hasta que se funda el queso.",
   "Guacamole: aguacate machacado con lima, sal, tomate y cebolla picados.",
   "Sirve en la bandeja con el guacamole y los jalapeños."],
  "Queso en dos capas (abajo y arriba) para que todos los nachos lleven algo.",
  "Al momento.")


# ═══════════════════════ Lo que cuesta de verdad cada plato ═══════════════════════
# Solo los ingredientes que mueven el precio (para 2), como (búsqueda en el catálogo, cantidad, unidad kg|l|ud).
# El resto (verdura de sofrito, especias) va en una base fija. La función SQL recetario_costes() los cruza con precios.
CLAVES = {
    "secreto-pimienta": [("secreto cerdo", .4, "kg", ["arroz", "hamburguesa", "relleno", "iberico"]), ("nata cocinar", .2, "l"), ("arroz largo", .15, "kg")],
    "solomillo-cerveza": [("cerdo solomillo", .45, "kg"), ("papa", .4, "kg"), ("cerveza tostada", .33, "l")],
    "lentejas-riojana": [("lentejas pardinas", .25, "kg"), ("chorizo", .15, "kg", ["lentejas", "garbanzos", "fabada", "tortilla", "pizza", "croqueta", "pan", "loncha", "pamplona", "bocadillo"]), ("papa", .2, "kg")],
    "risotto-boletus": [("arroz risotto", .16, "kg"), ("champiñon", .2, "kg", ["perro", "gato", "crema", "salsa", "pizza", "croqueta", "salteado de gambas"]), ("grana padano", .04, "kg"), ("mantequilla", .03, "kg", ["palomitas", "masa", "helado", "rosquilla", "galleta", "cacahuete", "pan", "croissant", "hojaldre", "pasta", "caracola", "canela", "napolitana", "sobao", "magdalena", "bizcocho"])],
    "filete-ternera-padron": [("novillo filete", .4, "kg"), ("pimiento padron", .15, "kg"), ("papa", .4, "kg")],
    "garbanzos-espinacas": [("garbanzos cocidos", .4, "kg"), ("espinacas", .3, "kg")],
    "pollo-ajillo": [("contramuslo pollo", .6, "kg"), ("papa", .4, "kg")],
    "albondigas-almendras": [("picada vacuno cerdo", .4, "kg"), ("almendra", .03, "kg", ["bebida", "leche", "chocolate", "turron", "crema", "galleta", "yogur", "gel", "bano", "champu", "jabon", "aceite corporal", "pasta", "harina"]), ("caldo pollo", .4, "l", ["cacito", "avecrem", "pastilla", "granulado", "concentrado"])],
    "arroz-horno": [("arroz redondo", .16, "kg"), ("costilla cerdo", .25, "kg"), ("morcilla", .15, "kg"), ("garbanzos cocidos", .2, "kg")],
    "merluza-verde": [("merluza", .4, "kg", ["palitos", "romana", "rebozad", "empanad", "varitas", "croqueta", "salsa", "hamburguesa", "potito", "nutriben", "suprema", "tarrito", "hero", "verduritas"]), ("papa", .4, "kg")],
    "carrilleras-vino": [("carrillera", .6, "kg", ["pasta", "ravioli", "girasol"]), ("vino tinto", .25, "l", ["vinagre"]), ("papa", .5, "kg")],
    "judias-costilla": [("alubia blanca", .2, "kg"), ("costilla cerdo", .25, "kg")],
    "caballa-horno": [("caballa fresca", .8, "kg"), ("papa", .4, "kg")],
    "arroz-meloso-setas": [("arroz redondo", .16, "kg"), ("contramuslo pollo", .25, "kg"), ("setas", .25, "kg", ["crema", "croqueta", "arroz", "risotto", "pizza", "salsa", "sopa", "tortitas", "pasta", "mezzelune"]), ("caldo pollo", 1, "l", ["cacito", "avecrem", "pastilla", "granulado", "concentrado"])],
    "pisto-huevo": [("calabacin", .3, "kg"), ("berenjena", .3, "kg"), ("tomate triturado", .4, "kg"), ("huevos", 2, "ud", ["codorniz"])],
    "amatriciana": [("espaguetis", .2, "kg"), ("bacon taco", .12, "kg"), ("tomate triturado", .4, "kg")],
    "ragu-bolones": [("picada vacuno cerdo", .4, "kg"), ("tagliatelle", .25, "kg"), ("tomate triturado", .4, "kg"), ("grana padano", .03, "kg")],
    "pasta-ceci": [("garbanzos cocidos", .4, "kg"), ("macarrones", .12, "kg"), ("grana padano", .02, "kg")],
    "pollo-cacciatora": [("contramuslo pollo", .6, "kg"), ("champiñon", .15, "kg", ["perro", "gato", "crema", "salsa", "pizza", "croqueta"]), ("tomate troceado", .4, "kg")],
    "orecchiette-brocoli": [("macarrones", .2, "kg"), ("brocoli", .4, "kg"), ("salchicha cerdo", .2, "kg", ["cocktail", "frankfurt", "viena", "perro", "gato", "lata", "cocida", "ahumada"])],
    "tinga-pollo": [("contramuslo pollo", .5, "kg"), ("tomate triturado", .4, "kg"), ("alubia negra", .4, "kg"), ("aguacate", .2, "kg", ["dados", "guacamole", "salsa", "smoothie", "batido", "mango", "crema", "aceite"]), ("tortillas trigo", .2, "kg", ["maiz"])],
    "chili-carne": [("picada vacuno", .3, "kg"), ("alubia roja", .4, "kg"), ("tomate triturado", .4, "kg"), ("arroz largo", .15, "kg")],
    "tacos-pastor": [("cinta lomo", .4, "kg"), ("piña", .2, "kg", ["refresco", "zumo", "bebida", "nectar", "yogur", "gominola", "sabor", "aquavia", "mango", "leche", "coco"]), ("tortillas maiz", .2, "kg")],
    "pollo-teriyaki": [("contramuslo pollo", .5, "kg"), ("brocoli", .3, "kg"), ("arroz largo", .15, "kg"), ("salsa soja", .06, "l")],
    "curry-rojo": [("pechuga pollo", .4, "kg", ["empanad", "rebozad", "fiambre", "pavo", "loncha", "nugget", "asada", "cocida", "barra"]), ("leche coco", .4, "l", ["gel", "champu", "bebida", "palmolive", "crema", "helado", "yogur", "fruta", "pina"]), ("arroz largo", .15, "kg")],
    "arroz-frito": [("lomo cerdo", .2, "kg"), ("huevos", 2, "ud", ["codorniz"]), ("guisantes", .1, "kg")],
    "cerdo-jengibre": [("lomo cerdo", .4, "kg"), ("cebolla", .2, "kg", ["frita", "crujiente", "polvo", "sopa", "crema", "picada", "ducros"]), ("arroz largo", .15, "kg")],
    "dal-lentejas": [("lenteja roja", .2, "kg", ["pasta", "fusilli", "macarrones", "espaguetis", "espirales", "gluten"]), ("leche coco", .2, "l", ["gel", "champu", "bebida", "palmolive", "crema", "helado", "yogur", "fruta", "pina"]), ("arroz basmati", .15, "kg")],
    "tikka-masala": [("pechuga pollo", .4, "kg", ["empanad", "rebozad", "fiambre", "pavo", "loncha", "nugget", "asada", "cocida", "barra"]), ("yogur natural", .125, "kg", ["liquido", "azucar", "sabor"]), ("nata cocinar", .1, "l"), ("arroz basmati", .15, "kg")],
    "shawarma-pollo": [("contramuslo pollo", .5, "kg"), ("yogur griego", .125, "kg"), ("pepino", .3, "kg"), ("arroz largo", .15, "kg")],
    "kofta-cuscus": [("picada vacuno cerdo", .4, "kg"), ("cous cous", .15, "kg", ["vasitos", "mediterraneo"]), ("yogur griego", .125, "kg")],
    "shakshuka": [("huevos", 4, "ud", ["codorniz"]), ("tomate triturado", .4, "kg"), ("pimiento rojo", .3, "kg"), ("queso fresco", .1, "kg")],
    "pollo-mostaza": [("contramuslo pollo", .6, "kg"), ("nata cocinar", .15, "l"), ("mostaza", .04, "kg")],
    "ternera-borgona": [("morcillo", .5, "kg"), ("bacon taco", .1, "kg"), ("champiñon", .2, "kg", ["perro", "gato", "crema", "salsa", "pizza", "croqueta", "salteado de gambas"]), ("vino tinto", .3, "l", ["vinagre"])],
    "hachis-parmentier": [("picada vacuno cerdo", .35, "kg"), ("papa", .5, "kg"), ("queso rallado", .05, "kg")],
    "quiche-lorraine": [("masa quebrada", .23, "kg"), ("bacon taco", .15, "kg"), ("huevos", 3, "ud", ["codorniz"]), ("nata cocinar", .2, "l"), ("emmental rallado", .08, "kg")],
    "salmon-mostaza-miel": [("salmon lomo", .3, "kg"), ("calabacin", .3, "kg"), ("pimiento rojo", .2, "kg")],
    "hummus-casero": [("garbanzos cocidos", .4, "kg"), ("tahini", .015, "kg"), ("zanahoria", .2, "kg", ["bebida", "zumo", "perro", "salchicha", "crema", "pastel", "mezcla", "tarta"]), ("pan pita", .15, "kg")],
    "tosta-pimiento-cabra": [("pimiento asado", .2, "kg", ["aceitunas", "rellena", "anchoa"]), ("rulo cabra", .1, "kg"), ("pan barra", .25, "kg", ["rebanad", "tostad", "rallado"])],
    "burritos-frijoles": [("tortillas trigo", .2, "kg", ["maiz"]), ("alubia negra", .2, "kg"), ("queso rallado", .06, "kg")],
    "quesadillas-champi": [("tortillas trigo", .2, "kg", ["maiz"]), ("champiñon", .2, "kg", ["perro", "gato", "crema", "salsa", "pizza", "croqueta", "salteado de gambas"]), ("queso rallado", .1, "kg")],
    "sandwich-club": [("pan molde", .2, "kg"), ("pechuga pollo", .2, "kg", ["empanad", "rebozad", "fiambre", "pavo", "loncha", "nugget", "asada", "cocida", "barra"]), ("bacon lonchas", .06, "kg")],
    "tostas-champi-jamon": [("pan hogaza", .25, "kg", ["gluten"]), ("champiñon", .25, "kg", ["perro", "gato", "crema", "salsa", "pizza", "croqueta"]), ("jamon serrano lonchas", .05, "kg")],
    "tabla-picoteo": [("queso semicurado", .12, "kg"), ("jamon serrano lonchas", .08, "kg"), ("aceitunas", .1, "kg"), ("pan barra", .25, "kg", ["rebanad", "tostad", "rallado"])],
    "tortilla-patatas": [("huevos", 4, "ud", ["codorniz"]), ("papa", .5, "kg")],
    "ensalada-garbanzos": [("garbanzos cocidos", .4, "kg"), ("atun claro", .16, "kg"), ("huevos", 2, "ud", ["codorniz"])],
    "wrap-cesar": [("pechuga pollo", .3, "kg", ["empanad", "rebozad", "fiambre", "pavo", "loncha", "nugget", "asada", "cocida", "barra"]), ("tortillas trigo", .2, "kg", ["maiz"]), ("lechuga romana", .3, "kg"), ("yogur griego", .125, "kg")],
    "croque-monsieur": [("pan molde", .2, "kg"), ("jamon cocido", .1, "kg"), ("emmental rallado", .08, "kg")],
    "falafel-pita": [("garbanzos cocidos", .4, "kg"), ("pan pita", .2, "kg"), ("yogur griego", .125, "kg")],
    "crema-calabaza": [("calabaza", .6, "kg"), ("caldo verduras", .5, "l")],
    "tostas-salmon": [("salmon ahumado", .1, "kg"), ("queso crema", .08, "kg", ["calabacin", "knorr", "sopa", "crema de"]), ("pan molde", .15, "kg")],
    "baba-ganoush": [("berenjena", .6, "kg"), ("pan pita", .2, "kg")],
    "nachos-horno": [("nachos", .2, "kg"), ("alubia negra", .2, "kg"), ("queso rallado", .1, "kg"), ("aguacate", .2, "kg", ["dados", "guacamole", "salsa", "smoothie", "batido", "mango", "crema", "aceite"])],
}


def sql():
    q = lambda s: "$r$" + s + "$r$"
    arr = lambda xs: "array[" + ",".join(q(x) for x in xs) + "]::text[]"
    filas = []
    for x in R:
        meses = "array[" + ",".join(map(str, x["meses"])) + "]::smallint[]" if x["meses"] else "null"
        filas.append("(" + ",".join([
            q(x["slug"]), q(x["titulo"]), q(x["cocina"]), q(x["momento"]), "2", str(x["minutos"]), q(x["aparato"]),
            arr(x["etiquetas"]), arr(x["ingredientes"]), arr(x["pasos"]), q(x["truco"]), q(x["conservacion"]),
            "true" if x["sobras"] else "false", "true" if x["congela"] else "false", q(x["coste"]), meses]) + ")")
    return ("-- Datos del recetario (generado por scripts/recetario.py; no editar a mano).\n"
            "insert into public.recetario (slug, titulo, cocina, momento, raciones, minutos, aparato, etiquetas, ingredientes, pasos, truco,\n"
            "  conservacion, sobras, congela, coste, meses) values\n"
            + ",\n".join(filas) +
            "\non conflict (slug) do update set titulo = excluded.titulo, cocina = excluded.cocina, momento = excluded.momento,\n"
            "  raciones = excluded.raciones, minutos = excluded.minutos, aparato = excluded.aparato, etiquetas = excluded.etiquetas,\n"
            "  ingredientes = excluded.ingredientes, pasos = excluded.pasos, truco = excluded.truco, conservacion = excluded.conservacion,\n"
            "  sobras = excluded.sobras, congela = excluded.congela, coste = excluded.coste, meses = excluded.meses;\n")


def sql_claves():
    q = lambda s: "$r$" + s + "$r$"
    def clave(t):
        b, c, u, *x = t
        d = dict(q=b, cant=round(c, 3), u=u)
        if x:
            d["x"] = x[0]
        return d
    filas = ",\n".join(f"({q(slug)}, {q(json.dumps([clave(t) for t in v], ensure_ascii=False))}::jsonb)"
                        for slug, v in CLAVES.items())
    return ("-- Ingredientes que marcan el precio de cada receta (generado por scripts/recetario.py --claves).\n"
            "update public.recetario r set claves = v.claves from (values\n" + filas + "\n) v(slug, claves) where r.slug = v.slug;\n")


if __name__ == "__main__":
    slugs = [x["slug"] for x in R]
    assert len(slugs) == len(set(slugs)), "slug repetido"
    assert set(CLAVES) == set(slugs), f"faltan claves: {set(slugs) - set(CLAVES)}"
    if "--claves" in sys.argv:
        print(sql_claves())
    elif "--json" in sys.argv:
        print(json.dumps(R, ensure_ascii=False))
    else:
        print(sql())
    print(f"-- {len(R)} recetas: {sum(x['momento'] == 'almuerzo' for x in R)} almuerzos, {sum(x['momento'] == 'cena' for x in R)} cenas", file=sys.stderr)

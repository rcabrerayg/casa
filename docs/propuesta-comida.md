# Propuesta: el sistema de comida de Casa, de punta a punta

Estado a 15-nov-2026. Lo que ya existe: catálogo de Mercadona e HiperDino con precios de cada noche, lista compartida,
menú semanal con Claude (plan → candidatos → elección → reajuste al presupuesto), votos «Nos gustó / No repetir» y,
desde este PR, el **recetario** (53 platos con técnica) y la **semana que viene** visible junto a la actual.

El hueco grande es que cada pieza va por su lado. El menú no sabe qué hay en casa, ni qué está de oferta, ni qué
sobró. La lista no vuelve al menú. Las recetas solo se ven dentro de un plato. La propuesta es cerrar ese círculo:

```
  despensa ──► planificar ──► comprar ──► cocinar ──► valorar
     ▲                                       │
     └──────── sobras / congelador ◄─────────┘
```

## 1. Planificar con lo que hay y con lo que está barato (impacto alto)

- **Ofertas primero.** `productos.precio_antes` ya existe. Antes de planear, se saca un top de ofertas de carne,
  pescado y fruta y verdura (por % de bajada y por €/kg frente a su media) y se le da a Claude como «esta semana
  conviene…». Así el filete o el solomillo entran solo cuando toca, sin decirlo a mano (esta semana: solomillo de
  cerdo a 6,95 €/kg y babilla de novillo a 8,75 €/kg).
- **Precio por plato en el recetario.** Un job nocturno, el mismo que refresca precios, calcula `coste_estimado` por
  receta cruzando sus ingredientes con el catálogo. El planificador elige con números y no a ojo, y se gasta menos en
  reajustar el presupuesto, que es la llamada más cara.
- **Temporada real.** Se usa `recetario.meses` y además una lista corta de producto de temporada en Canarias por mes.

## 2. Despensa y congelador (impacto alto)

- Tabla `despensa (household_id, nombre, cantidad, caduca, lugar: nevera|congelador|armario)`.
- Al cocinar un plato con `sobras`/`congela`, la app pregunta: «¿Guardaste ragú para otro día?» con un toque, y se
  apunta en el congelador.
- El planificador recibe la despensa: «hay 2 raciones de ragú congelado y medio paquete de arroz». Gasta menos,
  tira menos y a veces resuelve un día sin cocinar, que con un bebé vale oro.
- Lo que se marca como comprado en la lista entra en la despensa, sin teclear nada.

## 3. Recetario vivo (impacto medio)

- **Pantalla Recetario:** buscar y filtrar por cocina, tiempo, momento o «se congela»; corazón para favoritos (la
  tabla `recetario_favoritos` ya existe); «Ponlo esta semana» para cambiar un plato concreto del menú.
- **Recetas de la casa:** que Rubén pueda guardar su versión de un plato (`household_id` en una tabla
  `recetas_casa`) y que el planificador la prefiera a la global.
- **Cambiar un plato** sin rehacer la semana: «otra idea para el jueves» regenera solo ese plato y su compra.
- **Modo cocina:** paso a paso a pantalla completa, letra grande, pantalla siempre encendida (Wake Lock) y
  temporizadores tocando los tiempos del texto («12-14 minutos»). Con un bebé en brazos, se cocina con una mano.

## 4. Compra más lista (impacto medio)

- **Unificar** lo que se repite entre platos (cebolla de 5 recetas = 1 malla) y redondear a envases reales.
  Hoy lo hace Claude y a veces falla.
- **Partir la compra** en dos visitas si conviene: el fresco de la segunda mitad de la semana, el jueves.
- **Comparar Mercadona e HiperDino** al pasar a la lista: «si compras todo en HiperDino, +1,80 €, una sola parada».
- Lo **no encontrado** en el catálogo (p. ej. boletus secos) queda marcado como «buscar en otra tienda», no
  se pierde.

## 5. Aprender de verdad (impacto medio, barato)

- Los votos de hoy van por título exacto. Mejor guardar también el `recetario` (slug) y la cocina, para aprender
  «les gusta lo indio» y no solo «les gustó el dal».
- **Marcar «lo hicimos»** en cada plato. Es la señal más fiable (lo que se planifica y no se cocina dice mucho) y
  alimenta la despensa (sobras).
- Resumen mensual: platos más repetidos, gasto medio por semana, €/ración.

## 6. Bebé y familia (a medio plazo)

- Lactancia ya está en las reglas. Cuando Darío empiece con sólidos (unos 6 meses, mayo de 2027), habrá
  **«versión bebé»** del plato: aparte antes de salar, textura y alimentos a evitar por edad. Un solo menú para
  los tres.
- **Batch cooking del domingo:** un plan de 2 horas que deja hechas 3-4 bases (legumbre, ragú, crema, arroz) y
  reparte su uso por la semana.

## 7. Coste y robustez del lado de Claude

- Falta `ANTHROPIC_API_KEY`: sin ella solo funcionan las recetas que vienen del recetario. Las de 2 personas ya
  salen sin llamar a Claude.
- **Prompt caching** del `SISTEMA` y del bloque del recetario. Son largos y se repiten en las 3-4 llamadas de cada
  plan.
- Una prueba de humo con el SDK en CI (un plan con 2 recetas y modelo barato) para no descubrir un fallo de esquema
  en producción.

## Orden propuesto

| # | Qué | Por qué primero | Tamaño |
|---|-----|-----------------|--------|
| 1 | Guardar la clave de Claude y probar el plan de punta a punta | Sin ella, nada nuevo se puede comprobar | S |
| 2 | ~~Ofertas y coste por plato en el planificador~~ (hecho, PR #13) | Más sabor por el mismo dinero, menos reajustes | M |
| 3 | Pantalla Recetario, favoritos y cambiar un plato | Usa lo que ya está en la base de datos | M |
| 4 | Despensa y congelador, enlazados a sobras y lista | Cierra el círculo y evita tirar comida | L |
| 5 | Modo cocina | Calidad de vida diaria | S |
| 6 | Aprendizaje por slug y cocina, «lo hicimos» | Mejora sola con el uso | S |
| 7 | Versión bebé y batch del domingo | Cuando toque | M |

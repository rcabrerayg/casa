# Auditoría de uso rápido — Comida (17 nov 2026)

Pensado para padres con un bebé: abren la app 10 segundos, con una mano. Recorrido real en el navegador a 390 px con un hogar de prueba (menú generado por el planificador, 39 cosas en la lista).

## Toques por tarea (antes)

| Tarea | Toques | Qué estorba |
|---|---|---|
| Ver qué toca hoy | 0 (Ahora) | Bien. Pero «ver receta» en la tarjeta lleva al menú arriba del todo (lunes), no a la receta. |
| Ver la receta de hoy | 4 + scroll | Ahora → Comida (abre en el lunes) → bajar hasta hoy → abrir plato → «Ver cómo se hace». |
| Confirmar que comimos | 4 | Tarjeta → «Sí, lo comimos» → voto o «Ahora no» → «No, nada» (sobras). Además sale de una en una. |
| Cambiar el plato de hoy | 5 + scroll | Comida → bajar → abrir plato → «Cambiar plato» (al final del detalle, tras ingredientes) → hoja. |
| Apuntar algo a la lista | 3 | Comida → Lista → escribir → elegir. Correcto. |
| Hacer la compra en el súper | 1 por producto | Bien, pero: casilla pequeña (~26 px), aviso largo arriba, «Ver ofertas» y total empujan la lista hacia abajo; comprados hay que vaciarlos a mano. |
| Rehacer la semana | 2 | «Hacer otra semana» al final de una página de 2.300 px. |

## Problemas encontrados

1. **El menú abre en el lunes**, no en hoy. Los días pasados ocupan la primera pantalla.
2. **«¿Comisteis?» cuesta 4 toques** y una hoja; debería ser un toque en la tarjeta.
3. **`compra_vieja` bloquea el menú real**: «A la lista» queda desactivado hasta pulsar «Rehacer la compra». Los menús nuevos ya no lo usan (se ajustan solos), solo queda en menús antiguos.
4. **Tres totales distintos** para lo mismo: menú 70,91 €, lista 84,67 €, tarjeta de Ahora ≈ 93,33 €.
5. **Mucho texto de ayuda** fijo: párrafo de resumen en cursiva + pista + «Cada día, además…» + avisos de dos líneas.
6. **«Cambiar plato» escondido** dentro del detalle del plato.
7. La tarjeta de compra de Ahora no se actualizó tras pasar el menú a la lista hasta recargar (realtime del canal «ahora»).

## Después (PR «uso rápido»)

| Tarea | Antes | Ahora |
|---|---|---|
| Ver la receta de hoy | 4 toques + scroll | 1 (tarjeta de Ahora abre el plato con la receta ya cargada) |
| Confirmar que comimos | 4 | 1 («Sí»); votar es opcional, 1 más. «Sí a las N» si hay varias |
| Cambiar el plato de hoy | 5 + scroll | 2 (Comida → «Cambiar») + 1 idea de las 3 que propone |
| Menú antiguo con «compra vieja» | botón «Rehacer la compra» bloqueando «A la lista» | se pone al día solo |
| Marcar en el súper | casilla de 26 px, sin deshacer | casilla de 30 px en zona de 52 px, «Deshacer» 5 s |

Otros cambios:
- El menú abre en **hoy** («Hoy», «Mañana»); los días pasados se pliegan en «Ver lunes a …».
- Cabecera del menú en una línea (coste de la semana / presupuesto) y fuera los párrafos de ayuda fijos.
- Lista: un solo total con nº de cosas; ofertas al final; lo comprado hace más de 12 h se quita solo (queda en el historial).
- «Antes de comprar: ¿se cocinó?» en la lista con Sí/No en el sitio.
- Comparación entre súper solo si los envases se parecen (antes: «ahorras 52 €» comparando una patata con un saco de 10 kg) y el reparto respeta el producto elegido en ese caso.
- La tarjeta «Compra» de Ahora ya no muestra un total distinto al de la lista; las recargas por realtime se agrupan y no se pisan.
- Ahora avisa si el menú se está preparando o si no hay menú esta semana.

## Queda

- ~~Deshacer una compra no restaba del historial ni de la despensa~~: arreglado con la migración `20261117120000_deshacer_compra` (aplicada y probada).
- **Rehacer la compra** ya solo compra lo que queda de semana (sin lo pasado ni lo comido), con su parte del presupuesto y una segunda vuelta con envases más pequeños si se pasa. En la prueba (martes): menú de 94,18 € → compra rehecha de 85,63 € para 6 días. Sigue por encima del tope (60 € para 6 días) porque los platos ya están decididos; el propio planificador también se pasa (94 € con tope de 70 €).
- Reordenar perecederos si se retrasa la compra (pendiente conocido).

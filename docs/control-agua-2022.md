# Campo · «control AGUA VALLADOLISES.xlsx» (julio-agosto 2022)

Hoja del Drive de Juan Carlos (encontrada por Antonio el 1/11/2026). Es un **parte diario** de las dos fincas, a medio rellenar: del 30/6 al 12/8/2022 tiene datos; el resto de agosto, solo las fechas.

## Cómo está montada
Una fila por día (fecha y día de la semana) y dos bloques:

**Valladolises**
| Columna | Qué se apuntaba |
|---|---|
| CONTADOR NUESTRO (m³) | lectura del contador propio: 1.442.472 (1/7) → 1.444.909 (4/7) → 1.455.725 (28/7) → 1.461.157 (1/8) → 1.465.804 (8/8). |
| CONTADOR CRCC | contador de la Comunidad de Regantes del Campo de Cartagena (lecturas diarias pequeñas: 1.280, 1.224, 1.416, 1.485, 1.508…; «2.404 en este turno»). |
| CUPO Y COMENTARIO | cupo de agua que queda: 37.523 (1/7) → 46.198 «nos dan 11.078 más» (4/7) → 42.111 (2/8) → 37.487 (8/8). |
| RIEGO Y PRO | programa de riego: «P04 3H MAÑANA», «04-2.30-07-1H 08» (programas/sectores 04, 07 y 08 con sus horas). |
| TRABAJO | tareas: fumigación de hierba, veneno de ratas, limpieza de puntas y gomas (goteros), limpieza de la casa y poda… |

**Corvera**
| Columna | Qué se apuntaba |
|---|---|
| CONTADOR AZUL | 1.208.075 (y 126.420 en la columna de al lado, sin título). |
| CONTADOR POZO | sin datos. |
| RIEGO / TAREA | «fumigación piojo-araña-coto» (1-4/7), «quitamos 08 de noche – pantano lleno», «poniendo muro verde». |

Además, notas sueltas de **tiempo** (viento, 33 °C, 39 °C) e **incidencias**.

## Datos útiles que salen
- **Consumo de Valladolises (contador propio):** 5.432 m³ del 28/7 al 1/8 y 4.647 m³ del 1/8 al 8/8 de 2022 (≈ 660 m³/día en agosto).
- **Contador propio frente al de la Comunidad:** 1/8: 5.432 frente a 4.409 m³ («ojo», «casi 1.000 m³ más el nuestro»); 8/8: 4.647 frente a 4.625 m³. Ya entonces se vigilaba la diferencia entre contadores.
- **Cupo:** se llevaba la cuenta de los m³ que quedaban y de las ampliaciones («nos dan 11.078 más»).
- **Coste de un tratamiento:** 14/7/2022, fumigación contra araña, piojo y cotonet con Supreblok, Movento, Indigo y Suporter: **16.131 €** («una parte sin Indigo»). Primer dato real de coste de tratamientos.
- **Incidencias:** rotura del pantano de Valladolises el 31/7/2022, arreglado el 3-4/8; «muro verde» (malla o manta en el muro) del 5 al 10/8; rotura de cuba el 3/7.
- **Personas:** Diego y José Manuel vienen por el abono (1/8); «Antonio pasa por las dos fincas, algo de cotonet, quiere soltar bichos (lucha biológica), Diego no» (10/8); Salah y Pencho en riego y fumigación; cita con «Jesús B» (3/8).
- **Calor:** con 39 °C se alargó el riego (04, 07 y 08, 5 h en total hasta el martes).

## Ojo: posible confusión de contadores de Corvera
En `datos_0002.sql` se cargó 126.420 como «contador azul» y 1.208.075 como «contador blanco» (de otro control de 2022 con columnas blanco/azul/Toño). En esta hoja, la columna «CONTADOR AZUL» tiene **1.208.075** y 126.420 está en la columna de al lado sin título. Las dos lecturas siguen marcadas «pendiente de conciliar»; **preguntar a Juan Carlos** cuál es cuál (pregunta AGU-03 del banco).

## Qué nos dice para Campo
Es el mismo «cuaderno» que Campo quiere sustituir, en una sola pantalla por día: **lecturas de contadores (propio y de la Comunidad), cupo restante, programa de riego, tareas, tratamientos con su coste, incidencias y tiempo**. Ideas:
1. **Parte del día** en la app con esos campos, para apuntar todo de una vez (o por voz con ChatGPT).
2. **Comparar contador propio con el de la Comunidad** y avisar si la diferencia pasa de un umbral.
3. **Cupo de trasvase** de Valladolises: m³ que quedan y ampliaciones (tabla nueva o en `suministros_agua`).
4. **Coste por tratamiento** (el de 16.131 € alimentaría el «árbol en euros» de Cosecha).
5. El tiempo ya lo trae Open-Meteo; se puede guardar el del día junto al parte.

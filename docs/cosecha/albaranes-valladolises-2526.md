# Campo · Control de kilos (albaranes) de Valladolises, campaña 2025/26

Análisis de dos hojas de control de la familia (1/11/2026):
- **1º corte** (pegado en el chat): diciembre de 2025, del 1 al 5. Cabecera: «JUAN CARLOS HERNANDEZ · JUAN HERNANDEZ SAEZ Y OTROS».
- **«VALLADOLISES.--MªTERESA» 2026** (Google Sheets, Hoja1): febrero de 2026, del 2 al 11. Cabecera: «JUAN CARLOS HERNANDEZ».
- **MªTeresa = Maite**, hermana de Juan Carlos y socia en algunas de las fincas (dato de Antonio, 1/11/2026). La hoja «MªTERESA» es, por tanto, la cuenta o la parte de Maite en Valladolises, no un trozo de la finca ni el comprador.

## Qué es cada columna
| Columna | Qué significa |
|---|---|
| Albarán | Nº del albarán de báscula (un camión). Dos numeraciones: 69xxx–77xxx y 113xxx (probablemente dos básculas o almacenes). |
| FECHA | día-mes del corte. |
| CAJA | nº de cajas del camión (510, 594, 636, 702, 804, 900, 912…). |
| BRUTO | peso del camión cargado (kg). |
| TARA (1ª) | peso del camión vacío (kg). |
| TARA (2ª) | peso de las cajas vacías: **2,5 kg por caja** (p. ej. 594 × 2,5 = 1.485). |
| NETO | BRUTO − tara del camión − tara de las cajas = kilos de limón. |
| MED | kilos por caja (NETO / CAJA): **~19–20 kg por caja**. |
| KILOS | kilos que cuentan. Si el albarán trae el peso, es el NETO; si no (filas sin bruto ni tara), se teclean directamente del albarán. |
| «K BUENOS» / «importe» | **euros**: KILOS × **0,60 €/kg** (en el 1º corte la columna se llama «K BUENOS», pero es el importe). |
| Último total a la derecha | importe × **1,12**: el importe más el **12 % de compensación del régimen especial agrario (REAGP)** (interpretación; confirmar con la gestoría). |

## Totales
| | 1º corte (dic 2025) | Hoja de Maite (feb 2026) | Suma |
|---|---|---|---|
| Albaranes (camiones) | 24 | 31 | 55 |
| Kilos | 291.433 | 361.174 | **652.607** |
| Importe a 0,60 €/kg | 174.857,50 € | 216.704,40 € | 391.561,90 € |
| Con el 12 % | 195.840,40 € | 242.708,93 € | 438.549,33 € |
| Cajas (solo albaranes con peso) | 13.803 | — | |

## Lo que cuadra
- **652.607 kg es (casi) exactamente el «buenos» de Valladolises** del documento de la familia: **652.582 kg**. La diferencia, **25 kg**, es justo la del albarán **113121** (ver abajo). Así que el «buenos» de Valladolises = estas dos hojas juntas.
- El destrío del documento (108.003 kg) y el descuadre de 940 kg quedan fuera de estas hojas.

## Dudas y errores a revisar
1. **Albarán 113121 (11-2):** 24.480 − 11.160 − 1.485 = **11.835 kg**, pero la hoja pone NETO 11.660 y KILOS 11.635. Revisar con el papel del albarán (¿la tara del camión era 11.660, como la del 113122?).
2. **Precio:** las hojas usan **0,60 €/kg** (coincide con la referencia de la negociación con García Aranda); la liquidación da **0,582 €/kg** de media. Falta saber si 0,60 es precio pactado y 0,582 lo liquidado tras descuentos.
3. **Liquidación frente a hojas:** la liquidación de Valladolises dice 842.025 kg y 487.347,18 € en «tres periodos»; estas hojas suman 652.607 kg. ¿Falta un periodo, o la liquidación incluye el destrío/cítrica?
4. **Reparto entre socios:** ¿la hoja de Maite son los kilos de unas parcelas suyas o su parte del corte de febrero? ¿En qué fincas es socia y con qué porcentaje? ¿El 1º corte es todo de Juan Carlos («Juan Hernández Sáez y otros»)?
5. Filas sin bruto ni tara (albaranes 69xxx–71xxx): ¿de qué báscula son?

## Cómo encaja en Campo
- Es exactamente lo que necesita la futura tabla de **cortes y albaranes** (migración 0006): albarán, fecha, finca/trozo, corte, **titular o cuenta** (Juan Carlos, Maite…), cajas, bruto, tara camión, tara cajas (2,5 kg/caja), neto, kg/caja, kilos, precio, importe y compensación.
- Con eso, los indicadores de Cosecha salen solos: kilos por corte y por día, **kilos por caja** (calibre/peso de la fruta), nº de camiones, precio por corte, reparto por socio y, cuando haya árboles por variedad, kilos por árbol.
- Se pueden importar estas hojas tal cual (cada fila = un albarán).

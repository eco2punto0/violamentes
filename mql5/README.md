# NEXXUS XAU M1 Sniper HFT — v12 "TURBO"

Expert Advisor para **XAUUSD en M1** (`mql5/Experts/NEXXUS_XAU_M1_Sniper_HFT.mq5`).
Evolución de la v11: más volumen inicial, escalado agresivo sobre operaciones claras
y mucha más frecuencia de entradas, con guardas duras para que la agresividad no
destruya la cuenta en la primera racha adversa.

## Instalación

1. Copiar `Experts/NEXXUS_XAU_M1_Sniper_HFT.mq5` a
   `<carpeta de datos MT5>/MQL5/Experts/`.
2. Compilar en MetaEditor (F7).
3. Adjuntar a un gráfico **XAUUSD M1** con trading algorítmico activado.

> El archivo no se ha compilado en este entorno (MetaEditor solo existe en
> Windows/Wine). Compilar antes de operar y revisar la pestaña de errores.

---

## 1. Más volumen inicial

| Parámetro | v11 | v12 | Efecto |
|---|---|---|---|
| `BaseRiskPercent` | 0.5 % | **1.5 %** | El triple de tamaño en la primera entrada |
| `RiskBase` | balance | **equity** | El beneficio flotante ya alimenta el siguiente lote |
| `MinLotsFloor` | — | 0.0 (opcional) | Piso de lote forzado, capado por `MinLotsFloorMaxRisk` |
| `LotsPer1kEquity` | — | 0.50 | Techo dinámico: 10 000 de equity → máx. 5 lotes |
| `HardMaxLot` | 5.0 | 20.0 | Techo duro absoluto |

El lote nunca se acepta a ciegas: pasa por `ApplyPortfolioRiskCap` (riesgo abierto
total), `ApplyMarginSafety` (margen y margen libre) y el techo dinámico por equity.

## 2. Multiplicación rápida en operaciones claras

- **Calidad de señal** (0–3.5 puntos: volumen, distancia de ruptura, distancia a la
  EMA macro y cuerpo de la vela). Alta calidad → `HighQualityRiskMult = 2.0`.
- **Escalado por racha**: `+35 %` de riesgo por victoria consecutiva, hasta 4
  escalones (`≈ +140 %`). Se reinicia con la primera pérdida.
- **De-escalado por pérdida**: el riesgo se divide entre 2 por cada pérdida
  consecutiva; a la 5.ª el EA se pausa hasta el día siguiente.
- **Piramidación**: hasta 2 refuerzos, solo en la misma dirección, solo con señal
  de calidad alta y solo si la última posición ya gana ≥ 0.7 ATR
  (`AddOnRiskFactor = 0.6`). Nunca se promedia a la baja.
- **Techo absoluto**: ninguna combinación de multiplicadores puede superar
  `MaxRiskPercentCap = 6 %` por operación ni `MaxTotalOpenRiskPct = 12 %` abierto.

## 3. Mucha más frecuencia (scalping real)

- **Entradas intrabar**: la v11 evaluaba una vez por vela cerrada; la v12 evalúa en
  cada tick contra el canal de velas cerradas (`AllowIntrabarEntries`).
- **Doble motor**: ruptura Donchian (`DonchianPeriod = 10`) **+** continuación tras
  retroceso a la EMA 21 — dos familias de setups por dirección.
- **Topes de frecuencia**: 150 ops/día, 2 por vela, 8 s de enfriamiento,
  4 posiciones simultáneas. Antidupe por (motor × dirección × vela) para que un
  mismo setup no se dispare tick a tick.
- Sesión ampliada a 07:00–21:00, sin fines de semana y con corte de viernes tarde.

## 4. Gestión de posición

- **Cierre parcial en 1R** (50 %) y el resto se deja correr con trailing por ATR.
- **Breakeven** a 0.6 ATR, **trailing** desde 0.9 ATR a 0.6 ATR de distancia, con
  paso mínimo para no saturar al broker con modificaciones.
- **Stop temporal**: cierra a los 900 s si la operación no alcanzó 0.25R
  (higiene de scalping: el capital no se queda atrapado).
- Todos los stops respetan `SYMBOL_TRADE_STOPS_LEVEL` y `SYMBOL_TRADE_FREEZE_LEVEL`.

## 5. Correcciones sobre la v11

- **Desfase de una vela**: la v11 hacía `CopyRates(..., start_pos = 1, ...)` y luego
  leía `rates[1]`, es decir operaba sobre la vela **anterior** a la última cerrada y
  un canal Donchian desplazado. Corregido a `start_pos = 0`.
- **Cálculo de lote**: usa `SYMBOL_TRADE_TICK_VALUE_LOSS` y, si el lote mínimo
  implica más riesgo del permitido, **no** se abre la operación (la v11 forzaba
  el mínimo aunque rompiera el límite de riesgo).
- **Trailing en USD fijo** sustituido por trailing en ATR (el fijo no se adapta a
  la volatilidad del oro).
- **Riesgo abierto agregado**: la v11 podía tener varias posiciones sin medir el
  riesgo conjunto; ahora se mide y recorta el lote.
- Comprobaciones de terminal/cuenta, reintento único ante requote, normalización
  de lote y precio a `step`/`digits`, y limpieza del registro de posiciones.
- Panel en pantalla con equity, pico, rachas, riesgo abierto y estado.

## 6. Presets

| Perfil | `BaseRiskPercent` | `MaxRiskPercentCap` | `MaxTotalOpenRiskPct` | `MaxTradesDay` | `UsePyramiding` |
|---|---|---|---|---|---|
| Conservador | 0.5 | 2.0 | 4.0 | 40 | false |
| Por defecto | 1.5 | 6.0 | 12.0 | 150 | true |
| Agresivo | 2.5 | 10.0 | 20.0 | 250 | true |

## 7. Advertencia sobre el backtest

Un resultado de 10 000 → 5 276 545 con drawdown del 8 % y Sharpe 128 no es
alcanzable en mercado real: es el patrón típico de interés compuesto sobre un
modelo de ticks del probador (calidad de historial "solo precios de apertura" o
ticks generados), donde el spread real, el slippage y los rechazos no existen.
Antes de operar en real conviene:

1. Backtest con **ticks reales** y spread variable del bróker.
2. Validación **walk-forward** (optimizar en un tramo, verificar en otro posterior).
3. Comisión y swap del bróker configurados.
4. Un mínimo de 4 semanas en **demo en vivo** con el mismo bróker y latencia.

Con `MinSecondsBetweenTrades = 8` y entradas intrabar el EA envía muchas más
órdenes: verificar que el bróker no penalice por scalping ni por ratio de órdenes.

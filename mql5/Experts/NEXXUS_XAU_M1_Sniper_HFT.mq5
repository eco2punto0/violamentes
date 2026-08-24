//+------------------------------------------------------------------+
//|                                NEXXUS_XAU_M1_Sniper_HFT.mq5      |
//|  v12 TURBO                                                       |
//|  + Riesgo base mayor con escalado por racha ganadora             |
//|  + Piramidacion controlada sobre operaciones claras              |
//|  + Entradas intrabar (scalping de alta frecuencia)               |
//|  + Doble motor: Ruptura Donchian + Continuacion en retroceso     |
//|  + Cierre parcial en 1R, BE y trailing por ATR, stop temporal    |
//|  + Guardas: riesgo abierto total, margen, drawdown, racha, dia   |
//+------------------------------------------------------------------+
#property copyright "NEXXUS Algorithmic Framework"
#property version   "12.00"
#property description "XAUUSD M1: scalping HFT adaptativo con riesgo escalable y piramidacion controlada"

#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\AccountInfo.mqh>

enum ENUM_SIGNAL_QUALITY { QUALITY_LOW=0, QUALITY_MEDIUM=1, QUALITY_HIGH=2 };
enum ENUM_RISK_BASE      { RISK_ON_BALANCE=0, RISK_ON_EQUITY=1, RISK_ON_PEAK_EQUITY=2 };
enum ENUM_ENTRY_ENGINE   { ENGINE_BREAKOUT=0, ENGINE_PULLBACK=1, ENGINE_ADDON=2 };

//====================================================================
//  1. RIESGO BASE Y TAMANO INICIAL
//====================================================================
sinput string  _Risk_              = "=== 1. RIESGO BASE / VOLUMEN INICIAL ===";
input double         BaseRiskPercent     = 1.5;               // Riesgo base por operacion (%)
input ENUM_RISK_BASE RiskBase            = RISK_ON_EQUITY;    // Sobre que capital se calcula el riesgo
input double         MinLotsFloor        = 0.0;               // Lote minimo forzado (0 = desactivado)
input double         MinLotsFloorMaxRisk = 3.0;               // El lote forzado nunca supera este riesgo (%)
input double         LotsPer1kEquity     = 0.50;              // Techo dinamico de lotes por cada 1000 de equity
input double         HardMaxLot          = 20.0;              // Techo duro absoluto de lotes

//====================================================================
//  2. ESCALADO (MULTIPLICACION EN OPERACIONES CLARAS)
//====================================================================
sinput string  _Escalation_        = "=== 2. ESCALADO POR RACHA Y CALIDAD ===";
input bool     UseWinStreakScaling = true;   // Aumentar riesgo tras ganancias consecutivas
input double   WinStreakRiskStep   = 0.35;   // +35% de riesgo por victoria consecutiva
input int      MaxWinStreakSteps   = 4;      // Tope de escalones (4 => hasta +140%)
input bool     UseLossDeEscalation = true;   // Reducir riesgo tras perdidas consecutivas
input double   LossRiskCutFactor   = 0.50;   // Factor de recorte por perdida consecutiva
input int      MaxConsecutiveLosses = 5;     // Pausa el EA hasta el dia siguiente

sinput string  _QualityScoring_    = "=== 2b. PUNTAJE DE CALIDAD DE SENAL ===";
input double   HighQualityThreshold   = 1.80;
input double   MediumQualityThreshold = 0.90;
input double   HighQualityRiskMult    = 2.00;
input double   MediumQualityRiskMult  = 1.00;
input double   LowQualityRiskMult     = 0.35;
input bool     TradeLowQuality        = true;   // false = solo opera calidad media/alta

//====================================================================
//  3. GUARDAS DE SUPERVIVENCIA (limitan la agresividad)
//====================================================================
sinput string  _Guards_            = "=== 3. GUARDAS DE SUPERVIVENCIA ===";
input double   MaxRiskPercentCap      = 6.0;    // Techo absoluto de riesgo por operacion (%)
input double   MaxTotalOpenRiskPct    = 12.0;   // Riesgo simultaneo maximo de todas las posiciones (%)
input double   MaxDailyLossPct        = 6.0;    // Perdida diaria maxima (%)
input double   MaxMarginUsagePct      = 35.0;   // Margen maximo por operacion (% del equity)
input double   MinMarginLevelPct      = 250.0;  // Nivel de margen minimo para seguir abriendo
input double   MaxDrawdownThrottlePct = 10.0;   // Drawdown desde pico que activa el freno
input double   ThrottledRiskFactor    = 0.35;   // Factor de riesgo con el freno activo

//====================================================================
//  4. FRECUENCIA (MOTOR DE SCALPING)
//====================================================================
sinput string  _Frequency_         = "=== 4. FRECUENCIA / SCALPING ===";
input int      MaxTradesDay             = 150;  // Tope diario de operaciones
input int      MaxTradesPerBar          = 2;    // Tope por vela M1
input int      MinSecondsBetweenTrades  = 8;    // Enfriamiento entre entradas
input int      MaxConcurrentPositions   = 4;    // Posiciones simultaneas del EA
input bool     AllowIntrabarEntries     = true; // Evaluar en cada tick, no solo al cierre de vela

//====================================================================
//  5. MOTORES DE ENTRADA
//====================================================================
sinput string  _Engines_           = "=== 5. MOTORES DE ENTRADA ===";
input bool     UseBreakoutEngine   = true;   // Ruptura del canal Donchian
input bool     UsePullbackEngine   = true;   // Continuacion tras retroceso a la EMA rapida
input int      DonchianPeriod      = 10;     // Micro-rango
input int      BreakoutBufferPts   = 3;      // Colchon en puntos sobre el borde del canal
input int      VolumeAvgPeriod     = 20;
input double   VolumeMultiplier    = 1.25;   // Volumen minimo vs media
input double   IntrabarVolFactor   = 0.70;   // Exigencia de volumen en la vela en formacion
input double   MaxExhaustionATR    = 2.20;   // Filtro anti-trampa: vela gigante = rechazo
input int      MacroEmaM1          = 200;    // Tendencia macro M1
input int      PullbackEmaPeriod   = 21;     // EMA rapida para el retroceso
input double   PullbackTolATR      = 0.35;   // Cercania exigida a la EMA rapida

sinput string  _HTF_               = "=== 5b. CONFIRMACION MULTI-TIMEFRAME ===";
input bool             UseHigherTFFilter = true;
input ENUM_TIMEFRAMES  HigherTF          = PERIOD_M5;
input int              HigherTF_EMA      = 50;

//====================================================================
//  6. PIRAMIDACION
//====================================================================
sinput string  _Pyramid_           = "=== 6. PIRAMIDACION SOBRE GANADORAS ===";
input bool     UsePyramiding       = true;
input int      MaxAddOns           = 2;      // Refuerzos por secuencia
input double   AddOnTriggerATR     = 0.70;   // Ganancia minima (ATR) de la ultima posicion
input double   AddOnRiskFactor     = 0.60;   // Riesgo del refuerzo vs entrada normal
input bool     AddOnOnlyHighQuality = true;  // Solo reforzar con senal de calidad alta

//====================================================================
//  7. GESTION DE POSICION
//====================================================================
sinput string  _PositionMgmt_      = "=== 7. GESTION DE POSICION ===";
input bool     UseATR_Stops        = true;
input int      ATR_Period          = 14;
input double   ATR_SL_Mult         = 1.0;
input double   ATR_TP_Mult         = 1.8;
input double   StopLossUSD_Fixed   = 2.0;
input double   TakeProfitUSD_Fixed = 3.0;
input bool     UsePartialTP        = true;
input double   PartialAtR          = 1.0;    // Cierre parcial al alcanzar 1R
input double   PartialClosePct     = 50.0;   // Porcentaje a cerrar
input bool     UseBreakeven        = true;
input double   BreakevenTriggerATR = 0.60;
input double   BreakevenOffsetATR  = 0.05;
input bool     UseTrailing         = true;
input double   TrailStartATR       = 0.90;
input double   TrailDistATR        = 0.60;
input int      TrailMinStepPts     = 5;      // Movimiento minimo para modificar el SL
input int      MaxTradeSeconds     = 900;    // Stop temporal (0 = desactivado)
input double   StagnantExitRFrac   = 0.25;   // Se cierra si tras el tiempo va por debajo de 0.25R

//====================================================================
//  8. FILTROS DE MERCADO Y CONTROL
//====================================================================
sinput string  _Filters_           = "=== 8. FILTROS DE MERCADO ===";
input int      MaxSpreadPts        = 30;
input double   MaxSpreadATRRatio   = 0.35;
input bool     UseSessionFilter    = true;
input int      SessionStartHour    = 7;
input int      SessionEndHour      = 21;
input bool     AvoidFridayLate     = true;
input int      FridayStopHour      = 19;
input bool     UseBlackout         = false;
input string   BlackoutStart       = "15:25";
input string   BlackoutEnd         = "15:35";

sinput string  _Control_           = "=== 9. CONTROL ===";
input int      MagicNumber         = 77733;
input int      Slippage            = 20;
input bool     ShowDashboard       = true;
input bool     DebugLog            = false;

//====================================================================
//  ESTADO INTERNO
//====================================================================
CTrade         m_trade;
CSymbolInfo    m_symbol;
CAccountInfo   m_account;
CPositionInfo  m_position;

struct MarketCtx
  {
   datetime bar_time;
   bool     valid;
   double   ema_macro;
   double   ema_fast;
   double   atr;
   double   htf_ema;
   double   htf_close;
   double   ch_high;
   double   ch_low;
   double   vol_thresh;
   double   last_open, last_high, last_low, last_close;
   double   last_volume;
  };

struct PosState
  {
   ulong    ticket;
   bool     is_buy;
   bool     partial_done;
   bool     be_done;
   double   r_dist;
   datetime opened;
  };

MarketCtx   m_ctx;
PosState    m_states[];

int         m_ema_macro_handle  = INVALID_HANDLE;
int         m_ema_fast_handle   = INVALID_HANDLE;
int         m_atr_handle        = INVALID_HANDLE;
int         m_htf_ema_handle    = INVALID_HANDLE;

int         m_current_day       = -1;
int         m_trades_today      = 0;
int         m_trades_this_bar   = 0;
int         m_addon_count       = 0;
int         m_consecutive_losses = 0;
int         m_consecutive_wins   = 0;
bool        m_loss_streak_pause  = false;
bool        m_daily_loss_notified = false;
double      m_day_start_balance = 0.0;
double      m_peak_equity       = 0.0;
datetime    m_last_trade_time   = 0;
datetime    m_engine_bar[6];              // dedup: engine*2 + (is_buy?0:1)

//+------------------------------------------------------------------+
int OnInit()
  {
   if(!m_symbol.Name(_Symbol))  return(INIT_FAILED);
   m_symbol.Refresh();
   m_symbol.RefreshRates();

   m_trade.SetExpertMagicNumber(MagicNumber);
   m_trade.SetTypeFillingBySymbol(_Symbol);
   m_trade.SetDeviationInPoints(Slippage);
   m_trade.SetAsyncMode(false);

   m_ema_macro_handle = iMA(_Symbol, PERIOD_M1, MacroEmaM1, 0, MODE_EMA, PRICE_CLOSE);
   m_ema_fast_handle  = iMA(_Symbol, PERIOD_M1, PullbackEmaPeriod, 0, MODE_EMA, PRICE_CLOSE);
   m_atr_handle       = iATR(_Symbol, PERIOD_M1, ATR_Period);
   m_htf_ema_handle   = iMA(_Symbol, HigherTF, HigherTF_EMA, 0, MODE_EMA, PRICE_CLOSE);

   if(m_ema_macro_handle == INVALID_HANDLE || m_ema_fast_handle == INVALID_HANDLE ||
      m_atr_handle == INVALID_HANDLE       || m_htf_ema_handle == INVALID_HANDLE)
      return(INIT_FAILED);

   if(BaseRiskPercent <= 0.0 || MaxRiskPercentCap <= 0.0)
     {
      Print("NEXXUS: BaseRiskPercent y MaxRiskPercentCap deben ser mayores que cero.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(MaxConcurrentPositions < 1)
     {
      Print("NEXXUS: MaxConcurrentPositions debe ser al menos 1.");
      return(INIT_PARAMETERS_INCORRECT);
     }

   m_day_start_balance = m_account.Balance();
   m_peak_equity       = m_account.Equity();
   m_ctx.valid         = false;
   m_ctx.bar_time      = 0;
   for(int i = 0; i < 6; i++) m_engine_bar[i] = 0;
   ArrayResize(m_states, 0);

   PrintFormat("NEXXUS XAU HFT v12 activo | riesgo base %.2f%% | tope/op %.2f%% | tope abierto %.2f%% | max %d ops/dia",
               BaseRiskPercent, MaxRiskPercentCap, MaxTotalOpenRiskPct, MaxTradesDay);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(m_ema_macro_handle != INVALID_HANDLE) IndicatorRelease(m_ema_macro_handle);
   if(m_ema_fast_handle  != INVALID_HANDLE) IndicatorRelease(m_ema_fast_handle);
   if(m_atr_handle       != INVALID_HANDLE) IndicatorRelease(m_atr_handle);
   if(m_htf_ema_handle   != INVALID_HANDLE) IndicatorRelease(m_htf_ema_handle);
   if(ShowDashboard) Comment("");
  }

//+------------------------------------------------------------------+
//| Contabilidad de rachas sobre operaciones realmente cerradas      |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;
   if((long)HistoryDealGetInteger(trans.deal, DEAL_ENTRY) != DEAL_ENTRY_OUT) return;
   if((long)HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != MagicNumber) return;
   if(HistoryDealGetString(trans.deal, DEAL_SYMBOL) != _Symbol) return;

   double net = HistoryDealGetDouble(trans.deal, DEAL_PROFIT)
              + HistoryDealGetDouble(trans.deal, DEAL_SWAP)
              + HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);

   if(net < 0.0)
     {
      m_consecutive_wins = 0;
      m_consecutive_losses++;
      if(m_consecutive_losses >= MaxConsecutiveLosses)
        {
         m_loss_streak_pause = true;
         PrintFormat("NEXXUS: %d perdidas consecutivas. Pausa hasta el proximo dia.", m_consecutive_losses);
        }
     }
   else if(net > 0.0)
     {
      m_consecutive_losses = 0;
      m_consecutive_wins++;
     }
  }

//+------------------------------------------------------------------+
//| Utilidades de simbolo                                            |
//+------------------------------------------------------------------+
double PointSize()      { return SymbolInfoDouble(_Symbol, SYMBOL_POINT); }
double LotStep()        { double s = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP); return (s > 0.0 ? s : 0.01); }
double LotMin()         { return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN); }
double LotMax()         { return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX); }

double StopsLevelPrice()
  {
   double point = PointSize();
   long   stops = (long)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   long   freeze = (long)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   long   lvl = MathMax(stops, freeze);
   return (double)lvl * point;
  }

double NormalizeLots(double lots)
  {
   double step = LotStep();
   lots = MathFloor(lots / step + 1e-8) * step;
   int    step_digits = (int)MathMax(0.0, MathRound(-MathLog10(step)));
   return NormalizeDouble(lots, step_digits);
  }

//| Valor monetario de 1 unidad de precio por 1 lote                 |
double MoneyPerPriceUnit()
  {
   double tick_size = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double tick_val  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tick_val <= 0.0) tick_val = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   if(tick_size <= 0.0 || tick_val <= 0.0) return 0.0;
   return tick_val / tick_size;
  }

//+------------------------------------------------------------------+
//| Registro de estado por posicion                                  |
//+------------------------------------------------------------------+
int FindState(ulong ticket)
  {
   for(int i = 0; i < ArraySize(m_states); i++)
      if(m_states[i].ticket == ticket) return i;
   return -1;
  }

int EnsureState(ulong ticket, bool is_buy, double r_dist, datetime opened)
  {
   int idx = FindState(ticket);
   if(idx >= 0) return idx;
   int n = ArraySize(m_states);
   ArrayResize(m_states, n + 1);
   m_states[n].ticket       = ticket;
   m_states[n].is_buy       = is_buy;
   m_states[n].partial_done = false;
   m_states[n].be_done      = false;
   m_states[n].r_dist       = r_dist;
   m_states[n].opened       = opened;
   return n;
  }

void PruneStates()
  {
   for(int i = ArraySize(m_states) - 1; i >= 0; i--)
     {
      if(PositionSelectByTicket(m_states[i].ticket)) continue;
      int last = ArraySize(m_states) - 1;
      for(int j = i; j < last; j++) m_states[j] = m_states[j + 1];
      ArrayResize(m_states, last);
     }
  }

//+------------------------------------------------------------------+
//| Inventario de posiciones propias                                 |
//+------------------------------------------------------------------+
int CountMyPositions()
  {
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!m_position.SelectByIndex(i)) continue;
      if(m_position.Symbol() == _Symbol && m_position.Magic() == MagicNumber) count++;
     }
   return count;
  }

//| +1 todas largas, -1 todas cortas, 0 sin posiciones o mixtas      |
int NetDirection()
  {
   int longs = 0, shorts = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!m_position.SelectByIndex(i)) continue;
      if(m_position.Symbol() != _Symbol || m_position.Magic() != MagicNumber) continue;
      if(m_position.PositionType() == POSITION_TYPE_BUY) longs++; else shorts++;
     }
   if(longs > 0 && shorts == 0) return 1;
   if(shorts > 0 && longs == 0) return -1;
   return 0;
  }

//| Ganancia en precio de la posicion propia abierta mas reciente    |
double NewestProfitDistance()
  {
   datetime newest = 0;
   double   dist = 0.0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!m_position.SelectByIndex(i)) continue;
      if(m_position.Symbol() != _Symbol || m_position.Magic() != MagicNumber) continue;
      if(m_position.Time() < newest) continue;
      newest = m_position.Time();
      bool is_buy = (m_position.PositionType() == POSITION_TYPE_BUY);
      double px   = is_buy ? m_symbol.Bid() : m_symbol.Ask();
      dist = is_buy ? (px - m_position.PriceOpen()) : (m_position.PriceOpen() - px);
     }
   return dist;
  }

//| Riesgo abierto agregado en % del equity                          |
double OpenRiskPercent()
  {
   double mppu = MoneyPerPriceUnit();
   double equity = m_account.Equity();
   if(mppu <= 0.0 || equity <= 0.0) return 0.0;

   double risk_money = 0.0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!m_position.SelectByIndex(i)) continue;
      if(m_position.Symbol() != _Symbol || m_position.Magic() != MagicNumber) continue;

      double open = m_position.PriceOpen();
      double sl   = m_position.StopLoss();
      double lots = m_position.Volume();
      bool   is_buy = (m_position.PositionType() == POSITION_TYPE_BUY);

      double dist;
      if(sl <= 0.0)
         dist = (m_ctx.atr > 0.0 ? m_ctx.atr * ATR_SL_Mult : 0.0);   // sin SL: riesgo estimado
      else
         dist = is_buy ? (open - sl) : (sl - open);

      if(dist <= 0.0) continue;   // SL ya en beneficio: no suma riesgo
      risk_money += dist * lots * mppu;
     }
   return risk_money / equity * 100.0;
  }

//+------------------------------------------------------------------+
//| Guardas                                                          |
//+------------------------------------------------------------------+
bool InSession()
  {
   if(!UseSessionFilter) return true;
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(AvoidFridayLate && dt.day_of_week == 5 && dt.hour >= FridayStopHour) return false;
   if(dt.day_of_week == 0 || dt.day_of_week == 6) return false;

   if(SessionStartHour <= SessionEndHour)
      return (dt.hour >= SessionStartHour && dt.hour < SessionEndHour);
   return (dt.hour >= SessionStartHour || dt.hour < SessionEndHour);
  }

bool ParseHHMM(string s, int &h, int &mi)
  {
   string parts[];
   if(StringSplit(s, StringGetCharacter(":", 0), parts) != 2) return false;
   h  = (int)StringToInteger(parts[0]);
   mi = (int)StringToInteger(parts[1]);
   return true;
  }

bool InBlackout()
  {
   if(!UseBlackout) return false;
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   int now_min = dt.hour * 60 + dt.min;

   int sh, sm, eh, em;
   if(!ParseHHMM(BlackoutStart, sh, sm)) return false;
   if(!ParseHHMM(BlackoutEnd,   eh, em)) return false;
   int start_min = sh * 60 + sm;
   int end_min   = eh * 60 + em;

   if(start_min <= end_min) return (now_min >= start_min && now_min <= end_min);
   return (now_min >= start_min || now_min <= end_min);
  }

bool DailyLossExceeded()
  {
   if(m_day_start_balance <= 0.0) return false;
   double loss_pct = (m_day_start_balance - m_account.Equity()) / m_day_start_balance * 100.0;
   if(loss_pct < MaxDailyLossPct) return false;
   if(!m_daily_loss_notified)
     {
      PrintFormat("NEXXUS: perdida diaria %.2f%% >= limite %.2f%%. Pausa hasta manana.", loss_pct, MaxDailyLossPct);
      m_daily_loss_notified = true;
     }
   return true;
  }

bool MarginLevelSafe()
  {
   if(PositionsTotal() == 0) return true;
   double lvl = m_account.MarginLevel();
   if(lvl <= 0.0) return true;
   return lvl >= MinMarginLevelPct;
  }

bool SpreadSafe()
  {
   int spread = (int)m_symbol.Spread();
   if(spread > MaxSpreadPts) return false;
   if(m_ctx.valid && m_ctx.atr > 0.0)
     {
      double spread_price = spread * PointSize();
      if((spread_price / m_ctx.atr) > MaxSpreadATRRatio) return false;
     }
   return true;
  }

bool TerminalReady()
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) return false;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))           return false;
   if(!m_account.TradeAllowed())                    return false;
   if(!m_account.TradeExpert())                     return false;
   if(SymbolInfoInteger(_Symbol, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED) return false;
   return true;
  }

//+------------------------------------------------------------------+
//| Contexto de mercado (se recalcula una vez por vela M1)           |
//+------------------------------------------------------------------+
bool RefreshContext()
  {
   datetime bar_time = iTime(_Symbol, PERIOD_M1, 0);
   if(bar_time <= 0) return false;
   if(m_ctx.valid && bar_time == m_ctx.bar_time) return true;

   double ema_macro[], ema_fast[], atr[];
   ArraySetAsSeries(ema_macro, true);
   ArraySetAsSeries(ema_fast, true);
   ArraySetAsSeries(atr, true);

   if(CopyBuffer(m_ema_macro_handle, 0, 1, 1, ema_macro) <= 0) return false;
   if(CopyBuffer(m_ema_fast_handle,  0, 1, 1, ema_fast)  <= 0) return false;
   if(CopyBuffer(m_atr_handle,       0, 1, 1, atr)       <= 0) return false;
   if(atr[0] <= 0.0) return false;

   int bars_needed = MathMax(DonchianPeriod, VolumeAvgPeriod) + 3;
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   // Desde el indice 0: rates[0] = vela en formacion, rates[1] = ultima vela cerrada.
   if(CopyRates(_Symbol, PERIOD_M1, 0, bars_needed, rates) < bars_needed) return false;

   double highest = -DBL_MAX, lowest = DBL_MAX;
   for(int i = 2; i <= DonchianPeriod + 1; i++)
     {
      if(rates[i].high > highest) highest = rates[i].high;
      if(rates[i].low  < lowest)  lowest  = rates[i].low;
     }
   if(highest <= -DBL_MAX || lowest >= DBL_MAX) return false;

   double avg_volume = 0.0;
   for(int i = 2; i <= VolumeAvgPeriod + 1; i++) avg_volume += (double)rates[i].tick_volume;
   avg_volume /= (double)VolumeAvgPeriod;

   double htf_ema_val = 0.0, htf_close_val = 0.0;
   if(UseHigherTFFilter)
     {
      double htf_ema[];
      ArraySetAsSeries(htf_ema, true);
      if(CopyBuffer(m_htf_ema_handle, 0, 1, 1, htf_ema) <= 0) return false;
      htf_close_val = iClose(_Symbol, HigherTF, 1);
      if(htf_close_val <= 0.0) return false;
      htf_ema_val = htf_ema[0];
     }

   m_ctx.ema_macro   = ema_macro[0];
   m_ctx.ema_fast    = ema_fast[0];
   m_ctx.atr         = atr[0];
   m_ctx.htf_ema     = htf_ema_val;
   m_ctx.htf_close   = htf_close_val;
   m_ctx.ch_high     = highest;
   m_ctx.ch_low      = lowest;
   m_ctx.vol_thresh  = avg_volume * VolumeMultiplier;
   m_ctx.last_open   = rates[1].open;
   m_ctx.last_high   = rates[1].high;
   m_ctx.last_low    = rates[1].low;
   m_ctx.last_close  = rates[1].close;
   m_ctx.last_volume = (double)rates[1].tick_volume;
   m_ctx.bar_time    = bar_time;
   m_ctx.valid       = true;
   m_trades_this_bar = 0;
   return true;
  }

//+------------------------------------------------------------------+
//| Calidad de senal                                                 |
//+------------------------------------------------------------------+
double ComputeSignalScore(bool is_buy, double price, double channel_edge, double volume_used)
  {
   double atr = m_ctx.atr;
   if(atr <= 0.0) return 0.0;

   double vol_ratio  = (m_ctx.vol_thresh > 0.0) ? (volume_used / m_ctx.vol_thresh) : 1.0;
   double vol_score  = MathMax(0.0, MathMin(vol_ratio - 1.0, 1.0));

   double break_dist  = is_buy ? (price - channel_edge) : (channel_edge - price);
   double break_score = MathMax(0.0, MathMin(break_dist / (atr * 0.5), 1.0));

   double trend_dist  = is_buy ? (price - m_ctx.ema_macro) : (m_ctx.ema_macro - price);
   double trend_score = MathMax(0.0, MathMin(trend_dist / atr, 1.0));

   double body = MathAbs(m_ctx.last_close - m_ctx.last_open);
   double range = m_ctx.last_high - m_ctx.last_low;
   double body_score = (range > 0.0) ? MathMax(0.0, MathMin(body / range, 1.0)) : 0.0;

   return vol_score + break_score + trend_score + (body_score * 0.5);
  }

ENUM_SIGNAL_QUALITY EvaluateSignalQuality(double raw_score)
  {
   if(raw_score >= HighQualityThreshold)   return QUALITY_HIGH;
   if(raw_score >= MediumQualityThreshold) return QUALITY_MEDIUM;
   return QUALITY_LOW;
  }

double GetQualityRiskMultiplier(ENUM_SIGNAL_QUALITY tier)
  {
   if(tier == QUALITY_HIGH)   return HighQualityRiskMult;
   if(tier == QUALITY_MEDIUM) return MediumQualityRiskMult;
   return LowQualityRiskMult;
  }

//+------------------------------------------------------------------+
//| Riesgo efectivo: base + calidad + racha - frenos                 |
//+------------------------------------------------------------------+
double AccountValueForRisk()
  {
   double equity = m_account.Equity();
   if(equity > m_peak_equity) m_peak_equity = equity;

   if(RiskBase == RISK_ON_BALANCE)     return m_account.Balance();
   if(RiskBase == RISK_ON_PEAK_EQUITY) return m_peak_equity;
   return equity;
  }

double ActiveRiskPercent(ENUM_SIGNAL_QUALITY tier)
  {
   double risk = BaseRiskPercent * GetQualityRiskMultiplier(tier);

   if(UseWinStreakScaling && m_consecutive_wins > 0)
     {
      int steps = (int)MathMin((double)m_consecutive_wins, (double)MaxWinStreakSteps);
      risk *= (1.0 + WinStreakRiskStep * steps);
     }

   if(UseLossDeEscalation && m_consecutive_losses > 0)
      risk *= MathPow(LossRiskCutFactor, (double)m_consecutive_losses);

   double equity = m_account.Equity();
   if(equity > m_peak_equity) m_peak_equity = equity;
   if(m_peak_equity > 0.0)
     {
      double dd_pct = (m_peak_equity - equity) / m_peak_equity * 100.0;
      if(dd_pct >= MaxDrawdownThrottlePct)
        {
         risk *= ThrottledRiskFactor;
         if(DebugLog) PrintFormat("NEXXUS: freno por drawdown %.2f%% -> riesgo %.3f%%", dd_pct, risk);
        }
     }

   return MathMin(risk, MaxRiskPercentCap);
  }

//+------------------------------------------------------------------+
//| Dimensionamiento                                                 |
//+------------------------------------------------------------------+
double DynamicLotCeiling()
  {
   double cap = HardMaxLot;
   if(LotsPer1kEquity > 0.0)
     {
      double equity_cap = (m_account.Equity() / 1000.0) * LotsPer1kEquity;
      cap = MathMin(cap, equity_cap);
     }
   double max_l = LotMax();
   if(max_l > 0.0) cap = MathMin(cap, max_l);
   return cap;
  }

double CalculateLots(double sl_dist, double risk_percent)
  {
   if(sl_dist <= 0.0 || risk_percent <= 0.0) return 0.0;
   double mppu = MoneyPerPriceUnit();
   if(mppu <= 0.0) return 0.0;

   double account_value = AccountValueForRisk();
   if(account_value <= 0.0) return 0.0;

   double risk_money = account_value * (risk_percent / 100.0);
   double lots = risk_money / (sl_dist * mppu);

   // Piso de lote solicitado, siempre que no rompa el techo de riesgo permitido
   if(MinLotsFloor > 0.0 && lots < MinLotsFloor)
     {
      double floor_risk_pct = (MinLotsFloor * sl_dist * mppu) / account_value * 100.0;
      if(floor_risk_pct <= MinLotsFloorMaxRisk) lots = MinLotsFloor;
     }

   lots = MathMin(lots, DynamicLotCeiling());
   lots = NormalizeLots(lots);

   double min_l = LotMin();
   if(lots < min_l)
     {
      // Solo se permite el lote minimo si su riesgo real cabe en el techo por operacion
      double min_risk_pct = (min_l * sl_dist * mppu) / account_value * 100.0;
      if(min_risk_pct > MaxRiskPercentCap) return 0.0;
      lots = min_l;
     }
   return lots;
  }

double ApplyMarginSafety(double lots, ENUM_ORDER_TYPE order_type, double price)
  {
   double margin_required = 0.0;
   if(!OrderCalcMargin(order_type, _Symbol, lots, price, margin_required)) return lots;
   if(margin_required <= 0.0) return lots;

   double max_allowed = m_account.Equity() * (MaxMarginUsagePct / 100.0);
   double free_margin = m_account.FreeMargin() * 0.90;
   max_allowed = MathMin(max_allowed, free_margin);
   if(margin_required <= max_allowed) return lots;

   double scaled = NormalizeLots(lots * (max_allowed / margin_required));
   if(scaled < LotMin()) return 0.0;
   return scaled;
  }

//| Recorta el lote para no exceder el riesgo abierto total          |
double ApplyPortfolioRiskCap(double lots, double sl_dist)
  {
   double mppu = MoneyPerPriceUnit();
   double equity = m_account.Equity();
   if(mppu <= 0.0 || equity <= 0.0 || sl_dist <= 0.0) return lots;

   double used_pct = OpenRiskPercent();
   double free_pct = MaxTotalOpenRiskPct - used_pct;
   if(free_pct <= 0.0) return 0.0;

   double new_risk_pct = (lots * sl_dist * mppu) / equity * 100.0;
   if(new_risk_pct <= free_pct) return lots;

   double scaled = NormalizeLots(lots * (free_pct / new_risk_pct));
   if(scaled < LotMin()) return 0.0;
   return scaled;
  }

//+------------------------------------------------------------------+
//| Gestion activa de posiciones                                     |
//+------------------------------------------------------------------+
void ManagePositions()
  {
   PruneStates();
   if(CountMyPositions() == 0) { m_addon_count = 0; return; }

   double atr = (m_ctx.valid ? m_ctx.atr : 0.0);
   double point = PointSize();
   double min_stop = StopsLevelPrice();
   int    digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!m_position.SelectByIndex(i)) continue;
      if(m_position.Symbol() != _Symbol || m_position.Magic() != MagicNumber) continue;

      ulong  ticket = m_position.Ticket();
      bool   is_buy = (m_position.PositionType() == POSITION_TYPE_BUY);
      double open   = m_position.PriceOpen();
      double sl     = m_position.StopLoss();
      double tp     = m_position.TakeProfit();
      double lots   = m_position.Volume();
      double price  = is_buy ? m_symbol.Bid() : m_symbol.Ask();
      double profit_dist = is_buy ? (price - open) : (open - price);

      double r_dist = (sl > 0.0) ? MathAbs(open - sl) : (atr > 0.0 ? atr * ATR_SL_Mult : 0.0);
      int idx = EnsureState(ticket, is_buy, r_dist, (datetime)m_position.Time());
      if(m_states[idx].r_dist <= 0.0 && r_dist > 0.0) m_states[idx].r_dist = r_dist;
      double R = m_states[idx].r_dist;

      // --- Cierre parcial en 1R: asegura caja y deja correr el resto
      if(UsePartialTP && !m_states[idx].partial_done && R > 0.0 && profit_dist >= R * PartialAtR)
        {
         double close_lots = NormalizeLots(lots * (PartialClosePct / 100.0));
         double remainder  = NormalizeLots(lots - close_lots);
         if(close_lots >= LotMin() && remainder >= LotMin())
           {
            if(m_trade.PositionClosePartial(ticket, close_lots))
              {
               m_states[idx].partial_done = true;
               if(DebugLog) PrintFormat("NEXXUS: parcial %.2f lotes en 1R (ticket %I64u)", close_lots, ticket);
               continue;   // el resto se gestiona en el siguiente tick
              }
           }
         else
            m_states[idx].partial_done = true;   // volumen indivisible: no reintentar
        }

      // --- Stop temporal para operaciones estancadas
      if(MaxTradeSeconds > 0 && R > 0.0)
        {
         long age = (long)(TimeCurrent() - m_states[idx].opened);
         if(age >= MaxTradeSeconds && profit_dist < R * StagnantExitRFrac)
           {
            if(m_trade.PositionClose(ticket))
              {
               if(DebugLog) PrintFormat("NEXXUS: stop temporal tras %d s (ticket %I64u)", (int)age, ticket);
               continue;
              }
           }
        }

      // --- Breakeven y trailing por ATR
      double new_sl = sl;
      bool   modify = false;

      bool already_be = is_buy ? (sl > 0.0 && sl >= open - point * 0.5)
                               : (sl > 0.0 && sl <= open + point * 0.5);

      if(UseBreakeven && atr > 0.0 && !already_be && profit_dist >= atr * BreakevenTriggerATR)
        {
         double off = atr * BreakevenOffsetATR;
         new_sl = is_buy ? (open + off) : (open - off);
         modify = true;
         m_states[idx].be_done = true;
        }

      if(UseTrailing && atr > 0.0 && profit_dist >= atr * TrailStartATR)
        {
         double trail = is_buy ? (price - atr * TrailDistATR) : (price + atr * TrailDistATR);
         double min_move = TrailMinStepPts * point;
         if(is_buy  && (new_sl <= 0.0 || trail > new_sl + min_move)) { new_sl = trail; modify = true; }
         if(!is_buy && (new_sl <= 0.0 || trail < new_sl - min_move)) { new_sl = trail; modify = true; }
        }

      if(modify)
        {
         // Respeta la distancia minima del broker respecto al precio actual
         if(is_buy  && new_sl > price - min_stop) new_sl = price - min_stop;
         if(!is_buy && new_sl < price + min_stop) new_sl = price + min_stop;
         new_sl = NormalizeDouble(new_sl, digits);

         bool improves = (sl <= 0.0) ||
                         (is_buy  && new_sl > sl + point * 0.5) ||
                         (!is_buy && new_sl < sl - point * 0.5);
         if(improves) m_trade.PositionModify(ticket, new_sl, tp);
        }
     }
  }

//+------------------------------------------------------------------+
//| Deteccion de senales (evaluable en cada tick)                    |
//+------------------------------------------------------------------+
bool VolumeConfirms()
  {
   if(m_ctx.vol_thresh <= 0.0) return true;
   if(m_ctx.last_volume >= m_ctx.vol_thresh) return true;
   double forming = (double)iVolume(_Symbol, PERIOD_M1, 0);
   return (forming >= m_ctx.vol_thresh * IntrabarVolFactor);
  }

bool NoExhaustion()
  {
   if(m_ctx.atr <= 0.0) return false;
   double candle = m_ctx.last_high - m_ctx.last_low;
   return (candle <= m_ctx.atr * MaxExhaustionATR);
  }

bool TrendAllows(bool is_buy)
  {
   bool macro_ok = is_buy ? (m_ctx.last_close > m_ctx.ema_macro) : (m_ctx.last_close < m_ctx.ema_macro);
   if(!macro_ok) return false;
   if(!UseHigherTFFilter) return true;
   return is_buy ? (m_ctx.htf_close > m_ctx.htf_ema) : (m_ctx.htf_close < m_ctx.htf_ema);
  }

int EngineSlot(int engine, bool is_buy) { return engine * 2 + (is_buy ? 0 : 1); }

bool EngineFreeThisBar(int engine, bool is_buy)
  {
   return (m_engine_bar[EngineSlot(engine, is_buy)] != m_ctx.bar_time);
  }

//| Devuelve true si hay senal; rellena direccion, motor y calidad   |
bool EvaluateSignals(bool &is_buy, int &engine, ENUM_SIGNAL_QUALITY &tier, double &score)
  {
   if(!NoExhaustion())  return false;
   if(!VolumeConfirms()) return false;

   double buffer = BreakoutBufferPts * PointSize();
   double ask = m_symbol.Ask();
   double bid = m_symbol.Bid();
   double volume_used = MathMax(m_ctx.last_volume, (double)iVolume(_Symbol, PERIOD_M1, 0));

   // --- Motor 1: ruptura del canal
   if(UseBreakoutEngine)
     {
      if(TrendAllows(true) && ask > m_ctx.ch_high + buffer && EngineFreeThisBar(ENGINE_BREAKOUT, true))
        {
         is_buy = true; engine = ENGINE_BREAKOUT;
         score  = ComputeSignalScore(true, ask, m_ctx.ch_high, volume_used);
         tier   = EvaluateSignalQuality(score);
         return true;
        }
      if(TrendAllows(false) && bid < m_ctx.ch_low - buffer && EngineFreeThisBar(ENGINE_BREAKOUT, false))
        {
         is_buy = false; engine = ENGINE_BREAKOUT;
         score  = ComputeSignalScore(false, bid, m_ctx.ch_low, volume_used);
         tier   = EvaluateSignalQuality(score);
         return true;
        }
     }

   // --- Motor 2: continuacion tras retroceso a la EMA rapida
   if(UsePullbackEngine && m_ctx.atr > 0.0)
     {
      double tol = m_ctx.atr * PullbackTolATR;
      if(TrendAllows(true) && m_ctx.last_low <= m_ctx.ema_fast + tol &&
         m_ctx.last_close > m_ctx.ema_fast && ask > m_ctx.last_high + buffer &&
         EngineFreeThisBar(ENGINE_PULLBACK, true))
        {
         is_buy = true; engine = ENGINE_PULLBACK;
         score  = ComputeSignalScore(true, ask, m_ctx.last_high, volume_used);
         tier   = EvaluateSignalQuality(score);
         return true;
        }
      if(TrendAllows(false) && m_ctx.last_high >= m_ctx.ema_fast - tol &&
         m_ctx.last_close < m_ctx.ema_fast && bid < m_ctx.last_low - buffer &&
         EngineFreeThisBar(ENGINE_PULLBACK, false))
        {
         is_buy = false; engine = ENGINE_PULLBACK;
         score  = ComputeSignalScore(false, bid, m_ctx.last_low, volume_used);
         tier   = EvaluateSignalQuality(score);
         return true;
        }
     }

   return false;
  }

//+------------------------------------------------------------------+
//| Apertura de operacion                                            |
//+------------------------------------------------------------------+
bool OpenTrade(bool is_buy, double risk_percent, ENUM_SIGNAL_QUALITY tier, int engine)
  {
   double atr = m_ctx.atr;
   double sl_dist, tp_dist;
   if(UseATR_Stops && atr > 0.0)
     {
      sl_dist = atr * ATR_SL_Mult;
      tp_dist = atr * ATR_TP_Mult;
     }
   else
     {
      sl_dist = StopLossUSD_Fixed;
      tp_dist = TakeProfitUSD_Fixed;
     }

   double min_stop = StopsLevelPrice();
   if(sl_dist < min_stop * 1.2) sl_dist = min_stop * 1.2;
   if(tp_dist < min_stop * 1.2) tp_dist = min_stop * 1.2;

   double lots = CalculateLots(sl_dist, risk_percent);
   if(lots <= 0.0) return false;

   double entry = is_buy ? m_symbol.Ask() : m_symbol.Bid();
   ENUM_ORDER_TYPE order_type = is_buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;

   lots = ApplyPortfolioRiskCap(lots, sl_dist);
   if(lots <= 0.0) return false;
   lots = ApplyMarginSafety(lots, order_type, entry);
   if(lots <= 0.0) return false;

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double sl = NormalizeDouble(is_buy ? entry - sl_dist : entry + sl_dist, digits);
   double tp = NormalizeDouble(is_buy ? entry + tp_dist : entry - tp_dist, digits);

   string tag = (engine == ENGINE_ADDON ? "ADD" : (engine == ENGINE_PULLBACK ? "PB" : "BRK"));
   string comment = StringFormat("NEXXUS %s %s Q%d", tag, (is_buy ? "L" : "S"), (int)tier);

   bool sent = is_buy ? m_trade.Buy(lots, _Symbol, 0.0, sl, tp, comment)
                      : m_trade.Sell(lots, _Symbol, 0.0, sl, tp, comment);

   if(!sent)
     {
      // Un reintento unico ante requote/precio desactualizado
      uint code = m_trade.ResultRetcode();
      if(code == TRADE_RETCODE_REQUOTE || code == TRADE_RETCODE_PRICE_CHANGED || code == TRADE_RETCODE_PRICE_OFF)
        {
         m_symbol.RefreshRates();
         entry = is_buy ? m_symbol.Ask() : m_symbol.Bid();
         sl = NormalizeDouble(is_buy ? entry - sl_dist : entry + sl_dist, digits);
         tp = NormalizeDouble(is_buy ? entry + tp_dist : entry - tp_dist, digits);
         sent = is_buy ? m_trade.Buy(lots, _Symbol, 0.0, sl, tp, comment)
                       : m_trade.Sell(lots, _Symbol, 0.0, sl, tp, comment);
        }
      if(!sent)
        {
         if(DebugLog) PrintFormat("NEXXUS: envio rechazado (%u) %s", m_trade.ResultRetcode(), m_trade.ResultRetcodeDescription());
         return false;
        }
     }

   m_trades_today++;
   m_trades_this_bar++;
   m_last_trade_time = TimeCurrent();
   m_engine_bar[EngineSlot(engine == ENGINE_ADDON ? ENGINE_BREAKOUT : engine, is_buy)] = m_ctx.bar_time;
   if(engine == ENGINE_ADDON) m_addon_count++;

   if(DebugLog)
      PrintFormat("NEXXUS %s: %.2f lotes | riesgo %.2f%% | Q%d | SL %.2f TP %.2f",
                  comment, lots, risk_percent, (int)tier, sl, tp);
   return true;
  }

//+------------------------------------------------------------------+
//| Ciclo de entradas                                                |
//+------------------------------------------------------------------+
void TryEntries()
  {
   if(m_trades_today >= MaxTradesDay) return;
   if(m_trades_this_bar >= MaxTradesPerBar) return;
   if((long)(TimeCurrent() - m_last_trade_time) < MinSecondsBetweenTrades) return;

   int open_pos = CountMyPositions();
   if(open_pos >= MaxConcurrentPositions) return;

   bool is_buy = false;
   int  engine = ENGINE_BREAKOUT;
   double score = 0.0;
   ENUM_SIGNAL_QUALITY tier = QUALITY_LOW;
   if(!EvaluateSignals(is_buy, engine, tier, score)) return;
   if(tier == QUALITY_LOW && !TradeLowQuality) return;

   double risk_mult = 1.0;

   if(open_pos > 0)
     {
      // Solo se admite sumar en la misma direccion y sobre una posicion ya ganadora
      int dir = NetDirection();
      if(dir == 0) return;
      if((dir > 0) != is_buy) return;
      if(!UsePyramiding) return;
      if(m_addon_count >= MaxAddOns) return;
      if(AddOnOnlyHighQuality && tier != QUALITY_HIGH) return;
      if(m_ctx.atr <= 0.0) return;
      if(NewestProfitDistance() < m_ctx.atr * AddOnTriggerATR) return;
      risk_mult = AddOnRiskFactor;
      engine = ENGINE_ADDON;
     }

   double risk_percent = MathMin(ActiveRiskPercent(tier) * risk_mult, MaxRiskPercentCap);
   if(risk_percent <= 0.0) return;

   OpenTrade(is_buy, risk_percent, tier, engine);
  }

//+------------------------------------------------------------------+
//| Panel                                                            |
//+------------------------------------------------------------------+
void UpdateDashboard()
  {
   if(!ShowDashboard) return;
   string txt = StringFormat(
      "NEXXUS XAU HFT v12\n"
      "Equity: %.2f | Pico: %.2f\n"
      "Ops hoy: %d/%d | En vela: %d/%d | Abiertas: %d\n"
      "Racha: +%d / -%d | Refuerzos: %d/%d\n"
      "Riesgo siguiente (Q alta): %.2f%% | Riesgo abierto: %.2f%%\n"
      "ATR: %.2f | Spread: %d pts | Estado: %s",
      m_account.Equity(), m_peak_equity,
      m_trades_today, MaxTradesDay, m_trades_this_bar, MaxTradesPerBar, CountMyPositions(),
      m_consecutive_wins, m_consecutive_losses, m_addon_count, MaxAddOns,
      ActiveRiskPercent(QUALITY_HIGH), OpenRiskPercent(),
      m_ctx.atr, (int)m_symbol.Spread(),
      (m_loss_streak_pause ? "PAUSA POR RACHA" : (m_daily_loss_notified ? "PAUSA DIARIA" : "OPERATIVO")));
   Comment(txt);
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(dt.day != m_current_day)
     {
      m_current_day         = dt.day;
      m_trades_today        = 0;
      m_addon_count         = 0;
      m_day_start_balance   = m_account.Balance();
      m_daily_loss_notified = false;
      m_consecutive_losses  = 0;
      m_loss_streak_pause   = false;
     }

   if(!m_symbol.RefreshRates()) return;

   bool ctx_ok = RefreshContext();
   ManagePositions();
   if(ShowDashboard) UpdateDashboard();

   if(!ctx_ok) return;
   if(!TerminalReady()) return;
   if(DailyLossExceeded()) return;
   if(m_loss_streak_pause) return;
   if(!MarginLevelSafe()) return;
   if(InBlackout()) return;
   if(!InSession()) return;
   if(!SpreadSafe()) return;

   if(!AllowIntrabarEntries)
     {
      // Modo conservador: una sola evaluacion por vela cerrada
      static datetime last_eval_bar = 0;
      if(last_eval_bar == m_ctx.bar_time) return;
      last_eval_bar = m_ctx.bar_time;
     }

   TryEntries();
  }
//+------------------------------------------------------------------+

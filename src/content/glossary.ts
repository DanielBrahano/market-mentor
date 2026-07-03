/** Structured glossary content. Every term has plain and beginner variants. */

export interface GlossaryTerm {
  id: string;
  term: string;
  short: string;
  /** Full plain-English explanation. */
  explanation: string;
  /** Even simpler wording used when Beginner Mode is on. */
  beginner: string;
  example: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "support",
    term: "Support",
    short: "A price level where a stock has repeatedly stopped falling.",
    explanation: "Support is a price area where buyers have consistently stepped in before, halting declines. Traders watch it because a bounce there suggests demand is still alive, while a break below it suggests sellers have taken control.",
    beginner: "Think of support as a floor. Every time the price fell to this level, people started buying and the price bounced. Floors can break, but they usually take effort.",
    example: "A stock falls to $50 three times over two months and bounces each time — $50 is acting as support.",
  },
  {
    id: "resistance",
    term: "Resistance",
    short: "A price level where a stock has repeatedly stopped rising.",
    explanation: "Resistance is the mirror of support: an area where sellers have repeatedly overwhelmed buyers. Breaking above resistance on strong volume is one of the most watched bullish events.",
    beginner: "Think of resistance as a ceiling. Every time the price climbed to this level, enough people sold that it fell back. Breaking through the ceiling is a big deal.",
    example: "A stock stalls at $80 four times. When it finally closes at $83 on heavy volume, that's a breakout above resistance.",
  },
  {
    id: "breakout",
    term: "Breakout",
    short: "Price pushing decisively through a known ceiling (or floor).",
    explanation: "A breakout happens when price closes beyond a level that previously stopped it, ideally with above-average volume. Volume matters because it shows real commitment; low-volume breakouts often fail (a 'false breakout').",
    beginner: "The stock finally smashed through its ceiling. If lots of shares traded while it happened, more people believe in the move.",
    example: "After bouncing between $45 and $50 for six weeks, a stock closes at $51.20 on double its usual volume.",
  },
  {
    id: "pullback",
    term: "Pullback",
    short: "A small, temporary dip inside a bigger uptrend.",
    explanation: "Pullbacks are normal pauses where some holders take profits. In healthy uptrends they tend to be shallow and find support near rising moving averages. Many traders prefer buying pullbacks over chasing breakouts.",
    beginner: "Even strong stocks take breathers. A pullback is a small dip on the way up — like stairs going up: rise, small step back, rise again.",
    example: "A stock rallies from $100 to $120, drifts back to $112 near its 50-day average, then resumes rising.",
  },
  {
    id: "moving-average",
    term: "Moving Average (MA)",
    short: "The average closing price over the last N days, drawn as a smooth line.",
    explanation: "A moving average smooths daily noise to show the underlying trend. The 50-day tracks the medium-term trend, the 200-day the long-term trend. Price above a rising MA = healthy; crosses above/below widely watched MAs often trigger buying or selling.",
    beginner: "Take the average price of the last 50 days and draw it as a line. If today's price is above that line and the line is rising, the stock has generally been going up.",
    example: "A stock reclaiming its 200-day moving average after months below it often attracts attention as a possible trend change.",
  },
  {
    id: "momentum",
    term: "Momentum",
    short: "How fast and persistently price is moving in one direction.",
    explanation: "Momentum measures the strength behind a move, not just its direction. Indicators like RSI and MACD quantify it. Strong momentum tends to persist short-term, but extremes can also mark exhaustion.",
    beginner: "A ball rolling fast keeps rolling for a while. Momentum tools measure how fast the 'price ball' is rolling and whether it's speeding up or slowing down.",
    example: "A stock making higher highs while RSI also makes higher highs shows momentum confirming the trend.",
  },
  {
    id: "volatility",
    term: "Volatility",
    short: "How much and how wildly a price swings.",
    explanation: "Volatility measures the size of price swings, regardless of direction. High volatility means bigger potential gains and losses. Position sizing and stop placement should account for it — a normal day's wiggle in a volatile stock can stop out a tight trade.",
    beginner: "Some stocks move 1% a day, others move 8%. Volatility is the 'bounciness' of the price. Bouncier = more exciting but riskier.",
    example: "A small biotech that regularly moves ±6% a day is far more volatile than a utility moving ±0.5%.",
  },
  {
    id: "market-cap",
    term: "Market Cap",
    short: "Total value of all a company's shares.",
    explanation: "Market capitalization = share price × shares outstanding. It sizes the company: mega caps (>$200B), large caps (>$10B), small caps ($300M–$2B). Small caps tend to be more volatile and less covered by analysts, which is why scanners often look there for early moves.",
    beginner: "If you bought every single share of the company, market cap is what you'd pay. It tells you if this is a giant like Apple or a small up-and-comer.",
    example: "A $50 stock with 100 million shares outstanding has a $5 billion market cap.",
  },
  {
    id: "pe-ratio",
    term: "P/E Ratio",
    short: "Price divided by yearly earnings per share — what you pay per $1 of profit.",
    explanation: "The price-to-earnings ratio compares price to profit. A P/E of 25 means you pay $25 for each $1 of annual earnings. High P/E can mean expensive OR fast-growing; low P/E can mean cheap OR troubled. Compare within the same industry, and check 'forward P/E' (based on expected future earnings).",
    beginner: "Imagine buying a lemonade stand. If it earns $1,000 a year and costs $15,000, you paid 15× earnings. That's the P/E idea.",
    example: "A software firm at 40× earnings vs a bank at 11× isn't automatically overpriced — software is expected to grow faster.",
  },
  {
    id: "rsi",
    term: "RSI",
    short: "Momentum gauge from 0–100; above 70 = hot, below 30 = washed out.",
    explanation: "The Relative Strength Index compares recent gains to recent losses over 14 periods. Above 70 is traditionally 'overbought' and below 30 'oversold' — but strong trends can stay overbought for weeks. RSI recovering through 50 after a dip is a common momentum-turn signal.",
    beginner: "RSI is a speedometer for recent gains vs losses. Near 70+, the stock has been running hot; near 30, it's been beaten up. The middle (50) is the dividing line between winning and losing streaks.",
    example: "A stock dips, RSI touches 35, then climbs back through 50 as price stabilizes — a classic 'RSI recovery'.",
  },
  {
    id: "macd",
    term: "MACD",
    short: "Trend-momentum indicator built from two moving averages.",
    explanation: "MACD subtracts the 26-day EMA from the 12-day EMA to measure trend momentum, then smooths that with a 9-day 'signal line'. When MACD crosses above the signal line, short-term momentum is beating longer-term momentum — a bullish shift. The histogram shows the gap between the two.",
    beginner: "MACD watches whether the stock's recent average price is pulling ahead of its slower average. When the fast one overtakes the slow one, momentum is shifting up.",
    example: "After a pullback, the MACD line curls up through its signal line while price reclaims the 50-day average — momentum confirming trend.",
  },
  {
    id: "candlestick",
    term: "Candlestick",
    short: "A price bar showing open, high, low and close for a period.",
    explanation: "Each candle shows four prices: the 'body' spans open to close (green if close > open, red if lower), and the thin 'wicks' show the extremes. Candle shapes reveal the battle between buyers and sellers within the period.",
    beginner: "One candle = one day's story. The fat part shows where the day started and ended; the thin lines show how far price stretched in between.",
    example: "A candle with a long lower wick means sellers pushed price down hard but buyers dragged it back up before the close.",
  },
  {
    id: "confirmation",
    term: "Confirmation",
    short: "Waiting for follow-through before trusting a signal.",
    explanation: "One bar or one indicator is weak evidence. Confirmation means waiting for supporting evidence: a second strong close, volume expansion, or another indicator agreeing. It costs a slightly worse entry price but filters out many false signals.",
    beginner: "Don't trust the first green light — wait for the second. If a stock 'breaks out', let it prove itself for a day or two before believing the move.",
    example: "A hammer candle at support is interesting; a strong green candle the next day confirms buyers actually showed up.",
  },
  {
    id: "stop-loss",
    term: "Stop Loss",
    short: "A pre-decided exit price that caps your loss.",
    explanation: "A stop loss is an order (or firm rule) to sell if price falls to a set level, defining your maximum planned loss before you enter. Placing stops below support or below a recent swing low gives the trade room to breathe while still protecting capital.",
    beginner: "Decide the 'this idea was wrong' price before you buy. If the stock hits it, you sell — no debates, no hoping. It's a seatbelt for your money.",
    example: "Buy at $52 with a stop at $48 (below support at $49). Your planned risk is $4 per share, no matter what happens.",
  },
  {
    id: "risk-reward",
    term: "Risk / Reward",
    short: "Potential gain compared to planned loss.",
    explanation: "Risk/reward compares the distance to your target with the distance to your stop. Risking $2 to potentially make $6 is 1:3. Favorable ratios mean you can be wrong more often than right and still come out ahead.",
    beginner: "Only take bets where winning pays much more than losing costs. If you might lose $1 but could make $3, you don't need to be right most of the time.",
    example: "Entry $50, stop $47, target $59: risking $3 to make $9 — a 1:3 risk/reward.",
  },
  {
    id: "relative-volume",
    term: "Relative Volume",
    short: "Today's volume compared to its recent average.",
    explanation: "Relative volume (RVOL) divides current volume by the average of the last ~20 days. RVOL of 2.0 means twice normal trading activity. Price moves on high RVOL reflect real conviction; moves on quiet volume are easier to reverse.",
    beginner: "Is today busy or quiet for this stock? If way more shares than usual are changing hands, something has people's attention.",
    example: "A stock breaking out of a base on 3× normal volume is far more notable than the same move on 0.7×.",
  },
  {
    id: "trend",
    term: "Trend",
    short: "The general direction price has been traveling.",
    explanation: "An uptrend makes higher highs and higher lows; a downtrend the opposite. 'Trade with the trend' exists because trends persist more often than they reverse on any given day. Moving averages help define trend objectively.",
    beginner: "Zoom out. Is the line generally going up, down, or sideways? That's the trend — and fighting it is usually a losing game.",
    example: "A stock above its rising 200-day average, making higher lows for six months, is in an uptrend.",
  },
  {
    id: "reversal",
    term: "Reversal",
    short: "A trend changing direction.",
    explanation: "Reversals mark the end of one trend and the start of another. Reversal patterns (double bottoms, inverse head-and-shoulders) need more confirmation than continuation patterns because calling a top or bottom is genuinely hard — most 'reversals' are just pauses.",
    beginner: "The stock was going down and now it's genuinely turning up (or vice versa). Real reversals are rarer than they look — most dips and pops are just noise.",
    example: "After a 30% decline, a stock builds a double bottom over two months, then breaks above the middle peak — a possible reversal.",
  },
  {
    id: "continuation",
    term: "Continuation",
    short: "A pause that resolves in the same direction as the existing trend.",
    explanation: "Continuation patterns (flags, pennants, tight ranges) are rest stops in a trend. Because they resolve with the trend more often than against it, they're generally higher-probability setups than reversal patterns.",
    beginner: "The stock ran hard, stopped to catch its breath, then kept going the same way. The pause is the pattern.",
    example: "A stock rallies 20%, drifts sideways in a tight flag for two weeks, then breaks out and continues higher.",
  },
];

export function findTerm(id: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.id === id);
}

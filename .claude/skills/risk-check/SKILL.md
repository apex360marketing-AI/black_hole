---
name: risk-check
description: Pre-trade go/no-go gate with position sizing. Use when the user is about to take a trade, asks how many shares to buy, mentions an entry and stop, or asks "should I take this trade". Also use to sanity-check any trade idea against account risk rules.
---

# Risk Check — the pre-trade gate

Account defaults (override if the user says otherwise): equity from the latest state of `trading/journal/trades.csv` plus $300 starting capital; risk per trade **1%**; daily loss limit **3%**; cash account (no leverage, no PDT limit, T+1 settlement).

## Procedure

1. Get entry, stop, and (if offered) target. **No stop = no trade.** Don't compute a size without one; say why.
2. Compute:
   - Risk budget = equity × risk% (with $300 at 1% that is **$3** — say the real number, don't soften it)
   - Risk per share = |entry − stop|
   - Shares by risk = floor(budget ÷ risk per share)
   - Shares by cash = floor(equity ÷ entry) — the binding cap in a cash account
   - Position size = min of the two; dollar risk; position cost
   - If target given: reward:risk ratio. Below 1.5:1, recommend passing.
3. Run the gate — answer GO only if ALL pass, otherwise NO-GO with the failing rule named:
   - [ ] Stop defined and size ≥ 1 share within budget
   - [ ] Today's realized losses (from the CSV) haven't hit the daily loss limit
   - [ ] Reward:risk ≥ 1.5:1 (when a target exists)
   - [ ] Not the 4th+ day trade in 5 business days *if* they've said they're on margin (3 is the max — the 4th flags PDT)
   - [ ] The trade has a named setup (oracle-algo, orb-breakout, …) — "it looks good" is not a setup
4. Reply in this shape, short:

```
GO / NO-GO — <one-line reason>
Size: N shares · risk $X at stop <s> · cost $Y · R:R Z:1
```

## Hard lines

- Never scale the size up beyond the risk budget because the user "feels good about this one."
- If they've taken 2+ losses today, add: "Two strikes — next loss hits your daily limit. Consider being done."
- If the math says 0 shares fit, the answer is NO-GO, not a wider risk tolerance.

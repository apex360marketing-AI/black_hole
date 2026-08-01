---
name: weekly-review
description: Weekly performance review and Oracle Algo signal verification. Use when the user asks to review the week, analyze performance, check whether a signal service or setup is actually profitable, or asks "is Oracle Algo working".
---

# Weekly Review — where the truth lives

Read `trading/journal/trades.csv` and compute everything from real rows. Never soften the numbers.

## 1. Headline stats (all trades, and this week)
- Net P&L, win rate, average win vs average loss
- Expectancy in R (mean of R-multiples over trades that had stops) — this is THE number; a positive expectancy over 30+ trades is the only evidence a system works
- Profit factor, max drawdown on the equity curve, biggest single loss vs planned risk (did any loss blow past 1R? that's a stop-discipline failure, name it)

## 2. By setup — the Oracle Algo verdict
Group by the `setup` column. For each (especially `oracle-algo`):

| setup | trades | win% | expectancy (R) | net P&L |

Then say it plainly:
- **Under 30 trades**: "Not enough data to judge — keep logging, judge nothing yet."
- **30+ trades, negative expectancy**: "This setup is losing money over a real sample. Stop trading it live; if it's a paid service, this table is your refund argument."
- **30+ trades, positive expectancy**: "Working so far — keep size discipline identical; don't reward it with bigger risk yet."

## 3. Discipline audit
- Trades without stops (count them; goal is zero)
- Trades after the daily loss limit was already hit
- Revenge patterns: re-entering a loser within the hour, size creep after losses

## 4. One change
End with exactly ONE concrete change for next week (not five). The best candidate is whatever cost the most money in section 3.

## Framing

The user pays for Unity Academy / Oracle Algo. Your job is neither to trash it nor to cheer it — it's to hold it to the same evidence bar as any setup: logged trades, real expectancy, 30+ samples. That's how they find out if the subscription pays for itself, using their own data.

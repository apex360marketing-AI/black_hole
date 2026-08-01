---
name: trade-journal
description: Log day trades into the CSV journal and answer questions about trading history. Use when the user describes a trade they took ("bought 10 AAPL at 230, sold at 231.50"), asks to log/record a trade, or asks about their past trades, P&L, win rate, or stats.
---

# Trade Journal

The journal lives at `trading/journal/trades.csv` with this exact header:

```
date,symbol,side,qty,entry,exit,stop,fees,day_trade,setup,notes
```

- `date`: ISO `YYYY-MM-DD`
- `side`: `long` or `short`
- `stop`: the PLANNED stop at entry (may be empty, but push back — see below)
- `day_trade`: `yes` if opened and closed the same day, else `no`
- `setup`: the signal source or setup name, lowercase-kebab (e.g. `oracle-algo`, `orb-breakout`, `own-idea`). **Always ask for or infer this** — it is how /weekly-review verifies whether Oracle Algo signals actually make money.
- `notes`: short free text; quote if it contains commas

## Logging a trade

1. Parse the user's description into a row. Compute nothing they didn't say — ask one short question if qty, entry, or exit is missing.
2. If no stop was given, log the trade anyway but tell them: "No stop logged — this trade can't count toward your expectancy stats, and trading without a stop is how small accounts die."
3. Append the row to `trading/journal/trades.csv` (create it with the header if missing).
4. Reply with a one-line confirmation including computed P&L and R-multiple:
   - P&L: long `(exit-entry)*qty - fees`; short `(entry-exit)*qty - fees`
   - R: `P&L / (|entry-stop| * qty)` (only when a stop exists)
5. If this makes 3+ `day_trade=yes` rows within the last 5 business days, warn about the PDT rule (applies to margin accounts under $25K; cash accounts exempt).

## Answering questions

Read the CSV and compute directly (win rate, net P&L, expectancy in R, profit factor, by-setup breakdowns). Never estimate — the file is the source of truth. If the user mentions the dashboard, remind them the dashboard's Export CSV button produces this same format, and imports it back.

## Tone

Be a coach, not a cheerleader. Congratulate discipline (took the stop, followed the plan), not just green P&L. Flag revenge-trading patterns (multiple losses on the same symbol within an hour, sizing up after a loss) whenever the data shows them.

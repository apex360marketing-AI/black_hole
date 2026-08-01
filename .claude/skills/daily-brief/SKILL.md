---
name: daily-brief
description: Pre-market morning briefing. Use when the user asks for a market brief, premarket prep, "what's moving today", a trading plan for the day, or runs this at the start of a trading session.
---

# Daily Brief — pre-market routine

Produce ONE compact briefing, in this order. Use WebSearch for anything time-sensitive; never invent prices or news.

## 1. Yesterday's report card (from `trading/journal/trades.csv`)
- Net P&L, trades taken, rule violations (missing stops, trades after limit)
- One sentence: what to repeat, what to stop

## 2. Today's landscape (WebSearch)
- Major index futures direction (ES/NQ or SPY/QQQ premarket)
- Economic calendar for today (Fed speakers, CPI/PPI/NFP, FOMC — flag the exact times ET; recommend flat through red-flag releases)
- 2–3 notable premarket movers with a one-line "why" each — as *context*, not picks

## 3. The plan
- Max loss today in dollars (3% of current equity from the CSV) and max trade count
- Which setups are valid today (from their playbook / setup tags in the journal)
- If they're waiting on Oracle Algo signals: remind them each signal still passes /risk-check before entry — a signal is an idea, not an order

## Rules for this brief

- **No stock picks.** You research and contextualize; the user's tested setups make the calls. If asked "what should I buy," redirect to their highest-expectancy setup from /weekly-review data.
- Keep the whole brief under ~250 words. It's read in the 20 minutes before the open.
- End with the checklist reminder: "Dashboard open, checklist green, max loss written down."

# The $300 Playbook — read this before the market opens

This is the honest version. It's written to protect your capital while you learn — which means
it refuses to pretend $300 can be day-traded into income in weeks. Everything here is educational, not
financial advice.

---

## 1. The math nobody selling you a course will show you

**$300 at 1% risk per trade = $3 of risk per trade.** That's the professionally-sized bet your
account supports. At a good trader's expectancy (+0.3R average over time), that's about **$1 of
expected profit per trade**. Twenty perfect trades a month ≈ $20. That's the ceiling with real
risk management — and most people's first year has *negative* expectancy while they learn.

The other direction is faster: risk 20% per trade "to grow it quick" and a normal 5-trade losing
streak — which happens to *everyone* — cuts $300 to under $100. Small accounts don't die from bad
picks; they die from oversizing.

**Conclusion: the $300 is tuition, not seed capital.** Its job is to make your learning real, not
to pay bills. Income comes from Section 5 while the trading skill compounds.

## 2. Account rules that bind you at $300

- **PDT rule (margin accounts under $25,000):** max 3 day trades per rolling 5 business days, or
  your broker can freeze the account. The dashboard tracks this.
- **Cash account (recommended at this size):** no PDT limit, but you trade *settled* cash only —
  stocks settle T+1, so money used today is back tomorrow. Practical effect: roughly one full-size
  trade per day. That's not a bug; it's a built-in overtrading governor.
- Fees/spreads matter at this size: a $1 round-trip cost on a $3-risk trade is a 33% tax. Use a
  zero-commission broker and liquid tickers only.

## 3. Unity Academy / Oracle Algo — the evidence protocol

Not a judgment — a test. Any signal service, course, or algo must pass the same bar:

1. **30 paper trades first.** Log every Oracle Algo signal in the journal with `setup=oracle-algo`
   — entry, stop, exit, exactly as signaled. No real money until the sample exists.
2. **Judge by expectancy, not screenshots.** Run `/weekly-review`: 30+ trades and positive
   expectancy in R → trade it small and live. Negative → the subscription is costing you twice.
3. **Red flags to check while you gather the sample:** guaranteed/typical-return claims (the
   surest scam tell), pressure to recruit others (MLM structure), win-rate claims with no
   third-party-verifiable track record, and upsells arriving faster than education. Search
   "<name> + FINRA", "<name> + SEC action", "<name> + refund" — takes ten minutes, worth it.
4. **The subscription is a business expense.** If it costs $50–150/month, it must *earn* that back
   in measured expectancy on your account size. $300 accounts almost never can. If the education
   is genuinely good, the knowledge stays after one month's fee.

## 4. The trading rules (enforced by the dashboard + skills)

1. Every trade has a stop **before** entry. No stop, no trade (`/risk-check` will refuse).
2. Risk 1% per trade. Daily loss limit 3% — hit it and the day is over. No exceptions, especially
   the days you're "sure."
3. Every trade gets journaled — paper and real. The equity curve doesn't lie to you; that's its job.
4. A setup earns live money only after 30+ logged trades with positive expectancy.
5. Reward:risk under 1.5:1 → pass. There is always another trade.
6. Two losses in a day → mandatory 30-minute walk before any third trade.

## 5. Where the fast money actually is — the Apex360 angle

You run a marketing operation. The highest-probability way to turn $300 and AI leverage into
cash-flow in *weeks* is selling services, not trading. The trading account grows in the background.

**Tier 1 — this week, ~$0 cost:**
- **Google Business Profile rescue** for local businesses: claim/optimize the profile, fix
  categories, write the description, set up review responses. 60–90 min of work with AI drafting.
  $150–300 each; ten cold walk-ins or DMs can land one or two.
- **AI-drafted review responses + reputation cleanup** as a $99–199/mo micro-retainer. Sticky,
  recurring, nearly zero marginal time with Claude drafting.
- **One-page website / landing page** for businesses that have none (Claude builds it — the same
  way this dashboard got built): $250–500 flat.

**Tier 2 — this month, spend part of the $300:**
- $50–100 on a domain + portfolio page for Apex360 showing 2–3 before/afters from Tier 1.
- $100–150 testing one narrow ad ("Google Business Profile fixed in 48h — $199") once a Tier-1
  offer has proven it converts organically. Never spend ad money on an unproven offer.
- Keep the remaining ~$100 as the *cash* account's trading float for post-verification live trades.

**The loop:** services generate income → income funds the trading account properly (toward the
$25K that makes day trading rules irrelevant) → the journal proves which setups deserve the money.
Service income scales with effort and is far more predictable; trading income at $300 is not.
Sequence accordingly.

## 6. The daily workflow (the "optimized AI trading setup")

| When | What | Tool |
|---|---|---|
| Pre-market | `/daily-brief` — report card, calendar, movers, max-loss number | Claude skill |
| Pre-market | Green-light all 5 checklist items | Dashboard |
| Before ANY entry | `/risk-check` with entry + stop → GO / NO-GO and size | Claude skill |
| After every trade | Log it (dashboard or `/trade-journal`) | Both |
| Friday | `/weekly-review` — expectancy by setup, Oracle Algo verdict, ONE change | Claude skill |
| Anytime | Export CSV from dashboard → commit to `trading/journal/trades.csv` | Dashboard |

The dashboard (`trading/dashboard/index.html`) runs offline in any browser, phone included, and
keeps data in the browser. Export CSV regularly — it's your backup *and* what the skills analyze.

---

*Nothing here is financial advice. Day trading is high risk; the large majority of retail day
traders lose money. The edge this repo gives you is measurement and discipline — the two things
every losing trader skipped.*

# TradersProp Challenge Types Update

Added dynamic challenge types:
- 1 Phase Challenge
- 2 Phase Challenge
- 3 Phase Challenge
- Instant Funded Account (existing)

Challenge fees are generated from the existing account-size base fees using phase multipliers:
- 1 Phase: 100%
- 2 Phase: 90%
- 3 Phase: 80%

Rules are generated per challenge type and shown automatically for every account size.

1 Phase:
- Target: 10%
- Max daily loss: 5%
- Max total loss: 10%
- Minimum trading days: 5
- Profit split: 80%
- Payout cycle: 14 days
- Leverage: up to 1:100
- News/weekend: allowed

2 Phase:
- Phase 1 target: 8%
- Phase 2 target: 5%
- Max daily loss: 5%
- Max total loss: 10%
- Minimum trading days: 5
- Profit split: 80%
- Payout cycle: 14 days
- Leverage: up to 1:100
- News/weekend: allowed

3 Phase:
- Phase 1 target: 7%
- Phase 2 target: 5%
- Phase 3 target: 4%
- Max daily loss: 5%
- Max total loss: 12%
- Minimum trading days: 5
- Profit split: 80%
- Payout cycle: 14 days
- Leverage: up to 1:100
- News/weekend: allowed

Instant Funded pricing remains the existing 2k/$28, 5k/$48, 10k/$84, 50k/$480, with its existing instant-funding rules.

Important: the browser UI only displays/selects these rules. Production payment, account activation, and trading-risk enforcement must remain server-side.

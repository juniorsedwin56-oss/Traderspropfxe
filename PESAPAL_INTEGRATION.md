# PesaPal Integration

## Challenge and competition payments

All challenge purchases use the secure PesaPal checkout endpoint:
- `POST /v1/payments/pesapal/checkout`

The October Competition requires a **verified PesaPal deposit of at least USD 5** before the competition join action is accepted. The client checkout now lets a trader create that $5 deposit through the same PesaPal gateway used for challenge purchases. The $5 is a deposit requirement, not a separate competition fee, and an existing verified deposit can be reused.

The client checks:
- `GET /v1/payments/pesapal/competition-eligibility?clientId=<client email>`

Expected response when eligible:
```json
{
  "eligible": true,
  "verifiedDeposit": 5.00
}
```

The backend must calculate `verifiedDeposit` from server-side, verified PesaPal transactions. Never trust a browser/localStorage flag as proof of payment.

## Required backend behavior

1. Authenticate the client/session.
2. Identify the client's verified PesaPal payments from the server-side payment ledger.
3. Sum only successfully verified deposits attributable to that client.
4. Return `eligible: true` only when the verified deposit total is at least USD 5.
5. When the client joins, record the competition registration server-side and prevent duplicate registrations.
6. Do not create a second $5 PesaPal order if the client already has a verified deposit of at least $5.
7. For a new competition deposit, accept the client checkout request as a normal PesaPal deposit and attribute the verified transaction to the authenticated client so it contributes to `verifiedDeposit`.

The browser UI stores an eligibility hint for navigation only; the backend must enforce the rule again when provisioning competition access/MT5 credentials.

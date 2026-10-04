# TradersProp — Live PesaPal Deployment

This package is configured for **PesaPal Live** by default.

## Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for the
**Production** environment:

- `PESAPAL_ENVIRONMENT=live`
- `CONSUMER_KEY` = your **live** PesaPal consumer key
- `CONSUMER_SECRET_KEY` = your **live** PesaPal consumer secret
- `PESAPAL_NOTIFICATION_ID` = the IPN/notification ID registered in your **live** PesaPal account
- `PESAPAL_NOTIFICATION_URL=https://YOUR-LIVE-DOMAIN/api/v1/payments/pesapal/ipn`
- `POSTGRES_URL` = your production PostgreSQL connection string

Do not put these secrets in `index.html`, `config.js`, or GitHub.

## Important

The live IPN must be registered in the same PesaPal Live account as the live
consumer key/secret. The notification URL should point to the deployed
production domain.

The browser sends the checkout request to:

`/v1/payments/pesapal/checkout`

The server then authenticates with PesaPal Live, creates the order, and sends
the customer to the returned PesaPal checkout URL.

Payment verification is server-side through the PesaPal transaction-status
endpoint and the IPN endpoint.

## Sandbox

Sandbox is still available only when explicitly set:

`PESAPAL_ENVIRONMENT=sandbox`

For production, leave it set to `live`.

## Deployment

After adding the variables, redeploy the project on Vercel. Test first with a
small real transaction. Do not use sandbox credentials with the live endpoint.

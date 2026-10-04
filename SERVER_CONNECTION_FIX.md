# TradersProp server connection fix

This build fixes the client-side connection logic shown in the Android screenshot.

Changes:
- The client now uses the PesaPal/Daraja backend configured in `config.js`.
- `/health` is no longer incorrectly rewritten to `/api/health`.
- Health testing tries `/health`, `/api/v1/health`, `/api/health`, `/v1/health`, then `/api/v1/status`.
- The connection screen no longer claims that a deployed website origin is automatically the API.
- The client continues to use HTTPS and bearer tokens for authenticated API requests.

Important: the backend deployment itself must expose one of the health endpoints above and allow the deployed TradersProp website origin through CORS. This ZIP cannot create or repair a missing backend deployment.

# Authentication testing on Android / local HTML

If this HTML is opened directly from a file manager, Android Chrome may show a `content://...` URL. In that mode the page has no web origin, so relative `/api/...` requests cannot work.

This build detects `content://` / `file://` and sends authentication requests to `https://tradersprop.com/api/v1/auth/*` instead. The API CORS helper also accepts the `null` origin used by local file pages.

For production, deploy the whole project as one Vercel project. Then authentication automatically becomes same-origin and uses `/api/v1/auth/*` on that deployment.

Required Vercel environment variable:

`POSTGRES_URL`

If `https://tradersprop.com/api/v1/auth/*` is not deployed yet, local testing will still fail until the project is deployed there (or `TRADERSPROP_API_BASE` is changed to the actual API URL).

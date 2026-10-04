TradersProp deployment

This build contains both the website and /api routes. Deploy the entire folder as one Vercel project.
Authentication uses same-origin /api/v1/auth/* routes by default, so no separate auth hostname is required.

Required server environment variable:
- POSTGRES_URL: PostgreSQL connection string

Optional:
- ALLOWED_ORIGINS: comma-separated origins if the frontend is hosted on a different domain.
- TRADERSPROP_API_BASE: only set this in config.js when deliberately using a separate API deployment.

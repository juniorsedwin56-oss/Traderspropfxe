# TradersProp LinkedIn Authentication

LinkedIn sign-in is implemented with LinkedIn OpenID Connect using the `openid profile email` scopes. The existing TradersProp dashboard layout is not changed.

## Vercel environment variables

Set these in the Vercel production environment:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI=https://tradersprop.com/api/v1/auth/linkedin?action=callback`
- `LINKEDIN_SUCCESS_REDIRECT=https://tradersprop.com/#/dashboard`
- `LINKEDIN_ERROR_REDIRECT=https://tradersprop.com/#/login`

Keep the client secret server-side only.

## LinkedIn Developer Portal

Create/choose the TradersProp LinkedIn app and enable **Sign in with LinkedIn using OpenID Connect**. Add the exact redirect URL:

`https://tradersprop.com/api/v1/auth/linkedin?action=callback`

The implementation requests `openid profile email` and verifies the OIDC ID token before creating the same TradersProp server session used by normal login.

## Behavior

- Existing email/password login remains available.
- Existing users are linked to LinkedIn by verified email.
- New LinkedIn users receive a TradersProp account automatically.
- The existing dashboard opens at `#/dashboard` after authentication.
- Logout clears the LinkedIn-backed TradersProp session.
- No dashboard navigation, cards, offers, payment UI, or dashboard layout is replaced.

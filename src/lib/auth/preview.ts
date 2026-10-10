/**
 * Public metadata for the preview OAuth client (server-only).
 *
 * The broker accepts the preview host patterns below. Enabling authentication
 * requires an explicit server-side GROK_AUTH_CLIENT_SECRET; this repository
 * does not supply a shared OAuth credential. Deployed apps can also provide a
 * per-app GROK_AUTH_CLIENT_ID that overrides this public preview identifier.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";
/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;


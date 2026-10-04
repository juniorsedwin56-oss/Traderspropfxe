// TradersProp client configuration.
// When the HTML is deployed over HTTP(S), use the same origin. When the
// HTML is opened locally on Android (content:// or file://), relative API
// URLs cannot work, so use the public TradersProp deployment instead.
const TP_PUBLIC_API='https://tradersprop.com';
window.TRADERSPROP_API_BASE = window.TRADERSPROP_API_BASE || (/^https?:$/.test(window.location.protocol) ? window.location.origin : TP_PUBLIC_API);

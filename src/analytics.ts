/** Cloudflare Web Analytics is opt-in: set a SITE TOKEN, not an account/API key.
 * On a GitHub Pages HashRouter site, first-page load counts are supported;
 * detailed internal hash-route tracking may require a separate SPA integration.
 */
export function enableWebAnalytics():boolean {
  const token=(import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN as string|undefined)?.trim();
  if(!token || !/^[a-z0-9-]{20,100}$/i.test(token))return false;
  if(document.querySelector('script[data-cf-beacon]'))return true;
  const script=document.createElement('script');
  script.defer=true;
  script.src='https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon',JSON.stringify({token}));
  document.head.appendChild(script);
  return true;
}

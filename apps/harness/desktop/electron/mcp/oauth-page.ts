import { randomBytes } from "node:crypto";
import type { ServerResponse } from "node:http";
import { mcpTranslations } from "../../src/locales/mcp";

/** No callback parameters, codes, or credentials are interpolated into the page. */
export function respondOAuth(
  response: ServerResponse,
  success: boolean,
  language = "en",
  status = success ? 200 : 400,
) {
  const locale = Object.hasOwn(mcpTranslations, language)
    ? (language as keyof typeof mcpTranslations)
    : "en";
  const t = mcpTranslations[locale];
  const nonce = randomBytes(18).toString("base64");
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "close",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
  });
  response.end(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Const</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#161616;color:#fff;font:15px/1.6 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(100%,480px);padding:40px;background:#222;border-radius:24px}small,p{color:#969696}h1{font-size:25px;font-weight:500;line-height:1.25;margin:24px 0 16px}button{border:0;border-radius:12px;padding:12px 20px;background:#fff;color:#161616;font:inherit;cursor:pointer;margin-top:16px}</style>
<main><small>Const</small><h1>${success ? t.oauthSuccess : t.oauthFailure}</h1><p>${success ? t.oauthReturn : t.oauthRetry}</p><button id="close">${t.closeTab}</button></main>
<script nonce="${nonce}">history.replaceState(null,"","/oauth/callback");document.getElementById("close").addEventListener("click",()=>window.close());${success ? "setTimeout(()=>window.close(),1500);" : ""}</script></html>`);
}

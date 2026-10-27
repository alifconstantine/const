import { translations, type SupportedLanguage } from "../src/locales";

/** Small pairing shell only; the full mobile workspace is intentionally a later phase. */
export function createPairingPage(acceptLanguage: string | undefined, nonce: string): string {
  const preferred = acceptLanguage?.split(",")[0]?.split("-")[0]?.trim().toLowerCase() ?? "en";
  const language = Object.hasOwn(translations, preferred) ? preferred as SupportedLanguage : "en";
  const copy = translations[language].remoteControl;
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const messages = JSON.stringify(copy).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(copy.title)}</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#161616;color:#fff;font:16px/1.5 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{max-width:480px;padding:24px;border-radius:24px;background:#222}h1{font-size:22px;font-weight:500}p{color:#d4d4d4}small{color:#969696}</style></head>
<body><main><h1>${escape(copy.title)}</h1><p id="status" role="status">${escape(copy.mobileConnecting)}</p><p>${escape(copy.mobileScope)}</p><small>${escape(copy.security)}</small></main>
<script nonce="${nonce}">
const copy=${messages};
const status=document.getElementById('status');
const key=new URLSearchParams(location.hash.slice(1)).get('key');
history.replaceState(null,'',location.pathname);
if(!key){status.textContent=copy.mobileDisconnected;}else{
const url=new URL('/ws',location.href);url.protocol='ws:';url.searchParams.set('key',key);url.searchParams.set('session',location.pathname.split('/').pop());
const ws=new WebSocket(url);
ws.onmessage=(event)=>{try{if(JSON.parse(event.data).type==='handshake:ack')status.textContent=copy.mobileConnected;}catch{}};
ws.onclose=ws.onerror=()=>{status.textContent=copy.mobileDisconnected;};
window.addEventListener('pagehide',()=>ws.close());
}
</script></body></html>`;
}

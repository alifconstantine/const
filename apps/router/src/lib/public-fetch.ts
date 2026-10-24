import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { GatewayError } from "./gateway";
const privateNetworks = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  privateNetworks.addSubnet(address, prefix, "ipv4");
const ipv6Denied = new BlockList();
ipv6Denied.addSubnet("2001::", 23, "ipv6");
ipv6Denied.addSubnet("2001:db8::", 32, "ipv6");
ipv6Denied.addSubnet("2002::", 16, "ipv6");
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !privateNetworks.check(address, "ipv4");
  return (
    family === 6 &&
    /^[23][0-9a-f]{0,3}:/i.test(address) &&
    !ipv6Denied.check(address, "ipv6")
  );
}
export async function publicPage(
  url: string,
  signal: AbortSignal,
  redirects = 0,
): Promise<string> {
  const target = new URL(url);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    (target.port && !["80", "443"].includes(target.port)) ||
    redirects > 5
  )
    throw new GatewayError("Only public HTTP(S) pages are supported.");
  const host = target.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new GatewayError(
      "Private or reserved network addresses are not allowed.",
    );
  const selected = addresses[0]!;
  return new Promise((resolve, reject) => {
    const client = target.protocol === "https:" ? https : http;
    const request = client.request(
      target,
      {
        method: "GET",
        signal,
        agent: false,
        headers: {
          "User-Agent": "ConstRouter/1.0",
          Accept: "text/html,text/plain,text/markdown",
          "Accept-Encoding": "identity",
        },
        // Pin the validated DNS result to the socket, preventing DNS rebinding.
        lookup: ((_hostname: string, options: any, callback: any) =>
          options.all
            ? callback(null, [selected])
            : callback(null, selected.address, selected.family)) as any,
      },
      (response) => {
        if (
          [301, 302, 303, 307, 308].includes(response.statusCode ?? 0) &&
          response.headers.location
        ) {
          response.resume();
          publicPage(
            new URL(response.headers.location, target).href,
            signal,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if ((response.statusCode ?? 500) >= 400) {
          response.resume();
          reject(new GatewayError("The page could not be fetched", 502));
          return;
        }
        if (
          !/text\/|application\/xhtml/.test(
            response.headers["content-type"] ?? "",
          )
        ) {
          response.resume();
          reject(new GatewayError("The URL must return a text or HTML page."));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) {
            request.destroy();
            reject(new GatewayError("Page is too large", 413));
          } else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve(Buffer.concat(chunks).toString("utf8")),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}

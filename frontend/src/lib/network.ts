// Service URLs are built pointing at this PC (127.0.0.1). When the app is opened from another
// device through the private ZeroTier relay (for example http://10.147.17.210:3000), "127.0.0.1"
// would mean that device itself, so loopback hosts are swapped for the host the page came from.
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function reachableServiceUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const target = new URL(url);
    const pageHost = window.location.hostname;
    if (LOOPBACK_HOSTS.has(target.hostname) && !LOOPBACK_HOSTS.has(pageHost)) target.hostname = pageHost;
    return target.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** RFC 4122 v4 id. crypto.randomUUID only exists on HTTPS or localhost; a phone on the
 *  ZeroTier address uses plain HTTP, where getRandomValues is still available. */
export function newRequestId(): string {
  const cryptoApi = typeof crypto !== "undefined" ? crypto : undefined;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

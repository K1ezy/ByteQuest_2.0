// Private phone access: listen ONLY on this PC's ZeroTier address and forward each port to the
// ByteQuest service on 127.0.0.1. Nothing is opened on Wi-Fi/LAN or the public internet.
// Usage: node infra/zerotier-relay.mjs <zerotier-ipv4> <port> [port ...]
import net from "node:net";

const [host, ...portArgs] = process.argv.slice(2);
const ports = portArgs.map(Number).filter((port) => Number.isInteger(port) && port > 0 && port < 65536);
if (!net.isIPv4(host ?? "") || ports.length === 0) {
  console.error("Usage: node infra/zerotier-relay.mjs <zerotier-ipv4> <port> [port ...]");
  process.exit(2);
}

for (const port of ports) {
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: "127.0.0.1", port });
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", close);
    upstream.on("error", close);
    client.on("close", close);
    upstream.on("close", close);
    client.pipe(upstream).pipe(client);
  });
  server.on("error", (error) => {
    // Docker already publishes some ports (Supabase) on every address; those need no relay.
    const reason = error.code === "EADDRINUSE" ? "already reachable on this address, no relay needed" : error.message;
    console.log(`${host}:${port} skipped: ${reason}`);
  });
  server.listen(port, host, () => console.log(`relaying ${host}:${port} -> 127.0.0.1:${port}`));
}

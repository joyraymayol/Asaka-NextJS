import { createServer, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/session-core";
import { toLiveFeedMessage } from "@/lib/traccar/dto";
import type { TraccarWsMessage } from "@/lib/traccar/types";

// Custom server required only so /ws/live can handle a raw WebSocket
// upgrade -- app/api/**/route.ts route handlers can't do that. Standalone
// output mode is incompatible with a custom server; don't enable it.
const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const LIVE_WS_PATH = "/ws/live";

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = value;
  }
  return cookies;
}

function getTraccarWsUrl(): string {
  const base = process.env.TRACCAR_API_URL;
  if (!base) throw new Error("TRACCAR_API_URL environment variable is not set");
  return base.replace(/\/$/, "").replace(/^http/, "ws") + "/api/socket";
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = new URL(req.url ?? "", "http://internal");
    if (pathname !== LIVE_WS_PATH) {
      // Not ours -- leave the socket alone so any other upgrade listener
      // (e.g. Next's own dev/HMR websocket) can still handle it.
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const session = await decryptSession(cookies[SESSION_COOKIE_NAME]);
    if (!session) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (browserSocket) => {
      // v1: one upstream Traccar WS per browser connection. Pooling one
      // upstream connection per Traccar session across multiple tabs is a
      // clean future optimization, not needed at this scale.
      const wsUrl = getTraccarWsUrl();
      const upstream = new WebSocket(wsUrl, {
        headers: { Cookie: `JSESSIONID=${session.traccarSessionId}` },
      });

      upstream.on("open", () => {
        console.log(`[ws/live] upstream connected to ${wsUrl}`);
      });
      upstream.on("unexpected-response", (_req, res) => {
        console.error(`[ws/live] upstream handshake rejected: HTTP ${res.statusCode}`);
      });
      upstream.on("message", (data) => {
        if (browserSocket.readyState !== WebSocket.OPEN) return;
        try {
          const raw = JSON.parse(data.toString()) as TraccarWsMessage;
          browserSocket.send(JSON.stringify(toLiveFeedMessage(raw)));
        } catch {
          // ignore malformed upstream frames
        }
      });
      upstream.on("close", (code, reason) => {
        console.log(`[ws/live] upstream closed: ${code} ${reason.toString()}`);
        browserSocket.close();
      });
      upstream.on("error", (err) => {
        console.error(`[ws/live] upstream error:`, err);
        browserSocket.close();
      });

      browserSocket.on("close", (code, reason) => {
        console.log(`[ws/live] browser closed: ${code} ${reason.toString()}`);
        upstream.close();
      });
      browserSocket.on("error", (err) => {
        console.error(`[ws/live] browser error:`, err);
        upstream.close();
      });
    });
  });

  server.listen(port, () => {
    console.log(
      `> Server listening at http://localhost:${port} as ${dev ? "development" : process.env.NODE_ENV}`,
    );
  });
});

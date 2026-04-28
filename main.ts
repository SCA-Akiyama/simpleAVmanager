import { deviceManager } from "./lib/manager";
import { initCronJobs } from "./lib/cron";
import { handleClientMessage } from "./lib/ws-router";

deviceManager.init();
initCronJobs();

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);

    // 1. WebSocketへのアップグレードリクエストを処理
    if (url.pathname === "/ws") {
      const success = server.upgrade(req);
      if (success) return undefined; // BunがWS接続へ切り替える
    }

    // --- 以下、既存のHTTP配信ロジック ---
    if (url.pathname === "/") return new Response(Bun.file("index.html"));
    if (url.pathname === "/pico.css") return new Response(Bun.file("node_modules/@picocss/pico/css/pico.min.css"));
    
    if (url.pathname === "/main.js") {
      const build = await Bun.build({ entrypoints: ["./ui/app.ts"] });
      return new Response(build.outputs[0]);
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      ws.subscribe("updates");
      ws.send(JSON.stringify({ type: "INIT", data: deviceManager.getStatus() }));
    },
    async message(ws, msg) {
      // 全員への一斉送信
      const broadcastUpdate = () => {
        server.publish("updates", JSON.stringify({ type: "SYNC", data: deviceManager.getStatus() }));
      };
      
      // 💡 このクライアントだけへの返信
      const sendResponse = (data: any) => {
        ws.send(JSON.stringify(data));
      };
      
      await handleClientMessage(msg.toString(), broadcastUpdate, sendResponse);
    },
  }
});

deviceManager.startPolling(() => {
  server.publish("updates", JSON.stringify({ type: "SYNC", data: deviceManager.getStatus() }));
});

console.log(`🚀 Server started at http://localhost:${server.port}`);
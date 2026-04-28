// src/lib/protocols.ts

export interface ControlTask {
  readonly deviceId: string;
// 💡 返信を期待しない場合（UDPなど）は null を返すように変更
  execute(): Promise<string | null>;
}

// BunネイティブなTCP通信 (PJLink等)
export class TcpTask implements ControlTask {
  constructor(
    public readonly deviceId: string,
    private ip: string,
    private port: number,
    private payload: string,
    private timeout = 2000
  ) {}

  execute(): Promise<string> { 
    return new Promise((resolve, reject) => {
      let response = "";
      let isTimedOut = false;
      let socketRef: any = null;

      console.log(`[TCP SEND] ${this.deviceId} (${this.ip}) >> ${this.payload.trim()}`);

      // 1. 通信全体（ハンドシェイクを含む）のタイムアウトタイマーを最初に仕掛ける
      const timer = setTimeout(() => {
        isTimedOut = true;
        if (socketRef) socketRef.end(); // すでにソケットが生成されていれば破棄
        reject(new Error("TCP Connection/Read Timeout"));
      }, this.timeout);

      Bun.connect({
        hostname: this.ip,
        port: this.port,
        socket: {
          data(s, data) {
            response += new TextDecoder().decode(data);
            s.end(); // 応答を受け取ったら即切断
          },
          close() { 
            if (!isTimedOut) {
              clearTimeout(timer);
              resolve(response);
            }
          },
          error(s, err) { 
            if (!isTimedOut) {
              clearTimeout(timer);
              reject(err);
            }
          }
        }
      }).then(socket => {
        socketRef = socket;
        
        // 2. タイムアウト後に繋がってしまった場合のゴーストコマンド送信を防止
        if (isTimedOut) {
          socket.end();
          return;
        }
        
        socket.write(this.payload);
      }).catch(err => {
        if (!isTimedOut) {
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }
}

// BunネイティブなUDP送信 (BrightSign等)
const udpOut = await Bun.udpSocket({ port: 0 }); // 送信専用

export class UdpTask implements ControlTask {
  constructor(
    public readonly deviceId: string,
    private ip: string,
    private port: number,
    private payload: string
  ) {}

  async execute(): Promise<string | null> {
    udpOut.send(this.payload, this.port, this.ip);
    // 💡 空文字ではなく明示的に null を返す
    return null; 
  }
}

// 💡 1. HTTPタスクの追加
export class HttpTask implements ControlTask {
  constructor(
    public readonly deviceId: string,
    private ip: string,
    private port: number,
    private payload: string,
    private timeout = 2000
  ) {}

  async execute(): Promise<string | null> {
    // payloadのフォーマット例: 
    // "GET /api/status" 
    // "POST /api/power {\"state\":\"on\"}"
    const parts = this.payload.trim().split(" ");
    const method = ["GET", "POST", "PUT", "DELETE"].includes(parts[0] ?? "") ? parts[0] : "GET";
    
    // メソッドが省略されて "/api/..." から始まった場合は GET とみなす
    const pathStr = method === "GET" && parts[0] !== "GET" ? parts[0] : parts[1];
    const path = pathStr?.startsWith("/") ? pathStr : `/${pathStr || ""}`;
    
    // 残りの文字列をJSON等のボディとして扱う
    const body = parts.slice(2).join(" ") || undefined;

    const url = `http://${this.ip}:${this.port}${path}`;
    console.log(`[HTTP SEND] ${this.deviceId} >> ${method} ${url} ${body || ""}`);

    // BunのfetchはAbortControllerでタイムアウトを制御できる
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        body,
        signal: controller.signal,
        headers: body ? { "Content-Type": "application/json" } : undefined
      });

      clearTimeout(timer);

      if (!response.ok) {
        // HTTPステータスエラー(404や500)は、device.checkErrorで弾けるように特定のフォーマットで返す
        return `HTTP_ERROR:${response.status}`;
      }

      // レスポンスボディをテキストとして返す
      return await response.text();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error("HTTP Timeout");
      }
      throw err; // ネットワークエラーとして上の catch に拾わせる
    }
  }
}

// 💡 2. 型の追加
export type ProtocolType = "TCP" | "UDP" | "HTTP"; // "HTTP" を追加

// 💡 3. ファクトリの更新
export const TaskFactory = {
  create: (
    protocol: ProtocolType,
    config: { id: string; ip: string; port: number; payload: string }
  ): ControlTask => {
    switch (protocol) {
      case "TCP":
        return new TcpTask(config.id, config.ip, config.port, config.payload);
      case "UDP":
        return new UdpTask(config.id, config.ip, config.port, config.payload);
      case "HTTP":
        return new HttpTask(config.id, config.ip, config.port, config.payload); // 追加
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
  },
};
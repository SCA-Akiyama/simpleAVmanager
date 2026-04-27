// src/lib/protocols.ts

export interface ControlTask {
  readonly deviceId: string;
  execute(): Promise<string>;
}

// BunネイティブなTCP送信 (PJLink等)
export class TcpTask implements ControlTask {
  constructor(
    public readonly deviceId: string,
    private ip: string,
    private port: number,
    private payload: string,
    private timeout = 2000
  ) {}

  async execute(): Promise<string> { // 戻り値の型を変更
    return new Promise(async (resolve, reject) => {
      let response = "";
      console.log(`[TCP SEND] ${this.deviceId} (${this.ip}) >> ${this.payload.trim()}`);

      try {
        const socket = await Bun.connect({
          hostname: this.ip,
          port: this.port,
          socket: {
            data(s, data) {
              response += new TextDecoder().decode(data);
              s.end(); 
            },
            close() { resolve(response); }, // response を返して解決
            error(s, err) { reject(err); }
          }
        });
        socket.write(this.payload);
        setTimeout(() => { socket.end(); resolve(response); }, this.timeout);
      } catch (e) { reject(e); }
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

  async execute(): Promise<string> {
    udpOut.send(this.payload, this.port, this.ip);
    return ""; // UDPは返事がないので空文字を返す
  }
}
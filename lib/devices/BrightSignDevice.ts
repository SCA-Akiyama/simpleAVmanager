// src/lib/devices/BrightSignDevice.ts
import { UdpTask } from "../protocols";

export class BrightSignDevice {
  public readonly type = "media_player";
  // 状態として覚えさせたいもの（電源など）。これ以外はEvent扱いになる
  public readonly statusKeys = []; 

  constructor(public id: string, public ip: string, public port = 5000) {}

  translate(key: string, value: any) {
    // 【重要】問い合わせが来てもUDPは返せないので null を返す
    if (value === "?") return null; 
    
    // それ以外は通常通り送信
    return new UdpTask(this.id, this.ip, this.port, String(value));
  }

  // マネージャーが呼ぶので、空の解析関数を置いておく
  parseResponse(key: string, raw: string) { return raw; }
}
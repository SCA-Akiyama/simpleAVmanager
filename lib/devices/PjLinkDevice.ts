import { TcpTask } from "../protocols";

export class PjLinkDevice {
  public readonly type = "projector";
  // 「状態」として管理するものだけを定義。これ以外（volume_drag等）は自動でEvent扱い
  public readonly statusKeys = ["power", "input", "volume"]; 

  constructor(public id: string, public ip: string, public port = 4352) {}

  translate(key: string, value: any) {
    const commands: Record<string, (v: any) => string> = {
      power: (v) => v === "?" ? "%1POWR ?\r" : (v === "on" ? "%1POWR 1\r" : "%1POWR 0\r"),
      input: (v) => v === "?" ? "%1INPT ?\r" : `%1INPT ${v}\r`,
      volume: (v) => v === "?" ? "%1VOLM ?\r" : `%1VOLM ${v}\r`,
      volume_drag: (v) => `%1VOLM ${v}\r`,
    };
    const cmd = commands[key]?.(value);
    return cmd ? new TcpTask(this.id, this.ip, this.port, cmd) : null;
  }

  parseResponse(key: string, raw: string) {
    if (key === "power") {
      if (raw.includes("POWR=0")) return "off";
      if (raw.includes("POWR=1")) return "on";
      if (raw.includes("POWR=2")) return "cooling";
      if (raw.includes("POWR=3")) return "warming";
    }
    const match = raw.match(/=(.*)/);
    return match && match[1] ? match[1].trim() : raw.trim();
  }
}
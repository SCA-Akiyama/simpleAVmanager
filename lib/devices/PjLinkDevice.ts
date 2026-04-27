import { TcpTask } from "../protocols";
import type { AVDevice } from "../types";

const PjState = { ON: "on", OFF: "off", WARMING: "warming", COOLING: "cooling" } as const;

//フロントエンドに公開するための「型スキーマ」を定義
export type PjLinkSchema = {
  power?: typeof PjState.ON | typeof PjState.OFF | typeof PjState.WARMING | typeof PjState.COOLING;
  input?: number;
  volume?: number;
  volume_drag?: number;
};

export class PjLinkDevice implements AVDevice<PjLinkSchema> {
  public readonly type = "PjLinkDevice" as const;

  // ==========================================
  // 1. 状態 (States): parse が【必須】なグループ
  // ==========================================
  // satisfies Record<string, ...> を使うことで、「parse関数が絶対必要」とTypeScriptに強制させます
  private readonly states = {
    power: {
      translate: (v: any) => v === "?" ? "%1POWR ?\r" : (v === PjState.ON ? "%1POWR 1\r" : "%1POWR 0\r"),
      parse: (raw: string) => { // ← これを書き忘れるとエディタが赤線で怒ってくれます！
        if (raw.includes("POWR=0")) return PjState.OFF;
        if (raw.includes("POWR=1")) return PjState.ON;
        if (raw.includes("POWR=2")) return PjState.COOLING;
        if (raw.includes("POWR=3")) return PjState.WARMING;
        return raw.trim();
      }
    },
    input: {
      translate: (v: any) => v === "?" ? "%1INPT ?\r" : `%1INPT ${v}\r`,
      parse: (raw: string) => raw.match(/=(.*)/)?.[1]?.trim() || raw.trim()
    },
    volume: {
      translate: (v: any) => v === "?" ? "%1VOLM ?\r" : `%1VOLM ${v}\r`,
      parse: (raw: string) => raw.match(/=(.*)/)?.[1]?.trim() || raw.trim()
    }
  } satisfies Record<string, { translate: (v: any) => string; parse: (raw: string) => string }>;

  // ==========================================
  // 2. イベント (Events): parse が【不要】なグループ
  // ==========================================
  private readonly events = {
    volume_drag: {
      translate: (v: any) => `%1VOLM ${v}\r`
      // ここは parse を書かなくても怒られません
    }
  } satisfies Record<string, { translate: (v: any) => string }>;

  // ==========================================
  // ★ 自動生成される statusKeys
  // ==========================================
  // 手書きの配列をやめて、statesのキー一覧（["power", "input", "volume"]）を動的に取得します。
  // これで配列の更新忘れやタイポが「物理的に不可能」になります。
  public readonly statusKeys = Object.keys(this.states);

  // （許容状態の定義はそのまま）
  public readonly toleratedStates: Record<string, Record<string, string[]>> = {
    power: {
      [PjState.ON]: [PjState.ON, PjState.WARMING],
      [PjState.OFF]: [PjState.OFF, PjState.COOLING]
    }
  };

  constructor(public id: string, public ip: string, public port = 4352) {}

  translate(key: string, value: any) {
    // states か events のどちらかから探し、あれば translate を実行
    const handler = (this.states as any)[key] || (this.events as any)[key];
    const cmd = handler?.translate(value);
    return cmd ? new TcpTask(this.id, this.ip, this.port, cmd) : null;
  }

  parseResponse(key: string, raw: string) {
    // parse は states 側にしか存在しないので、安全に呼び出せる
    const parser = (this.states as any)[key]?.parse;
    return parser ? parser(raw) : raw.trim();
  }
}
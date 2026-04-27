// src/lib/devices/BrightSignDevice.ts
import { UdpTask } from "../protocols";
import type { AVDevice } from "../types";

// フロントエンドの開発時に補完されるスキーマ定義
export type BrightSignSchema = {
  // UDP機材は基本的に一方通行のため、ここに定義したキーは「イベント」として扱われます
  power?: "on" | "off";
  play?: string;
  command?: string;
};

export class BrightSignDevice implements AVDevice<BrightSignSchema> {
  // 最新の識別ルール: クラス名 + as const
  public readonly type = "BrightSignDevice" as const;

  // ==========================================
  // 1. 状態 (States): parse（解析）が【必須】なグループ
  // ==========================================
  // BrightSignはUDPの一方通行で状態取得ができないため、ここには何も定義しません。
  // これにより statusKeys は自動的に空配列 [] になります。
  private readonly states = {
  } satisfies Record<string, { translate: (v: any) => string; parse: (raw: string) => string }>;

  // ==========================================
  // 2. イベント (Events): parse が【不要】なグループ
  // ==========================================
  private readonly events = {
    power: {
      translate: (v: any) => v === "on" ? "PowerOn" : "PowerOff" // 実機のコマンド仕様に合わせる
    },
    play: {
      translate: (v: any) => `play:${v}`
    },
    command: {
      translate: (v: any) => String(v)
    }
  } satisfies Record<string, { translate: (v: any) => string }>;

  // states のキーから自動生成（この機材の場合は [] になる） 
  public readonly statusKeys = Object.keys(this.states);

  constructor(public id: string, public ip: string, public port = 5000) {}

  translate(key: string, value: any) {
    // 問い合わせ（?）が来た場合はUDP機材なので null を返してスキップさせる [cite: 46]
    if (value === "?") return null;

    // states か events のどちらかからハンドラーを探す [cite: 63, 64]
    const handler = (this.states as any)[key] || (this.events as any)[key];
    const payload = handler?.translate(value);
    
    // UdpTask として生成して返す [cite: 47]
    return payload ? new UdpTask(this.id, this.ip, this.port, String(payload)) : null;
  }

  parseResponse(key: string, raw: string) {
    // states 側に定義がない機材（UDP機材）でも、マネージャーから呼ばれるため実装しておく
    const parser = (this.states as any)[key]?.parse;
    return parser ? parser(raw) : raw;
  }
}
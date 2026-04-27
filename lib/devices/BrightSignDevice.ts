import type { DeviceDefinition } from "../factory"; // [cite: 12]

export type BrightSignSchema = {
  command?: string;
};

export const brightSignDef: DeviceDefinition<BrightSignSchema> = {
  type: "BrightSignDevice",
  protocol: "UDP", // [cite: 58]
  defaultPort: 5000, // [cite: 58]

  // BrightSignは状態取得（Query）ができない仕様のため states は空にする [cite: 58]
  states: {},

  // 発行（Set）のみのコマンドを events に定義 [cite: 59]
  events: {
    command: {
      translate: (v) => String(v)
    }
  }
};
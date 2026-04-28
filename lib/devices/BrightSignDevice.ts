import { z } from "zod";
import type { DeviceDefinition } from "../factory";

// 1. Zodでスキーマを定義
// BrightSignに送る可能性のあるコマンド（例: "play", "stop", "next" など）を定義
// 自由な文字列を許可する場合は z.string()、決まった単語なら z.enum() を使います
export const brightSignSchema = z.object({
  command: z.string().optional(),
});

export type BrightSignSchema = z.infer<typeof brightSignSchema>;

// 2. デバイス定義本体
export const brightSignDef: DeviceDefinition<BrightSignSchema> = {
  type: "BrightSignDevice",
  protocol: "UDP", // [cite: 79]
  defaultPort: 5000, // [cite: 79]
  zodSchema: brightSignSchema, // 💡 マネージャーでのバリデーション用に登録

  // BrightSignは状態取得（Query）ができない仕様のため ping は最小限に [cite: 79]
  ping: { payload: "", protocol: "TCP" }, 
  states: {}, // [cite: 79]

  // 発行（Set）のみの操作を events に定義 [cite: 79]
  events: {
    command: {
      translate: (v) => String(v) // [cite: 79]
    }
  }
};
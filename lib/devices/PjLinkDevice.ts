import type { DeviceDefinition } from "../factory";
import { z } from "zod";

// 1. Zodでスキーマを定義（定数オブジェクトは廃止して直接リテラルを書く）
export const pjLinkSchema = z.object({
  power: z.enum(["on", "off", "warming", "cooling"]),
  shutter: z.enum(["open", "close"]),
  volume: z.number().min(0).max(100) // 範囲指定
});

export type PjLinkSchema = z.infer<typeof pjLinkSchema>;

// 2. デバイス定義本体
export const pjLinkDef: DeviceDefinition<PjLinkSchema> = {
  type: "PjLinkDevice",
  protocol: "TCP",
  defaultPort: 4352,
  zodSchema: pjLinkSchema, // 💡 ここにスキーマを渡すのを忘れずに！
  
  isError: (raw) => raw.includes("ERR"),
  ping: { payload: "\r" },
  
  states: {
    // --- 電源制御 ---
    power: {
      translate: (v) => v === "?" 
        ? "%1POWR ?\r" 
        : (v === "on" ? "%1POWR 1\r" : "%1POWR 0\r"),
      parse: (raw) => {
        if (raw.includes("POWR=0")) return "off";
        if (raw.includes("POWR=1")) return "on";
        if (raw.includes("POWR=2")) return "cooling";
        if (raw.includes("POWR=3")) return "warming";
        return raw.trim();
      }
    },
    // --- シャッター制御 ---
    shutter: {
      translate: (v) => v === "?" 
        ? "%1SHUT ?\r" 
        : (v === "open" ? "%1SHUT 0\r" : "%1SHUT 1\r"),
      parse: (raw) => {
        if (raw.includes("SHUT=10")) return "open"; // 映像消去解除
        if (raw.includes("SHUT=11")) return "close"; // 映像消去
        return raw.trim();
      }
    },
    // --- 音量制御 ---
    volume: {
      translate: (v) => v === "?" ? "%1VOLM ?\r" : `%1VOLM ${v}\r`,
      parse: (raw) => raw.match(/=(.*)/)?.[1]?.trim() || raw.trim()
    }
  },
  
  // 3. 理想と現実のギャップを埋める定義
  toleratedStates: {
    power: {
      "on": ["on", "warming"],
      "off": ["off", "cooling"]
    }
  }
};
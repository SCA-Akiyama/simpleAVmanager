import type { DeviceDefinition } from "../factory";

/**
 * 1. デバイス固有の定数（名前空間）を一つにまとめる
 * as const を付けることで、文字列ではなく「リテラル型」として扱われます。
 */
const PJ_CONST = {
  power: {
    ON: "on",
    OFF: "off",
    WARMING: "warming",
    COOLING: "cooling",
  },
  shutter: {
    OPEN: "open",
    CLOSE: "close",
  }
} as const;

/**
 * 2. 定数オブジェクトから自動的に型を抽出する
 */
export type PjLinkSchema = {
  power?: typeof PJ_CONST.power[keyof typeof PJ_CONST.power];
  shutter?: typeof PJ_CONST.shutter[keyof typeof PJ_CONST.shutter];
  volume?: number;
};

/**
 * 4. デバイス定義本体
 */
export const pjLinkDef: DeviceDefinition<PjLinkSchema> = {
  type: "PjLinkDevice",
  protocol: "TCP",
  defaultPort: 4352,
  states: {
    // --- 電源制御 ---
    power: {
      translate: (v) => v === "?" 
        ? "%1POWR ?\r" 
        : (v === PJ_CONST.power.ON ? "%1POWR 1\r" : "%1POWR 0\r"),
      parse: (raw) => {
        if (raw.includes("POWR=0")) return PJ_CONST.power.OFF;
        if (raw.includes("POWR=1")) return PJ_CONST.power.ON;
        if (raw.includes("POWR=2")) return PJ_CONST.power.COOLING;
        if (raw.includes("POWR=3")) return PJ_CONST.power.WARMING;
        return raw.trim();
      }
    },
    // --- シャッター制御 ---
    shutter: {
      translate: (v) => v === "?" 
        ? "%1SHUT ?\r" 
        : (v === PJ_CONST.shutter.OPEN ? "%1SHUT 0\r" : "%1SHUT 1\r"),
      parse: (raw) => {
        if (raw.includes("SHUT=10")) return PJ_CONST.shutter.OPEN; // 映像消去解除
        if (raw.includes("SHUT=11")) return PJ_CONST.shutter.CLOSE; // 映像消去
        return raw.trim();
      }
    },
    // --- 音量制御 ---
    volume: {
      translate: (v) => v === "?" ? "%1VOLM ?\r" : `%1VOLM ${v}\r`,
      parse: (raw) => raw.match(/=(.*)/)?.[1]?.trim() || raw.trim()
    }
  },
  // 5. 理想と現実のギャップを埋める定義
  toleratedStates: {
    power: {
      [PJ_CONST.power.ON]: [PJ_CONST.power.ON, PJ_CONST.power.WARMING],
      [PJ_CONST.power.OFF]: [PJ_CONST.power.OFF, PJ_CONST.power.COOLING]
    }
  }
};
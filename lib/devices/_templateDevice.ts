// src/lib/devices/_templateDevice.ts
import { z } from "zod";
import type { DeviceDefinition } from "../factory";

/**
 * 1. 状態スキーマの定義
 * この機材で操作・監視したい項目と、その取りうる値を Zod で定義します。
 * 例: 電源(on/off)、入力切替(hdmi1/hdmi2)、音量(0-100)など
 */
export const templateSchema = z.object({
  power: z.enum(["on", "off"]).optional(),
  // input: z.enum(["hdmi1", "hdmi2"]).optional(),
  // volume: z.number().min(0).max(100).optional(),
});

// スキーマからTypeScriptの型を自動生成
export type TemplateSchema = z.infer<typeof templateSchema>;

/**
 * 2. デバイス定義本体
 * Managerがこの機材をどう扱うか（通信方式、コマンドの変換ルールなど）を定義します。
 */
export const templateDef: DeviceDefinition<TemplateSchema> = {
  type: "TemplateDevice",  // 機器の識別用タイプ名（一意であること）
  protocol: "TCP",         // "TCP" | "UDP" | "HTTP" のいずれか
  defaultPort: 9999,       // 機材のデフォルトポート番号
  zodSchema: templateSchema, // バリデーション用のスキーマを登録

  // 【オプション】定期監視（Slow Path）の生存確認用コマンド
  // ping: { payload: "?\r" },

  // 【オプション】通信結果からエラーを判定するロジック
  // isError: (raw) => raw.toUpperCase().includes("ERROR"),

  /**
   * 3. 状態(State)の変換ルール
   * Managerの「理想(Desired)」と機材の「現実(Actual)」を橋渡しします。
   */
  states: {
    power: {
      // サーバーからの値(v)を、実機へ送る生のコマンド文字列に変換します
      // v が "?" の場合は、現在の状態を問い合わせるコマンドを返します
      translate: (v) => v === "?" ? "GET_POWER\r" : `SET_POWER ${v}\r`,
      
      // 実機から返ってきた生の文字列(raw)を解析し、スキーマで定義した値("on" | "off")に変換します
      parse: (raw) => raw.includes("PWR=1") ? "on" : "off"
    }
  },

  /**
   * 4. イベント(Event)の変換ルール 【オプション】
   * 現在の状態を問い合わせできない「送りっぱなし」の操作（UDPなど）はこちらに定義します。
   */
  // events: {
  //   trigger: {
  //     translate: (v) => `PLAY_FILE ${v}\r`
  //   }
  // },

  /**
   * 5. 許容される状態の定義 【オプション】
   * 理想と現実のズレを一時的に許容するルールです（例：ONを指示した後の「Warming Up」など）。
   */
  // toleratedStates: {
  //   power: {
  //     "on": ["on", "warming"],
  //   }
  // }
};
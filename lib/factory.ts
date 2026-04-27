// src/lib/factory.ts
import { TaskFactory, type ProtocolType } from "./protocols";
import type { AVDevice } from "./types";

// デバイスの「定義」の型。作者はこれだけを書く。
export interface DeviceDefinition<T = any> {
  readonly type: string;
  readonly protocol: ProtocolType;
  readonly defaultPort: number;
  readonly states: Record<string, {
    translate: (v: any) => string;
    parse: (raw: string) => any;
  }>;
  readonly events?: Record<string, {
    translate: (v: any) => string;
  }>;
  readonly toleratedStates?: Record<string, Record<string, string[]>>;
}

/**
 * 純粋な定義データから、managerが扱える AVDevice オブジェクトを合成する
 */
export const createDevice = <T>(
  def: DeviceDefinition<T>,
  config: { id: string; ip: string; port?: number }
): AVDevice<T> => {
  const port = config.port ?? def.defaultPort;

  return {
    id: config.id,
    type: def.type,
    // states のキーから自動的に statusKeys を生成 [cite: 51, 68, 83]
    statusKeys: Object.keys(def.states),
    toleratedStates: def.toleratedStates,

    _schema: undefined as T,

    translate(key, value) {
      // 1. 問い合わせコマンドの共通処理
      if (value === "?") {
        const handler = def.states[key];
        if (!handler) return null;
        const payload = handler.translate("?");
        return TaskFactory.create(def.protocol, { ...config, port, payload });
      }

      // 2. 通常コマンドの処理 (states または events から検索)
      const handler = (def.states as any)[key] || (def.events as any)?.[key];
      const payload = handler?.translate(value);
      
      return payload 
        ? TaskFactory.create(def.protocol, { ...config, port, payload: String(payload) })
        : null;
    },

    parseResponse(key, raw) {
      return def.states[key]?.parse(raw) ?? raw.trim();
    }
  };
};
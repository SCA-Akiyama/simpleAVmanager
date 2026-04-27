// src/lib/types.ts
import type { ControlTask } from "./protocols";

export interface AVDevice<TSchema = any> {
  readonly id: string;
  readonly type: string;
  readonly statusKeys: readonly string[] | string[];
  
  // オプショナル（あってもなくても良い）
  readonly toleratedStates?: Record<string, Record<string, string[]>>;

  readonly _schema?: TSchema;

  // 必ず実装すべきメソッド
  translate(key: string, value: any): ControlTask | null;
  parseResponse(key: string, raw: string): any;
}
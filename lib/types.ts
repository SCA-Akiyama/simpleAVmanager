// src/lib/types.ts
import type { z } from "zod";
import type { ControlTask } from "./protocols";

export interface AVDevice<TSchema = any> {
  readonly id: string;
  readonly type: string;
  readonly statusKeys: readonly string[] | string[];
  readonly zodSchema?: z.ZodObject<any>;
  
  // オプショナル（あってもなくても良い）
  readonly toleratedStates?: Record<string, Record<string, string[]>>;

  readonly _schema?: TSchema;

  checkError(raw: string): boolean;
  getPingTask(): import("./protocols").ControlTask | null;

  // 必ず実装すべきメソッド
  translate(key: string, value: any): ControlTask | null;
  parseResponse(key: string, raw: string): any;
}
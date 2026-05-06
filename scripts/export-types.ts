// scripts/export-types.ts
import { zodToTs, createTypeAlias, printNode } from "zod-to-ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { wsClientMessageSchema } from "../lib/ws-router";
import { inventory } from "../lib/inventory";

console.log("🚀 クライアント向けスキーマをエクスポート中...");

const deviceSchemas = new Map<string, z.ZodObject<any>>();
for (const device of inventory) {
  if (device.zodSchema && !deviceSchemas.has(device.type)) {
    deviceSchemas.set(device.type, device.zodSchema);
  }
}

// ==========================================
// 1. TypeScript環境向け (.ts の組み立て)
// ==========================================
// v1.2.0の仕様に合わせ、第2引数に直接文字列（型名）を渡します
const { node: msgNode } = zodToTs(wsClientMessageSchema, "ClientMessage");
const msgAlias = createTypeAlias(msgNode, "ClientMessage");

let tsCode = `
/**
 * ⚠️ 自動生成ファイル: バックエンドのZodスキーマから生成されています。
 * 直接編集せず、バックエンドのZodスキーマを更新して再生成してください。
 */

// --- 通信メッセージの型 ---
export ${printNode(msgAlias)}

// --- 各デバイスのプロパティ(状態)型 ---
`;

const stateTypeNames: string[] = [];

for (const [deviceType, schema] of deviceSchemas.entries()) {
  const typeName = `${deviceType}State`;
  stateTypeNames.push(typeName);

  // ここも同様に第2引数を文字列にします
  const { node } = zodToTs(schema, typeName);
  const alias = createTypeAlias(node, typeName);
  
  tsCode += `export ${printNode(alias)}\n\n`;
}

if (stateTypeNames.length > 0) {
  tsCode += `// 汎用的に使えるように全デバイスの状態をまとめたUnion型\n`;
  tsCode += `export type AnyDeviceState = ${stateTypeNames.join(" | ")};\n`;
}

await Bun.write("./frontend-protocol.ts", tsCode.trim());
console.log("✅ TypeScript型定義を出力しました (frontend-protocol.ts)");

// ==========================================
// 2. 他言語環境向け (.json の組み立て)
// ==========================================
const definitions: Record<string, any> = {};

const msgJson = zodToJsonSchema(wsClientMessageSchema, { $refStrategy: "none" }) as any;
delete msgJson.$schema;
definitions["ClientMessage"] = msgJson;

for (const [deviceType, schema] of deviceSchemas.entries()) {
  const typeName = `${deviceType}State`;
  const devJson = zodToJsonSchema(schema, { $refStrategy: "none" }) as any;
  delete devJson.$schema;
  definitions[typeName] = devJson;
}

const finalJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  description: "Simple AV Manager Protocol Schema",
  $ref: "#/definitions/ClientMessage",
  definitions: definitions
};

await Bun.write("./protocol-schema.json", JSON.stringify(finalJsonSchema, null, 2));
console.log("✅ JSON Schemaを出力しました (protocol-schema.json)");
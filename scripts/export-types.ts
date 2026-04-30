// scripts/export-types.ts
import { zodToTs, createTypeAlias, printNode } from "zod-to-ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { wsClientMessageSchema } from "../lib/ws-router";
import { inventory } from "../lib/inventory";

console.log("🛠️ クライアント向けスキーマをエクスポート中...");

let idCounter = 0;
const auxStore = { nextId: () => String(idCounter++), definitions: new Map() };

const deviceSchemas = new Map<string, z.ZodObject<any>>();
for (const device of inventory) {
  if (device.zodSchema && !deviceSchemas.has(device.type)) {
    deviceSchemas.set(device.type, device.zodSchema);
  }
}

// ==========================================
// 1. TypeScript環境向け (.ts の組み立て)
// ==========================================
const { node: msgNode } = zodToTs(wsClientMessageSchema, { auxiliaryTypeStore: auxStore });
const msgAlias = createTypeAlias(msgNode, "ClientMessage");

let tsCode = `
/**
 * ⚠️ 自動生成ファイル: バックエンドのZodスキーマから生成されています。
 * 直接編集せず、バックエンドのZodスキーマを更新して再生成してください。
 */

// --- 通信メッセージの型 ---
// 💡 export を追加！
export ${printNode(msgAlias)}

// --- 各デバイスのプロパティ(状態)型 ---
`;

const stateTypeNames: string[] = [];

for (const [deviceType, schema] of deviceSchemas.entries()) {
  const typeName = `${deviceType}State`;
  stateTypeNames.push(typeName);

  const { node } = zodToTs(schema, { auxiliaryTypeStore: auxStore });
  const alias = createTypeAlias(node, typeName);
  
  // 💡 ここにも export を追加！
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
const finalJsonSchema: any = {
  $schema: "http://json-schema.org/draft-07/schema#",
  description: "Simple AV Manager Protocol Schema",
  definitions: {}
};

// 💡 修正: 再び `as any` を付けてTSコンパイラを強制突破します！
const msgJson = zodToJsonSchema(wsClientMessageSchema as any, { $refStrategy: "none" });
if (msgJson) {
  delete (msgJson as any).$schema;
  finalJsonSchema.definitions["ClientMessage"] = msgJson;
}

for (const [deviceType, schema] of deviceSchemas.entries()) {
  const typeName = `${deviceType}State`;
  
  // 💡 修正: ここも `as any` を付けます！
  const devJson = zodToJsonSchema(schema as any, { $refStrategy: "none" });
  if (devJson) {
    delete (devJson as any).$schema;
    finalJsonSchema.definitions[typeName] = devJson;
  }
}

await Bun.write("./protocol-schema.json", JSON.stringify(finalJsonSchema, null, 2));
console.log("✅ JSON Schemaを出力しました (protocol-schema.json)");
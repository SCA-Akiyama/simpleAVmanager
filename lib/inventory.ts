// src/lib/inventory.ts
import { z } from "zod";
import { createDevice } from "./factory";
import { readdir } from "node:fs/promises";
import path from "node:path";

// 1. 動的に収集するデバイス定義の辞書
const definitions: Record<string, any> = {};

// 🌟 新機能： devices フォルダ内の .ts ファイルを自動スキャンしてインポートする
const loadDefinitions = async () => {
  // Bunの import.meta.dir を使って、現在のファイルのあるディレクトリからの相対パスを取得
  const devicesDir = path.join(import.meta.dir, "devices");
  const files = await readdir(devicesDir);

  for (const file of files) {
    // テンプレートファイル（_ で始まる）や、TypeScript以外のファイルはスキップ
    if (file.startsWith("_") || !file.endsWith(".ts")) continue;

    // 動的インポートを実行
    const mod = await import(`./devices/${file}`);
    
    // モジュール内のエクスポートから、DeviceDefinitionの要件（typeとprotocolがあるか）を満たすものを探す
    for (const exp of Object.values(mod)) {
      if (exp && typeof exp === "object" && "type" in exp && "protocol" in exp) {
        // 見つけたら、その type をキーにして辞書に登録！
        definitions[(exp as any).type] = exp;
      }
    }
  }
};

// CSVを読み込む前に、まずはデバイス定義をすべて集める
await loadDefinitions();

// 2. CSVの1行に対する厳格なバリデーションスキーマ
const inventoryRowSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
  ip: z.string().ip("正しいIPアドレス形式ではありません"),
  // 🌟 z.enum() ではなく、動的に集めた definitions のキーに存在するかをチェックする
  type: z.string().refine(val => val in definitions, { message: "未登録の機器タイプです" }),
  port: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined)
});

// 3. 読み込みロジック
const loadInventory = async () => {
  const csvFile = Bun.file("inventory.csv");

  if (!(await csvFile.exists())) {
    console.warn("⚠️ inventory.csv が見つかりません。空のインベントリで起動します。");
    return [];
  }

  const csvText = await csvFile.text(); 
  const lines = csvText.split(/\r?\n/);
  const devices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    
    // 空行やコメント行は無視
    if (!line || line.startsWith("#")) continue;

    const cols = line.split(",");
    const id = cols[0]?.trim();
    const ip = cols[1]?.trim();
    const type = cols[2]?.trim();
    const port = cols[3]?.trim();

    // 機器タイプが定義辞書に存在しない行（ヘッダー行など）は無視
    if (!type || !(type in definitions)) continue;

    const result = inventoryRowSchema.safeParse({ id, ip, type, port });
    
    if (!result.success) {
      console.error(`❌ inventory.csv 設定エラー (行 ${i + 1} - ${id || '不明'}):`);
      result.error.issues.forEach(issue => {
        console.error(`   - [${issue.path.join('.')}] ${issue.message}`);
      });
      process.exit(1); 
    }

    const validData = result.data;
    const def = definitions[validData.type];

    devices.push(createDevice(def, { 
      id: validData.id, 
      ip: validData.ip, 
      port: validData.port 
    }));
  }

  console.log(`📦 ${devices.length} 台のデバイスを inventory.csv から読み込みました`);
  return devices;
};

// 4. トップレベルawaitでエクスポート
export const inventory = await loadInventory();
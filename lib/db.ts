// src/lib/db.ts
import { Database } from "bun:sqlite";

// ファイル名を "state.db" として作成
const db = new Database("state.db", { create: true });

// テーブル作成 (デバイスID、設定キー、値)
db.run(`
  CREATE TABLE IF NOT EXISTS desired_states (
    device_id TEXT,
    key TEXT,
    value TEXT,
    PRIMARY KEY (device_id, key)
  )
`);

export const stateDb = {
  // すべての「理想」を読み込む
  loadAll: () => {
    const rows = db.query("SELECT * FROM desired_states").all() as any[];
    return rows;
  },

  // 1つの値を保存（または更新）
  save: (deviceId: string, key: string, value: any) => {
    const query = db.prepare(`
      INSERT OR REPLACE INTO desired_states (device_id, key, value)
      VALUES (?1, ?2, ?3)
    `);
    query.run(deviceId, key, JSON.stringify(value));
  }
};
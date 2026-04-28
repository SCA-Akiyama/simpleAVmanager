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

db.run(`
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    type TEXT,       -- 'once' または 'cron'
    trigger TEXT,    -- 実行時間(ミリ秒の文字列) または Cron式
    target_ids TEXT, -- 操作対象のID配列 (JSON)
    patch TEXT       -- 操作内容 (JSON)
  )
`);

export const scheduleDb = {
  // スケジュールの追加
  add: (id: string, type: "once" | "cron", trigger: string, ids: string[], patch: any) => {
    db.query(`INSERT OR REPLACE INTO schedules (id, type, trigger, target_ids, patch) VALUES (?1, ?2, ?3, ?4, ?5)`)
      .run(id, type, trigger, JSON.stringify(ids), JSON.stringify(patch));
  },
  
  // スケジュールの削除
  delete: (id: string) => {
    db.query("DELETE FROM schedules WHERE id = ?1").run(id);
  },

  // すべての定期ジョブを取得
  getAllCron: () => {
    return db.query("SELECT * FROM schedules WHERE type = 'cron'").all() as any[];
  },

  // 💡 指定した時間(ミリ秒)までに実行すべき単発ジョブを取得
  // CASTを使って文字列として保存されたミリ秒を数値として比較します
  getDueOnce: (targetTimeMs: number) => {
    return db.query("SELECT * FROM schedules WHERE type = 'once' AND CAST(trigger AS INTEGER) <= ?1").all(targetTimeMs) as any[];
  },

  getRange: (startMs: number, endMs: number) => {
    return db.query(`
      SELECT * FROM schedules 
      WHERE type = 'cron' 
      OR (type = 'once' AND CAST(trigger AS INTEGER) BETWEEN ?1 AND ?2)
    `).all(startMs, endMs) as any[];
  },

  getAll: () => {
    return db.query("SELECT * FROM schedules").all() as any[];
  }
};
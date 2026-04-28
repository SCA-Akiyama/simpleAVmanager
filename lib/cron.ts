// src/lib/cron.ts
import { deviceManager } from "./manager";
import { scheduleDb } from "./db";

/**
 * 💡 定期ジョブの登録
 */
export const scheduleRecurring = (cronExp: string, ids: string[], patch: any, id: string = crypto.randomUUID()) => {
  scheduleDb.add(id, "cron", cronExp, ids, patch);
  
  Bun.cron(cronExp, () => {
    // 💡 安全装置: 発火した瞬間に「まだDBに存在するか」を確認する
    const exists = scheduleDb.getAllCron().some((row: any) => row.id === id);
    if (exists) {
      deviceManager.updateDesired(ids, patch);
    } else {
      // ログを出してあげるか、静かに無視するかはお好みで
      // console.log(`👻 [亡霊ジョブ回避] 削除済みの定期ジョブの発火を無視しました: ${id}`);
    }
  });
  console.log(`⏰ [定期登録] ${cronExp} -> ${ids.join(",")}`);
};

/**
 * 💡 単発ジョブの登録
 */
export const scheduleOnce = (date: Date, ids: string[], patch: any, id: string = crypto.randomUUID()) => {
  const timeMs = date.getTime();
  const now = Date.now();
  if (timeMs <= now) return console.warn("⚠️ 過去の日時はスケジュールできません");

  scheduleDb.add(id, "once", timeMs.toString(), ids, patch);
  console.log(`📅 [単発登録] ${date.toLocaleString()} -> ${ids.join(",")}`);

  // 💡 【追加】次の00秒(ポーリング)よりも前に実行すべき直近のジョブなら、いま直接タイマーを仕掛ける
  const nextCronTime = Math.ceil(now / 60000) * 60000; 
  if (timeMs < nextCronTime) {
    setTimeout(() => {
      // 安全装置（発火時にDBにあるか確認）
      if (scheduleDb.getAll().some((r: any) => r.id === id)) {
        deviceManager.updateDesired(ids, patch);
        scheduleDb.delete(id);
      }
    }, timeMs - now);
  }
};

/**
 * 💡 スケジューラーの初期化とポーリング
 */
export const initCronJobs = () => {
  console.log("⏰ スケジューラーを初期化 (完全DB駆動モデル)");

  // 1. 起動時：DBから定期ジョブ(cron)をすべて復元
  const cronJobs = scheduleDb.getAllCron();
  cronJobs.forEach(row => {
    const ids = JSON.parse(row.target_ids);
    const patch = JSON.parse(row.patch);
    Bun.cron(row.trigger, () => {
      const exists = scheduleDb.getAllCron().some((r: any) => r.id === row.id);
      if (exists) {
        deviceManager.updateDesired(ids, patch);
      }
    });
  });

  // 2. 毎分のチェッカー（単発ジョブ用）
  // 💡 メモリ上の配列は一切管理せず、毎回直接DBに「今やるべき仕事ある？」と聞く
  Bun.cron("* * * * *", () => {
    const now = Date.now();
    const nextMinute = now + 60000;

    // 過去の実行漏れ（サーバー停止中など）も含めて、この1分以内に実行すべきジョブを取得
    const dueJobs = scheduleDb.getDueOnce(nextMinute);

    dueJobs.forEach(row => {
      const jobTime = parseInt(row.trigger, 10);
      const ids = JSON.parse(row.target_ids);
      const patch = JSON.parse(row.patch);

      // 実行時刻までのディレイを計算（過去のジョブなら 0 になり即時実行される）
      const delay = Math.max(0, jobTime - now);

      setTimeout(() => {
        // 💡 魔の60秒間対策: 発火した瞬間に「まだDBに存在するか」を最終確認
        const stillExists = scheduleDb.getAll().some((r: any) => r.id === row.id);
        
        if (stillExists) {
          deviceManager.updateDesired(ids, patch);
          scheduleDb.delete(row.id); // 実行が完了した瞬間にDBから消す
        } else {
          // 待機中にユーザーによってキャンセルされた場合は何もしない
          console.log(`🛑 [キャンセル検知] 待機中に削除された単発ジョブの実行を取りやめました: ${row.id}`);
        }
      }, delay);
    });
  });
};
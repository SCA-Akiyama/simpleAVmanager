// src/lib/cron.ts
import { deviceManager } from "./manager";
import { scheduleDb , logDb} from "./db";

// 💡 実行中のCronジョブを保持するMapを追加
export const activeCronJobs = new Map<string, any>();

export const scheduleRecurring = (cronExp: string, ids: string[], patch: any, id: string = crypto.randomUUID()) => {
  scheduleDb.add(id, "cron", cronExp, ids, patch);
  
  // 💡 戻り値のジョブインスタンスを変数で受け取る
  const job = Bun.cron(cronExp, () => {
    logDb.add("INFO", "CRON", "EXECUTE_CRON", { cronExp, patch }, ids.join(","));
    // ※ Mapでストップさせるため、毎回のDB生存確認(exists)は不要になります！
    deviceManager.updateDesired(ids, patch);
  });
  
  // 💡 Mapに保存する
  activeCronJobs.set(id, job);
  console.log(`⏰ [定期登録] ${cronExp} -> ${ids.join(",")}`);
};

// 💡 削除用の関数を追加
export const cancelCronJob = (id: string) => {
  const job = activeCronJobs.get(id);
  if (job) {
    job.stop(); // メモリから完全に削除
    activeCronJobs.delete(id);
    console.log(`🛑 [定期解除] メモリ上のジョブを停止しました: ${id}`);
  }
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
  console.log("⏰ スケジューラーを初期化");

  const cronJobs = scheduleDb.getAllCron();
  cronJobs.forEach(row => {
    const ids = JSON.parse(row.target_ids);
    const patch = JSON.parse(row.patch);
    
    // 💡 起動時の復元でもMapに保存する
    const job = Bun.cron(row.trigger, () => {
      deviceManager.updateDesired(ids, patch);
    });
    activeCronJobs.set(row.id, job);
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
          logDb.add("INFO", "CRON", "EXECUTE_ONCE", { trigger: row.trigger, patch }, ids.join(","));
          deviceManager.updateDesired(ids, patch);
          scheduleDb.delete(row.id); // 実行が完了した瞬間にDBから消す
        } else {
          // 待機中にユーザーによってキャンセルされた場合は何もしない
          console.log(`🛑 [キャンセル検知] 待機中に削除された単発ジョブの実行を取りやめました: ${row.id}`);
        }
      }, delay);
    });
  });

  Bun.cron("0 3 * * *", () => {
    logDb.cleanupOldLogs(30);
    console.log("🧹 [ログローテーション] 30日以上前のログを削除しました");
  });
};
import { inventory } from "./inventory";
import { stateDb, logDb } from "./db";
import type { AVDevice } from "./types";

// メモリ上の状態管理
const desiredMap = new Map<string, any>();
const actualMap = new Map<string, any>();

const lastOperationMap = new Map<string, number>();
// クールダウン期間（例: 5000ミリ秒 = 5秒）
const COOLDOWN_MS = 5000;

// 状態が満たされているか判定する純粋関数
const isStateMet = (device: AVDevice, key: string, desired: any, actual: any): boolean => {
  // device.toleratedStates が存在しない機材の場合は、ここが undefined になる
  const tolerated = device.toleratedStates?.[key]?.[desired];
  
  if (tolerated && Array.isArray(tolerated)) {
    return tolerated.includes(actual);
  }
  
  // 許容データがない機材は、今まで通りの完全一致で判定（フォールバック）
  return desired === actual;
};

export const deviceManager = {
  /**
   * 起動時にSQLiteから保存された「理想」の状態を復元する
   */
  init: () => {
    const savedStates = stateDb.loadAll();
    savedStates.forEach(row => {
      const current = desiredMap.get(row.device_id) || {};
      desiredMap.set(row.device_id, { 
        ...current, 
        [row.key]: JSON.parse(row.value) 
      });
    });
    console.log(`[DB] ${savedStates.length} 件の理想状態を復元しました。`);
  },

  /**
   * ユーザー操作やAPIからの「理想」の更新を受け付ける (Fast Pathの起点)
   */
  updateDesired: async (ids: string[], patch: any, options = { immediateOnly: false }) => {
    const now = Date.now();

    for (const id of ids) {
      const device = inventory.find(d => d.id === id) as AVDevice | undefined;
      if (!device) continue;

      let safePatch = patch;

      // 💡 Zodスキーマが定義されていれば、バリデーションとサニタイズを実行
      if (device.zodSchema) {
        // partial() により、一部のキーだけの更新も許可する
        const result = device.zodSchema.partial().safeParse(patch);
        
        if (!result.success) {
          console.warn(`[Validation Error] ${id} への無効な操作をブロックしました:`, result.error.issues);
          continue; // 不正な値が含まれる場合はDBにもメモリにも反映させない
        }
        
        safePatch = result.data; // 未知のキー(unknown_key等)はここで自動的に消える
      }

      // 空のオブジェクトになってしまったらスキップ
      if (Object.keys(safePatch).length === 0) continue;

      const next = { ...(desiredMap.get(id) || {}), ...safePatch };
      desiredMap.set(id, next);
      lastOperationMap.set(id, now);

      if (!options.immediateOnly) {
        // 安全が担保された safePatch のみをDBに書き込む
        Object.keys(safePatch).forEach(key => {
          stateDb.save(id, key, safePatch[key]);
        });
      }
    }

    await deviceManager.syncMany(ids, false, options.immediateOnly);
  },
 
  startPolling: (onSyncFinished?: () => void) => {
    // 分散起動用のインターバル（例：10秒間で200台を捌くなら、1台あたり50msずらす）
    const STAGGER_MS = 50; 

    inventory.forEach((device, index) => {
      const runDeviceLoop = async () => {
        await deviceManager.syncOne(device.id, true);
        if (onSyncFinished) onSyncFinished();
        setTimeout(runDeviceLoop, 10000);
      };

      // 初回起動を少しずつずらす（Thundering Herd対策）
      setTimeout(runDeviceLoop, index * STAGGER_MS);
    });
  },

  /**
   * 複数デバイスの同期を並列実行
   */
  syncMany: async (ids: string[], isSlowPath: boolean, immediateOnly = false) => {
    await Promise.all(ids.map(id => deviceManager.syncOne(id, isSlowPath, immediateOnly)));
  },

  /**
   * 1台のデバイスに対する同期ロジックの核心
   */
  syncOne: async (id: string, isSlowPath: boolean, immediateOnly = false) => {
    const device = inventory.find(d => d.id === id) as AVDevice | undefined;
    if (!device) return;

    const lastOpTime = lastOperationMap.get(id) || 0;
    const isCoolingDown = (Date.now() - lastOpTime) < COOLDOWN_MS;

    // Slow Path（定期監視）の時、クールダウン中なら処理をスキップする
    if (isSlowPath && isCoolingDown) {
      console.log(`[Cool Down] ${id} は操作直後のため監視をスキップします`);
      return; 
    }

    const statusKeys = device.statusKeys || [];
    const actual = { ...(actualMap.get(id) || {}) };
    const desired = desiredMap.get(id) || {};
    
    let networkError = false; // ネットワーク層の失敗（タイムアウト等）
    let controlError = false; // アプリケーション層の失敗（コマンド拒否等）

    // 1. 現実(Actual)の更新 (Slow Path時)
    if (isSlowPath) {
      const pingTask = device.getPingTask();
      if (pingTask) {
        try {
          await pingTask.execute();
        } catch (e) {
          networkError = true; // Ping 失敗
        }

        await Bun.sleep(150);
      }

    for (const key of statusKeys) {
      const task = device.translate(key, "?");
      if (!task) continue;
      try {
        const raw = await task.execute();
        
        // 💡 null 以外（TCPなど、応答があった場合）のみ評価する
          if (raw !== null) {
            if (device.checkError(raw)) {
              console.warn(`[Device Error] ${id} reported error for query: ${key}`);
              controlError = true;
            } else {
              actual[key] = device.parseResponse(key, raw);
            }
          }
        } catch (e) { 
          console.warn(`[Query Failed] ${id}:${key}`);
          networkError = true;
        }
        await Bun.sleep(150);
      }
    }

    // 2. 差分の同期
    
    for (const key of Object.keys(desired)) {
      const isStatus = statusKeys.includes(key);

      // Slow Path時は、Event（状態キー以外）の再送はしない
      if (isSlowPath && !isStatus) continue;

      // isStateMet 関数での判定に置き換え
      if (isStatus && isStateMet(device, key, desired[key], actual[key])) continue;

      const task = device.translate(key, desired[key]);
      if (!task) continue;

      try {
        const response = await task.execute();
        
        // 💡 null 以外で、かつエラー判定に引っかかった場合のみ弾く
        if (response !== null && device.checkError(response)) {
          console.error(`[Sync Rejected] ${id}:${key} -> ${response}`);
          controlError = true;
        } else {
          // 成功時（nullが返ってきたUDPもここを通る）
          const canQuery = device.translate(key, "?") !== null;
          if (!isStatus || immediateOnly || !canQuery) {
            actual[key] = desired[key];
          }
        }
      } catch (e: any) { 
        console.error(`[Sync Failed] ${id}:${key}`);
        networkError = true;
      }
    }

    const isNowOnline = !networkError;
    const isNowError = controlError;
    const prevActual = actualMap.get(id);
    
// 💡 状態が変化した瞬間のみログを記録する（スパム防止）
    if (prevActual) {
      // 1. ネットワーク状態の変化（LAN抜け・復旧など）
      if (prevActual._online !== isNowOnline) {
        if (isNowOnline) {
          logDb.add("INFO", "SYSTEM", "DEVICE_RECOVERED", { message: "通信が復旧しました" }, id);
        } else {
          logDb.add("ERROR", "DEVICE", "DEVICE_OFFLINE", { message: "通信が途絶しました" }, id);
        }
      }

      // 2. 機器の制御エラー状態の変化（コマンド拒否・解消など）
      if (prevActual._error !== isNowError) {
        if (isNowError) {
          logDb.add("ERROR", "DEVICE", "DEVICE_ERROR", { message: "機器がエラーを返しています" }, id);
        } else {
          logDb.add("INFO", "SYSTEM", "ERROR_CLEARED", { message: "機器のエラーが解消しました" }, id);
        }
      }
    }

    actualMap.set(id, { 
      ...actual, 
      _online: isNowOnline, // ネットワーク通信が一度でも失敗すれば false
      _error: isNowError    // デバイスが一度でもエラーを返せば true
    });
  },

  /**
   * 全デバイスを対象とした定期同期 (Slow Path)
   */
  syncAll: async () => {
    const allIds = inventory.map(d => d.id);
    await deviceManager.syncMany(allIds, true);
  },

  /**
   * UI表示用のデータセットを取得
   */
getStatus: () => inventory.map(d => ({
  id: d.id,
  desired: desiredMap.get(d.id) || {},
  actual: actualMap.get(d.id) || { _online: false, _error: false } // 💡 初期状態
}))
};
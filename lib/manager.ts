import { inventory } from "./inventory";
import { stateDb } from "./db";
import type { AVDevice } from "./types";

// メモリ上の状態管理
const desiredMap = new Map<string, any>();
const actualMap = new Map<string, any>();

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
    for (const id of ids) {
      const next = { ...(desiredMap.get(id) || {}), ...patch };
      desiredMap.set(id, next);

      // スライダー操作（immediateOnly）でなければDBに永続化
      if (!options.immediateOnly) {
        Object.keys(patch).forEach(key => {
          stateDb.save(id, key, patch[key]);
        });
      }
    }
    // 操作したデバイスに対して即座に同期を実行 (Fast Path)
    await deviceManager.syncMany(ids, false, options.immediateOnly);
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

    const statusKeys = device.statusKeys || [];

    // 1. 現実(Actual)の更新 (Slow Path時)
    if (isSlowPath) {
      for (const key of statusKeys) {
        const task = device.translate(key, "?");
        if (!task) continue; // BrightSignなどの「問いに答えられない機材」はスキップされる
        try {
          const raw = await task.execute();
          if (raw) {
            const val = device.parseResponse(key, raw);
            actualMap.set(id, { ...(actualMap.get(id) || {}), [key]: val });
          }
        } catch (e) { console.warn(`[Query Failed] ${id}:${key}`); }
      }
    }

    // 2. 差分の同期
    const desired = desiredMap.get(id) || {};
    const actual = actualMap.get(id) || {};
    
    for (const key of Object.keys(desired)) {
      const isStatus = statusKeys.includes(key);

      // Slow Path時は、Event（状態キー以外）の再送はしない
      if (isSlowPath && !isStatus) continue;

      // ★変更：完全一致（===）から、isStateMet 関数での判定に置き換え
      // 【変更前】if (isStatus && desired[key] === actual[key]) continue;
      // 【変更後】
      if (isStatus && isStateMet(device, key, desired[key], actual[key])) continue;

      const task = device.translate(key, desired[key]);
      if (!task) continue;

      try {
        await task.execute();
        
        // 【ポイント】Event、スライダー操作、または「問い合わせ不可の機材」なら
        // 送信成功した瞬間に actual を更新する (楽観的更新)
        const canQuery = device.translate(key, "?") !== null;
        if (!isStatus || immediateOnly || !canQuery) {
          actualMap.set(id, { ...(actualMap.get(id) || {}), [key]: desired[key] });
        }
      } catch (e: any) { console.error(`[Sync Failed] ${id}:${key}`); }
    }
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
    actual: actualMap.get(d.id) || {}
  }))
};
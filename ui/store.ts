// src/ui/store.ts
import van from "vanjs-core";
import { reactive } from "vanjs-ext";

// UIが管理する唯一の「固定」リスト
export const devices = reactive<any[]>([]);
export const status = van.state("サーバー接続中...");

const socket = new WebSocket(`ws://${location.host}/ws`);

socket.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    
    // --- 1. 初回接続時 (INIT): リストの枠組みを固定する ---
    if (msg.type === "INIT") {
      devices.length = 0; // 念のためリセット
      msg.data.forEach((d: any) => {
        // オブジェクト全体をリアクティブにして追加
        devices.push(reactive(d));
      });
      status.val = "オンライン";
    }

    // --- 2. 状態更新時 (SYNC): 中身の値（desired/actual）だけを書き換える ---
    if (msg.type === "SYNC") {
      msg.data.forEach((incoming: any) => {
        const target = devices.find(d => d.id === incoming.id);
        if (target) {
          // 重要: target 自体を差し替えるのではなく、中身のプロパティを更新する
          // これにより、DOM要素（tr）の作り直しが発生しなくなります
          target.desired = incoming.desired;
          target.actual = incoming.actual;
        }
      });
    }
  } catch (e) {
    console.error("データ同期エラー:", e);
  }
};

// 操作送信関数などは変更なし
export const sendUpdate = (ids: string[], patch: any, immediate = false) => {
  socket.send(JSON.stringify({ type: "UPDATE", ids, patch, options: { immediateOnly: immediate } }));
};
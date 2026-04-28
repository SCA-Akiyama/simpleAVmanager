// src/lib/ws-router.ts
import { z } from "zod";
import { deviceManager } from "./manager";
import { scheduleDb } from "./db";

// --- スキーマ定義 ---

const updateMessageSchema = z.object({
  type: z.literal("UPDATE"),
  ids: z.array(z.string()),
  patch: z.record(z.string(), z.any()), 
  options: z.object({ immediateOnly: z.boolean().default(false) }).default({ immediateOnly: false })
});

const addScheduleMessageSchema = z.object({
  type: z.literal("ADD_SCHEDULE"),
  scheduleType: z.enum(["once", "cron"]),
  trigger: z.string(),
  ids: z.array(z.string()),
  patch: z.record(z.string(), z.any()),
});

const getSchedulesMessageSchema = z.object({
  type: z.literal("GET_SCHEDULES"),
  start: z.string().optional(), 
  end: z.string().optional(),
});

// 💡 追加: 削除用スキーマ
const deleteScheduleMessageSchema = z.object({
  type: z.literal("DELETE_SCHEDULE"),
  id: z.string(),
});

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  updateMessageSchema,
  addScheduleMessageSchema,
  getSchedulesMessageSchema,
  deleteScheduleMessageSchema, // 💡 追加
]);

// --- ルーター本体 ---

export const handleClientMessage = async (
  rawMessage: string, 
  broadcastUpdate: () => void,
  sendResponse: (data: any) => void 
) => {
  try {
    const json = JSON.parse(rawMessage);
    const result = wsClientMessageSchema.safeParse(json);

    if (!result.success) {
      console.warn("⚠️ 不正なメッセージ:", result.error.issues);
      return;
    }

    const msg = result.data;

    switch (msg.type) {
      case "UPDATE":
        await deviceManager.updateDesired(msg.ids, msg.patch, msg.options);
        broadcastUpdate();
        break;

      case "ADD_SCHEDULE":
        const { scheduleOnce, scheduleRecurring } = await import("./cron");
        if (msg.scheduleType === "once") {
          scheduleOnce(new Date(msg.trigger), msg.ids, msg.patch);
        } else {
          scheduleRecurring(msg.trigger, msg.ids, msg.patch);
        }
        break;

      case "GET_SCHEDULES":
        let rows: any[];
        if (msg.start && msg.end) {
          const startMs = new Date(msg.start).getTime();
          const endMs = new Date(msg.end).getTime();
          rows = scheduleDb.getRange(startMs, endMs);
        } else {
          rows = scheduleDb.getAll();
        }

        const schedules = rows.map((row: any) => ({
          id: row.id,
          type: row.type,
          trigger: row.trigger,
          ids: JSON.parse(row.target_ids),
          patch: JSON.parse(row.patch)
        }));
        
        sendResponse({ type: "SCHEDULE_LIST", data: schedules });
        break;

      case "DELETE_SCHEDULE":
        // 💡 データベースから削除
        scheduleDb.delete(msg.id);
        console.log(`🗑️ [スケジュール削除] ID: ${msg.id}`);
        // 削除完了を通知
        sendResponse({ type: "SCHEDULE_DELETED", id: msg.id });
        break;
    }
  } catch (error) {
    console.error("❌ Router Error:", error);
  }
};
/**
 * ⚠️ 自動生成ファイル: バックエンドのZodスキーマから生成されています。
 * 直接編集せず、バックエンドのZodスキーマを更新して再生成してください。
 */

// --- 通信メッセージの型 ---
// 💡 export を追加！
export type ClientMessage = {
    type: "UPDATE";
    ids: string[];
    patch: {
        [key: string]: any;
    };
    options: {
        immediateOnly: boolean;
    };
} | {
    type: "ADD_SCHEDULE";
    scheduleType: "once" | "cron";
    trigger: string;
    ids: string[];
    patch: {
        [key: string]: any;
    };
} | {
    type: "GET_SCHEDULES";
    start?: string | undefined;
    end?: string | undefined;
} | {
    type: "DELETE_SCHEDULE";
    id: string;
};

// --- 各デバイスのプロパティ(状態)型 ---
export type PjLinkDeviceState = {
    power: "on" | "off" | "warming" | "cooling";
    shutter: "open" | "close";
    volume: number;
};

export type BrightSignDeviceState = {
    command?: string | undefined;
};

// 汎用的に使えるように全デバイスの状態をまとめたUnion型
export type AnyDeviceState = PjLinkDeviceState | BrightSignDeviceState;
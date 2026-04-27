// lib/devices/deviceTemplate.ts
import { TcpTask, UdpTask } from "../protocols";
import type { AVDevice } from "../types";

/**
 * 【STEP 1】(任意) ファイル内だけで使う定数(辞書)を定義します。
 * translateとparseResponseの間で文字列の打ち間違い(タイポ)を防ぐのに役立ちます。
 */
const States = {
  ON: "on",
  OFF: "off",
  WARMING: "warming",
  COOLING: "cooling",
} as const;

/**
 * 【STEP 2】機材固有の状態(State)や引数の型を定義します。
 * ここに書いた内容が、そのままフロントエンド(VanJS)での補完候補になります。
 */
export type DeviceTemplateSchema = {
  power?: typeof States.ON | typeof States.OFF | typeof States.WARMING | typeof States.COOLING;
  input?: string;
  volume?: number;
  // 解析不要なイベント(ボタン等)もここに型を書いておくと、sendUpdate時に補完が効きます
  trigger_flash?: boolean;
};

/**
 * 【STEP 3】デバイスクラスの実装
 */
export class DeviceTemplate implements AVDevice<DeviceTemplateSchema> {
  // typeは機材ごとにユニークな名前をつけ、必ず 'as const' を付与してください。
  // これにより、フロントエンドでこの機材固有の型が自動判別されるようになります。
  public readonly type = "DeviceTemplate" as const;

  /**
   * 【STEP 4】状態(States)の定義 - 監視・解析(parse)が必要なもの
   * satisfiesキーワードを使うことで、parse関数の書き忘れをTypeScriptがチェックしてくれます。
   */
  private readonly states = {
    power: {
      // 理想(desired)の状態を、実機へのコマンド文字列に変換
      translate: (v: any) => v === "?" ? "POWR ?\r" : (v === States.ON ? "POWR 1\r" : "POWR 0\r"),
      // 実機からの生の応答(raw)を、UI用の値に変換して返す
      parse: (raw: string) => {
        if (raw.includes("POWR=1")) return States.ON;
        if (raw.includes("POWR=0")) return States.OFF;
        if (raw.includes("POWR=2")) return States.COOLING;
        if (raw.includes("POWR=3")) return States.WARMING;
        return raw.trim();
      }
    },
    volume: {
      translate: (v: any) => v === "?" ? "VOLM ?\r" : `VOLM ${v}\r`,
      parse: (raw: string) => raw.match(/=(.*)/)?.[1]?.trim() || raw.trim()
    }
  } satisfies Record<string, { translate: (v: any) => string; parse: (raw: string) => string }>;

  /**
   * 【STEP 5】イベント(Events)の定義 - 送信のみで、状態の解析(parse)が不要なもの
   */
  private readonly events = {
    trigger_flash: {
      translate: (v: any) => "FLASH 1\r"
    }
  } satisfies Record<string, { translate: (v: any) => string }>;

  /**
   * 【STEP 6】自動生成される状態キーリスト
   * statesのキー(["power", "volume"])が自動で入ります。手動で更新する必要はありません。
   */
  public readonly statusKeys = Object.keys(this.states);

  /**
   * 【STEP 7】許容状態(Tolerated States)の設定
   * 「理想と現実が完全に一致していなくても、コマンドの再送を止めて待機してほしい」場合に定義します。
   * 例: 電源ONを命じた後、実機が暖機中(warming)であれば、いずれONになるので再送をスキップします。
   */
  public readonly toleratedStates: Record<string, Record<string, string[]>> = {
    power: {
      [States.ON]: [States.ON, States.WARMING],
      [States.OFF]: [States.OFF, States.COOLING]
    }
  };

  constructor(public id: string, public ip: string, public port = 8080) {}

  /**
   * マネージャーから呼ばれる共通の変換メソッド
   */
  translate(key: string, value: any) {
    if (value === "?") {
       // 問い合わせ不可の機材(UDP等)の場合は、ここで null を返せばスキップされます
    }
    const handler = (this.states as any)[key] || (this.events as any)[key];
    const payload = handler?.translate(value);
    
    // プロトコルに合わせて TcpTask か UdpTask を選んで返します
    return payload ? new TcpTask(this.id, this.ip, this.port, String(payload)) : null;
  }

  /**
   * マネージャーから呼ばれる共通の解析メソッド
   */
  parseResponse(key: string, raw: string) {
    const parser = (this.states as any)[key]?.parse;
    return parser ? parser(raw) : raw.trim();
  }
}

# Simple AV Manager

理想状態（Desired）と現実状態（Actual）を分離して管理する、堅牢かつ拡張性の高いAV機器マネージングツール・テンプレートです。

## 核心的なコンセプト：Desired vs Actual
本プロジェクトは、ネットワーク的に不安定なことが多いAV機器の制御において、「システムがどうあるべきか（Desired）」と「機器が今どうなっているか（Actual）」を厳格に分けて管理します。

- **Fast Path (更新用)**: ユーザー操作により「理想」を即座に書き換え、機器へコマンドを送信します。
- **Slow Path (監視用)**: 定期的（デフォルト10秒）に実機へ状態を問い合わせ、現実の状態を「理想」に同期、またはUIへフィードバックします。

## 主な特徴

### 1. デバイス定義の標準化（Factory Pattern）
`factory.ts` による抽象化により、新しいデバイスの追加が非常に簡単です。ロジック（どう通信するか）ではなく、データ（どのコマンドを投げるか）の定義に集中できます。
- **規律**: 誰が書いても同じ構造のデバイススクリプトになります。
- **柔軟性**: TCP, UDP などのプロトコルを定義一つで切り替え可能です。

### 2. 型安全性（TypeScript + Schema）
各デバイスの「状態」を `Schema` として定義することで、フロントエンドからバックエンドまで一貫した型補完が効きます。ボリュームの範囲や電源の列挙型など、IDEによる強力なサポートを受けながら開発できます。

### 3. リアクティブなUI（VanJS）
`VanJS` と `vanjs-ext` を採用。軽量でありながら、バックエンドの状態変化を即座にダッシュボードへ反映します。

### 4. 状態の永続化（SQLite）
「理想の状態」は SQLite (`state.db`) に保存されるため、システムの再起動後も直前の設定が自動的に復元されます。

## ディレクトリ構造

```text
├── main.ts             # サーバー・WebSocket・同期ループの定義
├── lib/
│   ├── manager.ts      # 状態管理・同期ロジックの核心
│   ├── factory.ts      # デバイスインスタンスの生成工場
│   ├── inventory.ts    # 機器リストの定義
│   ├── protocols.ts    # 通信プロトコル (TCP/UDP) の実装
│   ├── db.ts           # SQLite 永続化レイヤー
│   ├── types.ts        # 共通型定義
│   └── devices/        # 各機器の定義ファイル
│       ├── PjLinkDevice.ts
│       └── BrightSignDevice.ts
└── ui/                 # フロントエンド (VanJS)
    ├── app.ts          # エントリポイント
    ├── store.ts        # WebSocket通信・リアクティブデータ
    └── pages/
        └── dashboard.ts # 監視・操作パネル
```

## セットアップ

### 開発環境
- [Bun](https://bun.sh/) (Runtime)

### インストール
```bash
bun install
```

### 起動
```bash
# サーバー起動 (デフォルト: http://localhost:3000)
bun run main.ts
```

## 新しいデバイスの追加方法

`src/lib/devices/` 内に新しいファイルを作成し、`DeviceDefinition` に従ったオブジェクトを定義するだけです。

```typescript
// 例: MyDevice.ts
export const myDeviceDef: DeviceDefinition<MySchema> = {
  type: "MyDevice",
  protocol: "TCP",
  defaultPort: 8080,
  states: {
    power: {
      translate: (v) => v === "?" ? "GET_PWR" : `SET_PWR ${v}`,
      parse: (raw) => raw === "ON" ? "on" : "off"
    }
  }
};
```

その後、`lib/inventory.ts` に IPアドレスとIDを登録すれば完了です。

## 今後の改善予定
- サーバー同期ループの安全性向上（再帰的 setTimeout への移行）
- インベントリ情報の外部ファイル (JSON/YAML) 化
- UIへの通信エラー状態のフィードバック
- データベース保存のデバウンス処理


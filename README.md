# AV State Orchestrator (Project: "Desired vs Actual")

このプロジェクトは、**「理想（Desired）」と「現実（Actual）」の差分を埋める**という一貫した哲学に基づいた、Bun製のAV機器制御バックエンドシステムです。

## **1. コア・コンセプト: Reconciliation (調停)**

AV機器の現場では「コマンドを送ったはずなのに動いていない」という不整合が頻発します。本システムはこれを解決するため、以下のループを回し続けます。

* **Desired (理想)**: ユーザーが「こうあってほしい」と願う状態（DB/メモリに保存）。
* **Actual (現実)**: ポーリング（問い合わせ）によって判明した実機の生の状態。
* **Reconciliation (調停)**: 理想と現実が異なれば、**一致するまで命令を送り続ける**。
* **Tolerated States (許容状態)**: プロジェクターの暖機（Warming）のように「いずれ理想に到達する移行状態」を定義することで、機材への不要な連打を防ぎつつ、安全に待機します。

## **2. システム・アーキテクチャ**

### **バックエンド (Bun + SQLite)**
* **Manager**: `isStateMet` 関数による宣言的な判定。機材固有のロジックをコアから排除し、高い汎用性を維持。
* **Inventory**: 機材名簿。ここを更新するだけで、フロントエンドまでの型情報が自動的に同期されます。
* **Protocols**: `TcpTask` / `UdpTask` による非同期通信の抽象化。

### **デバイス定義 (lib/devices/)**
各機材を「状態（States）」と「イベント（Events）」に分離して定義します。
* **States**: 解析（parse）が必須な監視対象。`statusKeys` はここから自動生成されます。
* **Events**: 投げっぱなしのコマンド。再送制御の対象外。
* **Type Safety**: 各デバイスが持つ `_schema` 型により、VS Code上での完璧な補完を実現。

## **3. 開発者向けルール: 新しい機材の追加**

機材を追加する際の手順は以下の通りです。

1.  `lib/devices/deviceTemplate.ts` をコピーして新しいファイルを作成。
2.  `states` と `events` を埋める（`satisfies` により、parse関数の書き忘れはコンパイルエラーになります）。
3.  必要に応じて `toleratedStates` で移行状態（Warming等）を定義。
4.  `lib/inventory.ts` の `inventory` 配列に `new` して追加。

**これにより、フロントエンドのコードを一行も書き換えることなく、UI開発時に新しい機材のキーが補完候補に出現するようになります。**

## **4. 技術スタック**

* **Runtime**: Bun
* **Database**: SQLite (desired_statesテーブルによる永続化)
* **Communication**: WebSocket (リアルタイム同期)
* **Frontend**: VanJS (軽量・リアクティブUI)
* **Language**: TypeScript (End-to-Endの型安全)

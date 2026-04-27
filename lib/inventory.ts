// src/lib/inventory.ts
import { PjLinkDevice } from "./devices/PjLinkDevice";
import { BrightSignDevice } from "./devices/BrightSignDevice";

// 今後やることは、この配列に機材を1行足すことだけ！
export const inventory = [
  new PjLinkDevice("pj-01", "192.168.1.100"),
  new BrightSignDevice("bs-01", "192.168.1.110"),
] as const; // ★ as const を付けるのがポイント

// --- 【一度だけ書く魔法】これ以降は二度と触らなくてOK ---
export type FrontendDevice = typeof inventory[number] extends { 
  id: infer I, 
  type: infer T, 
  // クラス内の _schema から型を抽出（前回提案のポケット）
  _schema?: infer S 
} ? { 
  id: I, 
  type: T, 
  desired: Partial<S>, 
  actual: Partial<S> 
} : never;
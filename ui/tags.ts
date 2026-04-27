import van from "vanjs-core";

// TypeScriptが標準で持っている全HTMLタグのリスト (HTMLElementTagNameMap) を
// VanJSのタグ関数の型に変換します
type VanTags = {
  [K in keyof HTMLElementTagNameMap]: (...args: any[]) => HTMLElementTagNameMap[K];
} & Record<string, (...args: any[]) => Element>;

// 全てのタグが入った「魔法のオブジェクト」を作る
export const tags = van.tags as unknown as VanTags;
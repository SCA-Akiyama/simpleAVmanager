// src/ui/pages/dashboard.ts
import { list } from "vanjs-ext";
import { tags } from "../tags";
import { devices, sendUpdate } from "../store";

export const Dashboard = () => {
  return tags.table({ class: "striped" },
    tags.thead(
      tags.tr(tags.th("デバイスID"), tags.th("理想"), tags.th("現実"), tags.th("操作"))
    ),
    // list関数は「配列の要素（deviceオブジェクト）」とDOM（tr）を1対1で結びつけます
    list(tags.tbody(), devices, (device) => 
      tags.tr(
        tags.td(device.val.id),
        // () => で囲むことで、中身のプロパティが更新された時だけここが書き換わります
        tags.td(() => tags.span({ class: "badge" }, device.val.desired.power || "-")),
        tags.td(() => tags.span({ class: "badge" }, device.val.actual.power || "-")),
        tags.td(
          tags.button({
            onclick: () => sendUpdate([device.val.id], { power: "on" }),
            class: "outline"
          }, "ON"),
          tags.button({
            onclick: () => sendUpdate([device.val.id], { power: "off" }),
            class: "outline secondary"
          }, "OFF")
        )
      )
    )
  );
};
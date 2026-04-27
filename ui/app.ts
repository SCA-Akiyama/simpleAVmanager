// src/ui/app.ts
import van from "vanjs-core";
import { status } from "./store";
import { tags } from "./tags";
import { Dashboard } from "./pages/dashboard";

export const App = () => {
  return tags.main({ class: "container" },
    tags.header(
      tags.h1("Simple AV Manager"),
      tags.p("ステータス: ", status)
    ),
    tags.article(
      Dashboard()
    )
  );
};

van.add(document.body, App());
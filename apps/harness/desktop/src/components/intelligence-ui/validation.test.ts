import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLibrary, createParser, Renderer } from "@openuidev/react-lang";
import { definitions } from "./schema";
import { defineValidatedComponent } from "./validated-component";

const library = createLibrary({
  root: "Stack",
  components: [
    defineValidatedComponent({
      ...definitions.Stack,
      component: ({ props, renderNode }) =>
        React.createElement("section", null, renderNode(props.children)),
    }),
    defineValidatedComponent({
      ...definitions.Table,
      component: ({ props }) =>
        React.createElement("p", null, `${props.title}: ${props.rows.length}`),
    }),
    defineValidatedComponent({
      ...definitions.Form,
      component: ({ props }) => React.createElement("p", null, props.name),
    }),
  ],
});

function render(response: string, isStreaming = false) {
  return renderToStaticMarkup(
    React.createElement(Renderer, { response, library, isStreaming }),
  );
}

test("the rendered component enforces row limits omitted by the permissive parser", () => {
  const rows = Array.from({ length: 501 }, () => ["cell"]);
  const response = `root = Stack([table])\ntable = Table("Rows", ["Column"], ${JSON.stringify(rows)})`;
  const result = createParser(library.toJSONSchema(), library.root).parse(
    response,
  );
  assert.deepEqual(result.meta.errors, []);
  assert.throws(() => render(response), /Invalid Table component props/);
});

test("valid bounded components still render through the real OpenUI renderer", () => {
  assert.ok(
    render(
      'root = Stack([table])\ntable = Table("Rows", ["Column"], [["cell"]])',
    ).includes("Rows: 1"),
  );
});

test("invalid form identifiers are rejected before reaching the state store", () => {
  const response =
    'root = Stack([form])\nform = Form("constructor", "Choice", [{name: "scope", label: "Scope", type: "text"}], "Go")';
  assert.throws(() => render(response), /Invalid Form component props/);
});

test("invalid or incomplete props stay hidden while a response is streaming", () => {
  const response = 'root = Stack([table])\ntable = Table("Rows", [], [])';
  assert.doesNotThrow(() => render(response, true));
  assert.ok(!render(response, true).includes("Rows: 0"));
});

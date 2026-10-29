import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary, openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { intelligenceLibrary } from "./library";
import { definitions, validUiState } from "./schema";
import { validateUiProgram } from "./validation";
import { sampleOpenUiProgram } from "../../../tests/openui.fixture";

function render(response: string, isStreaming = false) {
  return renderToStaticMarkup(
    React.createElement(Renderer, {
      response,
      library: intelligenceLibrary,
      isStreaming,
      publishObservability: false,
    }),
  );
}

test("the actual production renderer enforces limits on native components", () => {
  const values = Array.from({ length: 501 }, () => "cell");
  const response =
    'root = Stack([table])\ntable = Table([col])\ncol = Col("Rows", ' +
    JSON.stringify(values) +
    ")";
  assert.ok(validateUiProgram(response).errors.length > 0);
  assert.throws(() => render(response), /Invalid .* component props/);
});

test("the production library renders valid native components and shares all prompt contracts", () => {
  assert.deepEqual(
    Object.keys(intelligenceLibrary.components),
    Object.keys(definitions),
  );
  const response =
    'root = Stack([text])\ntext = TextContent("Valid native content")';
  assert.deepEqual(validateUiProgram(response).errors, []);
  assert.ok(render(response).includes("Valid native content"));
});

test("the catalog contains only upstream components and preserves their positional signatures", () => {
  const upstream = {
    ...openuiLibrary.components,
    ...Object.fromEntries(
      ["FollowUpBlock", "FollowUpItem", "SectionBlock", "SectionItem"].map(
        (name) => [name, openuiChatLibrary.components[name]],
      ),
    ),
  };
  assert.deepEqual(Object.keys(definitions).sort(), Object.keys(upstream).sort());
  for (const [name, definition] of Object.entries(definitions)) {
    assert.equal(definition.component, upstream[name]!.component, name);
    assert.deepEqual(
      Object.keys(definition.props.shape),
      Object.keys(upstream[name]!.props.shape),
      name,
    );
  }
  assert.equal(definitions.Metric, undefined);
  assert.ok(
    validateUiProgram('root = Stack([Metric("Revenue", "42")])').errors.length,
  );
});

test("the real browser fixture validates and renders native nested charts, tabs and forms", () => {
  assert.deepEqual(validateUiProgram(sampleOpenUiProgram).errors, []);
  const html = render(sampleOpenUiProgram);
  assert.ok(html.includes("Send review"));
  assert.ok(html.includes('name="notes"'));
});

test("state identifiers and credentials are rejected by active contracts", () => {
  assert.equal(
    definitions.Input!.props.safeParse({ name: "constructor", type: "text" })
      .success,
    false,
  );
  assert.equal(
    definitions.Input!.props.safeParse({ name: "secret", type: "password" })
      .success,
    false,
  );
  assert.equal(
    definitions.Input!.props.safeParse({ name: "scope", type: "text" }).success,
    true,
  );
  assert.equal(
    validUiState(JSON.parse('{"__proto__":{"polluted":true}}')),
    false,
  );
  assert.equal(validUiState({ values: Array(501).fill(0) }), false);
  assert.equal(validUiState({ bad: Infinity }), false);
});

test("streaming incomplete props remain hidden and tool operations are rejected", () => {
  assert.doesNotThrow(() =>
    render("root = Stack([text])\ntext = TextContent(", true),
  );
  assert.ok(
    validateUiProgram(
      'root = Stack([text])\ntext = TextContent("x")\ndata = Query("read_file", {})',
    ).errors.length,
  );
});

test("all active contracts reject oversized nested text and non-finite numeric payloads", () => {
  assert.equal(
    definitions.TextContent!.props.safeParse({ text: "a".repeat(20001) })
      .success,
    false,
  );
  assert.equal(
    definitions.Col!.props.safeParse({ label: "n", data: [NaN] }).success,
    false,
  );
});

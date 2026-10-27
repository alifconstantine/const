import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGoogleMcpHandler,
  GOOGLE_TOOLS,
} from "../../../../accounts/src/lib/google-mcp";
const origin = "https://accounts.const.web.id";
const call = (
  name: string,
  args: object = {},
  extra: Record<string, string> = {},
) =>
  new Request(origin + "/mcp/google/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fixture-token",
      ...extra,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
test("Google MCP initialization validates the token before reporting a connection", async () => {
  let revoked = false;
  const handler = createGoogleMcpHandler({
    fetch: async (input, init) => {
      assert.equal(
        String(input),
        "https://openidconnect.googleapis.com/v1/userinfo",
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer fixture-token",
      );
      return revoked
        ? new Response(null, { status: 401 })
        : Response.json({ sub: "fixture-account" });
    },
  });
  const initialize = () =>
    new Request(origin + "/mcp/google/docs", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      }),
    });
  const response = await handler(initialize(), "docs");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.protocolVersion, "2025-06-18");
  revoked = true;
  assert.equal((await handler(initialize(), "docs")).status, 401);
});
test("Google MCP maps REST methods, encoded resource IDs, pagination, formulas and update masks without cross-app access", async () => {
  const calls: { url: URL; init: RequestInit }[] = [];
  const handler = createGoogleMcpHandler({
    fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer fixture-token",
      );
      assert.equal(init?.redirect, "error");
      calls.push({ url, init: init! });
      return Response.json({ id: "resource-1", nextPageToken: "page-2" });
    },
  });
  const cases = [
    [
      "drive",
      "list_files",
      { q: "trashed = false", pageToken: "page-1", pageSize: 25 },
      "GET",
      "www.googleapis.com",
      "/drive/v3/files",
    ],
    [
      "docs",
      "batch_update_document",
      {
        documentId: "doc/with?query",
        requests: [{ insertText: { endOfSegmentLocation: {}, text: "hello" } }],
        writeControl: { requiredRevisionId: "rev-1" },
      },
      "POST",
      "docs.googleapis.com",
      "/v1/documents/doc%2Fwith%3Fquery:batchUpdate",
    ],
    [
      "sheets",
      "update_values",
      {
        spreadsheetId: "book-1",
        range: "Tab 1!A1:B2",
        values: [["=SUM(A1:A2)", 2]],
        valueInputOption: "USER_ENTERED",
      },
      "PUT",
      "sheets.googleapis.com",
      "/v4/spreadsheets/book-1/values/Tab%201!A1%3AB2",
    ],
    [
      "slides",
      "batch_update_presentation",
      {
        presentationId: "deck-1",
        requests: [{ createSlide: { objectId: "page-1" } }],
      },
      "POST",
      "slides.googleapis.com",
      "/v1/presentations/deck-1:batchUpdate",
    ],
    [
      "calendar",
      "create_event",
      {
        calendarId: "person@example.test",
        event: {
          summary: "Review",
          start: { dateTime: "2026-10-27T09:00:00+07:00" },
          end: { dateTime: "2026-10-27T10:00:00+07:00" },
        },
      },
      "POST",
      "www.googleapis.com",
      "/calendar/v3/calendars/person%40example.test/events",
    ],
    [
      "classroom",
      "update_coursework",
      {
        courseId: "course-1",
        courseWorkId: "assignment-1",
        courseWork: { title: "Updated" },
        updateMask: "title",
      },
      "PATCH",
      "classroom.googleapis.com",
      "/v1/courses/course-1/courseWork/assignment-1",
    ],
  ] as const;
  for (const [app, name, args, method, host, path] of cases) {
    const result = await (await handler(call(name, args), app)).json();
    assert.equal(result.result.isError, undefined);
    assert.match(result.result.content[0].text, /page-2/);
    const actual = calls.at(-1)!;
    assert.equal(actual.init.method, method);
    assert.equal(actual.url.hostname, host);
    assert.equal(actual.url.pathname, path);
  }
  assert.equal(calls[0]!.url.searchParams.get("pageToken"), "page-1");
  assert.equal(
    JSON.parse(calls[1]!.init.body as string).writeControl.requiredRevisionId,
    "rev-1",
  );
  assert.equal(
    calls[2]!.url.searchParams.get("valueInputOption"),
    "USER_ENTERED",
  );
  assert.equal(
    JSON.parse(calls[2]!.init.body as string).values[0][0],
    "=SUM(A1:A2)",
  );
  assert.equal(calls[4]!.url.searchParams.get("sendUpdates"), "none");
  assert.equal(calls[5]!.url.searchParams.get("updateMask"), "title");
  const count = calls.length;
  for (const [app, name, args] of [
    ["docs", "list_messages", {}],
    ["drive", "get_file", { fileId: ".." }],
    [
      "docs",
      "get_document",
      { documentId: "doc", url: "https://evil.example" },
    ],
    [
      "sheets",
      "update_values",
      { spreadsheetId: "book", range: "A1", values: [[{}]] },
    ],
  ] as const) {
    const result = await (await handler(call(name, args), app)).json();
    assert.ok(result.error || result.result.isError);
  }
  assert.equal(
    calls.length,
    count,
    "invalid inputs never reach a network destination",
  );
});
test("Gmail draft uses authenticated sender, Unicode-safe MIME, and cannot inject recipient headers; sending is a separate tool", async () => {
  let raw = "";
  let sends = 0;
  const handler = createGoogleMcpHandler({
    fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/profile"))
        return Response.json({ emailAddress: "sender@example.test" });
      if (url.pathname.endsWith("/drafts/send")) sends++;
      else raw = JSON.parse(String(init?.body)).message.raw;
      return Response.json({ id: "draft-1" });
    },
  });
  const subject =
    "日本語の下書き 🐱".repeat(12) + "\r\nBcc: injected@example.test";
  const draft = await (
    await handler(
      call("create_draft", {
        to: ["receiver@example.test"],
        subject,
        body: "Halo\n日本語",
      }),
      "gmail",
    )
  ).json();
  assert.equal(draft.result.isError, undefined);
  const mime = Buffer.from(raw, "base64url").toString();
  assert.match(
    mime,
    /^From: sender@example.test\r\nto: receiver@example.test\r\n/,
  );
  assert.ok(!mime.includes("\r\nBcc:"));
  const decoded = [...mime.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)]
    .map((v) => Buffer.from(v[1]!, "base64").toString())
    .join("");
  assert.equal(decoded, subject);
  assert.equal(
    Buffer.from(
      mime.split("\r\n\r\n")[1]!.replaceAll("\r\n", ""),
      "base64",
    ).toString(),
    "Halo\n日本語",
  );
  assert.equal(sends, 0);
  const bad = await (
    await handler(
      call("create_draft", {
        to: ["receiver@example.test\r\nBcc: bad@example.test"],
        subject: "hi",
        body: "hi",
      }),
      "gmail",
    )
  ).json();
  assert.equal(bad.result.isError, true);
  await handler(call("send_draft", { draftId: "draft-1" }), "gmail");
  assert.equal(sends, 1);
});
test("Google MCP refuses foreign origins, missing auth and invalid requests; bounds output and classifies API failures without leaking responses", async () => {
  let status = 403;
  const handler = createGoogleMcpHandler({
    fetch: async () =>
      new Response(
        status === 200 ? "x".repeat(2_000_001) : "private provider response",
        { status, headers: { "Content-Type": "text/plain" } },
      ),
  });
  assert.equal(
    (
      await handler(
        call(
          "get_document",
          { documentId: "doc" },
          { Origin: "https://evil.example" },
        ),
        "docs",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handler(
        call("get_document", { documentId: "doc" }, { Authorization: "" }),
        "docs",
      )
    ).status,
    401,
  );
  assert.equal((await handler(new Request(origin), "docs")).status, 405);
  assert.equal((await handler(call("get_document"), "unknown")).status, 404);
  for (const code of [403, 404, 429, 500]) {
    status = code;
    const body = await (
      await handler(call("get_document", { documentId: "doc" }), "docs")
    ).text();
    assert.ok(
      body.includes('"isError":true') &&
        !body.includes("private provider response"),
    );
  }
  status = 401;
  assert.equal(
    (await handler(call("get_document", { documentId: "doc" }), "docs")).status,
    401,
  );
  status = 200;
  const large = await (
    await handler(call("get_document", { documentId: "doc" }), "docs")
  ).json();
  assert.match(large.result.content[0].text, /too large/);
  for (const tools of Object.values(GOOGLE_TOOLS)) {
    assert.ok(tools.length >= 3);
    assert.equal(new Set(tools.map((t) => t.name)).size, tools.length);
    assert.ok(
      tools.every((t) => t.inputSchema.type === "object" && t.annotations),
    );
  }
});

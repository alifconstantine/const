import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ArtCraftApp } from "../src/lib/mcp/artcraft";

type Call = (name: string, args?: Record<string, unknown>) => Promise<any>;
/** Small authored documents exercise actual edit/save/open/render, rather than just initialize. */
export async function verifyArtcraftWorkflow(
  app: ArtCraftApp,
  output: string,
  call: Call,
  fixture: string,
) {
  const file = (name: string) => path.join(output, name);
  let native: string | undefined;
  let preview: string | undefined;
  switch (app) {
    case "photocraft":
      await call("doc_new", {
        width: 320,
        height: 180,
        name: "Const MCP test",
        background: "#3366aa",
      });
      await call("command_run", {
        id: "layer.new.layer",
        params: { name: "Const layer" },
      });
      native = file("smoke.pcraft");
      preview = file("smoke.png");
      await call("doc_save", { path: native });
      await call("doc_save", { path: preview });
      await call("doc_open", { path: native });
      assert.match(JSON.stringify(await call("doc_inspect")), /Const layer/);
      fs.copyFileSync(preview, path.join(fixture, "input.png"));
      break;
    case "vectorcraft":
      await call("run_command", {
        command: "file.new",
        params: { name: "Const test", width: 320, height: 180 },
      });
      await call("run_command", {
        command: "shape.rectangle",
        params: { x: 20, y: 20, width: 100, height: 80 },
      });
      native = file("smoke.vectorcraft");
      preview = file("smoke.svg");
      await call("save_file", { path: native });
      await call("export", { path: preview });
      await call("open_file", { path: native });
      await call("inspect_document");
      break;
    case "filmcraft":
      await call("command_run", {
        id: "file.newProject",
        params: { name: "Const test" },
      });
      await call("command_run", {
        id: "file.newSequence",
        params: { name: "Const sequence", width: 320, height: 180, fps: 24 },
      });
      native = file("smoke.fcproj");
      await call("command_run", {
        id: "file.saveAs",
        params: { path: native },
      });
      await call("command_run", { id: "file.open", params: { path: native } });
      assert.match(
        JSON.stringify(await call("project_inspect")),
        /Const sequence/,
      );
      await call("render_frame", { max_side: 320 });
      break;
    case "lightcraft": {
      await call("import", {
        paths: [path.join(fixture, "input.png")],
        mode: "copy",
        organize: "flat",
      });
      const photos = await call("query_photos");
      assert.match(JSON.stringify(photos), /input/);
      await call("set_develop", { values: { "light.exposure": 0.25 } });
      preview = file("smoke.png");
      await call("render_photo", { path: preview, size: 320 });
      native = path.join(output, "library", "catalog.snap");
      break;
    }
    case "pdfcraft": {
      const created = await call("doc_create", {
        from: "blank",
        width: 320,
        height: 180,
      });
      const doc = created.doc ?? created.id ?? created.document?.id;
      assert.ok(doc, JSON.stringify(created));
      await call("page_add_text", {
        doc,
        page: 1,
        text: "Const MCP test",
        at: [20, 40],
      });
      native = file("smoke.pdf");
      await call("doc_save", { doc, path: native });
      await call("doc_open", { path: native });
      await call("page_render", { doc, page: 1, dpi: 72 });
      break;
    }
    case "effectcraft":
      await call("open_project", { new: true });
      await call("command_run", {
        id: "comp.new",
        params: {
          name: "Const comp",
          width: 320,
          height: 180,
          duration: 1,
          frameRate: 24,
        },
      });
      await call("command_run", {
        id: "layer.newText",
        params: { text: "Const test", position: [50, 60], size: 24 },
      });
      native = file("smoke.ecproj");
      preview = file("smoke.png");
      await call("save_project", { path: native });
      await call("open_project", { path: native });
      await call("render_frame", { path: preview, max_side: 320 });
      break;
    case "designcraft":
      await call("new_document", {
        title: "Const test",
        width: 320,
        height: 180,
        pages: 1,
      });
      await call("execute", {
        command: "frame.create",
        params: {
          rect: [20, 20, 250, 100],
          content: "text",
          text: "Const test",
        },
      });
      native = file("smoke.designcraft");
      preview = file("smoke.png");
      await call("save_document", { path: native });
      await call("open_document", { path: native });
      await call("export_png", { path: preview, scale: 1 });
      break;
    case "figcraft":
      await call("create_node", {
        type: "frame",
        name: "Const frame",
        width: 320,
        height: 180,
        props: { fill: "#3366aa" },
      });
      native = file("smoke.figcraft");
      preview = file("smoke.svg");
      await call("save_file", { path: native });
      await call("open_file", { path: native });
      assert.match(
        JSON.stringify(await call("inspect_document")),
        /Const frame/,
      );
      await call("export", { path: preview, format: "svg" });
      break;
    case "wordcraft":
      await call("new_document", { template: "blank" });
      await call("type_text", { text: "Const MCP test" });
      native = file("smoke.docx");
      await call("save_document", { path: native });
      await call("open_document", { path: native });
      assert.match(JSON.stringify(await call("get_text")), /Const MCP test/);
      await call("render_page", { page: 1, scale: 0.5 });
      break;
    case "soundcraft": {
      const samples = 4800;
      const wav = Buffer.alloc(44 + samples * 2);
      wav.write("RIFF");
      wav.writeUInt32LE(wav.length - 8, 4);
      wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(48000, 24);
      wav.writeUInt32LE(96000, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write("data", 36);
      wav.writeUInt32LE(samples * 2, 40);
      for (let i = 0; i < samples; i++)
        wav.writeInt16LE(
          Math.round(3000 * Math.sin((i * 2 * Math.PI * 440) / 48000)),
          44 + i * 2,
        );
      fs.writeFileSync(file("input.wav"), wav);
      await call("new_session", { name: "Const test", template: "blank" });
      await call("import_audio", { path: file("input.wav") });
      native = file("smoke.soundcraft");
      preview = file("smoke.wav");
      await call("save_session", { path: native });
      await call("open_session", { path: native });
      await call("bounce_mix", {
        path: preview,
        format: "wav",
        start: 0,
        end: 0.1,
      });
      break;
    }
    case "deckcraft":
      await call("new_presentation");
      await call("add_text_box", { x: 20, y: 20, w: 300, text: "Const test" });
      native = file("smoke.deckcraft");
      preview = file("smoke.png");
      await call("save_presentation", { path: native });
      await call("open_presentation", { path: native });
      await call("export", { path: preview, format: "png", scale: 0.5 });
      break;
    case "cadcraft":
      await call("new_drawing", { metric: true });
      await call("execute", {
        command: "line",
        params: {
          points: [
            [0, 0],
            [100, 100],
          ],
        },
      });
      native = file("smoke.dxf");
      preview = file("smoke.png");
      await call("save", { path: native });
      await call("open", { path: native });
      await call("render", {
        path: preview,
        fit: true,
        width: 320,
        height: 180,
      });
      break;
    case "gridcraft":
      await call("new_workbook");
      await call("set_cell", { cell: "A1", input: "Const test" });
      await call("set_cell", { cell: "B1", input: "=1+2" });
      native = file("smoke.xlsx");
      preview = file("smoke.csv");
      await call("save_workbook", { path: native });
      await call("save_workbook", { path: preview });
      await call("open_workbook", { path: native });
      assert.match(
        JSON.stringify(await call("read_range", { range: "A1:B1" })),
        /Const test/,
      );
      break;
  }
  for (const target of [native, preview].filter((f): f is string => !!f))
    assert.ok(fs.statSync(target).size > 0, `Missing artifact ${target}`);
  return { native, preview };
}

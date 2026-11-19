import { build } from "esbuild";
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";

const source = new URL("./", import.meta.url);
const output = new URL("../../index.html", source);
const options = {
  absWorkingDir: fileURLToPath(source),
  entryPoints: ["js/main.js", "styles/index.css"],
  outdir: "bundle",
  bundle: true,
  format: "iife",
  write: false,
  loader: { ".woff2": "dataurl", ".jpg": "dataurl", ".mp4": "dataurl" },
};
const { outputFiles } = await build(options);
const css = outputFiles.find((file) => file.path.endsWith(".css")).text;
const js = outputFiles.find((file) => file.path.endsWith(".js")).text;

let html = await readFile(new URL("index.template.html", source), "utf8");
const mime = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};
for (const match of html.matchAll(/\bsrc="([^"]+)"/g)) {
  const path = match[1];
  const type = mime[extname(path)];
  if (!type) throw new Error(`Tipo de recurso sin definir: ${path}`);
  const bytes = await readFile(new URL(path, source));
  html = html.replace(
    match[0],
    () => `src="data:${type};base64,${bytes.toString("base64")}"`,
  );
}

html = html.replace("<!-- styles -->", () => `<style>\n${css}</style>`);
html = html.replace("<!-- app -->", () => `<script>\n${js}</script>`);
const temporary = new URL(`./.index-${randomUUID()}.tmp`, output);
await writeFile(temporary, html);
await rename(temporary, output);

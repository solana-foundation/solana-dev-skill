#!/usr/bin/env node
// Generates a typed SDK from a Solana program IDL using Codama renderers.
// Follows Castaway's codama-generate.ts logic:
//   1. Read IDL JSON (Anchor or native Codama format)
//   2. Create Codama node tree
//   3. Render to the target language
//
// Usage: node generate-sdk.mjs --idl <path> [--lang js|js-umi|rust|go] [--out <dir>]

import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor as renderJs } from "@codama/renderers-js";
import { renderVisitor as renderJsUmi } from "@codama/renderers-js-umi";
import { renderVisitor as renderRust } from "@codama/renderers-rust";
import { renderVisitor as renderGo } from "@codama/renderers-go";
import { readFileSync, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve } from "node:path";

const { values } = parseArgs({
  options: {
    idl: { type: "string" },
    lang: { type: "string", default: "js" },
    out: { type: "string", default: "./generated-sdk" },
  },
});

if (!values.idl) {
  console.error(
    "Usage: node generate-sdk.mjs --idl <path> --lang <js|js-umi|rust|go> --out <dir>"
  );
  process.exit(1);
}

// Read and parse IDL
const idlPath = resolve(values.idl);
let raw;
try {
  raw = JSON.parse(readFileSync(idlPath, "utf-8"));
} catch (err) {
  console.error(`Failed to read IDL at ${idlPath}: ${err.message}`);
  process.exit(1);
}

// Detect format: native Codama root nodes have kind === "rootNode"
const isAnchor = raw.kind !== "rootNode";
const codama = isAnchor
  ? createFromRoot(rootNodeFromAnchor(raw))
  : createFromRoot(raw);

const outDir = resolve(values.out);
mkdirSync(outDir, { recursive: true });

// Renderer map -- each renderer exports renderVisitor(outDir, options)
const renderers = {
  js: () => renderJs(outDir, { formatCode: false }),
  "js-umi": () => renderJsUmi(outDir, { formatCode: false }),
  rust: () => renderRust(outDir, { formatCode: false }),
  go: () => renderGo(outDir, { formatCode: false }),
};

const lang = values.lang;
if (!renderers[lang]) {
  console.error(
    `Unknown language: "${lang}". Supported: ${Object.keys(renderers).join(", ")}`
  );
  process.exit(1);
}

console.error(
  `Generating ${lang} SDK from ${isAnchor ? "Anchor" : "Codama"} IDL...`
);
codama.accept(renderers[lang]());
console.log(`SDK generated at: ${outDir}`);

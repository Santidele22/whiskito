// Independent import-graph verifier for the Whiskito static site.
// Usage: node resolve-imports.mjs <site-root> <entry.html relative to root>
// Walks the real ES-module graph starting at the entry page's module scripts and
// reports specifiers that do not resolve to a real file, plus specifiers that
// contain whitespace. Exit code 1 on any failure.
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const entryHtml = resolve(root, process.argv[3] ?? "src/index.html");

const failures = [];
const seen = new Set();
const order = [];
const SCRIPT_RE = /<script\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*>/gi;
// Three targeted patterns instead of one clever one: a single regex with an
// optional "[...] from" group happily spans newlines and swallows a
// side-effect import (`import "x";`), silently dropping a whole subtree from
// the walk. These three cannot over-match across statements.
const SPECIFIER_RES = [
  /\bfrom\s*["']([^"']+)["']/g, // import ... from "x" / export * from "x" (multiline-safe)
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // import("x")
  /(?:^|[\n;{}()])\s*import\s+["']([^"']+)["']/g, // side-effect: import "x";
];

function checkSpecifier(spec, fromFile) {
  if (typeof spec !== "string") return;
  if (/\s/.test(spec)) {
    failures.push(
      `WHITESPACE in specifier ${JSON.stringify(spec)} (${relative(root, fromFile)})`
    );
    return;
  }
  if (!spec.startsWith("./") && !spec.startsWith("../")) return; // bare/URL: not ours
  let target = resolve(dirname(fromFile), spec);
  if (!existsSync(target) && existsSync(target + ".js")) target += ".js";
  if (!existsSync(target)) {
    failures.push(
      `MISSING ${spec} (from ${relative(root, fromFile)}) -> ${relative(root, target)}`
    );
    return;
  }
  if (statSync(target).isDirectory()) return;
  walk(target);
}

function walk(file) {
  const abs = resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  order.push(abs);
  const src = readFileSync(abs, "utf8");
  for (const re of SPECIFIER_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) checkSpecifier(m[1], abs);
  }
}

const html = readFileSync(entryHtml, "utf8");
let count = 0;
SCRIPT_RE.lastIndex = 0;
let s;
while ((s = SCRIPT_RE.exec(html)) !== null) {
  if (!/type\s*=\s*"module"/i.test(s[0])) continue;
  count++;
  const spec = s[1];
  if (/^https?:/i.test(spec)) continue;
  const abs = resolve(dirname(entryHtml), spec.replace(/^\//, ""));
  if (!existsSync(abs)) failures.push(`MISSING script src ${spec} -> ${relative(root, abs)}`);
  else walk(abs);
}
if (count === 0) failures.push("NO module script found in entry HTML");

console.log(`entry: ${relative(root, entryHtml)} (${count} module script tag(s))`);
console.log(`modules reached: ${order.length}`);
for (const f of order) console.log(`  - ${relative(root, f)}`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  x ${f}`);
  process.exit(1);
}
console.log("\nOK: every relative specifier resolves to a real file; no whitespace in specifiers");

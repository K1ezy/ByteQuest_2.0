import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = join(frontend, "node_modules", "monaco-editor");
const source = join(packageDir, "min", "vs");
const target = join(frontend, "public", "monaco", "vs");
const marker = join(target, ".bytequest-monaco-version");

if (!existsSync(join(source, "loader.js"))) {
  throw new Error("Monaco is missing locally. Run npm ci while connected before preparing offline use.");
}

const version = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")).version;
if (existsSync(join(target, "loader.js")) && existsSync(marker) &&
    readFileSync(marker, "utf8") === version) {
  process.exit(0);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, force: true });
writeFileSync(marker, version);
console.log(`Prepared local Monaco ${version} assets for offline use.`);

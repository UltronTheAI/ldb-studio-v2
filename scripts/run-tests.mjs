import { run } from "node:test";
import { spec } from "node:test/reporters";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const testDir = path.join(rootDir, "tests");

function getTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      results = results.concat(getTsFiles(itemPath));
    } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
      results.push(itemPath);
    }
  }
  return results;
}

async function runTests() {
  const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));

  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
  };

  const tempOutDir = path.join(rootDir, ".test-dist");
  fs.mkdirSync(tempOutDir, { recursive: true });

  const allTsFiles = [
    ...getTsFiles(path.join(rootDir, "lib")),
    ...getTsFiles(path.join(rootDir, "tests")),
  ];

  for (const tsFile of allTsFiles) {
    const rel = path.relative(rootDir, tsFile);
    const outPath = path.join(tempOutDir, rel.replace(/\.tsx?$/, ".mjs"));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const content = fs.readFileSync(tsFile, "utf8");
    const transpiled = ts.transpileModule(content, {
      compilerOptions,
      fileName: tsFile,
    });

    const rewritten = transpiled.outputText.replace(
      /(import\s+[\s\S]*?from\s+['"])(\.[^'"]+)(['"])/g,
      (match, p1, p2, p3) => {
        if (p2.endsWith(".mjs") || p2.endsWith(".js") || p2.endsWith(".json")) return match;
        return `${p1}${p2}.mjs${p3}`;
      },
    );

    fs.writeFileSync(outPath, rewritten, "utf8");
  }

  const testMjsFiles = testFiles.map((f) =>
    path.join(tempOutDir, "tests", f.replace(/\.ts$/, ".mjs")),
  );

  const testStream = run({
    files: testMjsFiles,
  });

  testStream.compose(new spec()).pipe(process.stdout);

  await new Promise((resolve, reject) => {
    testStream.on("end", () => {
      try {
        fs.rmSync(tempOutDir, { recursive: true, force: true });
      } catch {}
      resolve(undefined);
    });
    testStream.on("error", (err) => {
      try {
        fs.rmSync(tempOutDir, { recursive: true, force: true });
      } catch {}
      reject(err);
    });
  });
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

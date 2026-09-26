#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { STYLES, type StyleId } from "../src/lib/constants";
import { generateDesigns } from "../src/lib/generate/pipeline";

async function main() {
  const names = process.argv.slice(2);
  const targets = names.length ? names : ["Merve", "Zeynep", "Şükrü"];
  const outDir = path.join(process.cwd(), "preview-out");
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of targets) {
    for (const style of STYLES) {
      console.log(`Generating ${name} / ${style}…`);
      const result = await generateDesigns(name, style as StyleId, 4);
      for (const design of result.designs) {
        const stem = `${name}-${style}-${design.index + 1}-${design.engine}`;
        fs.writeFileSync(path.join(outDir, `${stem}.png`), design.png);
        fs.writeFileSync(path.join(outDir, `${stem}.svg`), design.svg);
      }
    }
  }
  console.log(`Wrote designs to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

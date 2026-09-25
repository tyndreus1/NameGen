#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { STYLES, type StyleId } from "../src/lib/constants";
import { generateDesigns } from "../src/lib/generate/pipeline";

const STYLE_SLUG: Record<StyleId, string> = {
  classic: "klasik",
  hearts: "kalpli",
  star: "yildizli",
  butterfly: "kelebekli",
  elegant: "zarif",
};

const NAMES: { display: string; slug: string }[] = [
  { display: "Merve", slug: "merve" },
  { display: "Zeynep", slug: "zeynep" },
  { display: "Aleyna", slug: "aleyna" },
  { display: "Sophia", slug: "sophia" },
  { display: "Şükrü", slug: "sukru" },
];

async function main() {
  const outDir = path.join(process.cwd(), "docs/samples");
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of NAMES) {
    for (const style of STYLES) {
      console.log(`Generating ${name.display} / ${style}…`);
      const result = await generateDesigns(name.display, style, 1);
      const design = result.designs[0];
      if (!design) throw new Error(`No design for ${name.display} ${style}`);
      const stem = `${name.slug}_${STYLE_SLUG[style]}`;
      fs.writeFileSync(path.join(outDir, `${stem}.png`), design.png);
      if (name.slug === "merve" && style === "hearts") {
        fs.writeFileSync(path.join(outDir, `${stem}.svg`), design.svg);
      }
    }
  }
  console.log(`Wrote sample designs to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

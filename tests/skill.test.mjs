import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skill = fileURLToPath(new URL("../skills/sce-c2pa/", import.meta.url));

test("C2PA skill has discoverable frontmatter and valid local links", async () => {
  const body = await readFile(path.join(skill, "SKILL.md"), "utf8");
  const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, "SKILL.md needs YAML frontmatter");
  assert.match(frontmatter[1], /^name: sce-c2pa$/m);
  const description = frontmatter[1].match(/^description: (.+)$/m)?.[1];
  assert.ok(description && description.length <= 1024);

  let linkCount = 0;
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.name.endsWith(".md")) {
        const markdown = await readFile(full, "utf8");
        for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
          const target = match[1];
          if (/^(https?:|#)/.test(target)) continue;
          assert.ok((await readFile(path.resolve(folder, target), "utf8")).length > 0, target);
          linkCount += 1;
        }
      }
    }
  }
  await visit(skill);
  assert.ok(linkCount >= 6);
});

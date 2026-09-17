import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillsRoot = fileURLToPath(new URL("../skills/", import.meta.url));
const skillFolders = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory());
assert.ok(skillFolders.length > 0, "At least one skill must be discoverable");

for (const folder of skillFolders) {
  test(`${folder.name} has discoverable frontmatter and valid local links`, async () => {
    const skill = path.join(skillsRoot, folder.name);
    const body = await readFile(path.join(skill, "SKILL.md"), "utf8");
    const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    assert.ok(frontmatter, "SKILL.md needs YAML frontmatter");
    const name = frontmatter[1].match(/^name: (.+)$/m)?.[1].trim();
    assert.equal(name, folder.name);
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(name.length <= 64);
    const description = frontmatter[1].match(/^description: (.+)$/m)?.[1];
    assert.ok(description && description.length <= 1024);

    async function visit(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await visit(full);
        } else if (entry.name.endsWith(".md")) {
          const markdown = await readFile(full, "utf8");
          for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
            const target = match[1];
            if (/^(https?:|#)/.test(target)) continue;
            assert.ok((await readFile(path.resolve(directory, target), "utf8")).length > 0, target);
          }
        }
      }
    }
    await visit(skill);
  });
}

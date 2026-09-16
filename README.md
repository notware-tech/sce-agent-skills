# SCE Agent Skills

Open-source Secure Content Engine skills for Codex and Claude Code. The first release contains `sce-c2pa`, which covers the public SCE C2PA API, asynchronous signing, provenance declarations, AI disclosure, recovery, and the browser Content Credentials badge. A blockchain skill is planned but is not included yet.

## Install from GitHub

With Node.js and npm available, run the [Skills CLI](https://github.com/vercel-labs/skills) from the project where you want to use the skill:

```sh
npx skills add notware-tech/sce-agent-skills
```

The command lets you select the available skill and supported agents. For a direct, non-interactive installation of `sce-c2pa`:

| Target | Command |
| --- | --- |
| Codex | `npx skills add notware-tech/sce-agent-skills --skill sce-c2pa --agent codex --copy --yes` |
| Claude Code | `npx skills add notware-tech/sce-agent-skills --skill sce-c2pa --agent claude-code --copy --yes` |
| Both | `npx skills add notware-tech/sce-agent-skills --skill sce-c2pa -a codex -a claude-code --copy --yes` |

These commands install in the current project. Add `--global` to make the skill available across your local projects. `--copy` uses ordinary file copies, including on Windows. Omit it if you prefer the CLI's symlink installation. Use `npx skills add notware-tech/sce-agent-skills --list` to inspect available skills before installing. When more skills are published, `--skill sce-c2pa` keeps the selection explicit.

The CLI places project installations under `.agents/skills/` for Codex and `.claude/skills/` for Claude Code. Codex can invoke the skill as `$sce-c2pa`, and Claude Code as `/sce-c2pa`. Both can also select it when the task matches the description. If a newly installed skill does not appear, restart the agent. Use `npx skills update sce-c2pa` to get the latest version.

The repository is the distribution source. No `@notware` npm package or npm publication is required: publishing this repository publicly on GitHub is enough for the commands above. `npx` downloads the independently maintained `skills` CLI. Installing the skill does not call SCE APIs or consume signing credits. Examples under `skills/sce-c2pa/examples/` call live APIs only when a user runs them with an API key.

## Repository layout

```text
skills/
  sce-c2pa/
    SKILL.md
    references/
    examples/
```

The `SKILL.md` frontmatter identifies the skill to the CLI. Reference files contain task-specific guidance, and examples cover curl, Python, and JavaScript. Future skills can be added as sibling directories under `skills/`.

## Validate locally

```sh
node --test tests/skill.test.mjs
npx skills add . --list
```

The second command asks the Skills CLI to discover skills from the local checkout. After the repository is public, repeat discovery with `npx skills add notware-tech/sce-agent-skills --list` to check the published source.

The C2PA skill is written against a documentation snapshot dated 2026-09-16 and was not tested against a live signing job. Refer to the current authenticated [SCE C2PA API documentation](https://dashboard.securecontentengine.com/api/docs/c2pa) and [badge documentation](https://dashboard.securecontentengine.com/api/cdn/c2pa-badge) when updating it.

## License

MIT. See [LICENSE](LICENSE).

# SCE Agent Skills

Open-source Secure Content Engine skills for Codex and Claude Code. Each skill is self-contained and can be installed separately:

| Skill | Scope |
| --- | --- |
| `sce-c2pa` | Public SCE C2PA API, asynchronous signing, provenance and AI declarations, recovery, and the Content Credentials image badge |
| `sce-blockchain` | Public SCE Blockchain API, asynchronous hash notarization, SHA-256 verification, recovery, and the Blockchain browser badge |

## Install from GitHub

With Node.js and npm available, run the [Skills CLI](https://github.com/vercel-labs/skills) from the project where you want to use the skill:

```sh
npx skills add notware-tech/sce-agent-skills
```

The command lets you select the available skills and supported agents. For a direct, non-interactive installation of `sce-c2pa`:

| Target | Command |
| --- | --- |
| Codex | `npx skills add notware-tech/sce-agent-skills --skill sce-c2pa --agent codex --copy --yes` |
| Claude Code | `npx skills add notware-tech/sce-agent-skills --skill sce-c2pa --agent claude-code --copy --yes` |
| Both | `npx skills add notware-tech/sce-agent-skills --skill sce-c2pa -a codex -a claude-code --copy --yes` |

For `sce-blockchain`, use the same commands with `--skill sce-blockchain`. For example, to install it for both agents:

```sh
npx skills add notware-tech/sce-agent-skills --skill sce-blockchain -a codex -a claude-code --copy --yes
```

These commands install in the current project. Add `--global` to make the skill available across your local projects. `--copy` uses ordinary file copies, including on Windows. Omit it if you prefer the CLI's symlink installation. Use `npx skills add notware-tech/sce-agent-skills --list` to inspect the published skills before installing. Use `--skill` to keep the selection explicit. Newly added skills become available through these GitHub commands once the changes are published to that repository; for the local checkout, use `npx skills add .`.

The CLI places project installations under `.agents/skills/` for Codex and `.claude/skills/` for Claude Code. Codex can invoke the skills as `$sce-c2pa` or `$sce-blockchain`, and Claude Code as `/sce-c2pa` or `/sce-blockchain`. Both can also select a skill when the task matches its description. If a newly installed skill does not appear, restart the agent. Use `npx skills update sce-c2pa` or `npx skills update sce-blockchain` to update the installed skill.

The repository is the distribution source. No `@notware` npm package or npm publication is required: publishing this repository publicly on GitHub is enough for the commands above. `npx` downloads the independently maintained `skills` CLI. Installing a skill does not call SCE APIs or consume signing credits. Examples under each skill's `examples/` directory call live APIs only when a user runs them with an API key.

## Repository layout

```text
skills/
  sce-c2pa/
    SKILL.md
    references/
    examples/
  sce-blockchain/
    SKILL.md
    references/
    examples/
```

The `SKILL.md` frontmatter identifies the skill to the CLI. Reference files contain task-specific guidance, and examples cover curl, Python, and JavaScript. Future skills can be added as sibling directories under `skills/`.

## Validate locally

```sh
node --test tests/*.test.mjs
npx skills add . --list
```

The tests check skill frontmatter and local links, and exercise the blockchain JavaScript example with mocked API/storage responses, without network requests or signing charges. The second command asks the Skills CLI to discover skills from the local checkout. After publishing changes, repeat discovery with `npx skills add notware-tech/sce-agent-skills --list` to check the published source.

The C2PA skill is written against a documentation snapshot dated 2026-09-16 and was not tested against a live signing job. Refer to the current authenticated [SCE C2PA API documentation](https://dashboard.securecontentengine.com/api/docs/c2pa) and [badge documentation](https://dashboard.securecontentengine.com/api/cdn/c2pa-badge) when updating it.

The Blockchain skill derives from supplied technical documentation dated 2026-09-17, citing frontend documentation at commit `107aba22372b80a5cc35fa43822fc392870928f5` and public-backend sources at commit `57267220bbe64feed32d43627fe0a6d03ef645a9`. These are source snapshot references, not deployment attestations. No live notarization or CDN verification was performed. Refer to the current authenticated [SCE Blockchain API documentation](https://dashboard.securecontentengine.com/api/docs/blockchain) and [badge documentation](https://dashboard.securecontentengine.com/api/cdn/blockchain-badge) when updating it. In particular, the simplified verify response is insufficient for the badge: the integration needs a real signature-bearing record and a separate backend finalization check.

## License

MIT. See [LICENSE](LICENSE).

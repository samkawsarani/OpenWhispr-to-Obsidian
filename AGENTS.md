# AGENTS.md

Guidance for AI coding agents working in this repository. Humans may find it
useful too.

## What this is

An **Obsidian plugin** that syncs [OpenWhispr](https://openwhispr.com) notes —
including speaker-labeled meeting transcripts — into an Obsidian vault. Instead
of calling an API, it shells out to the official `openwhispr` CLI, so it works
against whatever backend the CLI is configured for. Because it spawns a child
process, the plugin is **desktop-only** (`isDesktopOnly: true`).

## Source layout (`src/`)

- `main.ts` — plugin lifecycle, commands, sync engine, and note rendering.
- `cli.ts` — thin wrapper around the `openwhispr` CLI (`notes list` / `notes get`
  / `notes get --transcript --format markdown`). Also owns PATH augmentation
  (see below).
- `format.ts` — filename/date/YAML formatting helpers (dependency-free).
- `settings.ts` — the settings tab UI.
- `types.ts` — shared types and `DEFAULT_SETTINGS`.

`main.js` at the repo root is the **built bundle** (esbuild output), gitignored
in dev and produced fresh in CI for releases. Never hand-edit it.

## Build & dev commands

```bash
npm ci            # install exact, locked dependencies
npm run dev       # esbuild watch → main.js (inline sourcemap)
npm run build     # tsc --noEmit type-check, then production bundle
```

`npm run build` is the source of truth for "is it correct" — it type-checks and
bundles. Run it before committing anything under `src/`.

## Conventions

- **TypeScript**, bundled to CJS targeting ES2018 (Obsidian's runtime).
- Indentation is **tabs, width 4** (see `.editorconfig`) — match it.
- Keep `format.ts` dependency-free; it exists to avoid pulling in a date/YAML
  library for what is only ever filename/frontmatter formatting.
- `types.ts` keeps the CLI response shapes permissive (`[key: string]: unknown`)
  because the CLI schema is still evolving — don't over-tighten them.

## Gotchas worth knowing

- **PATH under Obsidian.** Obsidian is an Electron GUI app launched from the
  desktop, so it inherits a stripped-down `PATH` that omits Homebrew, nvm/volta,
  and `/usr/local/bin` — where `npm i -g @openwhispr/cli` puts the binary.
  `cli.ts` augments `PATH` with the common install locations before spawning, so
  a bare `openwhispr` resolves regardless of how Obsidian was started. If you
  touch process spawning, preserve this.
- **`execFile`, not `exec`.** The CLI is spawned without a shell (no shell
  injection surface). Keep it that way; pass args as an array.
- **Desktop-only.** Don't introduce Node/`child_process` usage on code paths
  that could run on mobile, and keep `isDesktopOnly: true` in `manifest.json`.

## Releasing

Automated; version conventions matter — see the **Releasing** section in the
[README](README.md). Key rules an agent must not break:

- Release tags have **no `v` prefix** and must equal `manifest.json`'s `version`
  exactly (Obsidian requirement; `.npmrc` sets `tag-version-prefix=""`).
- A release ships three loose assets: `main.js`, `manifest.json`, `styles.css`.
- Bump versions with `npm version <patch|minor|major>` — this runs
  `version-bump.mjs`, which syncs `manifest.json`/`versions.json` and stamps the
  `## [Unreleased]` changelog notes into a dated `## [<version>]` section. Don't
  edit those versions or hand-date the changelog.
- Add changelog entries under `## [Unreleased]` in
  [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog format); `npm version` dates
  them and the release workflow pulls notes from the matching section.

## Verifying changes

There is no automated test suite yet. To validate a change:

1. `npm run build` must pass (type-check + bundle).
2. For behavior changes, exercise the affected path in a real vault: copy
   `main.js`, `manifest.json`, `styles.css` into
   `<vault>/.obsidian/plugins/openwhispr-to-obsidian/`, reload Obsidian, and use
   **Test connection** / **Sync OpenWhispr notes**.

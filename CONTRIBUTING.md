# Contributing to OpenWhispr Sync

Thanks for your interest! This plugin exists to get your OpenWhispr notes and
speaker-labeled transcripts into Obsidian with as little ceremony as possible —
every decision favors keeping it **simple, private, and faithful to the
official `openwhispr` CLI**. Contributions that respect those three things are
very welcome.

## Ways to contribute

- **Report a bug** — open an issue with what you did, what you expected, and
  what happened. Include your OS, Obsidian version, and the output of
  `openwhispr --version`. Screenshots of the settings tab / error notices help.
- **Suggest a feature** — open an issue first for anything non-trivial. If it
  depends on CLI behavior, link the relevant
  [`openwhispr-cli`](https://github.com/OpenWhispr/openwhispr-cli) command or
  flag so the design discussion is grounded.
- **Send a change** — see below.

## Sending a change

1. Fork the repo and branch from `main`, using the branch convention
   **`feature/your-feature-name`** (e.g. `feature/folder-filter`).
2. Set up locally: `npm install`. npm is the package manager and task runner —
   there is no separate build tool to install.
3. Make your change, keeping it focused on one thing.
4. Run and keep green: `npm run build` — it type-checks (`tsc --noEmit`) and
   produces the production bundle. This is the source of truth for "is it
   correct."
5. There is no automated test suite yet, so **exercise the affected path in a
   real vault**: copy `main.js`, `manifest.json`, and `styles.css` into
   `<vault>/.obsidian/plugins/openwhispr-to-obsidian/`, reload Obsidian, and use
   **Test connection** / **Sync OpenWhispr notes**.
6. Open a pull request and fill in the template.

## Conventions that come up in review

- **TypeScript, tabs at width 4.** Match `.editorconfig`; the bundle targets
  ES2018 (Obsidian's runtime).
- **Spawn with `execFile`, never `exec`.** The CLI is run without a shell (no
  injection surface); pass arguments as an array.
- **Preserve the `PATH` augmentation in `cli.ts`.** Obsidian inherits a
  stripped-down `PATH` when launched from the desktop, so the plugin prepends
  the common global-bin locations before spawning. Don't regress this.
- **Desktop-only.** Keep `isDesktopOnly: true` in `manifest.json` and don't put
  Node / `child_process` usage on any path that could run on mobile.
- **Trust the CLI's output.** Transcripts are written from
  `notes get <id> --transcript --format markdown` verbatim — don't reintroduce
  client-side reformatting of the transcript body.
- **Keep `format.ts` dependency-free** and keep the CLI response types in
  `types.ts` permissive — the CLI schema is still evolving.
- **Keep dependencies light** — prefer small, self-contained code.

## License

By contributing, you agree your work is licensed under the project's
[MIT license](LICENSE.md).

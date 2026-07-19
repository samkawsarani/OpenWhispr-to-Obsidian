# OpenWhispr Sync for Obsidian
[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/samkawsarani)

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE.md)
[![Star on GitHub](https://img.shields.io/github/stars/samkawsarani/OpenWhispr-to-Obsidian?style=social)](https://github.com/samkawsarani/OpenWhispr-to-Obsidian)

Sync your [OpenWhispr](https://openwhispr.com) notes — including meeting notes
with speaker-labeled transcripts — into an Obsidian vault folder.

Instead of talking to an API directly, this plugin drives the official
[`openwhispr` CLI](https://github.com/OpenWhispr/openwhispr-cli), so it works
against whichever backend the CLI is configured for (local desktop app or the
cloud API). Because it shells out to the CLI, the plugin is **desktop-only**.

## ✨ Features

- **🔄 One-click & auto sync** — sync from the ribbon icon, command palette, or
  the **Manual sync** button; or auto-sync on a fixed frequency (1 min → daily)
  and/or when Obsidian starts.
- **🧩 Selectable content** — pick which sections land in each note: **My Notes**
  (your personal notes, on by default), **Enhanced Notes** (the AI-cleaned
  version), and the full **Transcript** (speaker-labeled, taken verbatim from
  `notes get <id> --transcript --format markdown`).
- **🗂️ File organization** — keep notes flat, in **date-based subfolders** (by
  meeting date), or **mirror your OpenWhispr folders**; notes are re-organized on
  every sync when their folder changes.
- **🧱 Rich frontmatter** — `openwhispr_id`, `title`, `folder` (resolved to its
  name via `folders list`), `created_at`, `updated_at`, and `source`.
- **♻️ Dedup & update-in-place** — notes are matched by `openwhispr_id`; choose
  to overwrite, skip, or keep a timestamped copy when a file already exists.
- **🏷️ Configurable filenames** — optional prefix, templates (`{title}`, `{id}`,
  `{created_date}`, `{folder}`), date format, and separator (incl. none).
- **🎚️ Sync limit** — sync only the most-recent N notes, or the entire history.
- **🔌 Backend selection** — Auto, Local (`--local`), or Remote (`--remote`).
- **🩺 Test connection** — a one-click command that runs the CLI and reports its
  version so you can confirm the plugin can reach it.

## 🔒 Privacy & network use

The plugin makes **no network calls of its own**. It only spawns the local
`openwhispr` CLI and writes markdown into your vault — all backend
communication is handled by the CLI you configured and authenticated. There is
no telemetry, analytics, or third-party service.

Because it spawns a child process and may resolve an absolute binary path, the
plugin is marked `isDesktopOnly` and does not run on Obsidian mobile.

## 📦 Requirements

- Obsidian **1.6.6+** on desktop (Windows / macOS / Linux).
- The OpenWhispr CLI, installed and configured:

  ```bash
  npm i -g @openwhispr/cli    # requires Node.js 20+
  ```

## 🛠️ Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](https://github.com/samkawsarani/OpenWhispr-to-Obsidian/releases)
   (or build them yourself — see [Development](#-development)).
2. Copy the three files into your vault at
   `<vault>/.obsidian/plugins/openwhispr-to-obsidian/`.
3. Reload Obsidian and enable **OpenWhispr Sync** under
   *Settings → Community plugins*.

## 🎯 Usage

First-time setup:

1. Open *Settings → OpenWhispr Sync* and set the **CLI path** if `openwhispr`
   isn't on Obsidian's `PATH` (an absolute path such as
   `/usr/local/bin/openwhispr` is safest — see [Troubleshooting](#-troubleshooting)).
2. Click **Test connection** to confirm the plugin can reach the CLI.
3. Choose which content to include and how notes are named/organized (see
   [Configuration](#-configuration)), then run your first sync.

You can trigger a sync three ways:

- **Ribbon icon** — click the microphone in the left ribbon.
- **Command palette** — run *Sync OpenWhispr notes*.
- **Settings** — the **Sync now** button under the *Sync* section.

Or turn on **auto-sync** (a frequency and/or *Sync on startup*) and let it run in
the background. The **status bar** shows live progress (`OpenWhispr: 3/12`) and
the result of the last run (`OpenWhispr: 8 synced`).

> **Tip — first run:** enable **Sync all historical notes** to backfill your
> entire history once, then turn it off so routine syncs stay fast.

## ⚙️ Configuration

Access plugin settings via Settings → Community Plugins → OpenWhispr Sync

### OpenWhispr CLI

- **CLI path** — Path to the `openwhispr` executable. A bare name (`openwhispr`)
  resolves via `PATH`; an absolute path (e.g. `/usr/local/bin/openwhispr`) is
  safest because Obsidian launches with a stripped-down `PATH`. Find yours with
  `which openwhispr` / `where openwhispr`.
- **Backend** — Which backend to target: **Auto** (let the CLI decide — local,
  then remote), **Local** (`--local`, the desktop app), or **Remote**
  (`--remote`, the cloud API). Match how your CLI is authenticated.
- **Test connection** — Runs the CLI and reports its version, confirming the
  plugin can reach it before you sync.

### Note content

Each note is a single `# <title>` heading followed by whichever sections you
enable below. Turn them all on for a complete record, or keep just the one you
actually read.

- **Include my notes** *(default: on)* — The notes you typed yourself in
  OpenWhispr, under `## My Notes`.
- **Include enhanced notes** *(default: off)* — OpenWhispr's AI-cleaned rewrite
  of your notes (grammar fixed, filler removed, action items surfaced), under
  `## Enhanced Notes`.
- **Include full transcript** *(default: off)* — The complete speaker-labeled
  transcript with timestamps (`**Me** *(0:03)*: …`), under `## Transcript`. This
  can be long.

### Filename settings

- **Filename prefix** — Optional text added to the start of every filename (e.g.
  `openwhispr-` → `openwhispr-Weekly-Standup.md`). Handy for grouping synced
  notes or spotting them at a glance. Empty by default.
- **Filename template** *(default: `{title}`)* — Build filenames from tokens:
  `{title}`, `{id}`, `{created_date}`, `{folder}`. For example
  `{created_date}_{title}` → `2026-07-15_Weekly-Standup`.
- **Date format** — Format for the `{created_date}` token. Tokens: `YYYY`, `MM`,
  `DD`, `HH`, `mm`, `ss`. Examples: `YYYY-MM-DD` (ISO, `2026-07-15`),
  `DD-MM-YYYY` (European, `15-07-2026`), `MM-DD-YYYY` (US, `07-15-2026`).
- **Filename separator** — Character that replaces spaces in filenames, so it
  matches your naming convention. `Daily Standup` becomes:
  - **Dash** (`-`) → `Daily-Standup` *(default)*
  - **Underscore** (`_`) → `Daily_Standup`
  - **Space** → `Daily Standup`
  - **None** → `DailyStandup`
- **Existing notes** — What to do when a note that was already synced (matched by
  its `openwhispr_id`) has a file in your vault:
  - **Overwrite in place** *(default)* — keep the file up to date with the latest
    content.
  - **Skip** — leave it untouched, preserving any manual edits you made.
  - **Keep timestamped copy** — leave the old file and add a new one (e.g.
    `Standup_13-40.md`) whenever the content has actually changed, so you keep a
    history of versions.

  Two *different* notes that happen to resolve to the same filename are always
  kept as separate files (`Standup.md`, `Standup-2.md`) — nothing is silently
  overwritten.

### File organization

- **Sync folder** *(default: `OpenWhispr`)* — Vault folder that synced notes are
  written to, created automatically if it doesn't exist.
- **Folder structure** — How notes are laid out inside the sync folder. Notes are
  **moved to the right folder automatically on every sync** if their folder
  changes:
  - **Flat** *(default)* — everything in one folder.
  - **Date-based subfolders** — grouped by creation (meeting) date, e.g.
    `OpenWhispr/2026-07-15/Weekly-Standup.md`.
  - **Mirror OpenWhispr folders** — recreates the folders you set up in the
    OpenWhispr app, e.g. `OpenWhispr/Meetings/Weekly-Standup.md`.
- **Folder date format** — *(shown only for date-based folders)* Date format for
  the subfolders. Use `/` to nest: `YYYY-MM-DD` → `2026-07-15`, `YYYY/MM` →
  `2026/07`, `YYYY/MM/DD` → `2026/07/15`.

### Sync

- **Manual sync** — A **Sync now** button (same as the ribbon icon and the
  command).
- **Sync all historical notes** *(default: off)* — When on, every sync pulls your
  entire note history, ignoring the sync limit. Great for a one-time backfill;
  turn it off afterward.
- **Sync limit** *(default: `50`)* — *(shown when the above is off)* Maximum
  number of most-recent notes to pull per sync. Keeps routine syncs quick.
- **Auto-sync frequency** *(default: Never)* — How often to sync in the
  background: **Never**, every **1 / 5 / 10 / 30 minutes**, **hourly**, or
  **daily**. Every 5–10 minutes is a good balance; shorter is more up-to-date but
  busier.
- **Sync on startup** *(default: off)* — Run a sync automatically when Obsidian
  finishes loading.

## 📄 Note format

A synced note is YAML frontmatter, a single `# <title>` heading, then whichever
content sections you enabled. With **My Notes** on (the default) and the
transcript also enabled:

```markdown
---
openwhispr_id: "1234"
title: "Weekly Standup"
folder: "Meetings"
created_at: "2026-07-10T14:30:00.000Z"
updated_at: "2026-07-10T15:05:00.000Z"
source: openwhispr
---

# Weekly Standup

## My Notes

- Ship the beta on Friday

## Enhanced Notes

- **Decision:** ship the beta on Friday.
- **Action item:** finalize the release notes.

## Transcript

**Me** *(0:03)*: Let's get started.

**Speaker 2** *(0:11)*: Sounds good, I'll share my screen.
```

Only the sections you enable appear, in this order: **My Notes**, **Enhanced
Notes**, **Transcript**. If a section is enabled but the note has no such content
(e.g. no personal notes), it's simply omitted.

Where each part comes from:

| Part | Source |
| --- | --- |
| Frontmatter | Built by the plugin. `openwhispr_id` keys dedup / update-in-place. |
| `## My Notes` | The note's `content` (your typed notes). |
| `## Enhanced Notes` | The note's `enhanced_content` (OpenWhispr's AI rewrite). |
| `## Transcript` | `notes get <id> --transcript --format markdown`, with its duplicate `#` title heading stripped. |

## 🐛 Troubleshooting

### "Could not find the openwhispr executable" — but it works in my terminal

Obsidian is launched from your desktop, not a login shell, so it inherits a
stripped-down `PATH`. The plugin already searches the common install locations
(Homebrew, `/usr/local/bin`, nvm/volta/fnm, `%AppData%\npm`), but if your binary
lives elsewhere, find its absolute path and paste it into **CLI path**:

```bash
which openwhispr    # macOS / Linux
where openwhispr    # Windows
```

### Test connection fails or no notes sync

- Confirm the CLI itself works: `openwhispr --version` and
  `openwhispr doctor` in a terminal.
- If you use a non-default backend, make sure **Backend** matches how the CLI is
  configured (Local vs Remote).

## 🧑‍💻 Development

```bash
npm install
npm run dev      # watch build → main.js
npm run build    # type-check + production bundle
```

Source lives in `src/`:

- `cli.ts` — `openwhispr` CLI wrapper (`notes list` / `notes get` /
  `notes get --transcript --format markdown`) and `PATH` augmentation.
- `format.ts` — filename/date/YAML formatting helpers (dependency-free).
- `settings.ts` — settings tab.
- `types.ts` — shared types and defaults.
- `main.ts` — plugin lifecycle and sync engine.

### Releasing

Releases are automated. To cut one:

1. Add your changes under the `## [Unreleased]` heading in
   [`CHANGELOG.md`](CHANGELOG.md).
2. Run `npm version <patch|minor|major>`. This bumps `manifest.json` /
   `versions.json`, stamps the `[Unreleased]` notes into a dated
   `## [<version>]` section, and creates a matching git tag (no `v` prefix —
   Obsidian requires the tag to equal the manifest version exactly).
3. `git push && git push --tags`.

Pushing the tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which builds
the plugin, verifies the tag matches `manifest.json`, and publishes a GitHub
Release with `main.js`, `manifest.json`, and `styles.css` — using the matching
changelog section as the release notes.

## 🤝 Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for how to
report issues, propose features, and open pull requests.

## 📝 License

[MIT](LICENSE.md) © Sam Kawsarani.

---

*Not officially affiliated with OpenWhispr or Obsidian.*

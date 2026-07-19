import {
	Notice,
	Plugin,
	TFile,
	TFolder,
	normalizePath,
} from "obsidian";
import { OpenWhisprCli, OpenWhisprCliError } from "./cli";
import {
	buildFilename,
	buildNoteSubfolder,
	formatDate,
	parseNoteDate,
	yamlQuote,
} from "./format";
import {
	DEFAULT_SETTINGS,
	OpenWhisprNote,
	OpenWhisprSettings,
} from "./types";
import { OpenWhisprSettingTab } from "./settings";

interface SyncResult {
	created: number;
	updated: number;
	skipped: number;
	failed: number;
	total: number;
}

export default class OpenWhisprPlugin extends Plugin {
	settings: OpenWhisprSettings = DEFAULT_SETTINGS;
	private statusBar: HTMLElement | null = null;
	private autoSyncTimer: number | null = null;
	private syncing = false;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("mic", "Sync OpenWhispr notes", () => {
			void this.syncNotes();
		});

		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("openwhispr-status");
		this.setStatus("idle");

		this.addCommand({
			id: "sync-notes",
			name: "Sync OpenWhispr notes",
			callback: () => void this.syncNotes(),
		});

		this.addCommand({
			id: "test-connection",
			name: "Test OpenWhispr CLI connection",
			callback: () => void this.testConnection(),
		});

		this.addSettingTab(new OpenWhisprSettingTab(this.app, this));

		this.restartAutoSync();

		if (this.settings.syncOnStartup) {
			this.app.workspace.onLayoutReady(() => void this.syncNotes(true));
		}
	}

	onunload() {
		this.clearAutoSync();
	}

	// ---- settings ---------------------------------------------------------

	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<OpenWhisprSettings> & {
			overwriteExisting?: boolean;
		};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		// Migrate the old boolean `overwriteExisting` to `existingNoteAction`.
		if (loaded && loaded.overwriteExisting !== undefined && loaded.existingNoteAction === undefined) {
			this.settings.existingNoteAction = loaded.overwriteExisting ? "overwrite" : "skip";
		}

		// Drop settings that no longer exist (leftover from older versions).
		const bag = this.settings as unknown as Record<string, unknown>;
		delete bag.overwriteExisting;
		delete bag.extraCliArgs;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.restartAutoSync();
	}

	private cli(): OpenWhisprCli {
		return new OpenWhisprCli(this.settings);
	}

	// ---- auto-sync --------------------------------------------------------

	restartAutoSync() {
		this.clearAutoSync();
		const minutes = this.settings.autoSyncMinutes;
		if (minutes && minutes > 0) {
			this.autoSyncTimer = window.setInterval(
				() => void this.syncNotes(true),
				minutes * 60 * 1000
			);
			this.registerInterval(this.autoSyncTimer);
		}
	}

	private clearAutoSync() {
		if (this.autoSyncTimer !== null) {
			window.clearInterval(this.autoSyncTimer);
			this.autoSyncTimer = null;
		}
	}

	// ---- status bar -------------------------------------------------------

	private setStatus(state: "idle" | "syncing" | "success" | "error", text?: string) {
		if (!this.statusBar) return;
		this.statusBar.removeClass("is-syncing", "is-error", "is-success");
		switch (state) {
			case "syncing":
				this.statusBar.addClass("is-syncing");
				this.statusBar.setText(text ?? "OpenWhispr: syncing…");
				break;
			case "success":
				this.statusBar.addClass("is-success");
				this.statusBar.setText(text ?? "OpenWhispr: synced");
				break;
			case "error":
				this.statusBar.addClass("is-error");
				this.statusBar.setText(text ?? "OpenWhispr: error");
				break;
			default:
				this.statusBar.setText("OpenWhispr");
		}
	}

	// ---- commands ---------------------------------------------------------

	async testConnection() {
		try {
			const version = await this.cli().version();
			new Notice(`OpenWhispr CLI OK (${version || "version unknown"}).`);
		} catch (e) {
			this.reportError(e);
		}
	}

	async syncNotes(silent = false): Promise<SyncResult | null> {
		if (this.syncing) {
			if (!silent) new Notice("OpenWhispr sync already in progress.");
			return null;
		}
		this.syncing = true;
		this.setStatus("syncing");

		try {
			await this.ensureFolder(this.settings.syncFolder);
			const folderNames = await this.fetchFolderNames();
			const notes = this.selectNotes(await this.cli().listNotes(), folderNames);

			const result: SyncResult = {
				created: 0,
				updated: 0,
				skipped: 0,
				failed: 0,
				total: notes.length,
			};

			const existing = this.indexExistingNotes();

			for (const [index, summary] of notes.entries()) {
				this.setStatus("syncing", `OpenWhispr: ${index + 1}/${notes.length}`);
				try {
					await this.syncOne(summary, existing, result);
				} catch (e) {
					result.failed++;
					console.error("OpenWhispr: failed to sync note", summary.id, e);
				}
			}

			const message =
				`OpenWhispr sync complete — ${result.created} new, ` +
				`${result.updated} updated, ${result.skipped} skipped` +
				(result.failed ? `, ${result.failed} failed` : "");
			this.setStatus(
				result.failed ? "error" : "success",
				`OpenWhispr: ${result.created + result.updated} synced`
			);
			if (!silent || result.failed) new Notice(message);
			return result;
		} catch (e) {
			this.reportError(e, silent);
			return null;
		} finally {
			this.syncing = false;
		}
	}

	// ---- sync internals ---------------------------------------------------

	/**
	 * Resolve folder names onto each note, order newest-first, and apply the
	 * sync limit (unless "sync all history" is on).
	 */
	private selectNotes(
		notes: OpenWhisprNote[],
		folderNames: Map<string, string>
	): OpenWhisprNote[] {
		for (const note of notes) {
			if (note.folder_id != null) {
				const name = folderNames.get(String(note.folder_id));
				if (name) note.folder = name;
			}
		}
		notes.sort((a, b) => parseNoteDate(b).getTime() - parseNoteDate(a).getTime());
		if (this.settings.syncAllHistory) return notes;
		const limit = Math.max(0, this.settings.syncLimit || 0);
		return notes.slice(0, limit);
	}

	/**
	 * Map each folder id to its name via `folders list`, so notes can carry a
	 * human-readable folder in their frontmatter and (optionally) drive folder
	 * organization. Non-fatal: if the CLI can't list folders, names are omitted.
	 */
	private async fetchFolderNames(): Promise<Map<string, string>> {
		const map = new Map<string, string>();
		try {
			for (const folder of await this.cli().listFolders()) {
				if (folder.id != null && folder.name) map.set(String(folder.id), folder.name);
			}
		} catch (e) {
			console.warn("OpenWhispr: could not list folders; folder names omitted.", e);
		}
		return map;
	}

	private async syncOne(
		summary: OpenWhisprNote,
		existing: Map<string, TFile>,
		result: SyncResult
	): Promise<void> {
		const id = String(summary.id);
		const existingFile = existing.get(id);
		const dir = this.folderPath(buildNoteSubfolder(summary, this.settings));
		await this.ensureFolder(dir);

		if (existingFile) {
			// Re-organize on every sync: if the note's target folder changed,
			// move the file there — regardless of the overwrite action.
			await this.reorganize(existingFile, dir);

			const action = this.settings.existingNoteAction;
			if (action === "skip") {
				result.skipped++;
				return;
			}

			const markdown = await this.buildMarkdown(summary);

			if (action === "timestamped") {
				const current = await this.app.vault.read(existingFile);
				if (this.sameBody(current, markdown)) {
					result.skipped++;
					return;
				}
				const path = this.timestampedPath(dir, buildFilename(summary, this.settings));
				await this.app.vault.create(path, markdown);
				result.created++;
				return;
			}

			// overwrite
			await this.app.vault.modify(existingFile, markdown);
			result.updated++;
			return;
		}

		const markdown = await this.buildMarkdown(summary);
		const path = await this.uniquePath(dir, buildFilename(summary, this.settings));
		await this.app.vault.create(path, markdown);
		result.created++;
	}

	/** Fetch full note detail (+ transcript if enabled) and render markdown. */
	private async buildMarkdown(summary: OpenWhisprNote): Promise<string> {
		const note = await this.cli().getNote(summary.id);
		// Carry the folder name we already resolved from the list.
		if (summary.folder) note.folder = summary.folder;
		const transcript = this.settings.includeTranscript
			? await this.cli().getTranscriptMarkdown(summary.id)
			: null;
		return this.renderNote(note, transcript);
	}

	/**
	 * Assemble the note: YAML frontmatter, a single `# <title>` heading, then the
	 * enabled sections (My Notes, Enhanced Notes, Transcript). The transcript
	 * markdown from the CLI carries its own `# <title>` heading, which we strip
	 * so it isn't duplicated.
	 */
	private renderNote(note: OpenWhisprNote, transcriptMarkdown: string | null): string {
		const frontmatter = this.renderFrontmatter(note);
		const title = (note.title ?? "").trim() || "Untitled";
		const parts: string[] = [`# ${title}`];

		if (this.settings.includeMyNotes) {
			const content = (note.content ?? "").trim();
			if (content) parts.push(`## My Notes\n\n${content}`);
		}
		if (this.settings.includeEnhancedNotes) {
			const enhanced = (note.enhanced_content ?? "").trim();
			if (enhanced) parts.push(`## Enhanced Notes\n\n${enhanced}`);
		}
		if (this.settings.includeTranscript && transcriptMarkdown) {
			const body = stripLeadingH1(transcriptMarkdown).trim();
			if (body) parts.push(body);
		}

		return `${frontmatter}\n\n${parts.join("\n\n")}\n`;
	}

	private renderFrontmatter(note: OpenWhisprNote): string {
		const lines: string[] = ["---"];
		lines.push(`openwhispr_id: ${yamlQuote(String(note.id))}`);
		if (note.title) lines.push(`title: ${yamlQuote(note.title)}`);
		if (note.folder) lines.push(`folder: ${yamlQuote(String(note.folder))}`);
		if (note.created_at) lines.push(`created_at: ${yamlQuote(note.created_at)}`);
		if (note.updated_at) lines.push(`updated_at: ${yamlQuote(note.updated_at)}`);
		lines.push("source: openwhispr");
		lines.push("---");
		return lines.join("\n");
	}

	/** Compare two notes ignoring their frontmatter (which carries timestamps). */
	private sameBody(a: string, b: string): boolean {
		return stripFrontmatter(a).trim() === stripFrontmatter(b).trim();
	}

	/**
	 * Map every already-synced note (identified by its openwhispr_id
	 * frontmatter) within the sync folder to its file, for dedup/updates.
	 */
	private indexExistingNotes(): Map<string, TFile> {
		const index = new Map<string, TFile>();
		const folder = normalizePath(this.settings.syncFolder);
		const prefix = folder === "/" || folder === "" ? "" : folder + "/";

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (prefix && !file.path.startsWith(prefix)) continue;
			const cache = this.app.metadataCache.getFileCache(file);
			const id = cache?.frontmatter?.openwhispr_id;
			if (id != null) index.set(String(id), file);
		}
		return index;
	}

	/** Join the sync folder with a (possibly empty) subfolder. "" == root. */
	private folderPath(subfolder: string): string {
		const base = normalizePath(this.settings.syncFolder);
		const b = base && base !== "/" ? base : "";
		const s = subfolder ? normalizePath(subfolder) : "";
		return [b, s].filter(Boolean).join("/");
	}

	/** Move a file into `dir` if it isn't already there and nothing blocks it. */
	private async reorganize(file: TFile, dir: string): Promise<void> {
		const target = normalizePath(`${dir ? dir + "/" : ""}${file.name}`);
		if (file.path === target) return;
		if (this.pathExists(target)) return; // don't clobber a different file
		await this.app.fileManager.renameFile(file, target);
	}

	private async uniquePath(dir: string, base: string): Promise<string> {
		const d = dir ? dir + "/" : "";
		let candidate = normalizePath(`${d}${base}.md`);
		if (!this.pathExists(candidate)) return candidate;

		for (let i = 2; i < 1000; i++) {
			candidate = normalizePath(`${d}${base}-${i}.md`);
			if (!this.pathExists(candidate)) return candidate;
		}
		return normalizePath(`${d}${base}-${Date.now()}.md`);
	}

	/** A timestamped filename (base_HH-mm.md), disambiguated on collision. */
	private timestampedPath(dir: string, base: string): string {
		const d = dir ? dir + "/" : "";
		const stamp = formatDate(new Date(), "HH-mm");
		let candidate = normalizePath(`${d}${base}_${stamp}.md`);
		if (!this.pathExists(candidate)) return candidate;
		for (let i = 2; i < 1000; i++) {
			candidate = normalizePath(`${d}${base}_${stamp}-${i}.md`);
			if (!this.pathExists(candidate)) return candidate;
		}
		return normalizePath(`${d}${base}_${Date.now()}.md`);
	}

	private pathExists(path: string): boolean {
		return this.app.vault.getAbstractFileByPath(path) !== null;
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const path = normalizePath(folderPath);
		if (!path || path === "/") return;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;
		if (existing) {
			throw new Error(`"${path}" exists but is not a folder.`);
		}
		await this.app.vault.createFolder(path);
	}

	private reportError(error: unknown, silent = false) {
		const message =
			error instanceof OpenWhisprCliError || error instanceof Error
				? error.message
				: String(error);
		console.error("OpenWhispr sync error:", error);
		this.setStatus("error");
		if (!silent) new Notice(`OpenWhispr: ${message}`, 10000);
	}
}

/** Remove a leading top-level (`# …`) heading line from markdown. */
function stripLeadingH1(md: string): string {
	return md.replace(/^\s*#\s+.*(?:\r?\n)+/, "");
}

/** Drop a leading YAML frontmatter block, if present. */
function stripFrontmatter(md: string): string {
	return md.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

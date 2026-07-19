// Shapes returned by `openwhispr notes list|get --format json`.
// Fields are kept permissive because the CLI schema is still evolving.

export interface OpenWhisprNote {
	id: string | number;
	title?: string | null;
	/** The user's own personal notes (markdown). Rendered under `## My Notes`. */
	content?: string | null;
	/** AI-cleaned version of `content`. Rendered under `## Enhanced Notes`. */
	enhanced_content?: string | null;
	/** "personal" | "meeting" | … — informational only. */
	note_type?: string | null;
	/** Raw transcript payload from the CLI (unused for rendering; the plugin
	 *  writes the CLI's `--transcript --format markdown` output instead). */
	transcript?: string | null;
	/** Numeric folder reference; resolved to a name via `folders list`. */
	folder_id?: string | number | null;
	/** Resolved folder name (set by the plugin, not emitted by the CLI). */
	folder?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	// Anything else the CLI decides to emit.
	[key: string]: unknown;
}

/** Shape returned by `openwhispr folders list --format json`. */
export interface OpenWhisprFolder {
	id: string | number;
	name?: string | null;
	// Anything else the CLI decides to emit.
	[key: string]: unknown;
}

/** What to do when a note's file already exists in the vault (matched by id). */
export type ExistingNoteAction = "overwrite" | "skip" | "timestamped";

/** How synced notes are laid out inside the sync folder. */
export type FolderStructure = "flat" | "date" | "openwhispr";

/** Character used to join filename tokens and sanitize titles ("" = none). */
export type FilenameSeparator = "-" | "_" | " " | "";

export interface OpenWhisprSettings {
	// ---- OpenWhispr CLI ----
	/** Path to the `openwhispr` binary. Bare name resolves via PATH. */
	cliPath: string;
	/** Optional backend flag: "", "local", or "remote". */
	backend: "" | "local" | "remote";

	// ---- Note content ----
	/** Include the user's personal notes under `## My Notes`. */
	includeMyNotes: boolean;
	/** Include the AI-enhanced notes under `## Enhanced Notes`. */
	includeEnhancedNotes: boolean;
	/** Include the speaker-labeled transcript under `## Transcript`. */
	includeTranscript: boolean;

	// ---- Filename settings ----
	/** Literal prefix prepended to every synced filename. */
	filenamePrefix: string;
	/** Filename template, e.g. "{title}" or "{created_date}_{title}". */
	filenameTemplate: string;
	/** Moment-style date tokens used by {created_date}. */
	dateFormat: string;
	/** Character used to join template tokens and sanitize titles. */
	filenameSeparator: FilenameSeparator;
	/** What to do when a note already has a file (matched by openwhispr_id). */
	existingNoteAction: ExistingNoteAction;

	// ---- File organization ----
	/** Vault-relative folder that synced notes are written to. */
	syncFolder: string;
	/** How notes are organized within the sync folder. */
	folderStructure: FolderStructure;
	/** Date tokens for date-based subfolders (may contain "/" for nesting). */
	folderDateFormat: string;

	// ---- Sync ----
	/** Max notes to sync per run (most recent first). Ignored if syncAllHistory. */
	syncLimit: number;
	/** Sync the entire history every run, ignoring syncLimit. */
	syncAllHistory: boolean;
	/** Auto-sync interval in minutes. 0 disables auto-sync. */
	autoSyncMinutes: number;
	/** Sync on Obsidian startup. */
	syncOnStartup: boolean;
}

export const DEFAULT_SETTINGS: OpenWhisprSettings = {
	cliPath: "openwhispr",
	backend: "",

	includeMyNotes: true,
	includeEnhancedNotes: false,
	includeTranscript: false,

	filenamePrefix: "",
	filenameTemplate: "{title}",
	dateFormat: "YYYY-MM-DD",
	filenameSeparator: "-",
	existingNoteAction: "overwrite",

	syncFolder: "OpenWhispr",
	folderStructure: "flat",
	folderDateFormat: "YYYY-MM-DD",

	syncLimit: 50,
	syncAllHistory: false,
	autoSyncMinutes: 0,
	syncOnStartup: false,
};

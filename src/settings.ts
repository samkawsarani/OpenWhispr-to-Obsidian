import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionGroup,
	SettingDefinitionItem,
} from "obsidian";
import type OpenWhisprPlugin from "./main";
import type { OpenWhisprSettings } from "./types";

type SettingKey = keyof OpenWhisprSettings;

function isGroup(item: SettingDefinitionItem): item is SettingDefinitionGroup {
	return "type" in item && (item.type === "group" || item.type === "list");
}

export class OpenWhisprSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: OpenWhisprPlugin) {
		super(app, plugin);
	}

	private get settings() {
		return this.plugin.settings;
	}

	private save() {
		return this.plugin.saveSettings();
	}

	/**
	 * The single source of truth for this plugin's settings UI. Obsidian 1.13+
	 * renders (and search-indexes) this directly; `display()` below renders the
	 * same definitions imperatively for older versions.
	 */
	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			this.cliGroup(),
			this.noteContentGroup(),
			this.filenamesGroup(),
			this.organizationGroup(),
			this.syncGroup(),
		];
	}

	/**
	 * Obsidian's default accessors persist via `saveData` directly, which would
	 * bypass `saveSettings()` and leave the auto-sync timer on its old interval.
	 */
	getControlValue(key: string): unknown {
		const value = (this.settings as unknown as Record<string, unknown>)[key];
		// autoSyncMinutes is stored as a number but bound to a dropdown, and
		// dropdown controls are string-valued.
		return key === "autoSyncMinutes" ? String(value) : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const bag = this.settings as unknown as Record<string, unknown>;
		bag[key] = this.normalize(key, value);
		await this.save();
	}

	/** Trim/fallback/parse rules applied before a value is stored. */
	private normalize(key: string, value: unknown): unknown {
		const text = typeof value === "string" ? value.trim() : value;

		switch (key) {
			case "cliPath":
				return text || "openwhispr";
			case "filenameTemplate":
				return text || "{title}";
			case "dateFormat":
			case "folderDateFormat":
				return text || "YYYY-MM-DD";
			case "syncFolder":
				return text || "OpenWhispr";
			case "syncLimit": {
				const parsed =
					typeof value === "number" ? value : Number.parseInt(String(value), 10);
				return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
			}
			case "autoSyncMinutes":
				return Number.parseInt(String(value), 10) || 0;
			default:
				return value;
		}
	}

	// ---- OpenWhispr CLI ---------------------------------------------------

	private cliGroup(): SettingDefinitionGroup<SettingKey> {
		return {
			type: "group",
			heading: "OpenWhispr CLI",
			items: [
				{
					name: "CLI path",
					desc:
						'Path to the "openwhispr" executable. Use a bare name to resolve via PATH, ' +
						"or an absolute path (e.g. /usr/local/bin/openwhispr).",
					control: { type: "text", key: "cliPath", placeholder: "openwhispr" },
				},
				{
					name: "Backend",
					desc: "Which OpenWhispr backend to target. Auto lets the CLI decide (local, then remote).",
					control: {
						type: "dropdown",
						key: "backend",
						options: {
							"": "Auto",
							local: "Local (desktop app)",
							remote: "Remote (cloud API)",
						},
					},
				},
				{
					name: "Test connection",
					desc: "Run the CLI and report its version to confirm the plugin can reach it.",
					render: (setting) => {
						setting.addButton((btn) =>
							btn
								.setButtonText("Test connection")
								.setCta()
								.onClick(() => void this.plugin.testConnection())
						);
					},
				},
			],
		};
	}

	// ---- Note content -----------------------------------------------------

	private noteContentGroup(): SettingDefinitionGroup<SettingKey> {
		return {
			type: "group",
			heading: "Note content",
			items: [
				{
					name: "Include my notes",
					desc:
						"Add the notes you typed yourself in OpenWhispr under a ## My Notes " +
						"heading. Default: on.",
					control: { type: "toggle", key: "includeMyNotes" },
				},
				{
					name: "Include enhanced notes",
					desc:
						"Add OpenWhispr's AI-cleaned rewrite of your notes — grammar fixed, " +
						"filler removed, action items surfaced — under a ## Enhanced Notes " +
						"heading. Default: off.",
					control: { type: "toggle", key: "includeEnhancedNotes" },
				},
				{
					name: "Include full transcript",
					desc:
						"Add the complete speaker-labeled transcript with timestamps " +
						"(e.g. **Me** (0:03): …) under a ## Transcript heading. Can be long. " +
						"Default: off.",
					control: { type: "toggle", key: "includeTranscript" },
				},
			],
		};
	}

	// ---- Filenames --------------------------------------------------------

	private filenamesGroup(): SettingDefinitionGroup<SettingKey> {
		return {
			type: "group",
			heading: "Filenames",
			items: [
				{
					name: "Filename prefix",
					desc:
						"Optional text added to the start of every filename (e.g. openwhispr-, " +
						"meeting-) — handy for grouping or spotting synced notes at a glance. " +
						"Leave empty for none.",
					control: {
						type: "text",
						key: "filenamePrefix",
						placeholder: "openwhispr-",
					},
				},
				{
					name: "Filename template",
					desc:
						"Build filenames from tokens: {title}, {id}, {created_date}, {folder}. " +
						"Example: {created_date}_{title} → 2026-07-15_Weekly-Standup. " +
						"Default: {title}.",
					control: {
						type: "text",
						key: "filenameTemplate",
						placeholder: "{title}",
					},
				},
				{
					name: "Date format",
					desc:
						"Format for the {created_date} token. Tokens: YYYY, MM, DD, HH, mm, ss. " +
						"Examples: YYYY-MM-DD (2026-07-15), DD-MM-YYYY (15-07-2026), " +
						"YYYY/MM/DD (nests into subfolders when used in the template).",
					control: { type: "text", key: "dateFormat", placeholder: "YYYY-MM-DD" },
				},
				{
					name: "Filename separator",
					desc:
						"Character that replaces spaces in filenames — match your naming " +
						"convention. Each option previews the title 'Daily Standup'.",
					control: {
						type: "dropdown",
						key: "filenameSeparator",
						options: {
							"-": "Dash (-) — Daily-Standup",
							_: "Underscore (_) — Daily_Standup",
							" ": "Space — Daily Standup",
							"": "None — DailyStandup",
						},
					},
				},
				{
					name: "Existing notes",
					desc:
						"What to do when a note that was already synced (matched by its " +
						"openwhispr_id) has a file in your vault. Overwrite keeps it up to " +
						"date; Skip preserves any manual edits you made; Timestamped copy " +
						"leaves the old file and adds a new one (e.g. Standup_13-40.md) when " +
						"the content has changed. Two different notes that resolve to the " +
						"same name are always kept as separate files.",
					control: {
						type: "dropdown",
						key: "existingNoteAction",
						options: {
							overwrite: "Overwrite in place",
							skip: "Skip (leave untouched)",
							timestamped: "Keep timestamped copy",
						},
					},
				},
			],
		};
	}

	// ---- File organization ------------------------------------------------

	private organizationGroup(): SettingDefinitionGroup<SettingKey> {
		return {
			type: "group",
			heading: "File organization",
			items: [
				{
					name: "Sync folder",
					desc:
						"Vault folder that synced notes are written to. Created automatically " +
						"if it doesn't exist. Default: OpenWhispr.",
					control: { type: "text", key: "syncFolder", placeholder: "OpenWhispr" },
				},
				{
					name: "Folder structure",
					desc:
						"How notes are organized inside the sync folder. Flat keeps everything " +
						"in one folder; Date-based groups by creation (meeting) date (e.g. " +
						"OpenWhispr/2026-07-15/…); Mirror OpenWhispr folders recreates the " +
						"folders you set up in the OpenWhispr app (e.g. OpenWhispr/Meetings/…). " +
						"Notes are moved to the right folder automatically on every sync if " +
						"their folder changes.",
					control: {
						type: "dropdown",
						key: "folderStructure",
						options: {
							flat: "Flat (all in one folder)",
							date: "Date-based subfolders",
							openwhispr: "Mirror OpenWhispr folders",
						},
					},
				},
				{
					name: "Folder date format",
					desc:
						"Date format for date-based subfolders. Use / to nest: YYYY-MM-DD " +
						"→ 2026-07-15, YYYY/MM → 2026/07, YYYY/MM/DD → 2026/07/15. " +
						"Only applies when Folder structure is set to Date-based subfolders.",
					control: {
						type: "text",
						key: "folderDateFormat",
						placeholder: "YYYY-MM-DD",
					},
				},
			],
		};
	}

	// ---- Sync -------------------------------------------------------------

	private syncGroup(): SettingDefinitionGroup<SettingKey> {
		return {
			type: "group",
			heading: "Sync",
			items: [
				{
					name: "Manual sync",
					desc:
						"Sync your OpenWhispr notes right now. Also available from the ribbon " +
						"microphone icon and the 'Sync OpenWhispr notes' command.",
					render: (setting) => {
						setting.addButton((btn) =>
							btn
								.setButtonText("Sync now")
								.setCta()
								.onClick(() => void this.plugin.syncNotes())
						);
					},
				},
				{
					name: "Sync all historical notes",
					desc:
						"When on, every sync pulls your entire note history, ignoring the sync " +
						"limit. Useful for the first run to backfill everything — turn it off " +
						"afterward to keep routine syncs fast. Default: off.",
					control: { type: "toggle", key: "syncAllHistory" },
				},
				{
					name: "Sync limit",
					desc:
						"Maximum number of most-recent notes to pull per sync. Keeps routine " +
						"syncs quick; use 'Sync all historical notes' to backfill older " +
						"ones. Ignored while Sync all historical notes is on. Default: 50.",
					control: {
						type: "number",
						key: "syncLimit",
						placeholder: "50",
						min: 1,
					},
				},
				{
					name: "Auto-sync frequency",
					desc:
						"How often to sync automatically in the background. Every 5–10 minutes " +
						"is a good balance; shorter is more up-to-date but busier, and Never " +
						"leaves you in full manual control. Default: Never.",
					control: {
						type: "dropdown",
						key: "autoSyncMinutes",
						options: {
							"0": "Never",
							"1": "Every 1 minute",
							"5": "Every 5 minutes",
							"10": "Every 10 minutes",
							"30": "Every 30 minutes",
							"60": "Every hour",
							"1440": "Every 24 hours",
						},
					},
				},
				{
					name: "Sync on startup",
					desc: "Run a sync automatically when Obsidian finishes loading.",
					control: { type: "toggle", key: "syncOnStartup" },
				},
			],
		};
	}

	// ---- Fallback rendering for Obsidian < 1.13 ---------------------------

	/**
	 * Obsidian 1.13+ ignores this in favour of `getSettingDefinitions()`. Older
	 * versions call it, so render the same definitions imperatively rather than
	 * keeping a second copy of every name and description.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		for (const item of this.getSettingDefinitions()) {
			if (isGroup(item)) {
				if (item.heading) {
					new Setting(containerEl).setName(item.heading).setHeading();
				}
				for (const child of item.items ?? []) {
					this.renderLegacy(containerEl, child);
				}
			} else {
				this.renderLegacy(containerEl, item);
			}
		}
	}

	/** Render one definition with the pre-1.13 imperative `Setting` API. */
	private renderLegacy(
		containerEl: HTMLElement,
		def: SettingDefinitionItem<SettingKey>
	): void {
		// This plugin defines no nested groups, lists, or pages.
		if (isGroup(def) || ("type" in def && def.type === "page")) return;

		const setting = new Setting(containerEl).setName(def.name);
		if (def.desc) setting.setDesc(def.desc);

		if ("render" in def && def.render) {
			// No SettingGroup exists on this code path; every `render` callback in
			// this file takes only the Setting.
			def.render(setting, undefined as never);
			return;
		}
		if (!("control" in def) || !def.control) return;

		const control = def.control;
		const commit = (value: unknown) => void this.setControlValue(control.key, value);
		const current = this.getControlValue(control.key);

		switch (control.type) {
			case "toggle":
				setting.addToggle((toggle) =>
					toggle.setValue(Boolean(current)).onChange(commit)
				);
				break;
			case "dropdown":
				setting.addDropdown((dd) =>
					dd
						.addOptions(control.options)
						.setValue(String(current ?? ""))
						.onChange(commit)
				);
				break;
			case "text":
			case "number":
				setting.addText((text) => {
					if (control.placeholder) text.setPlaceholder(control.placeholder);
					if (control.type === "number") text.inputEl.type = "number";
					text.setValue(String(current ?? "")).onChange(commit);
				});
				break;
			default:
				break;
		}
	}
}

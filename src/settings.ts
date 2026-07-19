import { App, PluginSettingTab, Setting } from "obsidian";
import type OpenWhisprPlugin from "./main";
import type {
	ExistingNoteAction,
	FilenameSeparator,
	FolderStructure,
} from "./types";

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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderCliSection(containerEl);
		this.renderNoteContentSection(containerEl);
		this.renderFilenameSection(containerEl);
		this.renderOrganizationSection(containerEl);
		this.renderSyncSection(containerEl);
	}

	// ---- OpenWhispr CLI ---------------------------------------------------

	private renderCliSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("OpenWhispr CLI").setHeading();

		new Setting(containerEl)
			.setName("CLI path")
			.setDesc(
				'Path to the "openwhispr" executable. Use a bare name to resolve via PATH, ' +
					"or an absolute path (e.g. /usr/local/bin/openwhispr)."
			)
			.addText((text) =>
				text
					.setPlaceholder("openwhispr")
					.setValue(this.settings.cliPath)
					.onChange(async (value) => {
						this.settings.cliPath = value.trim() || "openwhispr";
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Backend")
			.setDesc("Which OpenWhispr backend to target. Auto lets the CLI decide (local, then remote).")
			.addDropdown((dd) =>
				dd
					.addOptions({ "": "Auto", local: "Local (desktop app)", remote: "Remote (cloud API)" })
					.setValue(this.settings.backend)
					.onChange(async (value) => {
						this.settings.backend = value as "" | "local" | "remote";
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Run the CLI and report its version to confirm the plugin can reach it.")
			.addButton((btn) =>
				btn
					.setButtonText("Test connection")
					.setCta()
					.onClick(() => void this.plugin.testConnection())
			);
	}

	// ---- Note content -----------------------------------------------------

	private renderNoteContentSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Note content").setHeading();

		new Setting(containerEl)
			.setName("Include my notes")
			.setDesc(
				"Add the notes you typed yourself in OpenWhispr under a ## My Notes " +
					"heading. Default: on."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.settings.includeMyNotes).onChange(async (value) => {
					this.settings.includeMyNotes = value;
					await this.save();
				})
			);

		new Setting(containerEl)
			.setName("Include enhanced notes")
			.setDesc(
				"Add OpenWhispr's AI-cleaned rewrite of your notes — grammar fixed, " +
					"filler removed, action items surfaced — under a ## Enhanced Notes " +
					"heading. Default: off."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.settings.includeEnhancedNotes).onChange(async (value) => {
					this.settings.includeEnhancedNotes = value;
					await this.save();
				})
			);

		new Setting(containerEl)
			.setName("Include full transcript")
			.setDesc(
				"Add the complete speaker-labeled transcript with timestamps " +
					"(e.g. **Me** (0:03): …) under a ## Transcript heading. Can be long. " +
					"Default: off."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.settings.includeTranscript).onChange(async (value) => {
					this.settings.includeTranscript = value;
					await this.save();
				})
			);
	}

	// ---- Filename settings ------------------------------------------------

	private renderFilenameSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Filename settings").setHeading();

		new Setting(containerEl)
			.setName("Filename prefix")
			.setDesc(
				"Optional text added to the start of every filename (e.g. openwhispr-, " +
					"meeting-) — handy for grouping or spotting synced notes at a glance. " +
					"Leave empty for none."
			)
			.addText((text) =>
				text
					.setPlaceholder("openwhispr-")
					.setValue(this.settings.filenamePrefix)
					.onChange(async (value) => {
						this.settings.filenamePrefix = value;
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Filename template")
			.setDesc(
				"Build filenames from tokens: {title}, {id}, {created_date}, {folder}. " +
					"Example: {created_date}_{title} → 2026-07-15_Weekly-Standup. " +
					"Default: {title}."
			)
			.addText((text) =>
				text
					.setPlaceholder("{title}")
					.setValue(this.settings.filenameTemplate)
					.onChange(async (value) => {
						this.settings.filenameTemplate = value.trim() || "{title}";
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Date format")
			.setDesc(
				"Format for the {created_date} token. Tokens: YYYY, MM, DD, HH, mm, ss. " +
					"Examples: YYYY-MM-DD (2026-07-15), DD-MM-YYYY (15-07-2026), " +
					"YYYY/MM/DD (nests into subfolders when used in the template)."
			)
			.addText((text) =>
				text
					.setPlaceholder("YYYY-MM-DD")
					.setValue(this.settings.dateFormat)
					.onChange(async (value) => {
						this.settings.dateFormat = value.trim() || "YYYY-MM-DD";
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Filename separator")
			.setDesc(
				"Character that replaces spaces in filenames — match your naming " +
					"convention. Each option previews the title 'Daily Standup'."
			)
			.addDropdown((dd) =>
				dd
					.addOptions({
						"-": "Dash (-) — Daily-Standup",
						_: "Underscore (_) — Daily_Standup",
						" ": "Space — Daily Standup",
						"": "None — DailyStandup",
					})
					.setValue(this.settings.filenameSeparator)
					.onChange(async (value) => {
						this.settings.filenameSeparator = value as FilenameSeparator;
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Existing notes")
			.setDesc(
				"What to do when a note that was already synced (matched by its " +
					"openwhispr_id) has a file in your vault. Overwrite keeps it up to " +
					"date; Skip preserves any manual edits you made; Timestamped copy " +
					"leaves the old file and adds a new one (e.g. Standup_13-40.md) when " +
					"the content has changed. Two different notes that resolve to the " +
					"same name are always kept as separate files."
			)
			.addDropdown((dd) =>
				dd
					.addOptions({
						overwrite: "Overwrite in place",
						skip: "Skip (leave untouched)",
						timestamped: "Keep timestamped copy",
					})
					.setValue(this.settings.existingNoteAction)
					.onChange(async (value) => {
						this.settings.existingNoteAction = value as ExistingNoteAction;
						await this.save();
					})
			);
	}

	// ---- File organization ------------------------------------------------

	private renderOrganizationSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("File organization").setHeading();

		new Setting(containerEl)
			.setName("Sync folder")
			.setDesc(
				"Vault folder that synced notes are written to. Created automatically " +
					"if it doesn't exist. Default: OpenWhispr."
			)
			.addText((text) =>
				text
					.setPlaceholder("OpenWhispr")
					.setValue(this.settings.syncFolder)
					.onChange(async (value) => {
						this.settings.syncFolder = value.trim() || "OpenWhispr";
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Folder structure")
			.setDesc(
				"How notes are organized inside the sync folder. Flat keeps everything " +
					"in one folder; Date-based groups by creation (meeting) date (e.g. " +
					"OpenWhispr/2026-07-15/…); Mirror OpenWhispr folders recreates the " +
					"folders you set up in the OpenWhispr app (e.g. OpenWhispr/Meetings/…). " +
					"Notes are moved to the right folder automatically on every sync if " +
					"their folder changes."
			)
			.addDropdown((dd) =>
				dd
					.addOptions({
						flat: "Flat (all in one folder)",
						date: "Date-based subfolders",
						openwhispr: "Mirror OpenWhispr folders",
					})
					.setValue(this.settings.folderStructure)
					.onChange(async (value) => {
						this.settings.folderStructure = value as FolderStructure;
						await this.save();
						this.display(); // toggle visibility of the date-format field
					})
			);

		if (this.settings.folderStructure === "date") {
			new Setting(containerEl)
				.setName("Folder date format")
				.setDesc(
					"Date format for date-based subfolders. Use / to nest: YYYY-MM-DD " +
						"→ 2026-07-15, YYYY/MM → 2026/07, YYYY/MM/DD → 2026/07/15."
				)
				.addText((text) =>
					text
						.setPlaceholder("YYYY-MM-DD")
						.setValue(this.settings.folderDateFormat)
						.onChange(async (value) => {
							this.settings.folderDateFormat = value.trim() || "YYYY-MM-DD";
							await this.save();
						})
				);
		}
	}

	// ---- Sync -------------------------------------------------------------

	private renderSyncSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Sync").setHeading();

		new Setting(containerEl)
			.setName("Manual sync")
			.setDesc(
				"Sync your OpenWhispr notes right now. Also available from the ribbon " +
					"microphone icon and the 'Sync OpenWhispr notes' command."
			)
			.addButton((btn) =>
				btn
					.setButtonText("Sync now")
					.setCta()
					.onClick(() => void this.plugin.syncNotes())
			);

		new Setting(containerEl)
			.setName("Sync all historical notes")
			.setDesc(
				"When on, every sync pulls your entire note history, ignoring the sync " +
					"limit. Useful for the first run to backfill everything — turn it off " +
					"afterward to keep routine syncs fast. Default: off."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.settings.syncAllHistory).onChange(async (value) => {
					this.settings.syncAllHistory = value;
					await this.save();
					this.display(); // toggle visibility of the sync limit field
				})
			);

		if (!this.settings.syncAllHistory) {
			new Setting(containerEl)
				.setName("Sync limit")
				.setDesc(
					"Maximum number of most-recent notes to pull per sync. Keeps routine " +
						"syncs quick; use 'Sync all historical notes' to backfill older " +
						"ones. Default: 50."
				)
				.addText((text) =>
					text
						.setPlaceholder("50")
						.setValue(String(this.settings.syncLimit))
						.onChange(async (value) => {
							const parsed = Number.parseInt(value, 10);
							this.settings.syncLimit =
								Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
							await this.save();
						})
				);
		}

		new Setting(containerEl)
			.setName("Auto-sync frequency")
			.setDesc(
				"How often to sync automatically in the background. Every 5–10 minutes " +
					"is a good balance; shorter is more up-to-date but busier, and Never " +
					"leaves you in full manual control. Default: Never."
			)
			.addDropdown((dd) =>
				dd
					.addOptions({
						"0": "Never",
						"1": "Every 1 minute",
						"5": "Every 5 minutes",
						"10": "Every 10 minutes",
						"30": "Every 30 minutes",
						"60": "Every hour",
						"1440": "Every 24 hours",
					})
					.setValue(String(this.settings.autoSyncMinutes))
					.onChange(async (value) => {
						this.settings.autoSyncMinutes = Number.parseInt(value, 10) || 0;
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc("Run a sync automatically when Obsidian finishes loading.")
			.addToggle((toggle) =>
				toggle.setValue(this.settings.syncOnStartup).onChange(async (value) => {
					this.settings.syncOnStartup = value;
					await this.save();
				})
			);
	}
}

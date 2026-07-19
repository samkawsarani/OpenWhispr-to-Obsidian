import { execFile } from "child_process";
import { readdirSync } from "fs";
import { homedir, platform } from "os";
import { delimiter, join } from "path";
import { OpenWhisprFolder, OpenWhisprNote, OpenWhisprSettings } from "./types";

const EXEC_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 64 * 1024 * 1024; // transcripts can be large

export class OpenWhisprCliError extends Error {
	constructor(message: string, readonly code?: number, readonly stderr?: string) {
		super(message);
		this.name = "OpenWhisprCliError";
	}
}

/**
 * Directories where a globally-installed `openwhispr` binary commonly lives.
 *
 * Obsidian is an Electron GUI app; when launched from Finder/Dock/a desktop
 * launcher it inherits a minimal PATH that usually omits Homebrew, the system
 * `/usr/local/bin`, and Node version managers (nvm/fnm/volta) — exactly where
 * `npm i -g @openwhispr/cli` puts the binary. `execFile` doesn't go through a
 * login shell, so a bare `openwhispr` then fails with ENOENT even though it
 * works fine in a terminal. We prepend these candidates to PATH so lookups
 * succeed regardless of how Obsidian was started.
 */
function extraPathDirs(): string[] {
	const home = homedir();
	const dirs: string[] = [];
	const env = process.env;

	if (platform() === "win32") {
		if (env.APPDATA) dirs.push(join(env.APPDATA, "npm"));
		if (env.LOCALAPPDATA) dirs.push(join(env.LOCALAPPDATA, "npm"));
	} else {
		dirs.push(
			"/usr/local/bin",
			"/opt/homebrew/bin", // Apple Silicon Homebrew
			"/usr/bin",
			"/bin",
			"/opt/local/bin", // MacPorts
			"/snap/bin",
			join(home, ".local", "bin"),
			join(home, ".npm-global", "bin"),
			join(home, ".yarn", "bin"),
			join(home, ".bun", "bin")
		);
	}

	// Node version managers expose the active binary dir via env vars even when
	// the GUI PATH is stripped down.
	if (env.NVM_BIN) dirs.push(env.NVM_BIN);
	if (env.VOLTA_HOME) dirs.push(join(env.VOLTA_HOME, "bin"));
	if (env.npm_config_prefix) dirs.push(join(env.npm_config_prefix, "bin"));
	dirs.push(join(home, ".volta", "bin"), join(home, ".fnm"));

	// A GUI-launched Obsidian doesn't run the nvm/fnm shell init, so NVM_BIN et
	// al. are unset — env vars alone won't reveal the managed Node dir. The CLI
	// is a `#!/usr/bin/env node` script, so this dir must be on PATH not just to
	// resolve `openwhispr` but so its shebang can find `node` at exec time.
	// Discover installed versions directly from disk instead.
	dirs.push(...nodeVersionManagerBins(home));

	return dirs;
}

/**
 * Bin directories of Node versions installed by nvm / fnm, discovered by
 * scanning their on-disk layout (env vars are unavailable under a GUI launch).
 */
function nodeVersionManagerBins(home: string): string[] {
	const roots = [
		join(home, ".nvm", "versions", "node"),
		join(home, ".fnm", "node-versions"), // fnm: <ver>/installation/bin
		join(home, ".local", "share", "fnm", "node-versions"),
	];
	const bins: string[] = [];
	for (const root of roots) {
		let versions: string[];
		try {
			versions = readdirSync(root);
		} catch {
			continue; // manager not installed
		}
		for (const ver of versions) {
			bins.push(join(root, ver, "bin"), join(root, ver, "installation", "bin"));
		}
	}
	return bins;
}

/** process.env with common CLI install locations prepended to PATH. */
function augmentedEnv(): NodeJS.ProcessEnv {
	const current = process.env.PATH ?? "";
	const existing = new Set(current.split(delimiter).filter(Boolean));
	const additions = extraPathDirs().filter((dir) => dir && !existing.has(dir));
	const path = [...additions, current].filter(Boolean).join(delimiter);
	return { ...process.env, PATH: path, Path: path };
}

/** Thin wrapper around the `openwhispr` CLI executed via child_process. */
export class OpenWhisprCli {
	constructor(private settings: OpenWhisprSettings) {}

	private baseArgs(): string[] {
		const args: string[] = [];
		if (this.settings.backend === "local") args.push("--local");
		if (this.settings.backend === "remote") args.push("--remote");
		return args;
	}

	private run(args: string[]): Promise<string> {
		const command = this.settings.cliPath.trim() || "openwhispr";
		const fullArgs = [...args, ...this.baseArgs()];

		return new Promise((resolve, reject) => {
			execFile(
				command,
				fullArgs,
				{
					timeout: EXEC_TIMEOUT_MS,
					maxBuffer: MAX_BUFFER,
					windowsHide: true,
					env: augmentedEnv(),
				},
				(error, stdout, stderr) => {
					if (error) {
						const err = error as NodeJS.ErrnoException;
						if (err.code === "ENOENT") {
							const absoluteHint = /[\\/]/.test(command)
								? ""
								: " Obsidian may not see your shell's PATH — set the CLI path in " +
									'settings to an absolute path (find it by running "which openwhispr" ' +
									'or "where openwhispr" in a terminal).';
							reject(
								new OpenWhisprCliError(
									`Could not find the "${command}" executable. ` +
										`Install it with "npm i -g @openwhispr/cli", then confirm with ` +
										`"openwhispr --version".${absoluteHint}`
								)
							);
							return;
						}
						reject(
							new OpenWhisprCliError(
								`\`${command} ${fullArgs.join(" ")}\` failed: ${stderr || err.message}`,
								typeof err.code === "number" ? err.code : undefined,
								stderr
							)
						);
						return;
					}
					resolve(stdout);
				}
			);
		});
	}

	private async runJson<T>(args: string[]): Promise<T> {
		const stdout = await this.run(args);
		try {
			return JSON.parse(stdout) as T;
		} catch {
			throw new OpenWhisprCliError(
				`Could not parse JSON from \`${args.join(" ")}\`. Output began with: ` +
					stdout.slice(0, 200)
			);
		}
	}

	/** Verify the CLI is reachable; returns the reported version string. */
	async version(): Promise<string> {
		return (await this.run(["--version"])).trim();
	}

	/** `openwhispr notes list --format json` */
	async listNotes(): Promise<OpenWhisprNote[]> {
		const data = await this.runJson<unknown>(["notes", "list", "--format", "json"]);
		if (Array.isArray(data)) return data as OpenWhisprNote[];
		// Some backends may wrap the array in { notes: [...] } / { data: [...] }.
		if (data && typeof data === "object") {
			const obj = data as Record<string, unknown>;
			for (const key of ["notes", "data", "results", "items"]) {
				if (Array.isArray(obj[key])) return obj[key] as OpenWhisprNote[];
			}
		}
		throw new OpenWhisprCliError("Unexpected response shape from `notes list`.");
	}

	/** `openwhispr folders list --format json` */
	async listFolders(): Promise<OpenWhisprFolder[]> {
		const data = await this.runJson<unknown>(["folders", "list", "--format", "json"]);
		if (Array.isArray(data)) return data as OpenWhisprFolder[];
		if (data && typeof data === "object") {
			const obj = data as Record<string, unknown>;
			for (const key of ["folders", "data", "results", "items"]) {
				if (Array.isArray(obj[key])) return obj[key] as OpenWhisprFolder[];
			}
		}
		throw new OpenWhisprCliError("Unexpected response shape from `folders list`.");
	}

	/** `openwhispr notes get <id> --format json` */
	async getNote(id: string | number): Promise<OpenWhisprNote> {
		const data = await this.runJson<unknown>(["notes", "get", String(id), "--format", "json"]);
		if (data && typeof data === "object" && !Array.isArray(data)) {
			const obj = data as Record<string, unknown>;
			if (obj.note && typeof obj.note === "object") return obj.note as OpenWhisprNote;
			return obj as OpenWhisprNote;
		}
		throw new OpenWhisprCliError(`Unexpected response shape from \`notes get ${id}\`.`);
	}

	/**
	 * `openwhispr notes get <id> --transcript --format markdown` — the complete
	 * speaker-labeled markdown document (a `# <title>` heading, a `## Transcript`
	 * section, then one line per segment). Used verbatim as the note body.
	 * Throws {@link OpenWhisprCliError} if the CLI fails.
	 */
	async getTranscriptMarkdown(id: string | number): Promise<string> {
		const stdout = await this.run([
			"notes",
			"get",
			String(id),
			"--transcript",
			"--format",
			"markdown",
		]);
		return stdout.trim();
	}
}

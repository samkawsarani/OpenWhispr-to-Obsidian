import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));

// stamp CHANGELOG.md: turn the "## [Unreleased]" heading into a dated release
// section for this version, leaving a fresh empty "## [Unreleased]" above it.
// Runs during `npm version`, so the dated notes land in the version commit
// (and therefore the tag) — no manual editing, no CI write-back.
const changelogPath = "CHANGELOG.md";
let changelog = readFileSync(changelogPath, "utf8");
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
if (/## \[Unreleased\]/.test(changelog)) {
	changelog = changelog.replace(
		/## \[Unreleased\]/,
		`## [Unreleased]\n\n## [${targetVersion}] - ${today}`
	);
	writeFileSync(changelogPath, changelog);
} else {
	console.warn(
		"version-bump: no '## [Unreleased]' heading in CHANGELOG.md; skipped changelog stamp."
	);
}

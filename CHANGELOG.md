# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Fixed

- Removed a call to `SettingTab.update()`, which is newer than the declared
  minimum Obsidian version. The two conditional settings ("Folder date format"
  and "Sync limit") now always render, with their condition stated in the
  description.

## [1.0.6] - 2026-07-19

- Changes based on Obsidian plugin submission review

## [1.0.5] - 2026-07-19

Initial release.

### Added

- Initial release of OpenWhispr Sync plugin
- Basic sync functionality for OpenWhispr notes
- Frontmatter with metadata support
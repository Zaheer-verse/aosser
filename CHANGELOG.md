# Changelog

Changes are recorded here as they are prepared. Release tags and dates will be added when a release is published.

## Unreleased

### Changed

- Redesign Aosser as a light, responsive workspace with a dedicated monogram, clearer file controls, and keyboard-accessible compression presets.
- Disable the platform attribution and remix badge through the supported standalone project setting.
- Adopt Aosser across the app identity, download archives, package metadata, documentation, and GitHub repository links.

### Fixed

- Use a direct browser download for completed individual files.
- Prepare ZIP archives before a separate download click to preserve user activation.
- Retain multiple files with the same name when creating an archive.
- Keep download object URLs available long enough for the browser to consume them.

### Added

- Automated dependency auditing and CodeQL analysis alongside the existing secret scan.
- Browser checks for keyboard preset selection, local-only processing requests, and the standalone branding setting.
- Regression coverage for file downloads and ZIP creation.
- Project documentation, contribution and security guidance, and GitHub issue and pull request templates.
- Continuous integration for tests, download checks, TypeScript, and the production build.
- Source-control exclusions for generated output, local metadata, temporary files, and secrets.

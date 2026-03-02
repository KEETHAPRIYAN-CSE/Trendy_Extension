# Change Log

All notable changes to the "sfx-terminal" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.4] - 2026-03-02

### Fixed
- **CRITICAL**: Fixed browser autoplay blocking issue that prevented sounds from playing
- Replaced WebView (Chromium) audio with native system audio players
- Sounds now play automatically without any user interaction required

### Changed
- Uses play-sound npm package with native audio players (mplayer/afplay/wmplayer)
- Removed WebView panel and "Show Audio Panel" command
- Improved reliability across all platforms

## [0.0.3] - 2026-03-02

### Changed
- Renamed extension from EFX Terminal to SFX Terminal
- Updated all commands: `efx-terminal.*` → `sfx-terminal.*`
- Updated all settings: `efxTerminal.*` → `sfxTerminal.*`
- Updated branding and documentation

## [0.0.2] - 2026-03-02

### Changed
- Replaced PowerShell-based audio with WebView (Chromium) audio player
- Improved cross-platform compatibility
- Pre-loaded sounds as base64 data URIs for faster playback

### Added
- New command: "SFX: Show Audio Panel"

## [0.0.1] - 2026-03-01

### Added
- Initial release
- Terminal command sound effects
- VS Code task integration
- Custom sound file support
- Shell integration for PowerShell
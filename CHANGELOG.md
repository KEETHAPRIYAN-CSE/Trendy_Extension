# Change Log

All notable changes to the "sfx-terminal" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.7] - 2026-03-03

### Fixed
- **INSTANT PLAYBACK**: Sounds now play within milliseconds, not seconds!
- **UNIVERSAL COMPATIBILITY**: Auto-enables shell integration so sounds work on all machines
- Pre-loads sound files at startup (eliminates open/close overhead)
- Non-blocking playback: stop → seek → play (no more "wait" delay)
- Reduced cooldown from 1000ms to 300ms for faster response

### Changed
- Audio engine now pre-opens both MP3 files at startup and keeps them loaded
- Playback changed from blocking "open → play wait → close" to instant "stop → seek → play"
- Shell integration is now automatically enabled on extension activation
- Audio engine automatically restarts when sound file settings change
- Improved reliability for users whose terminals weren't firing sound events

## [0.0.6] - 2025-07-15

### Fixed
- **CRITICAL**: Reduced audio delay from ~3 seconds to under 1 second
- **CRITICAL**: Added detection and user guidance when shell integration isn't working

### Changed
- New persistent audio engine: pre-compiles winmm.dll bindings at startup, plays sounds instantly via stdin pipe (no more per-sound PowerShell startup)
- Removed unnecessary `Start-Sleep -Milliseconds 200` from audio playback
- Added automatic warning notification when shell integration fails with "Switch to PowerShell" button
- Auto-detects if terminal.integrated.shellIntegration is disabled and offers to enable it
- Auto-detects if default terminal is cmd.exe and offers to switch to PowerShell
- Clean engine shutdown on extension deactivation

## [0.0.5] - 2025-03-02

### Fixed
- Removed dependency on external tools (mplayer, ffmpeg, etc.)
- Audio now uses winmm.dll (built into every Windows since Windows 95)

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
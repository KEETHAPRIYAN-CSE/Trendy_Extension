# SFX Terminal - Sound Effects Extension 🎵

**Add trendy sound effects to your VS Code terminal!**

Just install and go! SFX Terminal **automatically** plays success and error sounds when your terminal commands finish. No setup, no configuration needed.

## ✨ Features

- 🎵 **Success Sound** - Plays when commands exit with code 0
- 🚨 **Error Sound** - Plays when commands fail (non-zero exit code)
- 🔧 **Task Integration** - Works with VS Code build tasks (npm, webpack, tsc, etc.)
- 🔊 **Native Audio** - Uses Windows built-in `winmm.dll` / Mac `afplay` / Linux `paplay` — no extra installs!
- ⚙️ **Customizable** - Use your own MP3/WAV sound files
- ⚡ **Shell Integration** - Automatic command detection in PowerShell terminals
- 💻 **Cross Platform** - Windows, macOS, and Linux
- 📦 **Zero Config** - Sounds are bundled. Just install and it works!

## 🎮 How to Use

1. **Install the extension** from VS Code Marketplace
2. **Open a PowerShell terminal** (View → Terminal)
3. **Run any command** — sounds play automatically!
   - `echo "Hello"` ✅ → Success sound
   - `exit 1` ❌ → Error sound
4. **That's it!** No configuration needed.

## ⚙️ Configuration

This extension provides the following settings:

- `sfxTerminal.enabled`: Enable/disable sound effects (default: true)
- `sfxTerminal.volume`: Volume level 0-100 (default: 100)
- `sfxTerminal.successSound`: Path to custom success sound file
- `sfxTerminal.errorSound`: Path to custom error sound file

## 🔧 Commands

- **SFX: Enable Terminal Audio** - Turn on sound effects
- **SFX: Disable Terminal Audio** - Turn off sound effects  
- **SFX: Test Success Sound** - Play success sound
- **SFX: Test Error Sound** - Play error sound

## 🔊 Custom Sounds

Replace the default sounds by:
1. Adding your `.mp3` or `.wav` files to the extension's `sounds/` folder
2. Or specify custom paths in settings:
   ```json
   {
     "sfxTerminal.successSound": "C:/path/to/your/success.mp3",
     "sfxTerminal.errorSound": "C:/path/to/your/error.wav"
   }
   ```

## 💡 Tips

- **PowerShell works best** — CMD has limited shell integration support
- **Build Tasks always work** — `npm run build`, `tsc`, `webpack` etc. trigger sounds even without shell integration
- **Sounds are bundled** — The MP3 files ship inside the extension, nothing extra to download

## 🐛 Troubleshooting

**No sounds playing?**
1. Check Output panel → "SFX Terminal" for debug logs
2. Ensure shell integration is enabled: Settings → "Terminal Integration"
3. Use PowerShell terminal instead of CMD
4. Test with: Ctrl+Shift+P → "SFX: Test Success Sound"
5. Check that system audio is working (try playing any audio file)

**Shell integration not working?**
- Wait 2-3 seconds after opening terminal
- Sounds still work for VS Code tasks and manual tests
- Consider switching to PowerShell terminal

## 📚 How It Works

| Platform | Audio Method | Needs Install? |
|----------|-------------|----------------|
| **Windows** | `winmm.dll` (mciSendString) via PowerShell | ❌ No — built into Windows |
| **macOS** | `afplay` command | ❌ No — built into macOS |
| **Linux** | `paplay` / `aplay` / `mpv` / `ffplay` | Usually pre-installed |

## 📝 Requirements

- **VS Code** 1.93.0 or higher
- **PowerShell** terminal recommended (for shell integration)
- **No extra software needed** — uses OS built-in audio!

## 🚀 Installation for Development

```bash
git clone https://github.com/KEETHAPRIYAN-CSE/Trendy_Extension.git
cd Trendy_Extension  
npm install
npm run compile
```

Press **F5** to launch Extension Development Host

## 📝 Release Notes

### 0.0.5

**FINAL FIX — Works on every machine!**
- 🔊 **Windows: Uses `winmm.dll` (mciSendString)** — built into every Windows since Windows 95, plays MP3 natively
- 🍎 **Mac: Uses `afplay`** — built into every macOS
- 🐧 **Linux: Uses `paplay`/`aplay`/`mpv`/`ffplay`** — tries multiple players automatically
- ❌ Removed WebView approach (blocked by Chrome autoplay policy)
- ❌ Removed play-sound dependency (needed external tools not installed by default)
- ✅ **Fallback system** — If MP3 playback fails on Windows, falls back to built-in WAV system sounds
- 📦 **Fully self-contained** — No extra downloads or configuration needed

### 0.0.4

**Critical Fix - Audio Autoplay Issue!**
- 🔧 **Fixed autoplay blocking** - Replaced WebView audio with native system audio players
- ✅ **Works automatically** - No user interaction needed, sounds play on every terminal event
- 🚀 **Better reliability** - Uses mplayer (Windows), afplay (Mac), or other system players
- ❌ **Removed WebView panel** - No longer needed, audio works directly

### 0.0.3

**Branding Update**
- 🏷️ **Renamed to SFX Terminal** - Changed from EFX to SFX (Sound Effects)
- 📝 **Updated all commands and settings** - New namespace: `sfxTerminal.*`

### 0.0.2

**Audio System Rewrite - Universal Compatibility!**
- 🌐 **WebView Audio Player** - Replaced PowerShell-based audio with VS Code's built-in Chromium engine
- ✅ **Works on all machines** - No more PowerShell script issues or missing dependencies
- 🚀 **Faster playback** - Sounds are pre-loaded as base64 data URIs
- 🎯 **New command** - "SFX: Show Audio Panel" to manage the audio player
- 🔧 **Improved reliability** - Single code path for Windows, Mac, and Linux

### 0.0.1

Initial release of SFX Terminal
- Terminal command sound effects
- VS Code task integration  
- Custom sound file support
- Cross-platform audio playback
- Shell integration for PowerShell

---

**Enjoy coding with sound effects!** 🎉

Created by [KEETHAPRIYAN](https://github.com/KEETHAPRIYAN-CSE)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/KEETHAPRIYAN.sfx-terminal)](https://marketplace.visualstudio.com/items?itemName=KEETHAPRIYAN.sfx-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/KEETHAPRIYAN.sfx-terminal)](https://marketplace.visualstudio.com/items?itemName=KEETHAPRIYAN.sfx-terminal)
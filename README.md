# EFX Terminal - Sound Effects Extension 🎵

**Add trendy sound effects to your VS Code terminal commands!** 

EFX Terminal plays success and error sounds when terminal commands complete, making your coding experience more engaging and providing immediate audio feedback.

## ✨ Features

- 🎵 **Success Sound** - Plays when commands exit with code 0
- 🚨 **Error Sound** - Plays when commands fail (non-zero exit code)  
- 🔧 **Task Integration** - Works with VS Code build tasks (npm run, webpack, etc.)
- ⚙️ **Customizable** - Use your own sound files
- 🎛️ **Volume Control** - Adjust sound volume (0-100%)
- ⚡ **Shell Integration** - Automatic command detection in PowerShell terminals
- 💻 **Cross Platform** - Works on Windows, macOS, and Linux

## 🎮 How to Use

1. **Install the extension** (F5 to test during development)
2. **Open a PowerShell terminal** (View → Terminal → New Terminal)
3. **Run commands**: 
   - `echo "Success!"` ✅ → Success sound
   - `exit 1` ❌ → Error sound
4. **Test manually**: Ctrl+Shift+P → "EFX: Test Success Sound"

## ⚙️ Configuration

This extension provides the following settings:

- `efxTerminal.enabled`: Enable/disable sound effects (default: true)
- `efxTerminal.volume`: Volume level 0-100 (default: 50)
- `efxTerminal.successSound`: Path to custom success sound file
- `efxTerminal.errorSound`: Path to custom error sound file

## 🔧 Commands

- **EFX: Enable Terminal Audio** - Turn on sound effects
- **EFX: Disable Terminal Audio** - Turn off sound effects  
- **EFX: Test Success Sound** - Play success sound
- **EFX: Test Error Sound** - Play error sound

## 🔊 Custom Sounds

Replace the default sounds by:
1. Adding your `.mp3` or `.wav` files to the extension's `sounds/` folder
2. Or specify custom paths in settings:
   ```json
   {
     "efxTerminal.successSound": "C:/path/to/your/success.mp3",
     "efxTerminal.errorSound": "C:/path/to/your/error.wav"
   }
   ```

## 💡 Tips

- **PowerShell works best** - CMD may have limited shell integration support
- **Shell Integration** must be enabled in VS Code settings
- **Build Tasks** always trigger sounds (npm run compile, webpack, etc.)
- **Error Detection** works for both terminal commands and compiler errors

## 🐛 Troubleshooting

**No sounds playing?**
1. Check Output panel → "EFX Terminal" for debug logs
2. Ensure shell integration is enabled: Settings → "Terminal Integration"
3. Use PowerShell terminal instead of CMD
4. Test with: Ctrl+Shift+P → "EFX: Test Success Sound"

**Shell integration not working?**
- Wait 2-3 seconds after opening terminal
- Sounds still work for VS Code tasks and manual tests
- Consider switching to PowerShell terminal

## 📋 Requirements

- **VS Code** 1.93.0 or higher
- **Audio support** on your system
- **PowerShell** recommended for full terminal integration

## 🚀 Installation for Development

```bash
git clone https://github.com/KEETHAPRIYAN-CSE/Trendy_Extension.git
cd Trendy_Extension  
npm install
npm run compile
```

Press **F5** to launch Extension Development Host

## 📝 Release Notes

### 0.0.1

Initial release of EFX Terminal
- Terminal command sound effects
- VS Code task integration  
- Custom sound file support
- Cross-platform audio playback
- Shell integration for PowerShell

---

**Enjoy coding with sound effects!** 🎉

Created by [KEETHAPRIYAN](https://github.com/KEETHAPRIYAN-CSE)

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/KEETHAPRIYAN.efx-terminal)](https://marketplace.visualstudio.com/items?itemName=KEETHAPRIYAN.efx-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/KEETHAPRIYAN.efx-terminal)](https://marketplace.visualstudio.com/items?itemName=KEETHAPRIYAN.efx-terminal)
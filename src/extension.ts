// ═══════════════════════════════════════════════════════════════════════
// SFX Terminal - Sound Effects for VS Code Terminal
// Plays success/error sounds automatically when terminal commands finish.
// Zero configuration needed - just install and use!
// ═══════════════════════════════════════════════════════════════════════

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as os from 'os';

let isExtensionEnabled = true;
let lastSoundTime = 0;
const SOUND_COOLDOWN = 1000; // Prevent rapid-fire sounds
let outputChannel: vscode.OutputChannel;

// Cache resolved sound file paths
let cachedSuccessPath: string | null = null;
let cachedErrorPath: string | null = null;

// ─── Activation ─────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('SFX Terminal');
    outputChannel.appendLine('SFX Terminal v0.0.5 activating...');
    outputChannel.appendLine('Platform: ' + process.platform);
    outputChannel.appendLine('Extension path: ' + context.extensionPath);

    // Verify & cache bundled sound files
    cachedSuccessPath = resolveSoundPath(context, 'success');
    cachedErrorPath = resolveSoundPath(context, 'error');
    outputChannel.appendLine('Success sound: ' + (cachedSuccessPath ? '✅ ' + cachedSuccessPath : '❌ NOT FOUND'));
    outputChannel.appendLine('Error sound:   ' + (cachedErrorPath ? '✅ ' + cachedErrorPath : '❌ NOT FOUND'));

    // Load config
    isExtensionEnabled = vscode.workspace.getConfiguration('sfxTerminal').get('enabled', true);

    // ── Register commands ──
    context.subscriptions.push(
        vscode.commands.registerCommand('sfx-terminal.enable', () => {
            isExtensionEnabled = true;
            vscode.workspace.getConfiguration('sfxTerminal').update('enabled', true, true);
            vscode.window.showInformationMessage('🔊 SFX Terminal: Sounds enabled');
        }),
        vscode.commands.registerCommand('sfx-terminal.disable', () => {
            isExtensionEnabled = false;
            vscode.workspace.getConfiguration('sfxTerminal').update('enabled', false, true);
            vscode.window.showInformationMessage('🔇 SFX Terminal: Sounds disabled');
        }),
        vscode.commands.registerCommand('sfx-terminal.testSuccess', () => {
            outputChannel.appendLine('--- TEST: Playing success sound ---');
            playSound(context, 'success');
        }),
        vscode.commands.registerCommand('sfx-terminal.testError', () => {
            outputChannel.appendLine('--- TEST: Playing error sound ---');
            playSound(context, 'error');
        })
    );

    // ── Config changes ──
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sfxTerminal')) {
                isExtensionEnabled = vscode.workspace.getConfiguration('sfxTerminal').get('enabled', true);
                // Re-resolve custom paths if changed
                cachedSuccessPath = resolveSoundPath(context, 'success');
                cachedErrorPath = resolveSoundPath(context, 'error');
            }
        })
    );

    // ── Task monitoring (npm run build, tsc, etc.) ──
    // This ALWAYS works, even without shell integration
    context.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess((e) => {
            if (!isExtensionEnabled) { return; }
            outputChannel.appendLine('[TASK] ' + e.execution.task.name + ' → exit code: ' + e.exitCode);
            if (e.exitCode === 0) {
                playSound(context, 'success');
            } else if (e.exitCode !== undefined) {
                playSound(context, 'error');
            }
        })
    );

    // ── Shell integration (VS Code 1.93+) ──
    // Detects individual command completions in the terminal
    context.subscriptions.push(
        vscode.window.onDidEndTerminalShellExecution((e) => {
            if (!isExtensionEnabled) { return; }
            outputChannel.appendLine('[SHELL] Command finished in ' + e.terminal.name + ' → exit code: ' + e.exitCode);
            if (e.exitCode === 0) {
                playSound(context, 'success');
            } else if (e.exitCode !== undefined) {
                playSound(context, 'error');
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTerminalShellIntegration((e) => {
            outputChannel.appendLine('[INFO] Shell integration active: ' + e.terminal.name);
        }),
        vscode.window.onDidStartTerminalShellExecution((e) => {
            outputChannel.appendLine('[SHELL] Command started in: ' + e.terminal.name);
        })
    );

    // ── Terminal lifecycle ──
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal(terminal => {
            outputChannel.appendLine('[INFO] Terminal opened: ' + terminal.name);
            if (!(terminal as any).shellIntegration) {
                pollForShellIntegration(terminal);
            }
        }),
        vscode.window.onDidCloseTerminal(terminal => {
            outputChannel.appendLine('[INFO] Terminal closed: ' + terminal.name);
        })
    );

    // Check existing terminals
    vscode.window.terminals.forEach(t => {
        if (!(t as any).shellIntegration) {
            pollForShellIntegration(t);
        }
    });

    outputChannel.appendLine('');
    outputChannel.appendLine('════════════════════════════════════════');
    outputChannel.appendLine('  SFX Terminal is ACTIVE! ✅');
    outputChannel.appendLine('  • Use PowerShell terminal for best results');
    outputChannel.appendLine('  • Test: Ctrl+Shift+P → "SFX: Test Success Sound"');
    outputChannel.appendLine('════════════════════════════════════════');
    outputChannel.show();
}

// ─── Shell integration polling ──────────────────────────────────────

const pollingSet = new Set<string>();

function pollForShellIntegration(terminal: vscode.Terminal) {
    if (pollingSet.has(terminal.name)) { return; }
    pollingSet.add(terminal.name);

    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if ((terminal as any).shellIntegration) {
            outputChannel.appendLine('[INFO] Shell integration ready: ' + terminal.name);
            clearInterval(interval);
            pollingSet.delete(terminal.name);
        } else if (attempts >= 20) {
            outputChannel.appendLine('[WARN] No shell integration for: ' + terminal.name + ' (use PowerShell)');
            clearInterval(interval);
            pollingSet.delete(terminal.name);
        }
    }, 500);

    const listener = vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) {
            clearInterval(interval);
            pollingSet.delete(terminal.name);
            listener.dispose();
        }
    });
}

// ─── Sound resolution ───────────────────────────────────────────────

function resolveSoundPath(context: vscode.ExtensionContext, type: 'success' | 'error'): string | null {
    // 1. Check user's custom path
    const cfg = vscode.workspace.getConfiguration('sfxTerminal');
    const customPath = type === 'success' ? cfg.get<string>('successSound') : cfg.get<string>('errorSound');
    if (customPath && customPath.trim() !== '' && fs.existsSync(customPath)) {
        return customPath;
    }

    // 2. Use bundled sound (shipped with extension)
    const bundled = path.join(context.extensionPath, 'sounds', type + '.mp3');
    if (fs.existsSync(bundled)) {
        return bundled;
    }

    return null;
}

// ─── Sound playback ─────────────────────────────────────────────────

function playSound(context: vscode.ExtensionContext, type: 'success' | 'error') {
    // Cooldown
    const now = Date.now();
    if (now - lastSoundTime < SOUND_COOLDOWN) {
        outputChannel.appendLine('[SKIP] Cooldown active');
        return;
    }
    lastSoundTime = now;

    if (!isExtensionEnabled) { return; }

    const soundPath = type === 'success' ? cachedSuccessPath : cachedErrorPath;
    if (!soundPath) {
        outputChannel.appendLine('[ERROR] No sound file for: ' + type);
        return;
    }

    outputChannel.appendLine('[PLAY] ' + type + ' → ' + soundPath);

    if (process.platform === 'win32') {
        playOnWindows(soundPath, type);
    } else if (process.platform === 'darwin') {
        playOnMac(soundPath, type);
    } else {
        playOnLinux(soundPath, type);
    }
}

// ─── Windows: winmm.dll mciSendString ───────────────────────────────
// winmm.dll is built into EVERY Windows since Windows 95.
// mciSendString plays MP3 natively. No external tools needed!

function playOnWindows(filePath: string, type: string) {
    const alias = 'sfx' + Date.now();
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const tempScript = path.join(os.tmpdir(), alias + '.ps1');

    // PowerShell script that uses winmm.dll to play audio
    const lines: string[] = [];
    lines.push("Add-Type @'");
    lines.push("using System;");
    lines.push("using System.Runtime.InteropServices;");
    lines.push("using System.Text;");
    lines.push("public class WinMM {");
    lines.push("    [DllImport(\"winmm.dll\")]");
    lines.push("    public static extern int mciSendString(string cmd, StringBuilder retStr, int retLen, IntPtr hwndCallback);");
    lines.push("}");
    lines.push("'@");
    lines.push("");
    lines.push("$soundFile = '" + escapedPath + "'");
    lines.push("$alias = '" + alias + "'");
    lines.push("");
    lines.push("# Open the audio file");
    lines.push('$openCmd = "open `"$soundFile`" type mpegvideo alias $alias"');
    lines.push("[WinMM]::mciSendString($openCmd, $null, 0, [IntPtr]::Zero) | Out-Null");
    lines.push("");
    lines.push("# Small delay to let it load");
    lines.push("Start-Sleep -Milliseconds 200");
    lines.push("");
    lines.push("# Play and wait for completion");
    lines.push('[WinMM]::mciSendString("play $alias wait", $null, 0, [IntPtr]::Zero) | Out-Null');
    lines.push("");
    lines.push("# Clean up");
    lines.push('[WinMM]::mciSendString("close $alias", $null, 0, [IntPtr]::Zero) | Out-Null');

    try {
        fs.writeFileSync(tempScript, lines.join('\r\n'), 'utf8');
    } catch (writeErr) {
        outputChannel.appendLine('[ERROR] Cannot write temp script: ' + writeErr);
        return;
    }

    const cmd = 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + tempScript + '"';

    exec(cmd, { timeout: 15000 }, (err, _stdout, stderr) => {
        // Always clean up temp file
        try { fs.unlinkSync(tempScript); } catch (_) { /* ignore */ }

        if (err) {
            outputChannel.appendLine('[ERROR] Windows playback failed: ' + err.message);
            if (stderr) { outputChannel.appendLine('[STDERR] ' + stderr); }
            // Fallback: try SoundPlayer with system WAV sounds
            playWindowsFallback(type);
        } else {
            outputChannel.appendLine('[OK] ✅ ' + type + ' sound played (winmm.dll)');
        }
    });
}

// Fallback: Use .NET SoundPlayer with built-in Windows WAV sounds
function playWindowsFallback(type: string) {
    outputChannel.appendLine('[FALLBACK] Trying Windows system sounds...');

    const wavFiles = type === 'success'
        ? ['C:\\Windows\\Media\\tada.wav', 'C:\\Windows\\Media\\chimes.wav', 'C:\\Windows\\Media\\notify.wav']
        : ['C:\\Windows\\Media\\Windows Critical Stop.wav', 'C:\\Windows\\Media\\chord.wav', 'C:\\Windows\\Media\\ding.wav'];

    let wavPath: string | null = null;
    for (const p of wavFiles) {
        if (fs.existsSync(p)) {
            wavPath = p;
            break;
        }
    }

    if (!wavPath) {
        outputChannel.appendLine('[ERROR] No system WAV sounds found');
        return;
    }

    const escapedWav = wavPath.replace(/'/g, "''");
    const cmd = "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"(New-Object Media.SoundPlayer '" + escapedWav + "').PlaySync()\"";

    exec(cmd, { timeout: 10000 }, (err) => {
        if (err) {
            outputChannel.appendLine('[ERROR] Fallback failed: ' + err.message);
        } else {
            outputChannel.appendLine('[OK] ✅ Played system sound (fallback)');
        }
    });
}

// ─── macOS: afplay (built into every Mac) ───────────────────────────

function playOnMac(filePath: string, type: string) {
    exec('afplay "' + filePath + '"', { timeout: 10000 }, (err) => {
        if (err) {
            outputChannel.appendLine('[ERROR] Mac playback failed: ' + err.message);
        } else {
            outputChannel.appendLine('[OK] ✅ ' + type + ' sound played (afplay)');
        }
    });
}

// ─── Linux: try multiple common audio players ───────────────────────

function playOnLinux(filePath: string, type: string) {
    // Try players in order of commonality
    const players = [
        'paplay "' + filePath + '"',
        'aplay "' + filePath + '"',
        'mpv --no-video --really-quiet "' + filePath + '"',
        'ffplay -nodisp -autoexit -loglevel quiet "' + filePath + '"',
        'mplayer -really-quiet "' + filePath + '"'
    ];

    tryNextPlayer(players, 0, type);
}

function tryNextPlayer(players: string[], index: number, type: string) {
    if (index >= players.length) {
        outputChannel.appendLine('[ERROR] No Linux audio player found. Install: sudo apt install pulseaudio-utils');
        return;
    }

    exec(players[index], { timeout: 10000 }, (err) => {
        if (err) {
            // Try next player
            tryNextPlayer(players, index + 1, type);
        } else {
            outputChannel.appendLine('[OK] ✅ ' + type + ' sound played on Linux');
        }
    });
}

// ─── Deactivation ───────────────────────────────────────────────────

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}

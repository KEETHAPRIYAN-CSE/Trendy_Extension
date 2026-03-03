// ═══════════════════════════════════════════════════════════════════════
// SFX Terminal - Sound Effects for VS Code Terminal
// v0.0.7 — Pre-loaded audio engine + auto shell integration
// Plays success/error sounds automatically when terminal commands finish.
// Zero configuration needed - just install and use!
// ═══════════════════════════════════════════════════════════════════════

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, exec, ChildProcess } from 'child_process';
import * as os from 'os';

let isExtensionEnabled = true;
let lastSoundTime = 0;
const SOUND_COOLDOWN = 300; // Minimal cooldown — sounds should feel instant
let outputChannel: vscode.OutputChannel;

// Cache resolved sound file paths
let cachedSuccessPath: string | null = null;
let cachedErrorPath: string | null = null;

// Persistent audio engine (Windows only) — eliminates per-sound startup delay
let audioEngine: ChildProcess | null = null;
let audioEngineReady = false;
let audioEngineStarting = false;

// ─── Activation ─────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('SFX Terminal');
    outputChannel.appendLine('SFX Terminal v0.0.7 activating...');
    outputChannel.appendLine('Platform: ' + process.platform);
    outputChannel.appendLine('Extension path: ' + context.extensionPath);

    // Verify & cache bundled sound files
    cachedSuccessPath = resolveSoundPath(context, 'success');
    cachedErrorPath = resolveSoundPath(context, 'error');
    outputChannel.appendLine('Success sound: ' + (cachedSuccessPath ? '✅ ' + cachedSuccessPath : '❌ NOT FOUND'));
    outputChannel.appendLine('Error sound:   ' + (cachedErrorPath ? '✅ ' + cachedErrorPath : '❌ NOT FOUND'));

    // Load config
    isExtensionEnabled = vscode.workspace.getConfiguration('sfxTerminal').get('enabled', true);

    // Auto-enable shell integration so terminal events fire on all machines
    ensureShellIntegration();

    // Pre-warm audio engine on Windows for instant playback
    if (process.platform === 'win32') {
        startAudioEngine();
    }

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
                cachedSuccessPath = resolveSoundPath(context, 'success');
                cachedErrorPath = resolveSoundPath(context, 'error');
                // Restart engine so new sound files are pre-loaded
                if (process.platform === 'win32' && audioEngine) {
                    restartAudioEngine();
                }
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
            outputChannel.appendLine('[INFO] ✅ Shell integration activated: ' + e.terminal.name);
        }),
        vscode.window.onDidStartTerminalShellExecution((e) => {
            outputChannel.appendLine('[SHELL] Command started in: ' + e.terminal.name);
        })
    );

    // ── Terminal lifecycle with shell integration monitoring ──
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal(terminal => {
            outputChannel.appendLine('[INFO] Terminal opened: ' + terminal.name);
            watchForShellIntegration(terminal);
        }),
        vscode.window.onDidCloseTerminal(terminal => {
            outputChannel.appendLine('[INFO] Terminal closed: ' + terminal.name);
            watchedTerminals.delete(terminal);
        })
    );

    // Monitor existing terminals
    vscode.window.terminals.forEach(t => watchForShellIntegration(t));

    // Check shell integration settings on Windows
    checkShellIntegrationConfig();

    outputChannel.appendLine('');
    outputChannel.appendLine('════════════════════════════════════════');
    outputChannel.appendLine('  SFX Terminal v0.0.7 is ACTIVE! ✅');
    outputChannel.appendLine('  • Terminal sounds need PowerShell');
    outputChannel.appendLine('  • Test: Ctrl+Shift+P → "SFX: Test"');
    outputChannel.appendLine('════════════════════════════════════════');
    outputChannel.show();
}

// ─── Persistent Audio Engine (Windows) ──────────────────────────────
// Spawns ONE PowerShell process at extension startup, pre-compiles
// winmm.dll bindings via Add-Type, AND pre-opens both sound files.
// On playback: just stop → seek → play (non-blocking, ~10ms).
// Eliminates all per-sound overhead for truly instant audio.

function startAudioEngine() {
    if (audioEngine || audioEngineStarting) { return; }
    audioEngineStarting = true;
    outputChannel.appendLine('[AUDIO] Starting persistent audio engine...');

    try {
        audioEngine = spawn('powershell.exe', [
            '-NoProfile', '-NoLogo', '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-Command', '-'
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });
    } catch (err: any) {
        outputChannel.appendLine('[AUDIO] Failed to start engine: ' + err.message);
        audioEngineStarting = false;
        return;
    }

    // Compile winmm.dll bindings ONCE AND pre-open both sound files
    const successEsc = (cachedSuccessPath || '').replace(/'/g, "''");
    const errorEsc = (cachedErrorPath || '').replace(/'/g, "''");

    const initLines: string[] = [
        '$ErrorActionPreference = "SilentlyContinue"',
        'Add-Type @"',
        'using System;',
        'using System.Runtime.InteropServices;',
        'using System.Text;',
        'public class WinMM {',
        '    [DllImport("winmm.dll")]',
        '    public static extern int mciSendString(string cmd, StringBuilder retStr, int retLen, IntPtr hwndCallback);',
        '}',
        '"@',
    ];

    // Pre-open sounds at startup so playback is instant (no open/close per play)
    if (cachedSuccessPath) {
        initLines.push('[WinMM]::mciSendString(\'open "' + successEsc + '" type mpegvideo alias sfx_success\', $null, 0, [IntPtr]::Zero) | Out-Null');
    }
    if (cachedErrorPath) {
        initLines.push('[WinMM]::mciSendString(\'open "' + errorEsc + '" type mpegvideo alias sfx_error\', $null, 0, [IntPtr]::Zero) | Out-Null');
    }

    initLines.push('Write-Host "SFX_READY"');
    const initScript = initLines.join('\r\n') + '\r\n';

    audioEngine.stdin!.write(initScript);

    audioEngine.stdout!.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.includes('SFX_READY')) {
            audioEngineReady = true;
            audioEngineStarting = false;
            outputChannel.appendLine('[AUDIO] ✅ Engine ready — sounds will play instantly');
        }
        if (text.includes('SFX_DONE')) {
            outputChannel.appendLine('[OK] ✅ Sound played (instant engine)');
        }
    });

    audioEngine.stderr!.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) { outputChannel.appendLine('[AUDIO STDERR] ' + msg); }
    });

    audioEngine.on('exit', (code) => {
        outputChannel.appendLine('[AUDIO] Engine stopped (code ' + code + ')');
        audioEngine = null;
        audioEngineReady = false;
        audioEngineStarting = false;
    });

    audioEngine.on('error', (err) => {
        outputChannel.appendLine('[AUDIO] Engine error: ' + err.message);
        audioEngine = null;
        audioEngineReady = false;
        audioEngineStarting = false;
    });
}

function restartAudioEngine() {
    outputChannel.appendLine('[AUDIO] Restarting engine with new sound files...');
    if (audioEngine) {
        try {
            audioEngine.stdin!.write('exit\r\n');
            audioEngine.kill();
        } catch (_) { /* ignore */ }
        audioEngine = null;
        audioEngineReady = false;
        audioEngineStarting = false;
    }
    startAudioEngine();
}

// ─── Shell Integration Monitoring ───────────────────────────────────
// Polls for shell integration on each terminal. If it never activates,
// shows a warning with a "Switch to PowerShell" button so the user
// can fix it without manual settings hunting.

const watchedTerminals = new Set<vscode.Terminal>();

function watchForShellIntegration(terminal: vscode.Terminal) {
    if (watchedTerminals.has(terminal)) { return; }
    watchedTerminals.add(terminal);

    if ((terminal as any).shellIntegration) {
        outputChannel.appendLine('[INFO] Shell integration already active: ' + terminal.name);
        return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 20 × 500ms = 10 seconds
    const interval = setInterval(() => {
        attempts++;
        if ((terminal as any).shellIntegration) {
            outputChannel.appendLine('[INFO] ✅ Shell integration ready: ' + terminal.name + ' (after ' + attempts + ' checks)');
            clearInterval(interval);
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            outputChannel.appendLine('[WARN] ⚠️ No shell integration: ' + terminal.name);
            outputChannel.appendLine('[WARN] Terminal commands won\'t trigger sounds in this terminal.');
            outputChannel.appendLine('[WARN] Solution: Use PowerShell terminal (not cmd.exe)');
            showShellIntegrationWarning(terminal);
        }
    }, 500);

    // Clean up on terminal close
    const closeListener = vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) {
            clearInterval(interval);
            closeListener.dispose();
        }
    });
}

function showShellIntegrationWarning(terminal: vscode.Terminal) {
    const name = terminal.name.toLowerCase();
    const isCmd = name.includes('cmd') || name.includes('command prompt');

    const message = isCmd
        ? 'SFX Terminal: "' + terminal.name + '" doesn\'t support shell integration. Switch to PowerShell for terminal sounds.'
        : 'SFX Terminal: Shell integration not active in "' + terminal.name + '". Use PowerShell terminal for automatic sound effects.';

    vscode.window.showWarningMessage(message, 'Switch to PowerShell', 'Learn More').then(choice => {
        if (choice === 'Switch to PowerShell') {
            vscode.workspace.getConfiguration('terminal.integrated').update(
                'defaultProfile.windows', 'PowerShell', vscode.ConfigurationTarget.Global
            ).then(() => {
                vscode.window.showInformationMessage(
                    '✅ Default terminal set to PowerShell. Open a new terminal (Ctrl+`) to use it.'
                );
            });
        } else if (choice === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse(
                'https://code.visualstudio.com/docs/terminal/shell-integration'
            ));
        }
    });
}

// ─── Auto-enable shell integration ──────────────────────────────────
// Without shell integration, onDidEndTerminalShellExecution won't fire
// and terminal commands won't trigger sounds. Auto-enable it.

function ensureShellIntegration() {
    const cfg = vscode.workspace.getConfiguration('terminal.integrated');
    const shellIntEnabled = cfg.get<boolean>('shellIntegration.enabled');
    if (shellIntEnabled !== true) {
        cfg.update('shellIntegration.enabled', true, vscode.ConfigurationTarget.Global).then(() => {
            outputChannel.appendLine('[INFO] ✅ Auto-enabled shell integration for terminal sound detection');
        });
    }
}

function checkShellIntegrationConfig() {
    if (process.platform !== 'win32') { return; }

    const cfg = vscode.workspace.getConfiguration('terminal.integrated');

    // Warn if shell integration is explicitly disabled
    const shellIntEnabled = cfg.get<boolean>('shellIntegration.enabled');
    if (shellIntEnabled === false) {
        outputChannel.appendLine('[WARN] ⚠️ Shell integration is DISABLED in settings!');
        vscode.window.showWarningMessage(
            'SFX Terminal: Shell integration is disabled in your settings. Enable it for terminal sound effects.',
            'Enable Now'
        ).then(choice => {
            if (choice === 'Enable Now') {
                cfg.update('shellIntegration.enabled', true, vscode.ConfigurationTarget.Global).then(() => {
                    vscode.window.showInformationMessage(
                        '✅ Shell integration enabled. Open a new terminal for it to take effect.'
                    );
                });
            }
        });
    }

    // Warn if default profile is cmd.exe
    const defaultProfile = cfg.get<string>('defaultProfile.windows');
    outputChannel.appendLine('[INFO] Default terminal profile: ' + (defaultProfile || '(system default)'));
    if (defaultProfile && defaultProfile.toLowerCase().includes('cmd')) {
        outputChannel.appendLine('[WARN] ⚠️ Default profile is cmd.exe — shell integration won\'t work!');
        vscode.window.showWarningMessage(
            'SFX Terminal: Your default terminal is cmd.exe. Shell integration (needed for terminal sounds) only works with PowerShell.',
            'Switch to PowerShell'
        ).then(choice => {
            if (choice === 'Switch to PowerShell') {
                cfg.update('defaultProfile.windows', 'PowerShell', vscode.ConfigurationTarget.Global).then(() => {
                    vscode.window.showInformationMessage(
                        '✅ Default terminal set to PowerShell. Open a new terminal.'
                    );
                });
            }
        });
    }
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

// ─── Windows: Instant playback via persistent engine ────────────────
// Primary: pre-loaded MCI aliases → stop/seek/play (~10ms, non-blocking)
// Fallback: one-shot PS process (~2s delay)
// Last resort: system WAV sounds via .NET SoundPlayer

function playOnWindows(filePath: string, type: string) {
    // Try the persistent engine first (instant — sounds are pre-loaded)
    if (audioEngine && audioEngineReady && audioEngine.stdin && !audioEngine.stdin.destroyed) {
        try {
            const alias = type === 'success' ? 'sfx_success' : 'sfx_error';
            // stop → seek to start → play (non-blocking, no 'wait')
            const cmd = "[WinMM]::mciSendString('stop " + alias + "', $null, 0, [IntPtr]::Zero) | Out-Null; " +
                "[WinMM]::mciSendString('seek " + alias + " to start', $null, 0, [IntPtr]::Zero) | Out-Null; " +
                "[WinMM]::mciSendString('play " + alias + "', $null, 0, [IntPtr]::Zero) | Out-Null; " +
                "Write-Host 'SFX_DONE'\r\n";
            audioEngine.stdin.write(cmd);
            return;
        } catch (err: any) {
            outputChannel.appendLine('[WARN] Engine write failed: ' + err.message);
        }
    }

    // Restart engine if it's down
    if (!audioEngine && !audioEngineStarting) {
        outputChannel.appendLine('[INFO] Restarting audio engine...');
        startAudioEngine();
    }

    // Fallback: one-shot PowerShell (slower but always works)
    playOnWindowsOneShot(filePath, type);
}

function playOnWindowsOneShot(filePath: string, type: string) {
    outputChannel.appendLine('[FALLBACK] One-shot PowerShell playback...');

    const alias = 'sfx' + Date.now();
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const tempScript = path.join(os.tmpdir(), alias + '.ps1');

    // No Start-Sleep — mciSendString "open" is synchronous
    const script = [
        "Add-Type @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "using System.Text;",
        "public class WinMM {",
        "    [DllImport(\"winmm.dll\")]",
        "    public static extern int mciSendString(string cmd, StringBuilder retStr, int retLen, IntPtr hwndCallback);",
        "}",
        "'@",
        "",
        "$null = [WinMM]::mciSendString('open \"" + escapedPath + "\" type mpegvideo alias " + alias + "', $null, 0, [IntPtr]::Zero)",
        "$null = [WinMM]::mciSendString('play " + alias + " wait', $null, 0, [IntPtr]::Zero)",
        "$null = [WinMM]::mciSendString('close " + alias + "', $null, 0, [IntPtr]::Zero)",
    ].join('\r\n');

    try {
        fs.writeFileSync(tempScript, script, 'utf8');
    } catch (writeErr) {
        outputChannel.appendLine('[ERROR] Cannot write temp script: ' + writeErr);
        playWindowsFallback(type);
        return;
    }

    exec('powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + tempScript + '"',
        { timeout: 15000 }, (err, _stdout, stderr) => {
        try { fs.unlinkSync(tempScript); } catch (_) { /* ignore */ }
        if (err) {
            outputChannel.appendLine('[ERROR] One-shot failed: ' + err.message);
            if (stderr) { outputChannel.appendLine('[STDERR] ' + stderr); }
            playWindowsFallback(type);
        } else {
            outputChannel.appendLine('[OK] ✅ ' + type + ' sound played (one-shot)');
        }
    });
}

// Last resort: Use .NET SoundPlayer with built-in Windows WAV sounds
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
    exec("powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"(New-Object Media.SoundPlayer '" + escapedWav + "').PlaySync()\"",
        { timeout: 10000 }, (err) => {
        if (err) {
            outputChannel.appendLine('[ERROR] System sound fallback failed: ' + err.message);
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
            tryNextPlayer(players, index + 1, type);
        } else {
            outputChannel.appendLine('[OK] ✅ ' + type + ' sound played on Linux');
        }
    });
}

// ─── Deactivation ───────────────────────────────────────────────────

export function deactivate() {
    // Stop persistent audio engine
    if (audioEngine) {
        try {
            audioEngine.stdin!.write('exit\r\n');
            audioEngine.kill();
        } catch (_) { /* ignore */ }
        audioEngine = null;
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}

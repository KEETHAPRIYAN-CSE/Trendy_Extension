import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let isExtensionEnabled = true;
let lastSoundTime = 0;
const SOUND_COOLDOWN = 500;
let outputChannel: vscode.OutputChannel;

// ─── WebView Audio Player ───────────────────────────────────────────
// Uses VS Code's built-in Chromium engine to play audio.
// Works on every machine — no PowerShell, no external tools needed.
let audioPanel: vscode.WebviewPanel | undefined;
let audioPanelReady = false;
let pendingMessages: any[] = [];

// Pre-loaded sound data URIs (base64-encoded MP3)
let successDataUri: string | null = null;
let errorDataUri: string | null = null;

function preloadSounds(context: vscode.ExtensionContext) {
    const successPath = path.join(context.extensionPath, 'sounds', 'success.mp3');
    const errorPath = path.join(context.extensionPath, 'sounds', 'error.mp3');

    if (fs.existsSync(successPath)) {
        const buf = fs.readFileSync(successPath);
        successDataUri = 'data:audio/mpeg;base64,' + buf.toString('base64');
        outputChannel.appendLine('Preloaded success sound (' + buf.length + ' bytes)');
    } else {
        outputChannel.appendLine('WARNING: success.mp3 not found at ' + successPath);
    }

    if (fs.existsSync(errorPath)) {
        const buf = fs.readFileSync(errorPath);
        errorDataUri = 'data:audio/mpeg;base64,' + buf.toString('base64');
        outputChannel.appendLine('Preloaded error sound (' + buf.length + ' bytes)');
    } else {
        outputChannel.appendLine('WARNING: error.mp3 not found at ' + errorPath);
    }
}

function ensureAudioPanel(context: vscode.ExtensionContext) {
    if (audioPanel) {
        return;
    }

    outputChannel.appendLine('Creating audio panel...');

    audioPanel = vscode.window.createWebviewPanel(
        'sfxAudio',
        '🔊 SFX Audio',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true }
    );

    audioPanelReady = false;
    audioPanel.webview.html = getAudioPlayerHtml();

    audioPanel.webview.onDidReceiveMessage(msg => {
        if (msg.type === 'ready') {
            audioPanelReady = true;
            outputChannel.appendLine('Audio panel ready — flushing ' + pendingMessages.length + ' pending sounds');
            for (const m of pendingMessages) {
                audioPanel!.webview.postMessage(m);
            }
            pendingMessages = [];
        } else if (msg.type === 'played') {
            outputChannel.appendLine('Sound played via WebView: ' + msg.soundType);
        } else if (msg.type === 'error') {
            outputChannel.appendLine('WebView audio error: ' + msg.message);
        }
    });

    audioPanel.onDidDispose(() => {
        audioPanel = undefined;
        audioPanelReady = false;
        outputChannel.appendLine('Audio panel closed — will recreate on next sound');
    });
}

function getAudioPlayerHtml(): string {
    return [
        '<!DOCTYPE html><html><head><style>',
        'body{background:#1e1e1e;color:#ccc;font-family:system-ui,-apple-system,sans-serif;',
        'display:flex;align-items:center;justify-content:center;height:100vh;margin:0}',
        '.c{text-align:center;max-width:420px;padding:20px}',
        'h2{color:#569CD6;margin-bottom:4px}',
        '.sub{color:#888;font-size:13px}',
        '.status{color:#6A9955;margin-top:16px;font-size:14px}',
        '.tip{color:#666;font-size:11px;margin-top:20px;line-height:1.7}',
        '</style></head><body>',
        '<div class="c">',
        '<h2>🔊 SFX Terminal</h2>',
        '<p class="sub">Audio Player</p>',
        '<p class="status" id="st">✅ Ready — listening for terminal events</p>',,
        '<p class="tip">💡 Keep this tab open for sound effects.<br>',
        'You can drag it to a side panel or the bottom bar.</p>',
        '</div>',
        '<script>',
        'const vs=acquireVsCodeApi();',
        'let last=0;',
        'window.addEventListener("message",function(ev){',
        '  var d=ev.data;',
        '  if(d.type==="play"){',
        '    var now=Date.now();if(now-last<300)return;last=now;',
        '    var el=document.getElementById("st");',
        '    el.textContent="🎵 Playing "+d.soundType+" sound...";',
        '    try{',
        '      var a=new Audio(d.dataUri);',
        '      a.volume=d.volume||1;',
        '      a.play().then(function(){',
        '        el.textContent="✅ Played: "+d.soundType;',
        '        vs.postMessage({type:"played",soundType:d.soundType});',
        '      }).catch(function(e){',
        '        el.textContent="❌ "+e.message;',
        '        vs.postMessage({type:"error",message:e.message});',
        '      });',
        '    }catch(e){',
        '      el.textContent="❌ "+e.message;',
        '      vs.postMessage({type:"error",message:e.message});',
        '    }',
        '  }',
        '});',
        'vs.postMessage({type:"ready"});',
        '</script></body></html>'
    ].join('\n');
}

// ─── Main activation ────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('SFX Terminal');
    outputChannel.appendLine('SFX Terminal extension activating...');

    // Pre-load sound files as base64 data URIs
    preloadSounds(context);

    // Load configuration
    const config = vscode.workspace.getConfiguration('sfxTerminal');
    isExtensionEnabled = config.get('enabled', true);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sfx-terminal.enable', () => {
            isExtensionEnabled = true;
            vscode.workspace.getConfiguration('sfxTerminal').update('enabled', true, true);
            vscode.window.showInformationMessage('🔊 SFX Terminal: Sound effects enabled');
        }),

        vscode.commands.registerCommand('sfx-terminal.disable', () => {
            isExtensionEnabled = false;
            vscode.workspace.getConfiguration('sfxTerminal').update('enabled', false, true);
            vscode.window.showInformationMessage('🔇 SFX Terminal: Sound effects disabled');
        }),

        vscode.commands.registerCommand('sfx-terminal.testSuccess', () => {
            playSound(context, 'success');
            vscode.window.showInformationMessage('🎵 Playing success sound...');
        }),

        vscode.commands.registerCommand('sfx-terminal.testError', () => {
            playSound(context, 'error');
            vscode.window.showInformationMessage('🎵 Playing error sound...');
        }),

        vscode.commands.registerCommand('sfx-terminal.showAudioPanel', () => {
            ensureAudioPanel(context);
            if (audioPanel) {
                audioPanel.reveal(vscode.ViewColumn.Beside, true);
            }
            vscode.window.showInformationMessage('🔊 SFX Audio panel opened');
        })
    );

    // Listen to configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('sfxTerminal.enabled')) {
                isExtensionEnabled = vscode.workspace.getConfiguration('sfxTerminal').get('enabled', true);
            }
        })
    );

    // Monitor VS Code task execution (build tasks, etc.)
    context.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess((e) => {
            if (!isExtensionEnabled) { return; }

            outputChannel.appendLine('Task ended: ' + e.execution.task.name + ', exit code: ' + e.exitCode);

            if (e.exitCode === 0) {
                playSound(context, 'success');
            } else if (e.exitCode !== undefined) {
                playSound(context, 'error');
            }
        })
    );

    // Monitor terminal shell integration (VS Code 1.93+)
    context.subscriptions.push(
        vscode.window.onDidEndTerminalShellExecution((e) => {
            if (!isExtensionEnabled) { return; }

            const exitCode = e.exitCode;
            outputChannel.appendLine('>>> SHELL EXECUTION DETECTED <<<');
            outputChannel.appendLine('Command finished in ' + e.terminal.name + ', exit code: ' + exitCode);

            if (exitCode === 0) {
                playSound(context, 'success');
            } else if (exitCode !== undefined) {
                playSound(context, 'error');
            }
        })
    );

    // Shell integration lifecycle
    context.subscriptions.push(
        vscode.window.onDidChangeTerminalShellIntegration((e) => {
            outputChannel.appendLine('>>> Shell integration ACTIVATED for: ' + e.terminal.name);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution((e) => {
            outputChannel.appendLine('Command started in: ' + e.terminal.name);
        })
    );

    // Listen for new terminals
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal(terminal => {
            outputChannel.appendLine('Terminal opened: ' + terminal.name);
            const shellIntegration = (terminal as any).shellIntegration;
            if (shellIntegration) {
                outputChannel.appendLine('Shell integration available for: ' + terminal.name);
            } else {
                outputChannel.appendLine('Shell integration NOT available yet for: ' + terminal.name);
                pollForShellIntegration(terminal);
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidCloseTerminal(terminal => {
            outputChannel.appendLine('Terminal closed: ' + terminal.name);
        })
    );

    // Check existing terminals
    outputChannel.appendLine('Existing terminals: ' + vscode.window.terminals.length);
    vscode.window.terminals.forEach(t => {
        const has = !!(t as any).shellIntegration;
        outputChannel.appendLine('  - ' + t.name + ' (shell integration: ' + has + ')');
        if (!has) { pollForShellIntegration(t); }
    });

    // Monitor diagnostic changes
    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics((e) => {
            if (!isExtensionEnabled) { return; }
            for (const uri of e.uris) {
                const diags = vscode.languages.getDiagnostics(uri);
                if (diags.some(d => d.severity === vscode.DiagnosticSeverity.Error)) {
                    outputChannel.appendLine('Errors detected in: ' + uri.fsPath);
                }
            }
        })
    );

    outputChannel.appendLine('SFX Terminal extension activated!');
    outputChannel.appendLine('Extension path: ' + context.extensionPath);
    outputChannel.appendLine('');
    outputChannel.appendLine('=== TIPS ===');
    outputChannel.appendLine('1. Use PowerShell terminal (not cmd) for shell integration');
    outputChannel.appendLine('2. Shell integration detects command completions automatically');
    outputChannel.appendLine('3. Tasks (npm run, build tasks) will always trigger sounds');
    outputChannel.appendLine('4. Test with: Ctrl+Shift+P -> "SFX: Test Success Sound"');
    outputChannel.appendLine('5. Keep the SFX Audio tab open for reliable sound playback');
    outputChannel.appendLine('============');
    outputChannel.show();
    console.log('SFX Terminal extension is now active!');
}

// ─── Shell integration polling ──────────────────────────────────────

const pollingTerminals = new Set<string>();

function pollForShellIntegration(terminal: vscode.Terminal) {
    if (pollingTerminals.has(terminal.name)) { return; }
    pollingTerminals.add(terminal.name);

    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(() => {
        attempts++;
        if ((terminal as any).shellIntegration) {
            outputChannel.appendLine('>>> Shell integration NOW AVAILABLE for: ' + terminal.name);
            clearInterval(interval);
            pollingTerminals.delete(terminal.name);
        } else if (attempts >= maxAttempts) {
            outputChannel.appendLine('Shell integration did not activate for: ' + terminal.name);
            clearInterval(interval);
            pollingTerminals.delete(terminal.name);
        }
    }, 500);

    const disposeListener = vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) {
            clearInterval(interval);
            pollingTerminals.delete(terminal.name);
            disposeListener.dispose();
        }
    });
}

// ─── Sound playback ─────────────────────────────────────────────────

function playSound(context: vscode.ExtensionContext, type: 'success' | 'error') {
    const now = Date.now();
    if (now - lastSoundTime < SOUND_COOLDOWN) { return; }
    lastSoundTime = now;

    const cfg = vscode.workspace.getConfiguration('sfxTerminal');
    const volume = cfg.get<number>('volume', 100);
    const customPath = type === 'success'
        ? cfg.get<string>('successSound')
        : cfg.get<string>('errorSound');

    let dataUri: string | null = null;

    // Custom sound file
    if (customPath && customPath.trim() !== '' && fs.existsSync(customPath)) {
        const buf = fs.readFileSync(customPath);
        const ext = path.extname(customPath).toLowerCase();
        const mime = ext === '.wav' ? 'audio/wav' : ext === '.ogg' ? 'audio/ogg' : 'audio/mpeg';
        dataUri = 'data:' + mime + ';base64,' + buf.toString('base64');
        outputChannel.appendLine('Using custom sound: ' + customPath);
    } else {
        // Use preloaded bundled sound
        dataUri = type === 'success' ? successDataUri : errorDataUri;
    }

    if (!dataUri) {
        outputChannel.appendLine('No sound data available for: ' + type);
        return;
    }

    // Ensure the audio WebView panel exists
    ensureAudioPanel(context);

    const msg = { type: 'play', dataUri: dataUri, volume: volume / 100, soundType: type };

    if (audioPanelReady && audioPanel) {
        audioPanel.webview.postMessage(msg);
    } else {
        pendingMessages.push(msg);
    }
}

// ─── Deactivation ───────────────────────────────────────────────────

export function deactivate() {
    if (audioPanel) {
        audioPanel.dispose();
        audioPanel = undefined;
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}
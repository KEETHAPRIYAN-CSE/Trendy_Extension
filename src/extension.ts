import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';

import * as os from 'os';

let isExtensionEnabled = true;
let lastSoundTime = 0;
const SOUND_COOLDOWN = 500;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('EFX Terminal');
    outputChannel.appendLine('EFX Terminal extension activating...');

    // Load configuration
    const config = vscode.workspace.getConfiguration('efxTerminal');
    isExtensionEnabled = config.get('enabled', true);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('efx-terminal.enable', () => {
            isExtensionEnabled = true;
            vscode.workspace.getConfiguration('efxTerminal').update('enabled', true, true);
            vscode.window.showInformationMessage('🔊 EFX Terminal: Sound effects enabled');
        }),
        
        vscode.commands.registerCommand('efx-terminal.disable', () => {
            isExtensionEnabled = false;
            vscode.workspace.getConfiguration('efxTerminal').update('enabled', false, true);
            vscode.window.showInformationMessage('🔇 EFX Terminal: Sound effects disabled');
        }),
        
        vscode.commands.registerCommand('efx-terminal.testSuccess', () => {
            playSound(context, 'success');
            vscode.window.showInformationMessage('🎵 Playing success sound...');
        }),
        
        vscode.commands.registerCommand('efx-terminal.testError', () => {
            playSound(context, 'error');
            vscode.window.showInformationMessage('🎵 Playing error sound...');
        })
    );

    // Listen to configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('efxTerminal.enabled')) {
                isExtensionEnabled = vscode.workspace.getConfiguration('efxTerminal').get('enabled', true);
            }
        })
    );

    // Monitor VS Code task execution (build tasks, etc.)
    context.subscriptions.push(
        vscode.tasks.onDidEndTaskProcess((e) => {
            if (!isExtensionEnabled) { return; }
            
            outputChannel.appendLine(`Task ended: ${e.execution.task.name}, exit code: ${e.exitCode}`);
            
            if (e.exitCode === 0) {
                playSound(context, 'success');
            } else if (e.exitCode !== undefined) {
                playSound(context, 'error');
            }
        })
    );

    // Monitor terminal shell integration (VS Code 1.93+)
    // This captures individual commands in the terminal
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

    // Also listen for shell integration becoming available
    context.subscriptions.push(
        vscode.window.onDidChangeTerminalShellIntegration((e) => {
            outputChannel.appendLine('>>> Shell integration ACTIVATED for: ' + e.terminal.name);
            vscode.window.showInformationMessage('EFX Terminal: Shell integration active - sounds enabled!');
        })
    );

    // Also listen for command start (helps verify shell integration is working)
    context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution((e) => {
            outputChannel.appendLine('Command started in: ' + e.terminal.name);
        })
    );

    // Listen for new terminals
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal(terminal => {
            outputChannel.appendLine('Terminal opened: ' + terminal.name);
            // Check if shell integration is available
            const shellIntegration = (terminal as any).shellIntegration;
            if (shellIntegration) {
                outputChannel.appendLine('Shell integration available for: ' + terminal.name);
            } else {
                outputChannel.appendLine('Shell integration NOT available yet for: ' + terminal.name);
                outputChannel.appendLine('Tip: Use PowerShell terminal for best shell integration support');
                
                // Start polling for shell integration
                pollForShellIntegration(terminal, context);
            }
        })
    );

    // Cleanup on terminal close
    context.subscriptions.push(
        vscode.window.onDidCloseTerminal(terminal => {
            outputChannel.appendLine('Terminal closed: ' + terminal.name);
        })
    );

    // Check existing terminals and set up polling
    outputChannel.appendLine('Existing terminals: ' + vscode.window.terminals.length);
    vscode.window.terminals.forEach(t => {
        const hasShellIntegration = !!(t as any).shellIntegration;
        outputChannel.appendLine('  - ' + t.name + ' (shell integration: ' + hasShellIntegration + ')');
        if (!hasShellIntegration) {
            pollForShellIntegration(t, context);
        }
    });

    // Monitor diagnostic changes (compile errors)
    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics((e) => {
            if (!isExtensionEnabled) { return; }
            
            // Check if any new errors appeared
            for (const uri of e.uris) {
                const diagnostics = vscode.languages.getDiagnostics(uri);
                const hasErrors = diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error);
                if (hasErrors) {
                    // Don't play sound for every diagnostic change, this is just for awareness
                    outputChannel.appendLine(`Errors detected in: ${uri.fsPath}`);
                }
            }
        })
    );

    outputChannel.appendLine('EFX Terminal extension activated!');
    outputChannel.appendLine('Extension path: ' + context.extensionPath);
    outputChannel.appendLine('');
    outputChannel.appendLine('=== TIPS ===');
    outputChannel.appendLine('1. Use PowerShell terminal (not cmd) for shell integration');
    outputChannel.appendLine('2. Shell integration detects command completions automatically');
    outputChannel.appendLine('3. Tasks (npm run, build tasks) will always trigger sounds');
    outputChannel.appendLine('4. Test with: Ctrl+Shift+P -> "EFX: Test Success Sound"');
    outputChannel.appendLine('============');
    outputChannel.show();
    console.log('EFX Terminal extension is now active!');
}

// Track terminals being polled
const pollingTerminals = new Set<string>();

function pollForShellIntegration(terminal: vscode.Terminal, context: vscode.ExtensionContext) {
    const terminalId = terminal.name + '_' + Date.now();
    
    if (pollingTerminals.has(terminal.name)) {
        return; // Already polling this terminal
    }
    pollingTerminals.add(terminal.name);
    
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total
    
    const checkInterval = setInterval(() => {
        attempts++;
        const si = (terminal as any).shellIntegration;
        
        if (si) {
            outputChannel.appendLine('>>> Shell integration NOW AVAILABLE for: ' + terminal.name);
            vscode.window.showInformationMessage('EFX: Shell integration active for ' + terminal.name);
            clearInterval(checkInterval);
            pollingTerminals.delete(terminal.name);
        } else if (attempts >= maxAttempts) {
            outputChannel.appendLine('Shell integration did not activate for: ' + terminal.name);
            outputChannel.appendLine('Sounds will still work for: Tasks, Build errors, and test commands');
            clearInterval(checkInterval);
            pollingTerminals.delete(terminal.name);
        }
    }, 500);
    
    // Clear interval if terminal is closed
    const disposeListener = vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) {
            clearInterval(checkInterval);
            pollingTerminals.delete(terminal.name);
            disposeListener.dispose();
        }
    });
}

function playSound(context: vscode.ExtensionContext, type: 'success' | 'error') {
    // Cooldown to prevent sound spam
    const now = Date.now();
    if (now - lastSoundTime < SOUND_COOLDOWN) {
        return;
    }
    lastSoundTime = now;

    const config = vscode.workspace.getConfiguration('efxTerminal');
    const customPath = type === 'success' 
        ? config.get<string>('successSound') 
        : config.get<string>('errorSound');
    const volume = config.get<number>('volume', 50);

    // Get sound file path
    let soundPath = getSoundPath(customPath, type, context);
    
    if (soundPath) {
        outputChannel.appendLine(`Playing ${type} sound: ${soundPath}`);
        playAudioFile(soundPath, volume);
    } else {
        outputChannel.appendLine(`No sound file found for: ${type}`);
    }
}

function getSoundPath(customPath: string | undefined, type: 'success' | 'error', context: vscode.ExtensionContext): string | null {
    // Check custom path first
    if (customPath && customPath.trim() !== '' && fs.existsSync(customPath)) {
        outputChannel.appendLine(`Using custom sound path: ${customPath}`);
        return customPath;
    }
    
    // Check extension sounds folder
    const soundFile = type === 'success' ? 'success.mp3' : 'error.mp3';
    const extPath = path.join(context.extensionPath, 'sounds', soundFile);
    outputChannel.appendLine(`Checking extension sound path: ${extPath}`);
    if (fs.existsSync(extPath)) {
        outputChannel.appendLine(`Found extension sound: ${extPath}`);
        return extPath;
    }

    // Fallback to system sounds
    outputChannel.appendLine(`Extension sound not found, trying system sounds`);
    return getSystemSound(type);
}

function getSystemSound(type: 'success' | 'error'): string | null {
    if (process.platform === 'win32') {
        const winSounds = type === 'success' 
            ? ['C:\\Windows\\Media\\tada.wav', 'C:\\Windows\\Media\\chimes.wav', 'C:\\Windows\\Media\\notify.wav']
            : ['C:\\Windows\\Media\\Windows Critical Stop.wav', 'C:\\Windows\\Media\\chord.wav', 'C:\\Windows\\Media\\ding.wav'];
        
        for (const p of winSounds) {
            if (fs.existsSync(p)) { return p; }
        }
    } else if (process.platform === 'darwin') {
        return type === 'success' 
            ? '/System/Library/Sounds/Glass.aiff'
            : '/System/Library/Sounds/Basso.aiff';
    } else {
        // Linux
        const linuxPaths = type === 'success' 
            ? ['/usr/share/sounds/freedesktop/stereo/complete.oga', '/usr/share/sounds/gnome/default/alerts/glass.ogg']
            : ['/usr/share/sounds/freedesktop/stereo/dialog-error.oga', '/usr/share/sounds/gnome/default/alerts/bark.ogg'];
        
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) { return p; }
        }
    }
    return null;
}

function playAudioFile(filePath: string, volume: number) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    if (process.platform === 'win32') {
        playOnWindows(filePath, volume);
    } else if (process.platform === 'darwin') {
        playOnMac(filePath, volume);
    } else {
        playOnLinux(filePath, volume);
    }
}

function playOnWindows(filePath: string, volume: number) {
    outputChannel.appendLine('Windows playback attempting: ' + filePath);
    
    // Create a temporary PowerShell script
    const tempScriptPath = path.join(os.tmpdir(), 'efx_play_' + Date.now() + '.ps1');
    const vol = volume / 100;
    
    const psScript = `
Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]'${filePath.replace(/'/g, "''")}')
$player.Volume = ${vol}
Start-Sleep -Milliseconds 300
$player.Play()
Start-Sleep -Milliseconds 3000
$player.Close()
Remove-Item -Path '$tempScriptPath' -Force -ErrorAction SilentlyContinue
`;

    try {
        fs.writeFileSync(tempScriptPath, psScript, 'utf8');
        
        exec('powershell -NoProfile -ExecutionPolicy Bypass -File "' + tempScriptPath + '"', 
            { timeout: 10000 }, 
            (err, stdout, stderr) => {
                if (err) {
                    outputChannel.appendLine('MediaPlayer error: ' + err.message);
                    outputChannel.appendLine('stderr: ' + stderr);
                    // Try alternative method
                    playWithWMPlayer(filePath, volume);
                } else {
                    outputChannel.appendLine('Sound played successfully via MediaPlayer');
                }
                // Cleanup temp file
                try { fs.unlinkSync(tempScriptPath); } catch (e) { /* ignore */ }
            }
        );
    } catch (writeErr) {
        outputChannel.appendLine('Failed to write temp script: ' + writeErr);
        playWithWMPlayer(filePath, volume);
    }
}

function playWithWMPlayer(filePath: string, volume: number) {
    outputChannel.appendLine('Trying WMPlayer fallback...');
    
    const tempScriptPath = path.join(os.tmpdir(), 'efx_wmp_' + Date.now() + '.ps1');
    const psScript = `
$wmp = New-Object -ComObject WMPlayer.OCX
$wmp.settings.volume = ${volume}
$wmp.URL = '${filePath.replace(/'/g, "''")}'
Start-Sleep -Milliseconds 300
$wmp.controls.play()
Start-Sleep -Milliseconds 3000
$wmp.close()
Remove-Item -Path '${tempScriptPath}' -Force -ErrorAction SilentlyContinue
`;

    try {
        fs.writeFileSync(tempScriptPath, psScript, 'utf8');
        
        exec('powershell -NoProfile -ExecutionPolicy Bypass -File "' + tempScriptPath + '"', 
            { timeout: 10000 }, 
            (err, stdout, stderr) => {
                if (err) {
                    outputChannel.appendLine('WMPlayer error: ' + err.message);
                } else {
                    outputChannel.appendLine('Sound played via WMPlayer');
                }
                try { fs.unlinkSync(tempScriptPath); } catch (e) { /* ignore */ }
            }
        );
    } catch (writeErr) {
        outputChannel.appendLine('Failed to write WMP script: ' + writeErr);
    }
}

function playOnMac(filePath: string, volume: number) {
    // afplay is built into macOS
    const vol = (volume / 100).toFixed(2);
    exec(`afplay -v ${vol} "${filePath}"`, (err) => {
        if (err) {
            outputChannel.appendLine(`Mac playback error: ${err.message}`);
        }
    });
}

function playOnLinux(filePath: string, volume: number) {
    // Try different Linux audio players
    const players = [
        { cmd: 'paplay', args: [`--volume=${Math.floor(volume * 655.36)}`] },
        { cmd: 'aplay', args: [] },
        { cmd: 'mpv', args: ['--no-video', `--volume=${volume}`] },
        { cmd: 'ffplay', args: ['-nodisp', '-autoexit', '-volume', volume.toString()] }
    ];

    tryLinuxPlayers(filePath, players, 0);
}

function tryLinuxPlayers(filePath: string, players: {cmd: string, args: string[]}[], index: number) {
    if (index >= players.length) {
        outputChannel.appendLine('No Linux audio player found');
        return;
    }

    const player = players[index];
    const args = [...player.args, filePath];
    
    const child = spawn(player.cmd, args, { stdio: 'ignore' });
    
    child.on('error', () => {
        // Try next player
        tryLinuxPlayers(filePath, players, index + 1);
    });
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
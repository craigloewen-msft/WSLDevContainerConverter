import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "devcontainertowsl" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('devcontainertowsl.checkIfRemote', () => {
        // Place code here
        let shell = process.env.SHELL;
        let isRemote = shell && shell.startsWith('/usr/local/bin/vscode-remote');
        if (isRemote) {
            let container = process.env.VSCODE_REMOTE_CONTAINERS_NAME;
            vscode.window.showInformationMessage(`You are running VS Code Remote in the "${container}" container.`);
        } else {
            vscode.window.showInformationMessage('You are running regular VS Code.');
        }

        console.log("VS Code env remoteName: ");
        console.log(vscode.env.remoteName);
        console.log(vscode.env);

        // Check if the extension is running in a WSL remote context
        if (vscode.env.remoteName && vscode.env.remoteName.startsWith('wsl')) {
            // Output the name of the WSL distro
            console.log(vscode.env.remoteName);
        }
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

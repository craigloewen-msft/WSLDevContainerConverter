import * as vscode from 'vscode';
import * as cp from "child_process";

// Credit to https://stackoverflow.com/questions/43007267/how-to-run-a-system-command-from-vscode-extension user Yong Wang
const execShell = (cmd: string) =>
    new Promise<string>((resolve, reject) => {
        cp.exec(cmd, (err, out) => {
            if (err) {
                return reject(err);
            }
            return resolve(out);
        });
    });

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "devcontainertowsl" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('devcontainertowsl.checkIfRemote', async () => {
        // Place code here

        // Check if the user is not in a remote session
        // Check if the user has set a location to store WSL distros as a variable in this extension
        const wslDistroLocation = vscode.workspace.getConfiguration('devcontainertowsl').get('wslDistroLocation');

        // If the user hasn't set a location, ask them to set one
        if (wslDistroLocation == null || wslDistroLocation == "") {
            vscode.window.showInformationMessage("Please set a location to store WSL distros in the settings");

            // Ask for text input for the user to set a location
            let value = await vscode.window.showInputBox({
                prompt: "Please enter a location to store WSL distros",
                placeHolder: "C:\\wslDistroStorage\\VSCodeDistros\\"
            });

            // If the user has set a location, set it in the extension settings
            if (value != null) {
                // Run instead in execShell
                let newFolderOutput = await execShell(`powershell.exe /c if (!(Test-Path -Path ${value})) { New-Item -ItemType Directory -Path ${value} }`);
                vscode.workspace.getConfiguration('devcontainertowsl').update('wslDistroLocation', value, true);
            }
        } else {
            // Since the user has set a location we can continue
            console.log("Working with wslDistroLocation: " + wslDistroLocation);

            // Run a PowerShell command to get a list of the name of all images in Docker
            let dockerImageNameList = await execShell("docker image list --format \"{{.Repository}}\"");

            // Put the list of images into an array
            let dockerImages = dockerImageNameList.split("\n");

            // Filter dockerImages to remove any empty strings or contains the string "<none>"
            dockerImages = dockerImages.filter((value) => {
                return value != "" && !value.includes("none");
            });

            // Sort dockerImages to have any values with "vsc" be at the top
            dockerImages.sort((a, b) => {
                if (a.includes("vsc") && !b.includes("vsc")) {
                    return -1;
                } else if (!a.includes("vsc") && b.includes("vsc")) {
                    return 1;
                } else {
                    return 0;
                }
            });

            // Ask the user to select an image from the list
            let selectedDockerImageName = await vscode.window.showQuickPick(dockerImages);

            // Process the image name. So vsc-vue-shopping-cart-85b9b471bbb02f934b1d0de27695c1b3 becomes vsc-vue-shopping-cart or vsc-gitgudissues-0f3c1b8e042af63247ebe5341441046f-uid becomes vsc-gitgudissues
            let imageName = selectedDockerImageName?.toString().replace("-uid", "").replace(/-[0-9a-f]{32}/g, "");

            if (imageName == null || imageName == "") {
                vscode.window.showInformationMessage("Error processing image name");
            } else {

                vscode.window.showInformationMessage("Selected Image name: " + imageName);

                // Run a PowerShell command to list all WSL distros
                let wslDistroListOutput = await execShell("wsl.exe --list");
                let wslDistros = wslDistroListOutput.split("\n");

                // Check if the image name is not already in use
                if (wslDistros.includes(imageName?.toString() ?? "unsearchable&name")) {
                    vscode.window.showInformationMessage("That image name is already in use");
                } else {

                    let newWSLDistroName = imageName?.toString() ?? "unsearchable&name";
                    let distroInstallPath = (wslDistroLocation?.toString() ?? "unsearchable&name") + "\\" + (newWSLDistroName);

                    let backSlashedDistroInstallPath = distroInstallPath.replace(/\\/g, "\\\\\\\\");
                    // Run a PowerShell command to convert the path to a WSL path and remove the end of line
                    let wslFormatDistroInstallPath = (await execShell(`powershell.exe /c wsl.exe wslpath ${backSlashedDistroInstallPath}`)).replace("\n", "");

                    // Run a PowerShell command to check if the folder for the WSL distro exists and if not create it
                    console.log("Creating new folder for WSL distro");
                    let newFolderOutput = await execShell(`powershell.exe /c \"if (!(Test-Path -Path ${distroInstallPath})) { New-Item -ItemType Directory -Path ${distroInstallPath} }\"`);

                    // Run a PowerShell command to check if a container named cscode_export_container exists and if so remove it
                    console.log("Removing old container");
                    let dockerContainerRemoveOutput = await execShell(`powershell.exe /c \"if (docker ps -a -q -f name=vscode_export_container) { docker rm vscode_export_container }\"`);

                    // Run a PowerShell command to remove the old WSL distro if present
                    console.log("Removing old WSL distro");
                    try {
                        let wslDistroRemoveOutput = await execShell(`powershell.exe /c "wsl.exe --unregister ${newWSLDistroName}"`);
                    } catch (error) {
                        console.log("No old WSL distro to remove");
                    }

                    // Run a PowerShell command to run bash inside of specified docker image and name the container as vscode_export_container
                    console.log("Running bash inside of docker image");
                    let dockerRunOutput = await execShell(`powershell.exe /c docker run -t --name vscode_export_container ${selectedDockerImageName?.toString() ?? "unsearchable&name"} node -e \"console.log(123)\"`);

                    let dockerContainerSHA = (await execShell(`powershell.exe /c docker ps -a -q -f name=vscode_export_container`)).replace("\n", "");

                    // Run a PowerShell command to export the container as a tar file
                    console.log(`Exporting container to ${distroInstallPath}.tar`);
                    console.log(`powershell.exe /c 'docker export --output="${distroInstallPath}.tar" ${dockerContainerSHA}'`);
                    vscode.window.showInformationMessage("Importing WSL distro, this could take a while so leave VS Code Open and go get a coffee!");
                    let dockerExportOutput = await execShell(`powershell.exe /c 'docker export --output="${distroInstallPath}.tar" ${dockerContainerSHA}'`);

                    // Run a PowerShell command to import the container
                    console.log("Importing container");
                    let wslImportOutput = await execShell(`powershell.exe /c \"wsl.exe --import ${newWSLDistroName} ${distroInstallPath} ${distroInstallPath}.tar\"`);

                    // Show success message
                    vscode.window.showInformationMessage("Successfully imported WSL distro");
                    // Run a PowerShell command to remove the container
                    console.log("Removing container");
                    let dockerRemoveOutput = await execShell(`powershell.exe /c docker rm vscode_export_container`);

                    // Run a PowerShell command to remove the tar file
                    console.log("Removing tar file");
                    console.log(`powershell.exe /c 'Remove-Item ${distroInstallPath}.tar'`);
                    let dockerRemoveTarOutput = await execShell(`powershell.exe /c 'Remove-Item ${distroInstallPath}.tar'`);

                    // Run a PowerShell command to open the WSL distro in a new Terminal Window
                    console.log("Opening WSL distro in new Terminal Window");
                    let wslOpenOutput = await execShell(`powershell.exe /c 'Start-Process wsl.exe -ArgumentList "-d","${newWSLDistroName}","--cd","~"'`);
                }

            }

        }
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

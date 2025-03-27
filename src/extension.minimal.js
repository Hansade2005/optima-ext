// @ts-nocheck
// Minimal extension.js for marketplace publication
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Minimal implementation of the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Extension "optima-ai" is now active');
  
  // Create output channel
  const outputChannel = vscode.window.createOutputChannel("Optima-AI");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("Optima AI started in minimal mode");
  
  // Register webview provider
  class MinimalWebviewProvider {
    constructor(context) {
      this.context = context;
    }
    
    resolveWebviewView(webviewView) {
      webviewView.webview.options = {
        enableScripts: true
      };
      
      webviewView.webview.html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Optima AI</title>
            <style>
              body { 
                font-family: var(--vscode-font-family);
                background-color: var(--vscode-editor-background); 
                color: var(--vscode-editor-foreground);
                padding: 20px;
              }
              button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 12px;
                cursor: pointer;
                margin-top: 10px;
              }
              .container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Optima AI</h2>
              <p>Running in minimal mode due to build issues.</p>
              <p>Please check the documentation for proper setup instructions.</p>
              <p>If you're seeing this message, it means the full UI couldn't be loaded.</p>
              <button onclick="window.location.reload()">Reload UI</button>
            </div>
          </body>
        </html>
      `;
    }
    
    clearTask() {
      // Stub implementation
      return Promise.resolve();
    }
    
    postMessageToWebview() {
      // Stub implementation
      return Promise.resolve();
    }
    
    resolveWebviewPanel() {
      // Stub implementation
      return Promise.resolve();
    }
    
    log(message) {
      console.log(message);
    }
  }
  
  // Register the provider
  const sideBarId = "optima-ai.SidebarProvider";
  const provider = new MinimalWebviewProvider(context);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(sideBarId, provider)
  );
  
  // Register basic commands
  context.subscriptions.push(
    vscode.commands.registerCommand("optima-ai.reloadWebview", () => {
      vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
      vscode.window.showInformationMessage("Optima AI UI reloaded");
    })
  );
}

function deactivate() {
  console.log('Extension "optima-ai" has been deactivated');
}

module.exports = { activate, deactivate }; 
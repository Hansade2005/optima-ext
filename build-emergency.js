/**
 * Emergency build script that bypasses TypeScript compilation issues
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

console.log('=== EMERGENCY BUILD PROCESS ===');
console.log('This script creates a minimal working extension that can be published');
console.log('while bypassing TypeScript compilation errors.');

// Ensure directories exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
  console.log('Created dist directory');
}

if (!fs.existsSync(path.join('webview-ui', 'build', 'assets'))) {
  fs.mkdirSync(path.join('webview-ui', 'build', 'assets'), { recursive: true });
  console.log('Created webview-ui/build/assets directory');
}

// Create minimal webview assets
const cssContent = `
body {
  font-family: var(--vscode-font-family);
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  margin: 0;
  padding: 20px;
}
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
}
button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 8px 16px;
  margin-top: 20px;
  cursor: pointer;
}
`;

const jsContent = `
(function() {
  const vscode = acquireVsCodeApi();
  
  window.addEventListener('load', function() {
    document.getElementById('root').innerHTML = \`
      <div class="container">
        <h1>Optima AI</h1>
        <p>Minimal UI version is active due to build issues.</p>
        <p>This is a fallback interface created by the emergency build system.</p>
        <button id="reloadBtn">Reload UI</button>
      </div>
    \`;
    
    document.getElementById('reloadBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'reloadWebview' });
    });
    
    // Tell the extension we're ready
    vscode.postMessage({ type: 'webviewDidLaunch' });
  });
})();
`;

fs.writeFileSync(path.join('webview-ui', 'build', 'assets', 'index.css'), cssContent);
fs.writeFileSync(path.join('webview-ui', 'build', 'assets', 'index.js'), jsContent);
console.log('Created minimal webview CSS and JS assets');

// Copy the minimal extension.js file to dist
try {
  const minimalExtensionPath = path.join('src', 'extension.minimal.js');
  const distExtensionPath = path.join('dist', 'extension.js');
  
  if (fs.existsSync(minimalExtensionPath)) {
    fs.copyFileSync(minimalExtensionPath, distExtensionPath);
    console.log('Copied minimal extension.js to dist');
  } else {
    // Create a simple extension.js directly
    const simpleExtension = `
    const vscode = require('vscode');
    
    function activate(context) {
      console.log('Optima AI extension activated in emergency mode');
      
      const outputChannel = vscode.window.createOutputChannel("Optima-AI");
      outputChannel.appendLine("Extension running in minimal mode");
      
      // Register minimal UI 
      class MinimalProvider {
        resolveWebviewView(webviewView) {
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = \`
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: system-ui; padding: 20px; text-align: center; }
                  button { margin-top: 20px; }
                </style>
              </head>
              <body>
                <h2>Optima AI</h2>
                <p>Emergency minimal UI mode</p>
                <button onclick="vscode.postMessage({type:'reload'})">Reload</button>
                <script>
                  const vscode = acquireVsCodeApi();
                  window.addEventListener('message', (event) => {
                    const message = event.data;
                    console.log('Received message:', message);
                  });
                  
                  // Tell extension we're ready
                  vscode.postMessage({type: 'webviewDidLaunch'});
                </script>
              </body>
            </html>
          \`;
        }
      }
      
      context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('optima-ai.SidebarProvider', new MinimalProvider())
      );
    }
    
    function deactivate() {}
    
    module.exports = { activate, deactivate };
    `;
    
    fs.writeFileSync(distExtensionPath, simpleExtension);
    console.log('Created simple extension.js in dist');
  }
  
  console.log('=== EMERGENCY BUILD COMPLETED SUCCESSFULLY ===');
  console.log('You can now package the extension using:');
  console.log('  pnpm dlx vsce package --no-dependencies');
  
} catch (error) {
  console.error('Error during emergency build:', error);
  process.exit(1);
} 
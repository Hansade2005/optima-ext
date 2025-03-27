// @ts-nocheck
// Minimal extension.js for emergency packaging

/**
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
  // Minimal activation
  console.log('Extension "optima-ai" is now active');
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}; 
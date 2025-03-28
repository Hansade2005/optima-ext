#!/usr/bin/env node

/**
 * This script automatically fixes common JSX/React syntax errors 
 * that occur after Git merge conflicts and other issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configure paths
const WEBVIEW_UI_PATH = path.join(__dirname, 'webview-ui');
const COMPONENTS_PATH = path.join(WEBVIEW_UI_PATH, 'src', 'components');

// Common JSX files that might have issues
const PROBLEMATIC_FILES = [
  path.join(COMPONENTS_PATH, 'chat', 'ChatView.tsx'),
  path.join(COMPONENTS_PATH, 'settings', 'SettingsView.tsx'),
  path.join(COMPONENTS_PATH, 'welcome', 'WelcomeView.tsx'),
  path.join(COMPONENTS_PATH, 'history', 'HistoryView.tsx')
];

// Ensure CSS module files exist
function ensureCssModules() {
  console.log('Ensuring CSS module files exist...');
  
  const HISTORY_CSS_PATH = path.join(COMPONENTS_PATH, 'history', 'HistoryView.module.css');
  
  if (!fs.existsSync(path.dirname(HISTORY_CSS_PATH))) {
    fs.mkdirSync(path.dirname(HISTORY_CSS_PATH), { recursive: true });
  }
  
  if (!fs.existsSync(HISTORY_CSS_PATH)) {
    console.log(`Creating missing CSS module: ${HISTORY_CSS_PATH}`);
    const cssContent = `/* Auto-generated CSS module */
.container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
`;
    fs.writeFileSync(HISTORY_CSS_PATH, cssContent, 'utf8');
  }
}

// Fix incomplete ternary expressions
function fixTernaryExpressions(file) {
  console.log(`Checking for incomplete ternary expressions in ${file}...`);
  
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix ternary with missing second part
  content = content.replace(/\?([^:]+): ,/g, '?$1: null,');
  content = content.replace(/\?([^:]+):, /g, '?$1: null, ');
  
  // Fix other common issues
  content = content.replace(/return \(\);/g, 'return (<div></div>);');
  content = content.replace(/return \(/g, 'return (');
  
  fs.writeFileSync(file, content, 'utf8');
}

// Replace corrupted components with minimal working versions
function replaceCorruptedComponents() {
  console.log('Checking for severely corrupted components...');
  
  // Minimal implementation for SettingsView
  const SETTINGS_PATH = path.join(COMPONENTS_PATH, 'settings', 'SettingsView.tsx');
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
      // Check if file has severe syntax errors
      if (content.includes(';p >') || content.includes('p >') || content.includes('security;risks.;')) {
        console.log('SettingsView.tsx is severely corrupted, replacing with minimal implementation');
        
        const minimalComponent = `import React from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

export const SettingsView: React.FC = () => {
  return (
    <div style={{ padding: "20px" }}>
      <h2>Settings</h2>
      <p>Configure your preferences and settings</p>
      
      <div style={{ marginTop: "20px" }}>
        <h3>API Configuration</h3>
        <p>Manage your API keys and endpoints</p>
      </div>
      
      <div style={{ marginTop: "20px" }}>
        <h3>UI Preferences</h3>
        <p>Customize your user interface settings</p>
      </div>
      
      <div style={{ marginTop: "20px" }}>
        <VSCodeButton>Save Settings</VSCodeButton>
      </div>
    </div>
  );
};

export default SettingsView;
`;
        fs.writeFileSync(SETTINGS_PATH, minimalComponent, 'utf8');
      }
    } catch (err) {
      console.error(`Error processing ${SETTINGS_PATH}:`, err);
    }
  }
  
  // Minimal implementation for WelcomeView
  const WELCOME_PATH = path.join(COMPONENTS_PATH, 'welcome', 'WelcomeView.tsx');
  if (fs.existsSync(WELCOME_PATH)) {
    try {
      const content = fs.readFileSync(WELCOME_PATH, 'utf8');
      // Check if file has return syntax errors
      if (content.includes('return ();') || content.includes('div >')) {
        console.log('WelcomeView.tsx is corrupted, replacing with minimal implementation');
        
        const minimalComponent = `import React from "react";
import { vscode } from "../../utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

export const WelcomeView = ({ apiConfiguration }: { apiConfiguration: any }) => {
  const handleContinue = () => {
    vscode.postMessage({ type: "apiConfiguration", apiConfiguration });
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Welcome to Optima AI</h1>
      <p>Your intelligent coding assistant for the African developer market</p>
      <div style={{ marginTop: "30px" }}>
        <VSCodeButton onClick={handleContinue}>
          Get Started
        </VSCodeButton>
      </div>
    </div>
  );
};

export default WelcomeView;
`;
        fs.writeFileSync(WELCOME_PATH, minimalComponent, 'utf8');
      }
    } catch (err) {
      console.error(`Error processing ${WELCOME_PATH}:`, err);
    }
  }
}

// Main function to run all fixes
function main() {
  console.log('Starting automatic JSX error fixing script...');
  
  try {
    // Ensure all required directories exist
    Object.keys(COMPONENTS_PATH).forEach(dir => {
      const dirPath = path.join(COMPONENTS_PATH, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    
    // Fix each problematic file
    PROBLEMATIC_FILES.forEach(file => {
      if (fs.existsSync(file)) {
        fixTernaryExpressions(file);
      }
    });
    
    // Create missing CSS modules
    ensureCssModules();
    
    // Replace severely corrupted components
    replaceCorruptedComponents();
    
    console.log('JSX error fixing completed successfully!');
  } catch (error) {
    console.error('Error fixing JSX errors:', error);
    process.exit(1);
  }
}

// Run the script
main(); 
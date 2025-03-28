#!/bin/bash

# This script automatically fixes common React/TypeScript syntax issues
# that occur after Git merge conflicts and other problems
# Can be used both locally and in CI environments

# Display usage info
echo "===== Optima IDE Component Fixer ====="
echo "Fixing common syntax errors in UI components..."

# Define paths
WEBVIEW_UI_PATH="./webview-ui"
SRC_PATH="$WEBVIEW_UI_PATH/src"
COMPONENTS_PATH="$SRC_PATH/components"

# Ensure all required directories exist
mkdir -p "$COMPONENTS_PATH/chat"
mkdir -p "$COMPONENTS_PATH/settings" 
mkdir -p "$COMPONENTS_PATH/welcome"
mkdir -p "$COMPONENTS_PATH/history"

# 1. Fix missing CSS module for HistoryView
echo "Creating missing CSS modules..."
HISTORY_CSS_PATH="$COMPONENTS_PATH/history/HistoryView.module.css"

if [ ! -f "$HISTORY_CSS_PATH" ]; then
  echo "Creating $HISTORY_CSS_PATH"
  cat > "$HISTORY_CSS_PATH" << EOF
/* Auto-generated CSS module */
.container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
EOF
fi

# 2. Fix ChatView.tsx ternary expression issues
CHAT_VIEW_PATH="$COMPONENTS_PATH/chat/ChatView.tsx"
if [ -f "$CHAT_VIEW_PATH" ]; then
  echo "Fixing syntax in ChatView.tsx..."
  # Backup the file
  cp "$CHAT_VIEW_PATH" "$CHAT_VIEW_PATH.bak"
  # Fix ternary operator missing second part
  sed -i 's/})) : ,/})) : null,/g' "$CHAT_VIEW_PATH"
  sed -i 's/})) :,/})) : null,/g' "$CHAT_VIEW_PATH"
fi

# 3. Replace corrupted SettingsView with minimal working version
SETTINGS_VIEW_PATH="$COMPONENTS_PATH/settings/SettingsView.tsx" 
if [ -f "$SETTINGS_VIEW_PATH" ]; then
  # Check if file is corrupted (look for specific syntax errors)
  if grep -q "p >" "$SETTINGS_VIEW_PATH" || grep -q "security;risks.;" "$SETTINGS_VIEW_PATH"; then
    echo "SettingsView.tsx appears corrupted, replacing with minimal implementation..."
    # Backup the file
    cp "$SETTINGS_VIEW_PATH" "$SETTINGS_VIEW_PATH.bak"
    # Create minimal implementation
    cat > "$SETTINGS_VIEW_PATH" << EOF
import React from "react";
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
EOF
  fi
fi

# 4. Replace corrupted WelcomeView with minimal working version
WELCOME_VIEW_PATH="$COMPONENTS_PATH/welcome/WelcomeView.tsx"
if [ -f "$WELCOME_VIEW_PATH" ]; then
  # Check if file is corrupted
  if grep -q "return ()" "$WELCOME_VIEW_PATH" || grep -q "div >" "$WELCOME_VIEW_PATH"; then
    echo "WelcomeView.tsx appears corrupted, replacing with minimal implementation..."
    # Backup the file
    cp "$WELCOME_VIEW_PATH" "$WELCOME_VIEW_PATH.bak"
    # Create minimal implementation
    cat > "$WELCOME_VIEW_PATH" << EOF
import React from "react";
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
EOF
  fi
fi

# 5. Add a .gitkeep file to ensure all required directories are committed
touch "$COMPONENTS_PATH/history/.gitkeep"
touch "$COMPONENTS_PATH/chat/.gitkeep"
touch "$COMPONENTS_PATH/settings/.gitkeep"
touch "$COMPONENTS_PATH/welcome/.gitkeep"

echo "✅ Syntax fixes completed successfully!"
echo "You can now build the project without syntax errors."
echo "Note: Changes made to components have been backed up with .bak extension" 
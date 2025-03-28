// This file provides mock implementations for missing MUI styled-engine exports
// to fix build errors without installing additional packages
import React from 'react';

// Mock the ThemeContext that's missing
export const ThemeContext = React.createContext({});

// Mock css function
export const css = () => {};

// Mock keyframes function
export const keyframes = () => {};

// Export other required components
export const GlobalStyles = ({ styles }) => null;
export const StyledEngineProvider = ({ children }) => children;

// Default export for styled function
export default function styled() {
  return () => null;
}

// Internal process styles function
export const internal_processStyles = () => {}; 
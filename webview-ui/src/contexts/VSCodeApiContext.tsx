import React, { createContext, useContext, ReactNode } from 'react';

// Define the VS Code API interface
interface VSCodeAPI {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
}

// Create a context for the VS Code API
const VSCodeApiContext = createContext<VSCodeAPI | undefined>(undefined);

// Custom hook to use the VS Code API
export function useVSCodeApi() {
  const context = useContext(VSCodeApiContext);
  if (context === undefined) {
    throw new Error('useVSCodeApi must be used within a VSCodeApiProvider');
  }
  return context;
}

// Provider component
interface VSCodeApiProviderProps {
  children: ReactNode;
}

export function VSCodeApiProvider({ children }: VSCodeApiProviderProps) {
  // Access the VS Code API only once when the extension loads
  const vscodeApi = React.useMemo(() => {
    // @ts-ignore
    if (typeof acquireVsCodeApi === 'function') {
      // @ts-ignore
      return acquireVsCodeApi();
    }
    return undefined;
  }, []);

  return (
    <VSCodeApiContext.Provider value={vscodeApi}>
      {children}
    </VSCodeApiContext.Provider>
  );
} 
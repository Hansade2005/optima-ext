import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AccountManager } from './components/AccountManager';
import { optimaTheme } from './theme';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <ThemeProvider theme={optimaTheme}>
                <CssBaseline />
                <AccountManager />
            </ThemeProvider>
        </React.StrictMode>
    );
} 
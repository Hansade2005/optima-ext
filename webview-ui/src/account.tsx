import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AccountManager } from './components/AccountManager';
import { optimaTheme } from './theme';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

// Create a new cache for emotion to use
const emotionCache = createCache({
  key: 'optima-emotion',
  prepend: true, // ensures styles are prepended to the <head>, preventing CSS specificity issues
});

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <CacheProvider value={emotionCache}>
                <ThemeProvider theme={optimaTheme}>
                    <CssBaseline />
                    <AccountManager />
                </ThemeProvider>
            </CacheProvider>
        </React.StrictMode>
    );
} 
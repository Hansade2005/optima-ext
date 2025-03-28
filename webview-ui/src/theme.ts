import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// Create a theme instance compatible with emotion
export const optimaTheme = responsiveFontSizes(createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#FF69B4', // Hot pink
            light: '#FFB6C1', // Light pink
            dark: '#DB7093', // Pale violet red
        },
        secondary: {
            main: '#FF1493', // Deep pink
            light: '#FF69B4', // Hot pink
            dark: '#C71585', // Medium violet red
        },
        background: {
            default: '#1e1e1e',
            paper: '#252526',
        },
        text: {
            primary: '#FFB6C1',
            secondary: '#DB7093',
        },
    },
    typography: {
        fontFamily: 'var(--vscode-font-family)',
        h1: {
            color: '#FF69B4',
            fontWeight: 600,
        },
        h2: {
            color: '#FF69B4',
            fontWeight: 600,
        },
        h3: {
            color: '#FF69B4',
            fontWeight: 600,
        },
        h4: {
            color: '#FF69B4',
            fontWeight: 600,
        },
        h5: {
            color: '#FF69B4',
            fontWeight: 600,
        },
        h6: {
            color: '#FF69B4',
            fontWeight: 600,
        },
        body1: {
            color: '#FFB6C1',
        },
        body2: {
            color: '#DB7093',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: '20px',
                    padding: '8px 24px',
                    fontWeight: 600,
                    '&:hover': {
                        background: 'linear-gradient(145deg, #FF69B4 0%, #FF1493 100%)',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: '#252526',
                    border: '1px solid #FF69B4',
                    borderRadius: '16px',
                    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
                    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        '&:hover fieldset': {
                            borderColor: '#FF69B4',
                        },
                    },
                    '& .MuiInputLabel-root': {
                        color: '#FFB6C1',
                    },
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    border: '1px solid #FF69B4',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
                    borderRadius: '16px',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
                    borderRight: '1px solid #FF69B4',
                },
            },
        },
        MuiListItem: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    margin: '4px 8px',
                    '&:hover': {
                        background: 'rgba(255, 105, 180, 0.1)',
                    },
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    color: '#FF69B4',
                    '&:hover': {
                        background: 'rgba(255, 105, 180, 0.1)',
                    },
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: {
                    borderColor: '#FF69B4',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 105, 180, 0.1)',
                    color: '#FF69B4',
                    '&:hover': {
                        backgroundColor: 'rgba(255, 105, 180, 0.2)',
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    backgroundColor: '#FF69B4',
                },
                tab: {
                    color: '#FFB6C1',
                    '&.Mui-selected': {
                        color: '#FF69B4',
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
                    borderRadius: '16px',
                    border: '1px solid #FF69B4',
                },
            },
        },
        MuiSnackbar: {
            styleOverrides: {
                root: {
                    '& .MuiSnackbarContent-root': {
                        background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
                        borderRadius: '12px',
                        border: '1px solid #FF69B4',
                    },
                },
            },
        },
    },
}));

export const theme = {
    colors: {
        primary: '#FF69B4', // Hot Pink
        secondary: '#FF1493', // Deep Pink
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        text: '#ffffff',
        textSecondary: 'rgba(255, 255, 255, 0.7)',
        border: 'rgba(255, 105, 180, 0.2)', // Hot Pink with opacity
        error: '#ff4444',
        success: '#00ff95'
    },
    borderRadius: {
        card: '16px',
        button: '20px',
        input: '12px'
    },
    transitions: {
        default: 'all 0.3s ease-in-out',
        fast: 'all 0.15s ease-in-out'
    },
    typography: {
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        weights: {
            regular: 400,
            medium: 500,
            bold: 600
        }
    },
    shadows: {
        card: '0 4px 20px rgba(255, 105, 180, 0.15)',
        button: '0 2px 10px rgba(255, 105, 180, 0.2)',
        hover: '0 6px 25px rgba(255, 105, 180, 0.25)'
    },
    effects: {
        hover: {
            transform: 'translateY(-2px)',
            transition: 'all 0.3s ease-in-out'
        },
        active: {
            transform: 'translateY(1px)',
            transition: 'all 0.1s ease-in-out'
        }
    }
}

// Common styles that can be reused across components
export const commonStyles = {
    card: {
        background: theme.colors.background,
        borderRadius: theme.borderRadius.card,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: theme.shadows.card,
        transition: theme.transitions.default,
        '&:hover': {
            boxShadow: theme.shadows.hover,
            ...theme.effects.hover
        }
    },
    button: {
        borderRadius: theme.borderRadius.button,
        background: `linear-gradient(45deg, ${theme.colors.secondary}, ${theme.colors.primary})`,
        color: theme.colors.text,
        border: 'none',
        padding: '8px 16px',
        fontWeight: theme.typography.weights.medium,
        transition: theme.transitions.default,
        cursor: 'pointer',
        '&:hover': {
            boxShadow: theme.shadows.button,
            ...theme.effects.hover
        },
        '&:active': {
            ...theme.effects.active
        }
    },
    input: {
        borderRadius: theme.borderRadius.input,
        border: `1px solid ${theme.colors.border}`,
        background: 'rgba(255, 255, 255, 0.05)',
        color: theme.colors.text,
        padding: '8px 12px',
        transition: theme.transitions.default,
        '&:focus': {
            borderColor: theme.colors.primary,
            boxShadow: `0 0 0 2px ${theme.colors.primary}25`
        }
    },
    heading: {
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily,
        fontWeight: theme.typography.weights.bold,
        '& span': {
            background: `linear-gradient(45deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
        }
    },
    codeBlock: {
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: theme.borderRadius.input,
        border: `1px solid ${theme.colors.border}`,
        padding: '12px',
        fontFamily: 'monospace'
    }
} 
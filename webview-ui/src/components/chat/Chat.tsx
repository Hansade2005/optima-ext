import React, { useState } from 'react';
import { Box, TextField, IconButton, Paper, Typography, Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { theme, commonStyles } from '../../theme';

const StyledPaper = styled(Paper)(() => ({
    padding: theme.spacing(2),
    margin: theme.spacing(2),
    background: theme.colors.background,
    borderRadius: theme.borderRadius.card,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.card,
    transition: theme.transitions.default,
    '&:hover': {
        boxShadow: theme.shadows.hover,
        ...theme.effects.hover
    }
}));

const StyledTextField = styled(TextField)(() => ({
    '& .MuiOutlinedInput-root': {
        borderRadius: theme.borderRadius.input,
        backgroundColor: 'rgba(255, 105, 180, 0.1)',
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily,
        '&:hover fieldset': {
            borderColor: theme.colors.primary,
        },
        '&.Mui-focused fieldset': {
            borderColor: theme.colors.primary,
            boxShadow: `0 0 0 2px ${theme.colors.primary}25`
        }
    },
    '& .MuiInputLabel-root': {
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily
    },
}));

const StyledIconButton = styled(IconButton)(() => ({
    color: theme.colors.primary,
    background: 'transparent',
    transition: theme.transitions.default,
    '&:hover': {
        background: `${theme.colors.primary}20`,
        transform: 'translateY(-2px)'
    },
    '&:active': {
        ...theme.effects.active
    }
}));

export const Chat: React.FC = () => {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (message.trim()) {
            // Handle message sending
            setMessage('');
        }
    };

    return (
        <Box sx={{ 
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: theme.colors.background
        }}>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                <StyledPaper>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                        <Avatar sx={{
                            bgcolor: theme.colors.primary,
                            mr: 2,
                            transition: theme.transitions.default,
                            '&:hover': {
                                transform: 'scale(1.1)'
                            }
                        }}>
                            <SmartToyIcon />
                        </Avatar>
                        <Box>
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    color: theme.colors.primary,
                                    fontFamily: theme.typography.fontFamily,
                                    fontWeight: theme.typography.weights.bold
                                }}>
                                Optima AI
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{
                                    color: theme.colors.text,
                                    fontFamily: theme.typography.fontFamily
                                }}>
                                Hello! I'm your AI coding assistant. How can I help you today?
                            </Typography>
                        </Box>
                    </Box>
                </StyledPaper>
            </Box>
            <Box sx={{
                p: 2,
                borderTop: `1px solid ${theme.colors.border}`,
                background: theme.colors.background
            }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <StyledTextField
                        fullWidth
                        variant="outlined"
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '&.Mui-focused': {
                                    '& fieldset': {
                                        borderColor: theme.colors.primary,
                                        boxShadow: `0 0 0 2px ${theme.colors.primary}25`
                                    }
                                }
                            }
                        }}
                    />
                    <StyledIconButton
                        onClick={handleSend}
                        sx={{
                            background: `linear-gradient(45deg, ${theme.colors.secondary}, ${theme.colors.primary})`,
                            color: theme.colors.text,
                            borderRadius: theme.borderRadius.button,
                            '&:hover': {
                                background: theme.colors.primary,
                                transform: 'translateY(-2px)'
                            }
                        }}>
                        <SendIcon />
                    </StyledIconButton>
                </Box>
            </Box>
        </Box>
    );
}; 
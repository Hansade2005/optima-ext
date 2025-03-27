import React from 'react';
import { Box, Paper, Typography, Switch, FormControlLabel, Select, MenuItem, Button } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    margin: theme.spacing(2),
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    borderRadius: '16px',
    border: '1px solid #FF69B4',
    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '20px',
    padding: '8px 24px',
    textTransform: 'none',
    fontWeight: 600,
    background: 'linear-gradient(145deg, #FF69B4 0%, #FF1493 100%)',
    '&:hover': {
        background: 'linear-gradient(145deg, #FF1493 0%, #FF69B4 100%)',
    },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 105, 180, 0.1)',
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#FF69B4',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#FF69B4',
    },
    color: '#FFB6C1',
}));

export const Settings: React.FC = () => {
    return (
        <Box sx={{ 
            p: 3,
            background: 'linear-gradient(145deg, #1e1e1e 0%, #252526 100%)',
            minHeight: '100vh'
        }}>
            <Typography variant="h4" sx={{ 
                color: '#FF69B4',
                mb: 4,
                fontWeight: 600
            }}>
                Settings
            </Typography>
            
            <StyledPaper>
                <Typography variant="h6" sx={{ color: '#FF69B4', mb: 3 }}>
                    AI Model Settings
                </Typography>
                <Box sx={{ mb: 3 }}>
                    <FormControlLabel
                        control={<Switch defaultChecked />}
                        label="Enable Optima AI"
                        sx={{ color: '#FFB6C1' }}
                    />
                </Box>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: '#FFB6C1', mb: 1 }}>
                        Default Model
                    </Typography>
                    <StyledSelect
                        fullWidth
                        defaultValue="optima"
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="optima">Optima AI</MenuItem>
                        <MenuItem value="gemma">Gemma 3</MenuItem>
                        <MenuItem value="gpt4">GPT-4</MenuItem>
                    </StyledSelect>
                </Box>
            </StyledPaper>

            <StyledPaper>
                <Typography variant="h6" sx={{ color: '#FF69B4', mb: 3 }}>
                    Subscription
                </Typography>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: '#FFB6C1', mb: 2 }}>
                        Current Plan: Premium
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#DB7093', mb: 2 }}>
                        Next billing date: March 27, 2024
                    </Typography>
                    <StyledButton variant="contained">
                        Manage Subscription
                    </StyledButton>
                </Box>
            </StyledPaper>
        </Box>
    );
}; 
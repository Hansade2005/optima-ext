import React from 'react';
import { Box, Typography, Button, Container, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';
import { vscode } from '../../utilities/vscode';

const StyledContainer = styled(Container)(({ theme }) => ({
    padding: theme.spacing(4),
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    borderRadius: '16px',
    border: '1px solid #FF69B4',
    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '20px',
    padding: '12px 32px',
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '1.1rem',
    background: 'linear-gradient(145deg, #FF69B4 0%, #FF1493 100%)',
    '&:hover': {
        background: 'linear-gradient(145deg, #FF1493 0%, #FF69B4 100%)',
    },
}));

export const Welcome: React.FC = () => {
    return (
        <Box sx={{ 
            minHeight: '100vh',
            background: 'linear-gradient(145deg, #1e1e1e 0%, #252526 100%)',
            py: 4
        }}>
            <StyledContainer maxWidth="lg">
                <Grid container spacing={4} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <Typography variant="h2" gutterBottom sx={{ 
                            color: '#FF69B4',
                            fontWeight: 700,
                            mb: 3
                        }}>
                            Welcome to Optima AI
                        </Typography>
                        <Typography variant="h5" sx={{ 
                            color: '#FFB6C1',
                            mb: 4
                        }}>
                            Your intelligent coding companion powered by advanced AI
                        </Typography>
                        <StyledButton
                            variant="contained"
                            size="large"
                            onClick={() => vscode.postMessage({ command: 'startCoding' })}
                        >
                            Start Coding
                        </StyledButton>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Box sx={{ 
                            p: 3,
                            background: 'rgba(255, 105, 180, 0.1)',
                            borderRadius: '16px',
                            border: '1px solid #FF69B4'
                        }}>
                            <Typography variant="h6" sx={{ color: '#FF69B4', mb: 2 }}>
                                Key Features
                            </Typography>
                            <ul style={{ 
                                listStyle: 'none', 
                                padding: 0,
                                color: '#FFB6C1'
                            }}>
                                <li>• Advanced AI-powered code completion</li>
                                <li>• Intelligent code refactoring</li>
                                <li>• Multi-model support</li>
                                <li>• African market optimization</li>
                                <li>• Real-time collaboration</li>
                            </ul>
                        </Box>
                    </Grid>
                </Grid>
            </StyledContainer>
        </Box>
    );
}; 
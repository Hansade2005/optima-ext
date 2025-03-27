import React from 'react';
import { Box, Typography, Slider, FormControlLabel, Switch, Paper, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    margin: theme.spacing(2),
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    borderRadius: '16px',
    border: '1px solid #FF69B4',
    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
}));

const StyledSlider = styled(Slider)(({ theme }) => ({
    color: '#FF69B4',
    '& .MuiSlider-thumb': {
        '&:hover, &.Mui-focusVisible': {
            boxShadow: '0 0 0 8px rgba(255, 105, 180, 0.16)',
        },
        '&.Mui-active': {
            boxShadow: '0 0 0 14px rgba(255, 105, 180, 0.16)',
        },
    },
}));

export const ModelControlPanel: React.FC = () => {
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
                Model Control Panel
            </Typography>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <StyledPaper>
                        <Typography variant="h6" sx={{ color: '#FF69B4', mb: 3 }}>
                            Model Settings
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ color: '#FFB6C1', mb: 2 }}>
                                Temperature
                            </Typography>
                            <StyledSlider
                                defaultValue={0.7}
                                min={0}
                                max={1}
                                step={0.1}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ color: '#FFB6C1', mb: 2 }}>
                                Max Tokens
                            </Typography>
                            <StyledSlider
                                defaultValue={2000}
                                min={100}
                                max={4000}
                                step={100}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                    </StyledPaper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <StyledPaper>
                        <Typography variant="h6" sx={{ color: '#FF69B4', mb: 3 }}>
                            Advanced Options
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            <FormControlLabel
                                control={<Switch defaultChecked />}
                                label="Enable Code Completion"
                                sx={{ color: '#FFB6C1' }}
                            />
                        </Box>
                        <Box sx={{ mb: 3 }}>
                            <FormControlLabel
                                control={<Switch defaultChecked />}
                                label="Enable Context Awareness"
                                sx={{ color: '#FFB6C1' }}
                            />
                        </Box>
                        <Box sx={{ mb: 3 }}>
                            <FormControlLabel
                                control={<Switch defaultChecked />}
                                label="Enable African Market Optimization"
                                sx={{ color: '#FFB6C1' }}
                            />
                        </Box>
                    </StyledPaper>
                </Grid>
            </Grid>
        </Box>
    );
}; 
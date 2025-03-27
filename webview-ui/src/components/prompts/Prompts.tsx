import React from 'react';
import { Box, Typography, Paper, Grid, IconButton, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    margin: theme.spacing(2),
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    borderRadius: '16px',
    border: '1px solid #FF69B4',
    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 105, 180, 0.1)',
        '&:hover fieldset': {
            borderColor: '#FF69B4',
        },
        '&.Mui-focused fieldset': {
            borderColor: '#FF69B4',
        },
    },
    '& .MuiInputLabel-root': {
        color: '#FFB6C1',
        '&.Mui-focused': {
            color: '#FF69B4',
        },
    },
    '& .MuiInputBase-input': {
        color: '#FFB6C1',
    },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
    color: '#FF69B4',
    '&:hover': {
        background: 'rgba(255, 105, 180, 0.1)',
    },
}));

export const Prompts: React.FC = () => {
    return (
        <Box sx={{ 
            p: 3,
            background: 'linear-gradient(145deg, #1e1e1e 0%, #252526 100%)',
            minHeight: '100vh'
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ 
                    color: '#FF69B4',
                    fontWeight: 600
                }}>
                    Custom Prompts
                </Typography>
                <StyledIconButton>
                    <AddIcon />
                </StyledIconButton>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <StyledPaper>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ color: '#FF69B4' }}>
                                Code Review Prompt
                            </Typography>
                            <Box>
                                <StyledIconButton>
                                    <EditIcon />
                                </StyledIconButton>
                                <StyledIconButton>
                                    <DeleteIcon />
                                </StyledIconButton>
                            </Box>
                        </Box>
                        <StyledTextField
                            fullWidth
                            multiline
                            rows={4}
                            defaultValue="Please review this code for best practices, performance, and potential bugs."
                            variant="outlined"
                        />
                    </StyledPaper>
                </Grid>

                <Grid item xs={12}>
                    <StyledPaper>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ color: '#FF69B4' }}>
                                Bug Fix Prompt
                            </Typography>
                            <Box>
                                <StyledIconButton>
                                    <EditIcon />
                                </StyledIconButton>
                                <StyledIconButton>
                                    <DeleteIcon />
                                </StyledIconButton>
                            </Box>
                        </Box>
                        <StyledTextField
                            fullWidth
                            multiline
                            rows={4}
                            defaultValue="Please help me fix this bug. Here's the error message and relevant code."
                            variant="outlined"
                        />
                    </StyledPaper>
                </Grid>
            </Grid>
        </Box>
    );
}; 
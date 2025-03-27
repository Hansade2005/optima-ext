import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, ListItemIcon, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';

const StyledListItem = styled(ListItem)(({ theme }) => ({
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    borderRadius: '12px',
    marginBottom: theme.spacing(1),
    border: '1px solid #FF69B4',
    '&:hover': {
        background: 'rgba(255, 105, 180, 0.1)',
    },
}));

const StyledListItemText = styled(ListItemText)(({ theme }) => ({
    '& .MuiListItemText-primary': {
        color: '#FF69B4',
        fontWeight: 600,
    },
    '& .MuiListItemText-secondary': {
        color: '#FFB6C1',
    },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
    color: '#FF69B4',
    '&:hover': {
        background: 'rgba(255, 105, 180, 0.1)',
    },
}));

export const History: React.FC = () => {
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
                Chat History
            </Typography>
            <List>
                <StyledListItem
                    secondaryAction={
                        <StyledIconButton edge="end" aria-label="delete">
                            <DeleteIcon />
                        </StyledIconButton>
                    }
                >
                    <ListItemIcon>
                        <HistoryIcon sx={{ color: '#FF69B4' }} />
                    </ListItemIcon>
                    <StyledListItemText
                        primary="Code Review Session"
                        secondary="Last active: 2 hours ago"
                    />
                </StyledListItem>
                <StyledListItem
                    secondaryAction={
                        <StyledIconButton edge="end" aria-label="delete">
                            <DeleteIcon />
                        </StyledIconButton>
                    }
                >
                    <ListItemIcon>
                        <HistoryIcon sx={{ color: '#FF69B4' }} />
                    </ListItemIcon>
                    <StyledListItemText
                        primary="Bug Fix Discussion"
                        secondary="Last active: 1 day ago"
                    />
                </StyledListItem>
            </List>
        </Box>
    );
}; 
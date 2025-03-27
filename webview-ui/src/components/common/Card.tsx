import React from 'react';
import { Card as MuiCard, CardContent, CardHeader, CardActions } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(MuiCard)(({ theme }) => ({
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    borderRadius: '16px',
    border: '1px solid #FF69B4',
    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
}));

const StyledCardHeader = styled(CardHeader)(({ theme }) => ({
    borderBottom: '1px solid #FF69B4',
    '& .MuiCardHeader-title': {
        color: '#FF69B4',
        fontWeight: 600,
    },
    '& .MuiCardHeader-subheader': {
        color: '#FFB6C1',
    },
}));

const StyledCardContent = styled(CardContent)(({ theme }) => ({
    color: '#FFB6C1',
}));

const StyledCardActions = styled(CardActions)(({ theme }) => ({
    borderTop: '1px solid #FF69B4',
    padding: theme.spacing(2),
}));

interface CardProps {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
    title,
    subtitle,
    children,
    actions,
}) => {
    return (
        <StyledCard>
            {(title || subtitle) && (
                <StyledCardHeader
                    title={title}
                    subheader={subtitle}
                />
            )}
            <StyledCardContent>
                {children}
            </StyledCardContent>
            {actions && (
                <StyledCardActions>
                    {actions}
                </StyledCardActions>
            )}
        </StyledCard>
    );
}; 
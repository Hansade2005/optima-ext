import React from 'react';
import { Button as MuiButton } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledButton = styled(MuiButton)(({ theme }) => ({
    borderRadius: '20px',
    padding: '8px 24px',
    textTransform: 'none',
    fontWeight: 600,
    background: 'linear-gradient(145deg, #FF69B4 0%, #FF1493 100%)',
    color: '#fff',
    '&:hover': {
        background: 'linear-gradient(145deg, #FF1493 0%, #FF69B4 100%)',
    },
    '&.Mui-disabled': {
        background: 'rgba(255, 105, 180, 0.3)',
    },
}));

interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'text' | 'contained' | 'outlined';
    size?: 'small' | 'medium' | 'large';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    disabled,
    variant = 'contained',
    size = 'medium',
}) => {
    return (
        <StyledButton
            onClick={onClick}
            disabled={disabled}
            variant={variant}
            size={size}
        >
            {children}
        </StyledButton>
    );
}; 
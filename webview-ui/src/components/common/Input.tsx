import React from 'react';
import { TextField } from '@mui/material';
import { styled } from '@mui/material/styles';

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
    '& .MuiInput-underline:before': {
        borderBottomColor: '#FF69B4',
    },
    '& .MuiInput-underline:hover:before': {
        borderBottomColor: '#FF69B4',
    },
}));

interface InputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    error?: boolean;
    helperText?: string;
    disabled?: boolean;
    multiline?: boolean;
    rows?: number;
}

export const Input: React.FC<InputProps> = ({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    error,
    helperText,
    disabled,
    multiline,
    rows,
}) => {
    return (
        <StyledTextField
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            type={type}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
            disabled={disabled}
            multiline={multiline}
            rows={rows}
            fullWidth
            variant="outlined"
        />
    );
}; 
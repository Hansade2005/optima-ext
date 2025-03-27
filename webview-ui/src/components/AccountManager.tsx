import React, { useEffect, useState } from 'react';
import { vscode } from '../utilities/vscode';
import { Button, Card, Typography, Alert, CircularProgress, Box } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme }) => ({
    padding: theme.spacing(3),
    margin: theme.spacing(2),
    maxWidth: 600,
    margin: '0 auto',
    background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
    boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: '20px',
    padding: '8px 24px',
    textTransform: 'none',
    fontWeight: 600,
    '&:hover': {
        background: 'linear-gradient(145deg, #FF69B4 0%, #FF1493 100%)',
    },
}));

const StyledAlert = styled(Alert)(({ theme }) => ({
    borderRadius: '12px',
    marginBottom: theme.spacing(2),
}));

interface SubscriptionStatus {
    isActive: boolean;
    expiryDate: Date;
    isTrial: boolean;
}

interface GitHubProfile {
    label: string;
    email?: string;
}

export const AccountManager: React.FC = () => {
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
    const [githubProfile, setGitHubProfile] = useState<GitHubProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAccountData();
    }, []);

    const loadAccountData = async () => {
        try {
            setLoading(true);
            const response = await vscode.postMessage({
                command: 'getAccountData'
            });
            
            if (response.error) {
                setError(response.error);
                return;
            }

            setSubscriptionStatus(response.subscriptionStatus);
            setGitHubProfile(response.githubProfile);
        } catch (err) {
            setError('Failed to load account data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGitHubLogin = async () => {
        try {
            const response = await vscode.postMessage({
                command: 'githubLogin'
            });
            
            if (response.error) {
                setError(response.error);
                return;
            }

            setGitHubProfile(response.profile);
            await loadAccountData();
        } catch (err) {
            setError('Failed to login with GitHub');
            console.error(err);
        }
    };

    const handleRenewSubscription = async () => {
        try {
            await vscode.postMessage({
                command: 'renewSubscription'
            });
        } catch (err) {
            setError('Failed to open subscription page');
            console.error(err);
        }
    };

    if (loading) {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: 'linear-gradient(145deg, #1e1e1e 0%, #252526 100%)'
            }}>
                <CircularProgress sx={{ color: '#FF69B4' }} />
            </Box>
        );
    }

    return (
        <StyledCard>
            <Typography variant="h4" gutterBottom sx={{ 
                color: '#FF69B4',
                fontWeight: 600,
                textAlign: 'center',
                mb: 4
            }}>
                Account Management
            </Typography>

            {error && (
                <StyledAlert severity="error">
                    {error}
                </StyledAlert>
            )}

            {!githubProfile ? (
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body1" gutterBottom sx={{ color: '#FFB6C1' }}>
                        Please login with GitHub to access Optima AI
                    </Typography>
                    <StyledButton
                        variant="contained"
                        startIcon={<GitHubIcon />}
                        onClick={handleGitHubLogin}
                        sx={{ mt: 2 }}
                    >
                        Login with GitHub
                    </StyledButton>
                </Box>
            ) : (
                <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: '#FF69B4' }}>
                        GitHub Profile
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#FFB6C1' }}>
                        Logged in as: {githubProfile.label}
                    </Typography>
                    {githubProfile.email && (
                        <Typography variant="body2" sx={{ color: '#DB7093' }}>
                            Email: {githubProfile.email}
                        </Typography>
                    )}

                    <Typography variant="h6" gutterBottom sx={{ mt: 3, color: '#FF69B4' }}>
                        Subscription Status
                    </Typography>
                    {subscriptionStatus ? (
                        <Box>
                            <Typography variant="body1" sx={{ 
                                color: subscriptionStatus.isActive ? '#FFB6C1' : '#DB7093',
                                fontWeight: 500
                            }}>
                                Status: {subscriptionStatus.isActive ? "Active" : "Expired"}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#DB7093' }}>
                                Expiry Date: {new Date(subscriptionStatus.expiryDate).toLocaleDateString()}
                            </Typography>
                            {subscriptionStatus.isTrial && (
                                <Typography variant="body2" sx={{ color: '#FFB6C1' }}>
                                    Trial Period
                                </Typography>
                            )}

                            {!subscriptionStatus.isActive && (
                                <StyledButton
                                    variant="contained"
                                    onClick={handleRenewSubscription}
                                    sx={{ mt: 2 }}
                                >
                                    Renew Subscription
                                </StyledButton>
                            )}
                        </Box>
                    ) : (
                        <Typography variant="body1" sx={{ color: '#DB7093' }}>
                            No subscription data available
                        </Typography>
                    )}
                </Box>
            )}
        </StyledCard>
    );
}; 
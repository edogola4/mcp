import { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Box, Button, Container, Paper, Typography } from '@mui/material';
import { ReportGmailerrorred as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../api/simpleClient';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
    this.reportError(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Report error to your error tracking service
      await apiClient.call('logError', {
        error: {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo?.componentStack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
      });
    } catch (e) {
      console.error('Failed to report error:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV === 'development';
      const errorId = `error-${Date.now()}`;

      return (
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                Oops! Something went wrong
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                We've encountered an unexpected error. Our team has been notified.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Error ID: {errorId}
              </Typography>
              
              <Alert 
                severity="error" 
                sx={{ 
                  textAlign: 'left',
                  mb: 3,
                  '& .MuiAlert-message': { width: '100%' }
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  {this.state.error?.message || 'Unknown error'}
                </Typography>
                {isDev && this.state.error?.stack && (
                  <Typography variant="caption" component="div" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                    {this.state.error.stack}
                  </Typography>
                )}
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={this.handleReset}
                  startIcon={<RefreshIcon />}
                >
                  Try Again
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
                <Button
                  variant="text"
                  color="primary"
                  onClick={() => window.location.href = '/'}
                >
                  Go to Home
                </Button>
              </Box>

              {isDev && this.state.errorInfo?.componentStack && (
                <Box sx={{ mt: 4, textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Component Stack:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      backgroundColor: 'rgba(0,0,0,0.02)',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      maxHeight: '300px',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

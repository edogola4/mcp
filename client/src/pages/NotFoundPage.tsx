import { Box, Button, Container, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Home as HomeIcon } from '@mui/icons-material';

export default function NotFoundPage() {
  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Typography
          variant="h1"
          component="div"
          sx={{
            fontSize: { xs: '6rem', sm: '8rem' },
            fontWeight: 'bold',
            lineHeight: 1,
            mb: 2,
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </Typography>
        
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 'medium',
            mb: 2,
          }}
        >
          Oops! Page not found
        </Typography>
        
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            maxWidth: '600px',
            mb: 4,
          }}
        >
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </Typography>
        
        <Button
          component={RouterLink}
          to="/"
          variant="contained"
          color="primary"
          size="large"
          startIcon={<HomeIcon />}
          sx={{
            borderRadius: '50px',
            px: 4,
            py: 1.5,
            textTransform: 'none',
            fontSize: '1.1rem',
            boxShadow: '0 4px 14px 0 rgba(33, 150, 243, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 20px 0 rgba(33, 150, 243, 0.4)',
            },
          }}
        >
          Go to Homepage
        </Button>
        
        <Box sx={{ mt: 6, display: 'flex', gap: 2 }}>
          <Button
            component={RouterLink}
            to="/dashboard"
            variant="outlined"
            color="primary"
          >
            Dashboard
          </Button>
          <Button
            component={RouterLink}
            to="/files"
            variant="outlined"
            color="primary"
          >
            File Browser
          </Button>
          <Button
            component={RouterLink}
            to="/database"
            variant="outlined"
            color="primary"
          >
            Database
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Grid, LinearProgress, Typography, Box, Paper } from '@mui/material';
import { api } from '../api/client';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color = 'primary' }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Box color={`${color}.main`} mr={1}>
          {icon}
        </Box>
        <Typography color="textSecondary" variant="subtitle2">
          {title}
        </Typography>
      </Box>
      <Typography variant="h5">{value}</Typography>
    </CardContent>
  </Card>
);

const HealthStatus = ({ status }: { status: 'ok' | 'error' | 'warning' }) => (
  <Box display="flex" alignItems="center">
    {status === 'ok' ? (
      <CheckCircleIcon color="success" sx={{ mr: 1 }} />
    ) : (
      <ErrorIcon color={status === 'warning' ? 'warning' : 'error'} sx={{ mr: 1 }} />
    )}
    <Typography
      color={status === 'ok' ? 'success.main' : status === 'warning' ? 'warning.main' : 'error.main'}
      variant="body2"
    >
      {status === 'ok' ? 'Operational' : status === 'warning' ? 'Degraded' : 'Error'}
    </Typography>
  </Box>
);

export default function DashboardPage() {
  const { data: healthData, isLoading } = useQuery(['health'], () => api.getHealth());
  
  // Mock data - replace with actual API calls
  const systemStats = {
    cpu: 25,
    memory: 65,
    disk: 42,
    uptime: '3d 12h 45m',
  };

  const services = [
    { name: 'API Server', status: 'ok' },
    { name: 'Database', status: 'ok' },
    { name: 'File System', status: 'warning' },
    { name: 'Weather Service', status: 'ok' },
  ];

  if (isLoading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="CPU Usage"
            value={`${systemStats.cpu}%`}
            icon={<SpeedIcon />}
            color={systemStats.cpu > 80 ? 'error' : systemStats.cpu > 60 ? 'warning' : 'primary'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Memory Usage"
            value={`${systemStats.memory}%`}
            icon={<MemoryIcon />}
            color={systemStats.memory > 85 ? 'error' : systemStats.memory > 70 ? 'warning' : 'primary'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Disk Usage"
            value={`${systemStats.disk}%`}
            icon={<StorageIcon />}
            color={systemStats.disk > 90 ? 'error' : systemStats.disk > 80 ? 'warning' : 'primary'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Uptime"
            value={systemStats.uptime}
            icon={<CheckCircleIcon />}
            color="success"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Service Status
            </Typography>
            <Box>
              {services.map((service) => (
                <Box key={service.name} display="flex" justifyContent="space-between" mb={1}>
                  <Typography>{service.name}</Typography>
                  <HealthStatus status={service.status as any} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            <Box>
              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Last Checked
                </Typography>
                <Typography>
                  {new Date(healthData?.timestamp || new Date()).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Status
                </Typography>
                <HealthStatus status={healthData?.status === 'ok' ? 'ok' : 'error'} />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

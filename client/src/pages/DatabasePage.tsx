import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  ContentCopy as CopyIcon,
  Save as SaveIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

type QueryResult = {
  columns: string[];
  rows: any[];
  rowCount: number;
  duration?: number;
};


export default function DatabasePage() {
  const [query, setQuery] = useState('SELECT * FROM sqlite_master WHERE type="table";');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data, isLoading, error, refetch } = useQuery<QueryResult>({
    queryKey: ['db-query', query],
    queryFn: () => api.call('database.query', { query }),
    enabled: false, // Don't run on mount
  });

  const executeQuery = () => {
    refetch();
  };

  const handleRunQuery = () => {
    if (!query.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter a SQL query',
        severity: 'error',
      });
      return;
    }
    executeQuery();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunQuery();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({
      open: true,
      message: 'Copied to clipboard',
      severity: 'success',
    });
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Database Query
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={8}
            variant="outlined"
            placeholder="Enter your SQL query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{ fontFamily: 'monospace' }}
            InputProps={{
              style: { fontFamily: 'monospace' },
            }}
          />
          <Box display="flex" flexDirection="column" gap={1}>
            <Button
              variant="contained"
              color="primary"
              startIcon={isLoading ? <CircularProgress size={20} /> : <RunIcon />}
              onClick={handleRunQuery}
              disabled={isLoading}
            >
              Run (Ctrl+Enter)
            </Button>
            <Tooltip title="Copy query">
              <IconButton onClick={() => copyToClipboard(query)}>
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Save query">
              <IconButton disabled>
                <SaveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Query history">
              <IconButton disabled>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error instanceof Error ? error.message : 'An error occurred while executing the query'}
          </Alert>
        )}
      </Paper>

      {data && (
        <Paper sx={{ width: '100%', overflow: 'hidden', mb: 3 }}>
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {data.columns.map((column, index) => (
                    <TableCell key={index}>
                      <strong>{column}</strong>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, rowIndex) => (
                    <TableRow hover key={rowIndex}>
                      {data.columns.map((column, colIndex) => (
                        <TableCell key={`${rowIndex}-${colIndex}`}>
                          {typeof row[column] === 'object'
                            ? JSON.stringify(row[column])
                            : String(row[column] ?? 'NULL')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={data.rowCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
          <Box p={1} textAlign="right">
            <Typography variant="caption" color="text.secondary">
              {data.rowCount} row{data.rowCount !== 1 ? 's' : ''}
              {data.duration !== undefined && ` in ${data.duration.toFixed(2)}ms`}
            </Typography>
          </Box>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

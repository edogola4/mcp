import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CreateNewFolder as NewFolderIcon,
  FileUpload as UploadIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

type FileItem = {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
};

export default function FileBrowserPage() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: files = [], isLoading } = useQuery<FileItem[]>({
    queryKey: ['files', currentPath],
    queryFn: () => api.call('file.list', { path: currentPath }),
  });

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      setCurrentPath(prev => `${prev}/${file.name}`.replace(/\/+/g, '/'));
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const pathParts = currentPath.split('/').filter(Boolean);
    const newPath = pathParts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" gutterBottom>
          File Browser
        </Typography>
        <Box>
          <IconButton color="primary" title="New Folder">
            <NewFolderIcon />
          </IconButton>
          <IconButton color="primary" title="Upload">
            <UploadIcon />
          </IconButton>
          <IconButton onClick={() => window.location.reload()} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="Search files..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link
            component="button"
            color="inherit"
            onClick={() => setCurrentPath('')}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Home
          </Link>
          {pathParts.map((part, index) => (
            <Link
              key={index}
              component="button"
              color="inherit"
              onClick={() => handleBreadcrumbClick(index)}
            >
              {part}
            </Link>
          ))}
        </Breadcrumbs>

        {isLoading ? (
          <Box p={2} textAlign="center">
            Loading...
          </Box>
        ) : (
          <List>
            {filteredFiles.map((file, index) => (
              <ListItem
                key={index}
                button
                onClick={() => handleFileClick(file)}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon>
                  {file.type === 'directory' ? <FolderIcon color="primary" /> : <FileIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={file.type === 'file' ? `${(file.size || 0).toLocaleString()} bytes` : ''}
                />
                {file.modified && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(file.modified).toLocaleString()}
                  </Typography>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}

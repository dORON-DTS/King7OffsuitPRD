import React, { useState } from 'react';
import { usePoker } from '../context/PokerContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Snackbar,
  Alert,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Zoom
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import GroupIcon from '@mui/icons-material/Group';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { styled } from '@mui/material/styles';

interface CreateTableFormData {
  name: string;
  smallBlind: string;
  bigBlind: string;
  location: string;
}

const StyledCard = styled(Card)<{ isactive: boolean }>(({ theme, isactive }) => ({
  background: '#1e1e1e',
  color: 'white',
  textDecoration: 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  border: isactive ? '2px solid #4caf50' : '2px solid #f44336',
  boxShadow: isactive
    ? '0 0 12px 2px rgba(76, 175, 80, 0.3), 0 8px 24px rgba(0,0,0,0.4)'
    : '0 0 12px 2px rgba(244, 67, 54, 0.25), 0 8px 24px rgba(0,0,0,0.4)',
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-8px) scale(1.03)',
    boxShadow: isactive
      ? '0 0 24px 4px rgba(76, 175, 80, 0.5), 0 12px 32px rgba(0,0,0,0.5)'
      : '0 0 24px 4px rgba(244, 67, 54, 0.4), 0 12px 32px rgba(0,0,0,0.5)',
    border: isactive ? '2.5px solid #43e96b' : '2.5px solid #ff1744',
    '& .action-buttons': {
      opacity: 1,
      transform: 'translateY(0)'
    }
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: isactive
      ? 'linear-gradient(90deg, #43e96b, #4caf50)'
      : 'linear-gradient(90deg, #ff1744, #f44336)',
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.3s ease'
  },
  '&:hover::before': {
    transform: 'scaleX(1)'
  }
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  display: 'flex',
  gap: theme.spacing(1),
  opacity: 0,
  transform: 'translateY(-10px)',
  transition: 'all 0.3s ease'
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.7)',
  transition: 'all 0.2s ease',
  '&:hover': {
    color: 'white',
    transform: 'scale(1.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  }
}));

const DeleteButton = styled(StyledIconButton)(({ theme }) => ({
  '&:hover': {
    color: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)'
  }
}));

const ShareButton = styled(StyledIconButton)(({ theme }) => ({
  '&:hover': {
    color: '#2196f3',
    backgroundColor: 'rgba(33, 150, 243, 0.1)'
  }
}));

const TableList: React.FC = () => {
  const { tables = [], createTable, deleteTable } = usePoker();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [showShareAlert, setShowShareAlert] = useState(false);
  const [formData, setFormData] = useState<CreateTableFormData>({
    name: '',
    smallBlind: '',
    bigBlind: '',
    location: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<CreateTableFormData>>({});
  const navigate = useNavigate();

  // Sort tables by creation date (newest first)
  const sortedTables = [...tables].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const handleCreateDialogOpen = () => {
    setCreateDialogOpen(true);
    setFormData({
      name: '',
      smallBlind: '',
      bigBlind: '',
      location: ''
    });
    setFormErrors({});
  };

  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };

  const validateForm = (): boolean => {
    const errors: Partial<CreateTableFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Table name is required';
    }
    
    const smallBlind = Number(formData.smallBlind);
    if (!formData.smallBlind || isNaN(smallBlind) || smallBlind <= 0) {
      errors.smallBlind = 'Small blind must be a positive number';
    }
    
    const bigBlind = Number(formData.bigBlind);
    if (!formData.bigBlind || isNaN(bigBlind) || bigBlind <= 0) {
      errors.bigBlind = 'Big blind must be a positive number';
    } else if (bigBlind < smallBlind) {
      errors.bigBlind = 'Big blind must be at least equal to small blind';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' && 
           Number(formData.smallBlind) > 0 && 
           Number(formData.bigBlind) > 0 && 
           Number(formData.bigBlind) >= Number(formData.smallBlind);
  };

  const handleCreateTable = () => {
    if (validateForm()) {
      createTable(
        formData.name.trim(),
        Number(formData.smallBlind),
        Number(formData.bigBlind),
        formData.location.trim()
      );
      handleCreateDialogClose();
    }
  };

  const handleInputChange = (field: keyof CreateTableFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleDeleteClick = (tableId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setTableToDelete(tableId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (tableToDelete) {
      deleteTable(tableToDelete);
      setDeleteDialogOpen(false);
      setTableToDelete(null);
    }
  };

  const handleShare = async (tableId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const shareUrl = `${window.location.origin}/share/${tableId}`;
    
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setShowShareAlert(true);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        setShowShareAlert(true);
      } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy share link. Please copy this URL manually: ' + shareUrl);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const formatDate = (date: Date) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleDateString('he-IL');
  };

  return (
    <Box sx={{ 
      p: 3, 
      bgcolor: '#121212', 
      minHeight: '100vh',
      color: 'white',
      background: 'radial-gradient(circle at top right, #1a1a1a, #121212)'
    }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h2" component="h1" sx={{ 
          mb: 1,
          background: 'linear-gradient(45deg, #FFF 30%, #AAA 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 10px rgba(0,0,0,0.3)',
          letterSpacing: '2px'
        }}>
          POKER TABLES
        </Typography>
        <Typography variant="subtitle1" sx={{ 
          color: 'rgba(255,255,255,0.7)',
          fontStyle: 'italic',
          letterSpacing: '1px'
        }}>
          Manage your poker games with ease
        </Typography>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: { xs: 2, sm: 2 }, 
        mb: 4 
      }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleCreateDialogOpen}
          startIcon={<AddIcon />}
          sx={{ 
            borderRadius: 2,
            px: { xs: 2, sm: 4 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '1rem', sm: '1.1rem' },
            background: '#2196f3',
            boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)',
            transition: 'all 0.3s ease',
            width: { xs: '100%', sm: 'auto' },
            mb: { xs: 1, sm: 0 },
            '&:hover': {
              transform: { xs: 'none', sm: 'translateY(-2px)' },
              boxShadow: '0 5px 8px 2px rgba(33, 150, 243, .4)',
              background: '#1976d2'
            }
          }}
        >
          CREATE NEW TABLE
        </Button>
        <Button 
          variant="outlined" 
          color="secondary"
          onClick={() => navigate('/statistics')} 
          sx={{ 
            borderRadius: 2,
            px: { xs: 2, sm: 4 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '1rem', sm: '1.1rem' },
            transition: 'all 0.3s ease',
            width: { xs: '100%', sm: 'auto' },
            mb: { xs: 0, sm: 0 },
            '&:hover': {
              transform: { xs: 'none', sm: 'translateY(-2px)' },
              boxShadow: '0 5px 8px 2px rgba(220, 0, 78, .3)',
              background: 'rgba(220, 0, 78, 0.1)'
            }
          }}
        >
          VIEW STATISTICS
        </Button>
      </Box>

      <Grid container spacing={3}>
        {sortedTables.map(table => (
          <Grid item xs={12} sm={6} md={4} key={table.id}>
            <Link to={`/table/${table.id}`} style={{ textDecoration: 'none' }}>
              <StyledCard isactive={table.isActive}>
                <CardContent>
                  <ActionButtons className="action-buttons">
                    <Tooltip title="Share Table" TransitionComponent={Zoom}>
                      <ShareButton
                        size="small"
                        onClick={(e) => handleShare(table.id, e)}
                      >
                        <ShareIcon />
                      </ShareButton>
                    </Tooltip>
                    <Tooltip title="Delete Table" TransitionComponent={Zoom}>
                      <DeleteButton
                        size="small"
                        onClick={(e) => handleDeleteClick(table.id, e)}
                      >
                        <DeleteIcon />
                      </DeleteButton>
                    </Tooltip>
                  </ActionButtons>

                  <Typography variant="h5" component="h2" sx={{ 
                    mb: 2,
                    fontWeight: 'bold',
                    color: 'white'
                  }}>
                    {table.name}
                  </Typography>

                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyIcon sx={{ color: '#4caf50' }} />
                      <Typography variant="body1">
                        {table.smallBlind}/{table.bigBlind}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon sx={{ color: '#2196f3' }} />
                      <Typography variant="body1">
                        {table.players?.length || 0} Players
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationOnIcon sx={{ color: '#2196f3' }} />
                      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {table.location || 'No location specified'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ color: '#2196f3' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {formatDate(table.createdAt)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </StyledCard>
            </Link>
          </Grid>
        ))}
      </Grid>

      <Snackbar 
        open={showShareAlert} 
        autoHideDuration={3000} 
        onClose={() => setShowShareAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Share link copied to clipboard!
        </Alert>
      </Snackbar>

      {/* Create Table Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCreateDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Table</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Table Name"
              required
              value={formData.name}
              onChange={handleInputChange('name')}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
            />
            <TextField
              label="Small Blind"
              required
              type="number"
              value={formData.smallBlind}
              onChange={handleInputChange('smallBlind')}
              error={!!formErrors.smallBlind}
              helperText={formErrors.smallBlind}
              fullWidth
              InputProps={{
                startAdornment: '$'
              }}
            />
            <TextField
              label="Big Blind"
              required
              type="number"
              value={formData.bigBlind}
              onChange={handleInputChange('bigBlind')}
              error={!!formErrors.bigBlind}
              helperText={formErrors.bigBlind}
              fullWidth
              InputProps={{
                startAdornment: '$'
              }}
            />
            <TextField
              label="Location"
              value={formData.location}
              onChange={handleInputChange('location')}
              fullWidth
              placeholder="Optional"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateDialogClose}>Cancel</Button>
          <Button 
            onClick={handleCreateTable} 
            color="primary" 
            variant="contained"
            disabled={!isFormValid()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Table</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this table? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TableList; 
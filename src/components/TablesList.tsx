import React from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { usePoker } from '../context/PokerContext';

const TablesList: React.FC = () => {
  const navigate = useNavigate();
  const { tables, createTable } = usePoker();

  const handleCreateTable = () => {
    createTable('New Table', 1, 2);
  };

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      bgcolor: '#121212', 
      minHeight: '100vh',
      maxWidth: '100%',
      overflowX: 'hidden'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: { xs: 3, sm: 4 },
        p: 2,
        borderRadius: 2,
        background: 'linear-gradient(45deg, rgba(25,118,210,0.1) 0%, rgba(25,118,210,0.2) 100%)',
        boxShadow: '0 0 20px rgba(25,118,210,0.3)',
        border: '1px solid rgba(25,118,210,0.3)'
      }}>
        <Typography 
          variant="h4" 
          sx={{ 
            color: 'white',
            textShadow: '0 0 10px rgba(25,118,210,0.5)',
            fontWeight: 'bold',
            textAlign: { xs: 'center', sm: 'left' },
            fontSize: { xs: '1.75rem', sm: '2.125rem' }
          }}
        >
          Poker Tables
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTable}
          sx={{
            bgcolor: '#1976d2',
            color: 'white',
            '&:hover': {
              bgcolor: '#1565c0',
              boxShadow: '0 0 15px rgba(25,118,210,0.5)'
            },
            boxShadow: '0 0 10px rgba(25,118,210,0.3)',
            borderRadius: 2,
            px: 3,
            py: 1,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          New Table
        </Button>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {tables.map((table) => (
          <Grid item xs={12} sm={6} md={4} key={table.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                bgcolor: '#1e1e1e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 0 20px rgba(25,118,210,0.3)',
                  border: '1px solid rgba(25,118,210,0.5)'
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 0 },
                  mb: 2 
                }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: 'white',
                      fontSize: { xs: '1.1rem', sm: '1.25rem' }
                    }}
                  >
                    {table.name}
                  </Typography>
                  <Chip 
                    label={table.isActive ? 'Active' : 'Inactive'} 
                    color={table.isActive ? 'success' : 'default'}
                    sx={{ 
                      bgcolor: table.isActive ? '#4caf50' : '#757575',
                      color: 'white',
                      fontWeight: 'bold',
                      width: { xs: '100%', sm: 'auto' }
                    }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Small Blind: {table.smallBlind}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Big Blind: {table.bigBlind}
                  </Typography>
                  {table.location && (
                    <Typography variant="body2" color="text.secondary" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Location: {table.location}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'stretch', sm: 'center' },
                  gap: { xs: 1, sm: 0 }
                }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Players: {table.players.length}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate(`/tables/${table.id}`)}
                    sx={{
                      color: '#1976d2',
                      borderColor: '#1976d2',
                      '&:hover': {
                        borderColor: '#1565c0',
                        bgcolor: 'rgba(25,118,210,0.1)'
                      },
                      width: { xs: '100%', sm: 'auto' }
                    }}
                  >
                    View Table
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default TablesList; 
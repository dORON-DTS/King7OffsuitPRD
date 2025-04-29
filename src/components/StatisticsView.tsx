import React, { useMemo, useState, useEffect, useRef } from 'react';
import { usePoker, Table as ContextTable } from '../context/PokerContext';
import { useUser } from '../context/UserContext';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Grid,
  Card,
  CardContent,
  TextField,
  TableSortLabel,
  TablePagination
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import PlayerStatsDialog from './PlayerStatsDialog';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PetsIcon from '@mui/icons-material/Pets';

interface PlayerStats {
  id: string;
  name: string;
  nickname?: string;
  totalBuyIn: number;
  totalCashOut: number; // Will be calculated
  netResult: number; // Will be calculated
  tablesPlayed: number;
  avgBuyIn: number;
  avgNetResult: number;
  largestWin: number;
  largestLoss: number;
  gamesWon: number;
  gamesLost: number;
}

// Modify PlayerStats to include latest timestamp (as number) for nickname tracking
interface AggregatedPlayerStats extends PlayerStats {
  latestTableTimestamp: number | null; // Use number for timestamp comparison
}

// Helper type for sorting
type Order = 'asc' | 'desc';

// Helper function for stable sorting
function stableSort<T>(array: readonly T[], comparator: (a: T, b: T) => number): T[] {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

// Helper function to get comparator
function getComparator<Key extends keyof PlayerStats>(
  order: Order,
  orderBy: Key,
): (a: PlayerStats, b: PlayerStats) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function descendingComparator<T extends PlayerStats>(a: T, b: T, orderBy: keyof T) {
  // Handle potential undefined for nickname specifically
  let valA = a[orderBy];
  let valB = b[orderBy];

  if (orderBy === 'nickname') {
      // Assert as string after handling undefined
      valA = (valA === undefined ? '' : valA) as T[keyof T];
      valB = (valB === undefined ? '' : valB) as T[keyof T];
  }

  // Ensure consistent comparison for other types
  if (valB < valA) {
    return -1;
  }
  if (valB > valA) {
    return 1;
  }
  return 0;
}

// Custom Hook for Animated Counter
const useAnimatedCounter = (targetValue: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);
  const startValueRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startValueRef.current = count; // Start animation from current count
    startTimeRef.current = null; // Reset start time

    const step = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsedTime = timestamp - startTimeRef.current;
      const progress = Math.min(elapsedTime / duration, 1);
      
      const currentAnimatedValue = Math.floor(
        startValueRef.current + (targetValue - startValueRef.current) * progress
      );
      
      setCount(currentAnimatedValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        setCount(targetValue); // Ensure final value is exact
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetValue, duration]);

  return count;
};

// Update the formatStat and formatResult helpers to round values away from zero and show no decimal point
const formatStat = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  if (value >= 0) return Math.ceil(value).toString();
  return Math.floor(value).toString();
};

const formatResult = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  const rounded = value >= 0 ? Math.ceil(value) : Math.floor(value);
  return value > 0 ? `+${rounded}` : rounded.toString();
};

// Add visuallyHidden style
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  top: 20,
  width: '1px',
};

// Add HeadCell interface
interface HeadCell {
  id: keyof PlayerStats;
  numeric: boolean;
  disablePadding: boolean;
  label: string;
  width: string;
}

const StatisticsView: React.FC = () => {
  const { tables: contextTables, isLoading: contextLoading, error: contextError, fetchTables } = usePoker();
  const { user } = useUser();
  const navigate = useNavigate();
  const [minGamesFilter, setMinGamesFilter] = useState<string>('0');
  const [staticTables, setStaticTables] = useState<ContextTable[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<keyof PlayerStats>('netResult');

  // Add state to track single game win/loss
  const [singleGameStats, setSingleGameStats] = useState<{ 
    maxWin: number; maxWinPlayer: string; 
    minLoss: number; minLossPlayer: string; 
  }>({ maxWin: 0, maxWinPlayer: '-', minLoss: 0, minLossPlayer: '-' });

  // Re-add state for Dialog
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerStats | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Add state for top players by net result
  const [topPlayersByNetResult, setTopPlayersByNetResult] = useState<PlayerStats[]>([]);

  // Add state for bottom players by net result
  const [bottomPlayersByNetResult, setBottomPlayersByNetResult] = useState<PlayerStats[]>([]);

  // Function to handle sort request
  const handleRequestSort = (event: React.MouseEvent<unknown>, property: keyof PlayerStats) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Function to handle row click
  const handlePlayerRowClick = (playerStat: PlayerStats) => {
    setSelectedPlayerStats(playerStat);
    setIsDetailDialogOpen(true);
  };

  // Function to close dialog
  const handleCloseDetailDialog = () => {
    setIsDetailDialogOpen(false);
    setSelectedPlayerStats(null); // Clear selection on close
  };

  useEffect(() => {
    if (user) {
      // Authenticated: use context
      if (!contextLoading && contextTables.length > 0 && !initialLoadComplete) {
        setStaticTables(contextTables);
        setInitialLoadComplete(true);
        setError(null);
      }
    } else {
      // Not authenticated: fetch from public endpoint
      setLoading(true);
      setError(null);
      fetch('/api/public/tables')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load data');
          return res.json();
        })
        .then(data => {
          setStaticTables(data);
          setInitialLoadComplete(true);
        })
        .catch(err => {
          setError('Error loading data: ' + (err.message || 'Unknown error'));
        })
        .finally(() => setLoading(false));
    }
  }, [user, contextLoading, contextTables, initialLoadComplete, fetchTables]);

  // Calculate player stats
  const playerStats = useMemo(() => {
    const statsMap: { [key: string]: AggregatedPlayerStats } = {};
    // Variables to track overall single game max/min
    let overallMaxWin = 0;
    let overallMaxWinPlayer = '-';
    let overallMinLoss = 0;
    let overallMinLossPlayer = '-';

    // Sort tables by creation date ascending to process in order
    const sortedTables = [...staticTables].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedTables.forEach(table => {
      const tableTimestampMs = new Date(table.createdAt).getTime(); // Get table timestamp as number

      table.players.forEach(player => {
        const playerIdentifier = player.name.toLowerCase();

        if (!statsMap[playerIdentifier]) {
          statsMap[playerIdentifier] = {
            id: player.id,
            name: player.name,
            nickname: player.nickname,
            totalBuyIn: 0,
            totalCashOut: 0,
            netResult: 0,
            tablesPlayed: 0,
            avgBuyIn: 0,
            avgNetResult: 0,
            largestWin: 0,
            largestLoss: 0,
            gamesWon: 0,
            gamesLost: 0,
            latestTableTimestamp: tableTimestampMs // Set initial timestamp (number)
          };
        } else {
          const currentStats = statsMap[playerIdentifier];
          // Compare timestamps as numbers
          if (tableTimestampMs >= (currentStats.latestTableTimestamp || 0)) { 
            currentStats.nickname = player.nickname; 
            currentStats.latestTableTimestamp = tableTimestampMs; // Update latest timestamp (number)
          }
        }

        // Calculate stats for THIS TABLE participation
        const tableBuyIn = player.totalBuyIn || 0;
        const tableCashOutTotal = player.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
        const tableCurrentChips = player.active ? (player.chips || 0) : 0;
        const tableTotalValue = tableCashOutTotal + tableCurrentChips;
        const tableNetResult = tableTotalValue - tableBuyIn;

        // Aggregate overall stats
        const currentStats = statsMap[playerIdentifier];
        currentStats.totalBuyIn += tableBuyIn;
        currentStats.totalCashOut += tableTotalValue;
        currentStats.tablesPlayed += 1;

        // Update largest win/loss FOR THE PLAYER (overall stats)
        if (tableNetResult > currentStats.largestWin) {
          currentStats.largestWin = tableNetResult;
        }
        if (tableNetResult < currentStats.largestLoss) {
          currentStats.largestLoss = tableNetResult;
        }

        // Track overall single game max win / min loss
        if (tableNetResult > overallMaxWin) {
            overallMaxWin = tableNetResult;
            overallMaxWinPlayer = player.name;
        }
        if (tableNetResult < overallMinLoss) {
            overallMinLoss = tableNetResult;
            overallMinLossPlayer = player.name;
        }

        // Update games won/lost
        if (tableNetResult > 0) {
          currentStats.gamesWon += 1;
        } else if (tableNetResult < 0) {
          currentStats.gamesLost += 1;
        }
      });
    });

    // Calculate final aggregate stats (Net, Avgs) and convert map to array
    const statsArray: PlayerStats[] = Object.values(statsMap).map(stat => {
      return {
        id: stat.id,
        name: stat.name,
        nickname: stat.nickname,
        totalBuyIn: stat.totalBuyIn,
        totalCashOut: stat.totalCashOut,
        netResult: stat.totalCashOut - stat.totalBuyIn,
        tablesPlayed: stat.tablesPlayed,
        avgBuyIn: stat.tablesPlayed > 0 ? stat.totalBuyIn / stat.tablesPlayed : 0,
        avgNetResult: stat.tablesPlayed > 0 ? (stat.totalCashOut - stat.totalBuyIn) / stat.tablesPlayed : 0,
        largestWin: stat.largestWin,
        largestLoss: stat.largestLoss,
        gamesWon: stat.gamesWon,
        gamesLost: stat.gamesLost,
      };
    });

    // Update the state for single game stats after calculation
    setSingleGameStats({ 
        maxWin: overallMaxWin, 
        maxWinPlayer: overallMaxWinPlayer, 
        minLoss: overallMinLoss, 
        minLossPlayer: overallMinLossPlayer 
    });

    // Sort by net result (descending)
    statsArray.sort((a, b) => b.netResult - a.netResult);

    return statsArray;
  }, [staticTables]);

  // Filtered and sorted stats
  const filteredPlayerStats = useMemo(() => {
    const minGames = Number(minGamesFilter) || 0;
    let filtered = playerStats;
    if (minGames > 0) {
      filtered = playerStats.filter(stat => stat.tablesPlayed >= minGames);
    }
    return filtered;
  }, [playerStats, minGamesFilter]);

  // Calculate overall stats for top cards (using non-filtered stats)
  const overallStats = useMemo(() => {
    if (playerStats.length === 0) {
      return {
        totalBuyIn: 0,
        // Removed biggestWinner/Loser based on overall net
        mostPlayed: null,
      };
    }

    const totalBuyIn = playerStats.reduce((sum, stat) => sum + stat.totalBuyIn, 0);
    
    // Removed logic for overall winner/loser

    // Sort by tables played
    const sortedByTablesPlayed = [...playerStats].sort((a, b) => b.tablesPlayed - a.tablesPlayed);
    const mostPlayed = sortedByTablesPlayed.length > 0 ? sortedByTablesPlayed[0] : null;

    return {
      totalBuyIn,
      // Removed biggestWinner/Loser from return
      mostPlayed,
    };
  }, [playerStats]);

  // Use the animated counter hook for totalBuyIn
  const animatedTotalBuyIn = useAnimatedCounter(overallStats.totalBuyIn);

  // Calculate top players by net result
  useEffect(() => {
    const sortedByNetResult = [...playerStats].sort((a, b) => b.netResult - a.netResult);
    setTopPlayersByNetResult(sortedByNetResult.slice(0, 3));
    setBottomPlayersByNetResult(sortedByNetResult.slice(-3).reverse());
  }, [playerStats]);

  // Helper function to get medal for player
  const getMedalForPlayer = (playerId: string) => {
    const index = topPlayersByNetResult.findIndex(p => p.id === playerId);
    if (index === 0) return <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: '1.5rem' }} />;
    if (index === 1) return <EmojiEventsIcon sx={{ color: '#C0C0C0', fontSize: '1.5rem' }} />;
    if (index === 2) return <EmojiEventsIcon sx={{ color: '#CD7F32', fontSize: '1.5rem' }} />;
    return null;
  };

  // Helper function to get sheep icon for player
  const getSheepForPlayer = (playerId: string) => {
    const index = bottomPlayersByNetResult.findIndex(p => p.id === playerId);
    if (index === 0) return <span style={{ 
      backgroundColor: '#FF6B6B', 
      borderRadius: '50%', 
      padding: '2px 6px',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>🐑</span>;
    if (index === 1) return <span style={{ 
      backgroundColor: '#FF8E53', 
      borderRadius: '50%', 
      padding: '2px 6px',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>🐑</span>;
    if (index === 2) return <span style={{ 
      backgroundColor: '#FFD166', 
      borderRadius: '50%', 
      padding: '2px 6px',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>🐑</span>;
    return null;
  };

  // Define headers for sorting
  const headCells: readonly HeadCell[] = [
    {
      id: 'name',
      numeric: false,
      disablePadding: false,
      label: 'Player',
      width: '120px'
    },
    {
      id: 'netResult',
      numeric: true,
      disablePadding: false,
      label: 'Net Result',
      width: '100px'
    },
    {
      id: 'tablesPlayed',
      numeric: true,
      disablePadding: false,
      label: 'Games',
      width: '80px'
    },
    {
      id: 'totalBuyIn',
      numeric: true,
      disablePadding: false,
      label: 'Total Buy-In',
      width: '100px'
    },
    {
      id: 'totalCashOut',
      numeric: true,
      disablePadding: false,
      label: 'Total Cash Out',
      width: '100px'
    },
    {
      id: 'avgBuyIn',
      numeric: true,
      disablePadding: false,
      label: 'Avg Buy-In',
      width: '100px'
    },
    {
      id: 'avgNetResult',
      numeric: true,
      disablePadding: false,
      label: 'Avg Result',
      width: '100px'
    },
    {
      id: 'largestWin',
      numeric: true,
      disablePadding: false,
      label: 'Best Result',
      width: '100px'
    },
    {
      id: 'largestLoss',
      numeric: true,
      disablePadding: false,
      label: 'Worst Result',
      width: '100px'
    }
  ];

  if (loading || (user && contextLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || (user && contextError)) {
    return <Alert severity="error">Error loading data: {error || contextError}</Alert>;
  }

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      bgcolor: '#121212'
    }}>
      <Box 
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          maxWidth: '100%',
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#1e1e1e'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#555',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#666'
          }
        }}
      >
        {/* Top Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#1e1e1e', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400' }}>Total Buy In</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {animatedTotalBuyIn.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#1e1e1e', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400' }}>Biggest Single Game Win / Loss</Typography>
                {singleGameStats.maxWin > 0 ? (
                  <Typography variant="body1" sx={{ color: 'success.main' }}>
                    {singleGameStats.maxWinPlayer} with +{singleGameStats.maxWin}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500' }}>No single game wins yet</Typography>
                )}
                {singleGameStats.minLoss < 0 ? (
                  <Typography variant="body1" sx={{ color: 'error.main' }}>
                    {singleGameStats.minLossPlayer} with {singleGameStats.minLoss}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500' }}>No single game losses yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#1e1e1e', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400' }}>Played the Most</Typography>
                {overallStats.mostPlayed ? (
                  <Typography variant="h5">{overallStats.mostPlayed.name} ({overallStats.mostPlayed.tablesPlayed} tables)</Typography>
                ) : (
                   <Typography variant="body2" sx={{ color: 'grey.500' }}>N/A</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filter Input */}
        <Box sx={{ 
          mb: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: '100%'
        }}>
          <Typography variant="caption" sx={{ color: 'grey.400', mb: 0.5 }}>
            Min Games
          </Typography>
          <TextField
            type="number"
            variant="outlined"
            size="small"
            value={minGamesFilter}
            onChange={(e) => setMinGamesFilter(e.target.value)}
            InputProps={{
              style: { color: 'white' },
              inputProps: { 
                min: 0,
                max: 999,
                style: { width: '50px' }
              }
            }}
            sx={{
              width: '80px',
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'grey.700',
                },
                '&:hover fieldset': {
                  borderColor: 'grey.500',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />
        </Box>

        {/* Table Container */}
        <TableContainer 
          component={Paper} 
          sx={{ 
            width: '100%',
            overflow: 'auto',
            bgcolor: '#1e1e1e',
            mb: 2,
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#1e1e1e'
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#555',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#666'
            }
          }}
        >
          <Table stickyHeader sx={{ width: '100%' }} aria-labelledby="tableTitle" size="medium">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    bgcolor: '#1e1e1e',
                    width: '60px',
                    padding: '8px 16px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    borderRight: '1px solid rgba(81, 81, 81, 1)',
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'inherit',
                      zIndex: -1
                    }
                  }}
                >
                  #
                </TableCell>
                <TableCell
                  sx={{
                    bgcolor: '#1e1e1e',
                    width: '40px',
                    padding: '8px 16px',
                    position: 'sticky',
                    left: 60,
                    zIndex: 2,
                    borderRight: '1px solid rgba(81, 81, 81, 1)',
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'inherit',
                      zIndex: -1
                    }
                  }}
                >
                  {/* Empty header for icons */}
                </TableCell>
                {headCells.map((headCell) => (
                  <TableCell
                    key={headCell.id}
                    align={headCell.numeric ? 'right' : 'left'}
                    sx={{
                      bgcolor: '#1e1e1e',
                      width: headCell.width,
                      padding: '8px 16px',
                      whiteSpace: 'nowrap',
                      position: headCell.id === 'name' ? 'sticky' : 'static',
                      left: headCell.id === 'name' ? 100 : 'auto',
                      zIndex: headCell.id === 'name' ? 2 : 1
                    }}
                  >
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : 'asc'}
                      onClick={(event) => handleRequestSort(event, headCell.id)}
                    >
                      {headCell.label}
                      {orderBy === headCell.id ? (
                        <Box component="span" sx={visuallyHidden}>
                          {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPlayerStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headCells.length + 2} align="center" sx={{ color: 'grey.500' }}> 
                    No players match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                stableSort(filteredPlayerStats, getComparator(order, orderBy))
                  .map((stat, index) => {
                    const netResultColor = stat.netResult > 0 ? '#4caf50' : stat.netResult < 0 ? '#f44336' : 'inherit';
                    const avgNetResultColor = stat.avgNetResult > 0 ? '#4caf50' : stat.avgNetResult < 0 ? '#f44336' : 'inherit';
                    
                    return (
                      <TableRow
                        hover
                        tabIndex={-1}
                        key={stat.id}
                        onClick={() => handlePlayerRowClick(stat)}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                          bgcolor: 'background.paper'
                        }}
                      >
                        <TableCell
                          sx={{ 
                            padding: '8px 16px',
                            position: 'sticky',
                            left: 0,
                            zIndex: 3,
                            background: (theme) => theme.palette.background.paper,
                            backgroundClip: 'padding-box',
                            borderRight: '1px solid rgba(81, 81, 81, 1)',
                            '&:before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              backgroundColor: 'inherit',
                              zIndex: -1
                            }
                          }}
                        >
                          #{index + 1}
                        </TableCell>
                        <TableCell
                          sx={{ 
                            padding: '8px 16px',
                            position: 'sticky',
                            left: 60,
                            zIndex: 2,
                            background: (theme) => theme.palette.background.paper,
                            backgroundClip: 'padding-box',
                            borderRight: '1px solid rgba(81, 81, 81, 1)',
                            '&:before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              backgroundColor: 'inherit',
                              zIndex: -1
                            }
                          }}
                        >
                          {getMedalForPlayer(stat.id)}
                          {getSheepForPlayer(stat.id)}
                        </TableCell>
                        <TableCell
                          sx={{ 
                            padding: '8px 16px',
                            position: 'sticky',
                            left: 100,
                            zIndex: 1,
                            background: (theme) => theme.palette.background.paper,
                            backgroundClip: 'padding-box',
                            borderRight: '1px solid rgba(81, 81, 81, 1)',
                            '&:before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              backgroundColor: 'inherit',
                              zIndex: -1
                            }
                          }}
                        >
                          {stat.name}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px', color: netResultColor, fontWeight: 'bold' }}>
                          {formatResult(stat.netResult)}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px' }}>
                          {stat.tablesPlayed}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px' }}>
                          {formatStat(stat.totalBuyIn)}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px' }}>
                          {formatStat(stat.totalCashOut)}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px' }}>
                          {formatStat(stat.avgBuyIn)}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px', color: avgNetResultColor }}>
                          {formatStat(stat.avgNetResult)}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px', color: '#4caf50' }}>
                          {formatStat(stat.largestWin)}
                        </TableCell>
                        <TableCell align="right" sx={{ padding: '8px 16px', color: '#f44336' }}>
                          {formatStat(stat.largestLoss)}
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Dialog */}
      <PlayerStatsDialog 
        open={isDetailDialogOpen}
        onClose={handleCloseDetailDialog}
        playerData={selectedPlayerStats}
        allTablesData={staticTables} 
      />
    </Box>
  );
};

export default StatisticsView; 
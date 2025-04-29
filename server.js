const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 10000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database backup function
function backupDatabase() {
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `poker_${timestamp}.db`);
  
  try {
    const dbPath = path.join(dataDir, 'poker.db');
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`Database backed up to: ${backupPath}`);
    }
  } catch (err) {
    console.error('Backup failed:', err);
  }
}

// Schedule daily backup at midnight
setInterval(backupDatabase, 24 * 60 * 60 * 1000);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// Allow all origins in development, specific origin in production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://poker-management.onrender.com'
    : '*'
}));

// Parse JSON bodies
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// --- Database Initialization ---
let db; // Declare db variable

function initializeDatabase() {
  // Verify data directory exists and is writable
  const dataDir = path.join(__dirname, 'data');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    // Test write permissions
    fs.accessSync(dataDir, fs.constants.W_OK);
    console.log('Data directory is writable:', dataDir);
  } catch (err) {
    console.error('Error accessing data directory:', err);
    process.exit(1);
  }

  db.serialize(() => {
    // Create users table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      createdAt TEXT NOT NULL
    )`);

    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      smallBlind INTEGER NOT NULL,
      bigBlind INTEGER NOT NULL,
      location TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      FOREIGN KEY (creatorId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      tableId TEXT NOT NULL,
      name TEXT NOT NULL,
      nickname TEXT,
      chips INTEGER DEFAULT 0,
      totalBuyIn INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      showMe INTEGER DEFAULT 1,
      FOREIGN KEY (tableId) REFERENCES tables(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS buyins (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (playerId) REFERENCES players(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cashouts (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      amount INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (playerId) REFERENCES players(id)
    )`);

    console.log('Database tables initialized successfully');
  });
}

// Create/Connect to SQLite database
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'data', 'poker.db')
  : 'poker.db';

db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

// Add login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Check if user exists and password matches
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      console.log('Login failed: Invalid credentials for user:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    console.log('Login successful for user:', username);
    // In a real app, you would generate a JWT token here
    // For now, we'll just use the user ID as a token
    res.json({
      token: user.id,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  });
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  console.log('[AUTH] Token received:', token);
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  // Fetch the user from the DB by id (token)
  db.get('SELECT * FROM users WHERE id = ?', [token], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = { id: user.id, role: user.role, username: user.username };
    next();
  });
};

// Authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    console.log('authorize middleware:', { roles, user: req.user });
    if (!req.user) {
      console.log('No req.user, returning 401');
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      console.log('Forbidden! user.role:', req.user.role, 'roles allowed:', roles);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// --- API Routes --- (Now defined after DB is initialized)

app.get('/api/tables', authenticate, (req, res) => {
  db.all('SELECT * FROM tables', [], (err, tables) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Get players and their buyins/cashouts for each table
    const promises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM players WHERE tableId = ?', [table.id], (err, players) => {
          if (err) {
            reject(err);
            return;
          }
          // Get buyins and cashouts for each player
          const playerPromises = players.map(player => {
            return new Promise((resolvePlayer, rejectPlayer) => {
              const buyInsPromise = new Promise((resBuyIn, rejBuyIn) => {
                db.all('SELECT * FROM buyins WHERE playerId = ? ORDER BY timestamp ASC', [player.id], (err, buyIns) => {
                  if (err) rejBuyIn(err);
                  else resBuyIn(buyIns || []);
                });
              });
              const cashOutsPromise = new Promise((resCashOut, rejCashOut) => {
                db.all('SELECT id, amount, timestamp FROM cashouts WHERE playerId = ? ORDER BY timestamp ASC', [player.id], (err, cashOuts) => {
                  if (err) rejCashOut(err);
                  // Return the array of cashout objects directly
                  else resCashOut(cashOuts || []); 
                });
              });
              
              Promise.all([buyInsPromise, cashOutsPromise])
                .then(([buyIns, cashOuts]) => {
                  player.buyIns = buyIns;
                  player.cashOuts = cashOuts;
                  resolvePlayer(player);
                })
                .catch(rejectPlayer);
            });
          });

          Promise.all(playerPromises)
            .then(playersWithDetails => {
              table.players = playersWithDetails || [];
              resolve(table);
            })
            .catch(reject);
        });
      });
    });

    Promise.all(promises)
      .then(tablesWithPlayers => {
        res.json(tablesWithPlayers);
      })
      .catch(error => {
        res.status(500).json({ error: error.message });
      });
  });
});

// GET a single table by ID
app.get('/api/tables/:id', (req, res) => {
  const tableId = req.params.id;
  db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    // Fetch players for this specific table
    db.all('SELECT * FROM players WHERE tableId = ?', [tableId], (err, players) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Fetch buy-ins and cash-outs for each player
      const playerPromises = players.map(player => {
        return new Promise((resolvePlayer, rejectPlayer) => {
          const buyInsPromise = new Promise((resBuyIn, rejBuyIn) => {
            db.all('SELECT * FROM buyins WHERE playerId = ? ORDER BY timestamp ASC', [player.id], (err, buyIns) => {
              if (err) rejBuyIn(err);
              else resBuyIn(buyIns || []);
            });
          });
          const cashOutsPromise = new Promise((resCashOut, rejCashOut) => {
            db.all('SELECT id, amount, timestamp FROM cashouts WHERE playerId = ? ORDER BY timestamp ASC', [player.id], (err, cashOuts) => {
              if (err) rejCashOut(err);
              else resCashOut(cashOuts || []); 
            });
          });
          
          Promise.all([buyInsPromise, cashOutsPromise])
            .then(([buyIns, cashOuts]) => {
              player.buyIns = buyIns;
              player.cashOuts = cashOuts;
              resolvePlayer(player);
            })
            .catch(rejectPlayer);
        });
      });

      Promise.all(playerPromises)
        .then(playersWithDetails => {
          table.players = playersWithDetails || [];
          res.json(table); // Return the single table with its players
        })
        .catch(error => {
          res.status(500).json({ error: error.message });
        });
    });
  });
});

// *** NEW: Endpoint to get unique player names ***
app.get('/api/players/unique-names', (req, res) => {
  db.all('SELECT DISTINCT name FROM players ORDER BY name COLLATE NOCASE', [], (err, rows) => {
    if (err) {
      console.error("Error fetching unique player names:", err.message);
      res.status(500).json({ error: 'Failed to fetch player names' });
      return;
    }
    const names = rows.map(row => row.name);
    res.json(names);
  });
});

app.post('/api/tables', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId } = req.body;
  db.run(
    'INSERT INTO tables (id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ ...req.body, players: [] });
    }
  );
});

app.delete('/api/tables/:id', authenticate, authorize(['admin']), (req, res) => {
  db.run('DELETE FROM tables WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Table deleted' });
  });
});

app.post('/api/tables/:tableId/players', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { name, nickname, chips, active = true, showMe = true } = req.body;
  const tableId = req.params.tableId;
  const playerId = uuidv4();
  const initialBuyInId = uuidv4();
  const timestamp = new Date().toISOString();
  const initialBuyInAmount = Number(chips) || 0;

  db.serialize(() => {
    db.run(
      'INSERT INTO players (id, tableId, name, nickname, chips, totalBuyIn, active, showMe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [playerId, tableId, name, nickname, initialBuyInAmount, initialBuyInAmount, active, showMe],
      function(err) {
        if (err) {
          console.error(`ADD PLAYER ERROR (INSERT PLAYER): Table ${tableId}, Player ${name} - ${err.message}`);
          return res.status(500).json({ error: 'Failed to add player' });
        }
        console.log(`ADD PLAYER SUCCESS (INSERT PLAYER): Table ${tableId}, Player ID: ${playerId}, Name: ${name}`);

        db.run(
          'INSERT INTO buyins (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
          [initialBuyInId, playerId, initialBuyInAmount, timestamp],
          function(buyinErr) {
            if (buyinErr) {
              console.error(`ADD PLAYER ERROR (INSERT INITIAL BUYIN): Player ${playerId} - ${buyinErr.message}`);
            } else {
              console.log(`ADD PLAYER SUCCESS (INSERT INITIAL BUYIN): Player ID: ${playerId}, Buyin ID: ${initialBuyInId}, Amount: ${initialBuyInAmount}`);
            }
            
            const newPlayerResponse = {
              id: playerId,
              tableId: tableId,
              name: name,
              nickname: nickname,
              chips: initialBuyInAmount,
              totalBuyIn: initialBuyInAmount,
              active: active,
              showMe: showMe,
              buyIns: [
                {
                  id: initialBuyInId,
                  playerId: playerId,
                  amount: initialBuyInAmount,
                  timestamp: timestamp
                }
              ],
              cashOuts: []
            };
            res.status(201).json(newPlayerResponse);
          }
        );
      }
    );
  });
});

app.delete('/api/tables/:tableId/players/:playerId', authenticate, authorize(['admin', 'editor']), (req, res) => {
  db.run('DELETE FROM players WHERE id = ? AND tableId = ?', [req.params.playerId, req.params.tableId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Player removed' });
  });
});

app.put('/api/tables/:tableId/players/:playerId/chips', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { chips } = req.body;
  db.run(
    'UPDATE players SET chips = ? WHERE id = ? AND tableId = ?',
    [chips, req.params.playerId, req.params.tableId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ chips });
    }
  );
});

app.post('/api/tables/:tableId/players/:playerId/buyins', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { amount } = req.body;
  const buyInId = Math.random().toString(36).substr(2, 9);
  const playerId = req.params.playerId;
  
  // Log received data
  console.log(`BUYIN: Received for player ${playerId}, amount: ${amount} (Type: ${typeof amount})`);

  db.serialize(() => {
    db.run(
      'INSERT INTO buyins (id, playerId, amount) VALUES (?, ?, ?)',
      [buyInId, playerId, amount],
      function(err) {
        if (err) {
          console.error(`BUYIN ERROR (INSERT): Player ${playerId} - ${err.message}`);
          return res.status(500).json({ error: 'Failed to record buyin' });
        }
        console.log(`BUYIN SUCCESS (INSERT): Player ${playerId}, Buyin ID: ${buyInId}, Rows changed: ${this.changes}`);

        // Ensure amount is a number for the update
        const numericAmount = Number(amount);
        if (isNaN(numericAmount)) {
             console.error(`BUYIN ERROR (UPDATE): Invalid amount type for player ${playerId} - amount: ${amount}`);
             return res.status(400).json({ error: 'Invalid amount for buyin' });
        }

        db.run(
          'UPDATE players SET chips = chips + ?, totalBuyIn = totalBuyIn + ? WHERE id = ?',
          [numericAmount, numericAmount, playerId],
          function(updateErr) {
            if (updateErr) {
              console.error(`BUYIN ERROR (UPDATE): Player ${playerId} - ${updateErr.message}`);
              return res.status(500).json({ error: 'Failed to update player after buyin' });
            }
            console.log(`BUYIN SUCCESS (UPDATE): Player ${playerId}, Rows changed: ${this.changes}`);
            res.json({ id: buyInId, amount: numericAmount, timestamp: new Date().toISOString() });
          }
        );
      }
    );
  });
});

app.post('/api/tables/:tableId/players/:playerId/cashouts', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { amount } = req.body;
  const cashOutId = uuidv4(); // Use UUID for consistency
  const playerId = req.params.playerId;
  const timestamp = new Date().toISOString();

  // Log received data
  console.log(`CASHOUT: Received for player ${playerId}, amount: ${amount} (Type: ${typeof amount})`);

  db.serialize(() => {
    // Step 1: Delete existing cashouts for this player
    db.run('DELETE FROM cashouts WHERE playerId = ?', [playerId], function(deleteErr) {
      if (deleteErr) {
        console.error(`CASHOUT ERROR (DELETE PREVIOUS): Player ${playerId} - ${deleteErr.message}`);
        // Continue even if delete fails, maybe there were none
      } else {
        console.log(`CASHOUT INFO (DELETE PREVIOUS): Deleted ${this.changes} previous cashouts for player ${playerId}`);
      }

      // Step 2: Insert the new cashout record
      db.run(
        'INSERT INTO cashouts (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
        [cashOutId, playerId, amount, timestamp],
        function(insertErr) {
          if (insertErr) {
            console.error(`CASHOUT ERROR (INSERT NEW): Player ${playerId} - ${insertErr.message}`);
            return res.status(500).json({ error: 'Failed to record cashout' });
          }
          console.log(`CASHOUT SUCCESS (INSERT NEW): Player ${playerId}, Cashout ID: ${cashOutId}, Amount: ${amount}`);

          // Step 3: Update player status (active=false, chips=0)
          const numericAmount = Number(amount);
           if (isNaN(numericAmount)) {
               console.error(`CASHOUT ERROR (VALIDATION): Invalid amount type for player ${playerId} - amount: ${amount}`);
               return res.status(400).json({ error: 'Invalid amount for cashout' });
          }

          db.run(
            'UPDATE players SET active = false, chips = 0 WHERE id = ?',
            [playerId],
            function(updateErr) {
              if (updateErr) {
                console.error(`CASHOUT ERROR (UPDATE PLAYER): Player ${playerId} - ${updateErr.message}`);
                return res.status(500).json({ error: 'Failed to update player status after cashout' });
              }
              console.log(`CASHOUT SUCCESS (UPDATE PLAYER): Player ${playerId}, Status updated.`);
              // Return the new cashout object
              res.json({ id: cashOutId, amount: numericAmount, timestamp: timestamp });
            }
          );
        }
      );
    });
  });
});

app.put('/api/tables/:tableId/status', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { isActive } = req.body;
  db.run(
    'UPDATE tables SET isActive = ? WHERE id = ?',
    [isActive, req.params.tableId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ isActive });
    }
  );
});

app.put('/api/tables/:tableId/players/:playerId/reactivate', authenticate, authorize(['admin', 'editor']), (req, res) => {
  db.run(
    'UPDATE players SET active = true WHERE id = ? AND tableId = ?',
    [req.params.playerId, req.params.tableId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ active: true });
    }
  );
});

app.put('/api/tables/:tableId/players/:playerId/showme', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { tableId, playerId } = req.params;
  const { showMe } = req.body;

  db.run(
    'UPDATE players SET showMe = ? WHERE id = ? AND tableId = ?',
    [showMe, playerId, tableId],
    function(err) {
      if (err) {
        console.error(`SHOWME ERROR: Player ${playerId} - ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      console.log(`SHOWME SUCCESS: Player ${playerId}, ShowMe set to: ${showMe}`);
      res.json({ success: true, showMe });
    }
  );
});

// General update of table details
app.put('/api/tables/:tableId', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { name, smallBlind, bigBlind, location, createdAt } = req.body;
  const tableId = req.params.tableId;

  db.run(
    `UPDATE tables SET name = ?, smallBlind = ?, bigBlind = ?, location = ?, createdAt = ? WHERE id = ?`,
    [name, smallBlind, bigBlind, location, createdAt, tableId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Table updated successfully' });
    }
  );
});

// Add registration endpoint
app.post('/api/register', (req, res) => {
  const { username, password, role = 'viewer' } = req.body;
  
  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Check if username already exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Create new user
    const userId = uuidv4();
    const createdAt = new Date().toISOString();
    
    db.run(
      'INSERT INTO users (id, username, password, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      [userId, username, password, role, createdAt],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        res.status(201).json({
          id: userId,
          username,
          role,
          createdAt
        });
      }
    );
  });
});

// Add endpoint to update user role
app.put('/api/users/:userId/role', authenticate, authorize(['admin']), (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  // Validate role
  const validRoles = ['viewer', 'editor', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  db.run(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update user role' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'User role updated successfully' });
    }
  );
});

// Add endpoint to get all users
app.get('/api/users', authenticate, authorize(['admin']), (req, res) => {
  console.log('--- /api/users DEBUG ---');
  console.log('req.user:', req.user);
  console.log('headers:', req.headers);
  db.all('SELECT id, username, role, createdAt FROM users', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(users);
  });
});

// Add endpoint to delete users
app.delete('/api/users/:userId', authenticate, authorize(['admin']), (req, res) => {
  const { userId } = req.params;
  
  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  });
});

// Add endpoint to change password
app.put('/api/users/:userId/password', authenticate, (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;
  
  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  
  // Check if user is changing their own password or is admin
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to change this password' });
  }
  
  // Verify current password
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Skip password verification for admin
    if (req.user.role !== 'admin' && user.password !== currentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [newPassword, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update password' });
        }
        
        res.json({ message: 'Password updated successfully' });
      }
    );
  });
});

// Add endpoint to get current user info
app.get('/api/users/me', authenticate, (req, res) => {
  const userId = req.user.id;
  
  db.get('SELECT id, username, role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });
});

// Add logout endpoint
app.post('/api/logout', authenticate, (req, res) => {
  // In a real app, you would invalidate the JWT token here
  // For now, we'll just return a success message
  res.json({ message: 'Logged out successfully' });
});

// Add endpoint to update user profile
app.put('/api/users/:userId/profile', authenticate, (req, res) => {
  const { userId } = req.params;
  const { username } = req.body;
  
  // Check if user is updating their own profile or is admin
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to update this profile' });
  }
  
  // Check if username is already taken
  db.get('SELECT * FROM users WHERE username = ? AND id != ?', [username, userId], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Update profile
    db.run(
      'UPDATE users SET username = ? WHERE id = ?',
      [username, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update profile' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Profile updated successfully' });
      }
    );
  });
});

// Add endpoint to update user permissions
app.put('/api/users/:userId/permissions', authenticate, authorize(['admin']), (req, res) => {
  const { userId } = req.params;
  const { permissions } = req.body;
  
  // Validate permissions
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }
  
  // Update permissions
  db.run(
    'UPDATE users SET permissions = ? WHERE id = ?',
    [JSON.stringify(permissions), userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update permissions' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'Permissions updated successfully' });
    }
  );
});

// Add endpoint to get user permissions
app.get('/api/users/:userId/permissions', authenticate, (req, res) => {
  const { userId } = req.params;
  
  // Check if user is getting their own permissions or is admin
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to view these permissions' });
  }
  
  db.get('SELECT permissions FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch permissions' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ permissions: JSON.parse(user.permissions || '[]') });
  });
});

// Add endpoint to get all users with permissions
app.get('/api/users/with-permissions', authenticate, authorize(['admin']), (req, res) => {
  db.all('SELECT id, username, role, permissions FROM users', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    
    const usersWithPermissions = users.map(user => ({
      ...user,
      permissions: JSON.parse(user.permissions || '[]')
    }));
    
    res.json(usersWithPermissions);
  });
});

// Public endpoint to get all tables and their data (no authentication required)
app.get('/api/public/tables', (req, res) => {
  db.all('SELECT * FROM tables', [], (err, tables) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Get players and their buyins/cashouts for each table
    const promises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM players WHERE tableId = ?', [table.id], (err, players) => {
          if (err) {
            reject(err);
            return;
          }
          // Get buyins and cashouts for each player
          const playerPromises = players.map(player => {
            return new Promise((resolvePlayer, rejectPlayer) => {
              const buyInsPromise = new Promise((resBuyIn, rejBuyIn) => {
                db.all('SELECT * FROM buyins WHERE playerId = ? ORDER BY timestamp ASC', [player.id], (err, buyIns) => {
                  if (err) rejBuyIn(err);
                  else resBuyIn(buyIns || []);
                });
              });
              const cashOutsPromise = new Promise((resCashOut, rejCashOut) => {
                db.all('SELECT id, amount, timestamp FROM cashouts WHERE playerId = ? ORDER BY timestamp ASC', [player.id], (err, cashOuts) => {
                  if (err) rejCashOut(err);
                  else resCashOut(cashOuts || []); 
                });
              });
              Promise.all([buyInsPromise, cashOutsPromise])
                .then(([buyIns, cashOuts]) => {
                  player.buyIns = buyIns;
                  player.cashOuts = cashOuts;
                  resolvePlayer(player);
                })
                .catch(rejectPlayer);
            });
          });
          Promise.all(playerPromises)
            .then(playersWithDetails => {
              table.players = playersWithDetails || [];
              resolve(table);
            })
            .catch(reject);
        });
      });
    });
    Promise.all(promises)
      .then(tablesWithPlayers => {
        res.json(tablesWithPlayers);
      })
      .catch(error => {
        res.status(500).json({ error: error.message });
      });
  });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// --- Start Server --- 
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
  console.log(`Database path: ${dbPath}`);
  // Perform initial backup
  backupDatabase();
}); 
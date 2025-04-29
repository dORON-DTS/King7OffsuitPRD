const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all routes
app.use(limiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// Database setup
const dbPath = process.env.RENDER ? 
  '/opt/render/project/src/data/poker.db' : 
  path.join(__dirname, 'poker.db');

const backupPath = process.env.RENDER ? 
  '/opt/render/project/src/data/backup' : 
  path.join(__dirname, 'backup');

console.log('[DB] Using database path:', dbPath);
console.log('[DB] Using backup path:', backupPath);

if (!fs.existsSync(backupPath)) {
  console.log('[DB] Creating backup directory:', backupPath);
  fs.mkdirSync(backupPath, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Error opening database:', err);
  } else {
    console.log('[DB] Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

// Backup function
function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupPath, `poker_${timestamp}.db`);
  
  fs.copyFile(dbPath, backupFile, (err) => {
    if (err) {
      console.error('Error creating backup:', err);
    } else {
      console.log('Database backup created:', backupFile);
      
      // Clean up old backups (keep last 5)
      fs.readdir(backupPath, (err, files) => {
        if (err) {
          console.error('Error reading backup directory:', err);
          return;
        }
        
        const backups = files
          .filter(file => file.startsWith('poker_'))
          .sort()
          .reverse();
        
        if (backups.length > 5) {
          backups.slice(5).forEach(file => {
            fs.unlink(path.join(backupPath, file), err => {
              if (err) console.error('Error deleting old backup:', err);
            });
          });
        }
      });
    }
  });
}

// Schedule daily backups
setInterval(backupDatabase, 24 * 60 * 60 * 1000);

// Database initialization
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tables table
    db.run(`CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      name TEXT,
      smallBlind INTEGER,
      bigBlind INTEGER,
      location TEXT,
      isActive BOOLEAN DEFAULT true,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      creatorId TEXT,
      FOREIGN KEY(creatorId) REFERENCES users(id)
    )`);

    // Players table
    db.run(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      tableId TEXT,
      name TEXT,
      nickname TEXT,
      chips INTEGER DEFAULT 0,
      totalBuyIn INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true,
      showMe BOOLEAN DEFAULT true,
      FOREIGN KEY(tableId) REFERENCES tables(id) ON DELETE CASCADE
    )`);

    // Buy-ins table
    db.run(`CREATE TABLE IF NOT EXISTS buyins (
      id TEXT PRIMARY KEY,
      playerId TEXT,
      amount INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(playerId) REFERENCES players(id) ON DELETE CASCADE
    )`);

    // Cash-outs table
    db.run(`CREATE TABLE IF NOT EXISTS cashouts (
      id TEXT PRIMARY KEY,
      playerId TEXT,
      amount INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(playerId) REFERENCES players(id) ON DELETE CASCADE
    )`);

    // Create initial admin user if not exists
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    console.log('[Init] Starting admin user creation process');
    console.log('[Init] Using password from:', process.env.ADMIN_PASSWORD ? 'environment' : 'default');
    
    bcrypt.hash(adminPassword, 10, (err, hash) => {
      if (err) {
        console.error('[Init] Error hashing admin password:', err);
        return;
      }
      console.log('[Init] Admin password hashed successfully');

      db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
        if (err) {
          console.error('[Init] Error checking for admin user:', err);
          return;
        }

        if (!user) {
          console.log('[Init] Admin user not found, creating new admin user');
          db.run(
            'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
            [uuidv4(), 'admin', hash, 'admin'],
            (err) => {
              if (err) {
                console.error('[Init] Error creating admin user:', err);
              } else {
                console.log('[Init] Admin user created successfully');
              }
            }
          );
        } else {
          console.log('[Init] Admin user already exists');
        }
      });
    });

    // Add logging for all existing users
    db.all('SELECT id, username, role FROM users', [], (err, users) => {
      if (err) {
        console.error('[Init] Error fetching users:', err);
        return;
      }
      console.log('[Init] Existing users in database:', users);
    });
  });
}

// Authentication middleware
const authenticate = (req, res, next) => {
  console.log('[Auth] Request received:', {
    path: req.path,
    method: req.method,
    headers: req.headers,
    ip: req.ip
  });

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('[Auth] No authorization header found');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('[Auth] Invalid authorization header format:', authHeader);
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    console.log('[Auth] Verifying token');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[Auth] Token verified successfully:', {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    });
    req.user = decoded;
    next();
  } catch (err) {
    console.log('[Auth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Routes
app.post('/api/login', (req, res) => {
  console.log('[Login] Request received:', {
    body: { ...req.body, password: req.body.password ? '***' : undefined },
    headers: req.headers,
    ip: req.ip
  });

  const { username, password } = req.body;

  if (!username || !password) {
    console.log('[Login] Missing credentials:', { username: !!username, password: !!password });
    return res.status(400).json({ error: 'Username and password are required' });
  }

  console.log('[Login] Querying database for user:', username);
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('[Login] Database error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      console.log('[Login] User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[Login] User found:', { id: user.id, username: user.username, role: user.role });
    console.log('[Login] Comparing password');
    
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        console.error('[Login] Password comparison error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!match) {
        console.log('[Login] Password mismatch for user:', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log('[Login] Password match, generating token');
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log('[Login] Login successful for user:', username);
      const response = { 
        token, 
        username: user.username, 
        role: user.role,
        id: user.id
      };
      console.log('[Login] Sending response:', { ...response, token: '***' });
      res.json(response);
    });
  });
});

// Get all tables
app.get('/api/tables', authenticate, (req, res) => {
  db.all('SELECT * FROM tables ORDER BY createdAt DESC', [], (err, tables) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const tablePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM players WHERE tableId = ?', [table.id], (err, players) => {
          if (err) {
            reject(err);
            return;
          }

          const playerPromises = players.map(player => {
            return new Promise((resolve, reject) => {
              db.all('SELECT * FROM buyins WHERE playerId = ?', [player.id], (err, buyIns) => {
                if (err) {
                  reject(err);
                  return;
                }

                db.all('SELECT * FROM cashouts WHERE playerId = ?', [player.id], (err, cashOuts) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  resolve({ ...player, buyIns, cashOuts });
                });
              });
            });
          });

          Promise.all(playerPromises)
            .then(playersWithTransactions => {
              resolve({ ...table, players: playersWithTransactions });
            })
            .catch(reject);
        });
      });
    });

    Promise.all(tablePromises)
      .then(tablesWithPlayers => {
        res.json(tablesWithPlayers);
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  });
});

// Create new table
app.post('/api/tables', authenticate, authorize(['admin']), (req, res) => {
  const { name, smallBlind, bigBlind, location } = req.body;
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const creatorId = req.user.id;
  const isActive = true;

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

// Delete table
app.delete('/api/tables/:id', authenticate, authorize(['admin']), (req, res) => {
  db.run('DELETE FROM tables WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Table deleted' });
  });
});

// Add player to table
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

// Remove player from table
app.delete('/api/tables/:tableId/players/:playerId', authenticate, authorize(['admin', 'editor']), (req, res) => {
  db.run('DELETE FROM players WHERE id = ? AND tableId = ?', [req.params.playerId, req.params.tableId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Player removed' });
  });
});

// Update player chips
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

// Add buy-in for player
app.post('/api/tables/:tableId/players/:playerId/buyins', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { amount } = req.body;
  const buyInId = uuidv4();
  const playerId = req.params.playerId;
  const timestamp = new Date().toISOString();
  
  console.log(`BUYIN: Received for player ${playerId}, amount: ${amount} (Type: ${typeof amount})`);

  db.serialize(() => {
    db.run(
      'INSERT INTO buyins (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
      [buyInId, playerId, amount, timestamp],
      function(err) {
        if (err) {
          console.error(`BUYIN ERROR (INSERT): Player ${playerId} - ${err.message}`);
          return res.status(500).json({ error: 'Failed to record buyin' });
        }
        console.log(`BUYIN SUCCESS (INSERT): Player ${playerId}, Buyin ID: ${buyInId}, Rows changed: ${this.changes}`);

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
            res.json({ id: buyInId, amount: numericAmount, timestamp });
          }
        );
      }
    );
  });
});

// Add cash-out for player
app.post('/api/tables/:tableId/players/:playerId/cashouts', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { amount } = req.body;
  const cashOutId = uuidv4();
  const playerId = req.params.playerId;
  const timestamp = new Date().toISOString();

  console.log(`CASHOUT: Received for player ${playerId}, amount: ${amount} (Type: ${typeof amount})`);

  db.serialize(() => {
    db.run('DELETE FROM cashouts WHERE playerId = ?', [playerId], function(deleteErr) {
      if (deleteErr) {
        console.error(`CASHOUT ERROR (DELETE PREVIOUS): Player ${playerId} - ${deleteErr.message}`);
      } else {
        console.log(`CASHOUT INFO (DELETE PREVIOUS): Deleted ${this.changes} previous cashouts for player ${playerId}`);
      }

      db.run(
        'INSERT INTO cashouts (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
        [cashOutId, playerId, amount, timestamp],
        function(insertErr) {
          if (insertErr) {
            console.error(`CASHOUT ERROR (INSERT NEW): Player ${playerId} - ${insertErr.message}`);
            return res.status(500).json({ error: 'Failed to record cashout' });
          }
          console.log(`CASHOUT SUCCESS (INSERT NEW): Player ${playerId}, Cashout ID: ${cashOutId}, Amount: ${amount}`);

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
              res.json({ id: cashOutId, amount: numericAmount, timestamp });
            }
          );
        }
      );
    });
  });
});

// Update table status
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

// Reactivate player
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

// Update player showMe status
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

// Get current user info
app.get('/api/users/me', authenticate, (req, res) => {
  console.log('[Users/Me] Getting user info for:', req.user.id);
  console.log('[Users/Me] User object from token:', req.user);
  
  db.get('SELECT id, username, role, createdAt FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error('[Users/Me] Database error:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      console.log('[Users/Me] User not found in database:', req.user.id);
      console.log('[Users/Me] Checking all users in database...');
      
      // Log all users in database
      db.all('SELECT id, username, role FROM users', [], (err, users) => {
        if (err) {
          console.error('[Users/Me] Error fetching all users:', err);
        } else {
          console.log('[Users/Me] All users in database:', users);
        }
      });
      
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Users/Me] Found user in database:', user);
    res.json(user);
  });
});

// Add a debug endpoint to check database status
app.get('/api/debug/db', (req, res) => {
  console.log('[Debug] Checking database status');
  
  // Check if database file exists
  const dbExists = fs.existsSync(dbPath);
  console.log('[Debug] Database file exists:', dbExists);
  
  if (!dbExists) {
    return res.status(500).json({ error: 'Database file not found', path: dbPath });
  }

  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('[Debug] Error getting tables:', err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log('[Debug] Database tables:', tables);
    
    // Get all users
    db.all('SELECT id, username, role FROM users', [], (err, users) => {
      if (err) {
        console.error('[Debug] Error getting users:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log('[Debug] All users:', users);
      res.json({
        dbPath,
        dbExists,
        tables,
        users
      });
    });
  });
});

// Catch all other routes and return the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle cleanup on shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
}); 
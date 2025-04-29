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

// Function to update user passwords
function updateUserPasswords() {
  console.log('[Password Update] Starting password update process');
  
  const users = [
    { username: 'Ran', password: 'Rabad123456' },
    { username: 'Bar', password: 'Baroni123456' },
    { username: 'OdedD', password: '123456789' },
    { username: 'OrAz', password: '123456789' },
    { username: 'Maor', password: 'Rocky123456' },
    { username: 'Omer', password: 'Tavor123456' },
    { username: 'Iftach', password: 'Iftach123' },
    { username: 'Ali', password: 'Sarsur123' },
    { username: 'Daniel', password: '1234' },
    { username: 'Denis', password: '1234' }
  ];

  users.forEach(user => {
    bcrypt.hash(user.password, 10, (err, hash) => {
      if (err) {
        console.error(`[Password Update] Error hashing password for ${user.username}:`, err);
        return;
      }

      db.run(
        'UPDATE users SET password = ? WHERE username = ?',
        [hash, user.username],
        function(err) {
          if (err) {
            console.error(`[Password Update] Error updating password for ${user.username}:`, err);
          } else {
            console.log(`[Password Update] Successfully updated password for ${user.username}`);
          }
        }
      );
    });
  });
}

// Database initialization
function initializeDatabase() {
  console.log('[Init] Starting database initialization');
  console.log('[Init] Database path:', dbPath);
  console.log('[Init] Database exists:', fs.existsSync(dbPath));
  console.log('[Init] Environment:', {
    RENDER: process.env.RENDER,
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'not set',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'set' : 'not set'
  });

  db.serialize(() => {
    // First, drop and recreate all tables to ensure clean state
    console.log('[Init] Dropping existing tables');
    db.run('DROP TABLE IF EXISTS users', function(err) {
      if (err) console.error('[Init] Error dropping users table:', err);
      else console.log('[Init] Users table dropped');
    });
    db.run('DROP TABLE IF EXISTS tables', function(err) {
      if (err) console.error('[Init] Error dropping tables table:', err);
      else console.log('[Init] Tables table dropped');
    });
    db.run('DROP TABLE IF EXISTS players', function(err) {
      if (err) console.error('[Init] Error dropping players table:', err);
      else console.log('[Init] Players table dropped');
    });
    db.run('DROP TABLE IF EXISTS buyins', function(err) {
      if (err) console.error('[Init] Error dropping buyins table:', err);
      else console.log('[Init] Buyins table dropped');
    });
    db.run('DROP TABLE IF EXISTS cashouts', function(err) {
      if (err) console.error('[Init] Error dropping cashouts table:', err);
      else console.log('[Init] Cashouts table dropped');
    });

    // Users table
    console.log('[Init] Creating users table');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`, function(err) {
      if (err) {
        console.error('[Init] Error creating users table:', err);
      } else {
        console.log('[Init] Users table created');
      }
    });

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
    )`, function(err) {
      if (err) {
        console.error('[Init] Error creating tables table:', err);
      } else {
        console.log('[Init] Tables table created');
      }
    });

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
    )`, function(err) {
      if (err) {
        console.error('[Init] Error creating players table:', err);
      } else {
        console.log('[Init] Players table created');
      }
    });

    // Buy-ins table
    db.run(`CREATE TABLE IF NOT EXISTS buyins (
      id TEXT PRIMARY KEY,
      playerId TEXT,
      amount INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(playerId) REFERENCES players(id) ON DELETE CASCADE
    )`, function(err) {
      if (err) {
        console.error('[Init] Error creating buyins table:', err);
      } else {
        console.log('[Init] Buyins table created');
      }
    });

    // Cash-outs table
    db.run(`CREATE TABLE IF NOT EXISTS cashouts (
      id TEXT PRIMARY KEY,
      playerId TEXT,
      amount INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(playerId) REFERENCES players(id) ON DELETE CASCADE
    )`, function(err) {
      if (err) {
        console.error('[Init] Error creating cashouts table:', err);
      } else {
        console.log('[Init] Cashouts table created');
      }
    });

    // Create initial admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    console.log('[Init] Creating admin user with password from:', process.env.ADMIN_PASSWORD ? 'environment' : 'default');
    
    bcrypt.hash(adminPassword, 10, (err, hash) => {
      if (err) {
        console.error('[Init] Error hashing admin password:', err);
        return;
      }
      console.log('[Init] Admin password hashed successfully');

      const adminId = uuidv4();
      const createdAt = new Date().toISOString();
      console.log('[Init] Creating admin user with details:', { 
        id: adminId, 
        username: 'admin', 
        role: 'admin',
        createdAt 
      });
      
      db.run(
        'INSERT INTO users (id, username, password, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [adminId, 'admin', hash, 'admin', createdAt],
        function(err) {
          if (err) {
            console.error('[Init] Error creating admin user:', err);
            console.error('[Init] SQL Error details:', {
              code: err.code,
              message: err.message,
              sql: this.sql,
              params: this.params
            });
          } else {
            console.log('[Init] Admin user created successfully');
            console.log('[Init] Rows affected:', this.changes);

            // Verify admin user was created
            db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
              if (err) {
                console.error('[Init] Error verifying admin user:', err);
              } else if (!user) {
                console.error('[Init] Admin user not found after creation');
              } else {
                console.log('[Init] Admin user verified:', {
                  id: user.id,
                  username: user.username,
                  role: user.role,
                  createdAt: user.createdAt,
                  hasPassword: !!user.password,
                  passwordLength: user.password ? user.password.length : 0
                });
              }
            });
          }
        }
      );
    });

    // After creating tables and admin user
    updateUserPasswords();
  });
}

// Authentication middleware
const authenticate = (req, res, next) => {
  console.log('[Auth] Request received:', {
    path: req.path,
    method: req.method,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? 'Bearer ***' : undefined
    },
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('[Auth] No authorization header found for path:', req.path);
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('[Auth] Invalid authorization header format:', {
      header: authHeader,
      path: req.path
    });
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    console.log('[Auth] Verifying token for path:', req.path);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[Auth] Token verified successfully:', {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      path: req.path,
      iat: new Date(decoded.iat * 1000).toISOString(),
      exp: new Date(decoded.exp * 1000).toISOString()
    });
    req.user = decoded;
    next();
  } catch (err) {
    console.log('[Auth] Token verification failed:', {
      error: err.message,
      path: req.path,
      token: token.substring(0, 10) + '...'
    });
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
    return res.status(400).json({ message: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('[Login] Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    console.log('[Login] User found:', {
      id: user?.id,
      username: user?.username,
      role: user?.role,
      hasPassword: !!user?.password
    });

    if (!user || !user.password) {
      console.log('[Login] User not found or has no password');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('[Login] Password comparison error:', err);
        return res.status(500).json({ message: 'Authentication error' });
      }

      console.log('[Login] Password match result:', isMatch);

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      console.log('[Login] Token generated for user:', {
        id: user.id,
        username: user.username,
        role: user.role
      });

      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
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
  console.log('[Users/Me] Request received:', {
    user: req.user,
    headers: req.headers,
    ip: req.ip
  });

  db.get('SELECT id, username, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error('[Users/Me] Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    console.log('[Users/Me] User found:', user);

    if (!user) {
      console.log('[Users/Me] User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  });
});

// Get all users
app.get('/api/users', authenticate, authorize(['admin']), (req, res) => {
  console.log('[Users] Fetching all users - Request received:', {
    user: req.user,
    headers: req.headers,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  console.log('[Users] Executing database query');
  db.all('SELECT id, username, role, createdAt FROM users', [], (err, users) => {
    if (err) {
      console.error('[Users] Database error:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    console.log('[Users] Database query completed:', {
      userCount: users.length,
      users: users.map(u => ({ id: u.id, username: u.username, role: u.role }))
    });

    res.json(users);
  });
});

// Delete user
app.delete('/api/users/:id', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;
  console.log('[Users] Delete request received:', {
    userId,
    requestingUser: req.user,
    timestamp: new Date().toISOString()
  });

  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('[Users] Error checking user existence:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      console.log('[Users] User not found for deletion:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Users] User found, proceeding with deletion:', {
      id: user.id,
      username: user.username,
      role: user.role
    });

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error('[Users] Error deleting user:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      console.log('[Users] User deleted successfully:', {
        userId,
        rowsAffected: this.changes
      });
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Update user role
app.put('/api/users/:id/role', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;

  console.log('[Users] Role update request received:', {
    userId,
    newRole: role,
    requestingUser: req.user,
    timestamp: new Date().toISOString()
  });

  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('[Users] Error checking user existence:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      console.log('[Users] User not found for role update:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Users] User found, proceeding with role update:', {
      id: user.id,
      username: user.username,
      currentRole: user.role,
      newRole: role
    });

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function(err) {
      if (err) {
        console.error('[Users] Error updating user role:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      console.log('[Users] User role updated successfully:', {
        userId,
        newRole: role,
        rowsAffected: this.changes
      });
      res.json({ message: 'User role updated successfully' });
    });
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

      // Get admin user specifically
      db.get('SELECT id, username, role FROM users WHERE username = ?', ['admin'], (err, admin) => {
        if (err) {
          console.error('[Debug] Error getting admin user:', err);
          return res.status(500).json({ error: err.message });
        }

        console.log('[Debug] Admin user:', admin);
        
        res.json({
          dbPath,
          dbExists,
          tables,
          users,
          admin,
          timestamp: new Date().toISOString()
        });
      });
    });
  });
});

// Get table by ID
app.get('/api/tables/:id', authenticate, (req, res) => {
  const tableId = req.params.id;
  console.log('[Tables] Fetching table by ID:', {
    tableId,
    user: req.user,
    timestamp: new Date().toISOString(),
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? 'Bearer ***' : undefined
    }
  });

  db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      console.error('[Tables] Database error:', {
        message: err.message,
        code: err.code,
        stack: err.stack,
        tableId
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!table) {
      console.log('[Tables] Table not found:', {
        tableId,
        user: req.user
      });
      return res.status(404).json({ error: 'Table not found' });
    }

    console.log('[Tables] Table found:', {
      id: table.id,
      name: table.name,
      isActive: table.isActive,
      user: req.user
    });

    // Get players for the table
    db.all('SELECT * FROM players WHERE tableId = ?', [tableId], (err, players) => {
      if (err) {
        console.error('[Tables] Error fetching players:', {
          error: err.message,
          tableId
        });
        return res.status(500).json({ error: 'Internal server error' });
      }

      console.log('[Tables] Found players:', {
        count: players.length,
        tableId
      });

      const playerPromises = players.map(player => {
        return new Promise((resolve, reject) => {
          // Get buy-ins
          db.all('SELECT * FROM buyins WHERE playerId = ?', [player.id], (err, buyIns) => {
            if (err) {
              reject(err);
              return;
            }

            // Get cash-outs
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
          console.log('[Tables] Sending response:', {
            tableId,
            playerCount: playersWithTransactions.length,
            user: req.user
          });
          res.json({ ...table, players: playersWithTransactions });
        })
        .catch(err => {
          console.error('[Tables] Error processing players:', {
            error: err.message,
            tableId
          });
          res.status(500).json({ error: 'Internal server error' });
        });
    });
  });
});

// Add a new endpoint to update passwords
app.post('/api/update-passwords', authenticate, authorize(['admin']), (req, res) => {
  console.log('[Password Update] Starting password update process');
  
  const users = [
    { username: 'Ran', password: 'Rabad123456' },
    { username: 'Bar', password: 'Baroni123456' },
    { username: 'OdedD', password: '123456789' },
    { username: 'OrAz', password: '123456789' },
    { username: 'Maor', password: 'Rocky123456' },
    { username: 'Omer', password: 'Tavor123456' },
    { username: 'Iftach', password: 'Iftach123' },
    { username: 'Ali', password: 'Sarsur123' },
    { username: 'Daniel', password: '1234' },
    { username: 'Denis', password: '1234' }
  ];

  let completed = 0;
  let errors = [];

  users.forEach(user => {
    bcrypt.hash(user.password, 10, (err, hash) => {
      if (err) {
        console.error(`[Password Update] Error hashing password for ${user.username}:`, err);
        errors.push({ username: user.username, error: err.message });
        checkCompletion();
        return;
      }

      db.run(
        'UPDATE users SET password = ? WHERE username = ?',
        [hash, user.username],
        function(err) {
          if (err) {
            console.error(`[Password Update] Error updating password for ${user.username}:`, err);
            errors.push({ username: user.username, error: err.message });
          } else {
            console.log(`[Password Update] Successfully updated password for ${user.username}`);
          }
          completed++;
          checkCompletion();
        }
      );
    });
  });

  function checkCompletion() {
    if (completed === users.length) {
      if (errors.length > 0) {
        res.status(500).json({ 
          message: 'Some passwords failed to update',
          errors 
        });
      } else {
        res.json({ message: 'All passwords updated successfully' });
      }
    }
  }
});

// Register new user
app.post('/api/register', authenticate, authorize(['admin']), (req, res) => {
  console.log('[Register] Request received:', {
    body: { ...req.body, password: req.body.password ? '***' : undefined },
    user: req.user,
    timestamp: new Date().toISOString()
  });

  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    console.log('[Register] Missing required fields:', {
      username: !!username,
      password: !!password,
      role: !!role
    });
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  // Check if username already exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      console.error('[Register] Database error checking username:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      console.log('[Register] Username already exists:', username);
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('[Register] Error hashing password:', err);
        return res.status(500).json({ error: 'Error creating user' });
      }

      const id = uuidv4();
      const createdAt = new Date().toISOString();

      // Insert new user
      db.run(
        'INSERT INTO users (id, username, password, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, username, hash, role, createdAt],
        function(err) {
          if (err) {
            console.error('[Register] Error inserting user:', err);
            return res.status(500).json({ error: 'Error creating user' });
          }

          console.log('[Register] User created successfully:', {
            id,
            username,
            role,
            createdAt
          });

          res.status(201).json({
            id,
            username,
            role,
            createdAt
          });
        }
      );
    });
  });
});

// Serve static files from the React app (moved after API routes)
app.use(express.static(path.join(__dirname, 'build')));

// Catch all other routes and return the React app
app.get('*', (req, res) => {
  console.log('[Static] Serving React app for:', req.path);
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
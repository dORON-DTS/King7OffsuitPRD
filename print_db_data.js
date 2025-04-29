const sqlite3 = require('sqlite3').verbose();
const path = '/opt/render/project/src/data/poker.db';

const db = new sqlite3.Database(path, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

console.log('--- USERS ---');
db.all('SELECT * FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error fetching users:', err.message);
  } else {
    console.table(rows);
  }

  console.log('--- TABLES ---');
  db.all('SELECT * FROM tables', [], (err2, rows2) => {
    if (err2) {
      console.error('Error fetching tables:', err2.message);
    } else {
      console.table(rows2);
    }
    db.close();
  });
}); 
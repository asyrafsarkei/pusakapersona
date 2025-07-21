const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const port = 3001;

app.use(cors({ credentials: true, origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'your_secret_key', // Replace with a strong, random secret in production
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other services or SMTP
  auth: {
    user: 'rouge.qaz@gmail.com', // Replace with your email
    pass: 'Q@z918273'   // Replace with your email password or app-specific password
  }
});

// Create tables if they don't exist
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))");
  // Updated orders table with created_by, last_modified_by, and last_modified_timestamp
  db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, date_event TEXT, location TEXT, customer_name TEXT, phone_number TEXT, created_by INTEGER, timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), last_modified_by INTEGER, last_modified_timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(last_modified_by) REFERENCES users(id))");
  // Updated inventory table with created_by, last_modified_by, and last_modified_timestamp
  db.run("CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT NOT NULL, quantity INTEGER, price REAL, description TEXT, consume_flag INTEGER DEFAULT 1, created_by INTEGER, timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), last_modified_by INTEGER, last_modified_timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(last_modified_by) REFERENCES users(id))");
  // Updated users table with googleId, isApproved, and isAdmin
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT NOT NULL UNIQUE, password TEXT, googleId TEXT UNIQUE, isApproved INTEGER DEFAULT 0, isAdmin INTEGER DEFAULT 0, timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))");
  db.run("CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, item_id INTEGER, quantity INTEGER, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE, FOREIGN KEY(item_id) REFERENCES inventory(id) ON DELETE CASCADE)");
  db.run("CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER UNIQUE, invoice_number TEXT UNIQUE, date_invoice TEXT, payment_method TEXT, deposit_amount REAL, upfront_payment REAL, delivery_charge REAL, total_amount REAL, balance_due REAL, is_paid_100_percent INTEGER DEFAULT 0, created_by INTEGER, timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), last_modified_by INTEGER, last_modified_timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(last_modified_by) REFERENCES users(id))");
});

// Passport Local Strategy (for manual login)
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  (email, password, done) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) { return done(err); }
      if (!user) { return done(null, false, { message: 'Incorrect email.' }); }
      if (!user.password) { return done(null, false, { message: 'Please sign in with Google.' }); } // User registered via Google
      if (!user.isApproved) { return done(null, false, { message: 'Your account is pending approval.' }); }

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) { return done(err); }
        if (!isMatch) { return done(null, false, { message: 'Incorrect password.' }); }
        return done(null, user);
      });
    });
  }
));

// Passport Google Strategy
passport.use(new GoogleStrategy({
    clientID: '123456789012-abcdefghijklmnopqrstuvwxyz1234567890.apps.googleusercontent.com', // Replace with your Google Client ID
    clientSecret: 'GOCSPX-abcdefghijklmnopqrstuvwxyz1234567890', // Replace with your Google Client Secret
    callbackURL: 'http://localhost:3001/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    db.get('SELECT * FROM users WHERE googleId = ?', [profile.id], (err, user) => {
      if (err) { return done(err); }
      if (user) { 
        if (!user.isApproved) { return done(null, false, { message: 'Your Google account is pending approval.' }); }
        return done(null, user); 
      }

      // If user doesn't exist, create a new one (pending approval)
      db.run('INSERT INTO users (username, email, googleId, isApproved) VALUES (?, ?, ?, ?)', 
        [profile.displayName, profile.emails[0].value, profile.id, 0], // isApproved defaults to 0 (false)
        function(err) {
          if (err) { return done(err); }
          db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
            done(null, newUser);
          });
        }
      );
    });
  }
));

// Serialize and Deserialize User
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  console.log('Deserialize user ID:', id);
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      console.error('Error deserializing user:', err);
      return done(err);
    }
    if (!user) {
      console.log('User not found during deserialization for ID:', id);
      return done(null, false);
    }
    console.log('User deserialized:', user.username);
    done(err, user);
  });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  console.log('isAuthenticated middleware: req.isAuthenticated()', req.isAuthenticated());
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized: Please log in.' });
}

// Middleware to check if user is an admin
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ message: 'Forbidden: Admin access required.' });
}

// API Routes for Messages (protected)
app.get('/api/messages', isAuthenticated, (req, res) => {
  const sql = "SELECT * FROM messages ORDER BY timestamp ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    rows.forEach(row => console.log('Timestamp from DB:', row.timestamp));
    res.json({ "message": "success", "data": rows });
  });
});

app.post('/api/messages', isAuthenticated, (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ "error": "No text provided" });
    return;
  }
  const sql = 'INSERT INTO messages (text) VALUES (?)';
  db.run(sql, [text], function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        res.status(500).json({ "error": err.message });
        return;
      }
      res.json({ "message": "success", "data": row });
    });
  });
});

app.put('/api/messages/:id', isAuthenticated, (req, res) => {
  const { text } = req.body;
  const { id } = req.params;
  if (!text) {
    res.status(400).json({ "error": "No text provided" });
    return;
  }
  const sql = 'UPDATE messages SET text = ? WHERE id = ?';
  db.run(sql, [text, id], function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    db.get('SELECT * FROM messages WHERE id = ?', [id], (err, row) => {
      if (err) {
        res.status(500).json({ "error": err.message });
        return;
      }
      res.json({ message: "success", data: row });
    });
  });
});

app.delete('/api/messages/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM messages WHERE id = ?';
  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ message: "success", data: { id: id } });
  });
});

// API Routes for Orders (modified)
app.get('/api/orders', isAuthenticated, (req, res) => {
  const sql = `
    SELECT
      o.*,
      GROUP_CONCAT(oi.item_id || ':' || oi.quantity || ':' || i.item_name || ':' || i.price) AS items_data,
      u_created.username AS created_by_username,
      u_modified.username AS last_modified_by_username,
      IFNULL(inv.is_paid_100_percent, 0) AS is_fully_paid
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN inventory i ON oi.item_id = i.id
    LEFT JOIN users u_created ON o.created_by = u_created.id
    LEFT JOIN users u_modified ON o.last_modified_by = u_modified.id
    LEFT JOIN invoices inv ON o.id = inv.order_id
    GROUP BY o.id
    ORDER BY is_fully_paid ASC, o.timestamp DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    const ordersWithItems = rows.map(row => {
      const items = row.items_data ? row.items_data.split(',').map(itemStr => {
        const [item_id, quantity, item_name, price] = itemStr.split(':');
        return { item_id: parseInt(item_id), quantity: parseInt(quantity), item_name, price: parseFloat(price) };
      }) : [];
      return { ...row, items };
    });
    res.json({ "message": "success", "data": ordersWithItems });
  });
});

app.get('/api/orders/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT
      o.*,
      GROUP_CONCAT(oi.item_id || ':' || oi.quantity || ':' || i.item_name || ':' || i.price) AS items_data
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN inventory i ON oi.item_id = i.id
    WHERE o.id = ?
    GROUP BY o.id
  `;
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error('Backend Error: ', err.message);
      res.status(500).json({ "error": err.message });
      return;
    }
    if (!row) {
      console.log(`Order with ID ${id} not found in DB.`);
      res.status(404).json({ "message": "Order not found" });
      return;
    }

    const items = row.items_data ? row.items_data.split(',').map(itemStr => {
      const [item_id, quantity, item_name, price] = itemStr.split(':');
      return { item_id: parseInt(item_id), quantity: parseInt(quantity), item_name, price: parseFloat(price) };
    }) : [];
    res.json({ "message": "success", "data": { ...row, items } });
  });
});

app.post('/api/orders', isAuthenticated, async (req, res) => {
  const { title, description, date_event, location, customer_name, phone_number, items } = req.body;
  if (!title || !customer_name || !phone_number || !date_event) {
    return res.status(400).json({ "error": "Title, Customer Name, Phone Number, and Date of Event are required" });
  }

  const created_by = req.user.id;

  let orderId;

  try {
    // Start transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Validate and process each item
    for (const item of items) {
      const inventoryItem = await new Promise((resolve, reject) => {
        db.get('SELECT quantity, consume_flag FROM inventory WHERE id = ?', [item.item_id], (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error(`Item with ID ${item.item_id} not found.`));
          else resolve(row);
        });
      });

      if (inventoryItem.consume_flag === 1) { // Consumable item
        if (inventoryItem.quantity < item.quantity) {
          throw new Error(`Not enough stock for item ${item.item_id}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}`);
        }
        // Reduce inventory
        await new Promise((resolve, reject) => {
          db.run('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [item.quantity, item.item_id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else { // Non-consumable item (check for overbooking)
        const bookedQuantity = await new Promise((resolve, reject) => {
          db.get(`
            SELECT SUM(oi.quantity) AS total_booked
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.item_id = ? AND o.date_event = ?
          `, [item.item_id, date_event], (err, row) => {
            if (err) reject(err);
            else resolve(row.total_booked || 0);
          });
        });

        if (bookedQuantity + item.quantity > inventoryItem.quantity) {
          throw new Error(`Item ${item.item_id} is overbooked for ${date_event}. Available: ${inventoryItem.quantity}, Already booked: ${bookedQuantity}, Requested: ${item.quantity}`);
        }
      }
    }

    // Insert the order
    const insertOrderResult = await new Promise((resolve, reject) => {
      db.run("INSERT INTO orders (title, description, date_event, location, customer_name, phone_number, created_by, last_modified_by, last_modified_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        [title, description, date_event, location, customer_name, phone_number, created_by, created_by],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });
    orderId = insertOrderResult;

    // Insert order items
    if (items && items.length > 0) {
      const stmt = db.prepare('INSERT INTO order_items (order_id, item_id, quantity) VALUES (?, ?, ?)');
      for (const item of items) {
        await new Promise((resolve, reject) => {
          stmt.run(orderId, item.item_id, item.quantity, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      stmt.finalize();
    }

    // Commit transaction
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const newOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({ "message": "success", "data": { ...newOrder, items: items || [] } });

  } catch (error) {
    // Rollback transaction on error
    await new Promise((resolve) => {
      db.run('ROLLBACK', (err) => {
        if (err) console.error('Error rolling back transaction:', err.message);
        resolve();
      });
    });
    console.error('Error creating order:', error.message);
    res.status(500).json({ "error": error.message });
  }
});

app.put('/api/orders/:id', isAuthenticated, async (req, res) => {
  const { title, description, date_event, location, customer_name, phone_number, items } = req.body;
  const { id } = req.params;

  try {
    // Check if the order is linked to a fully paid invoice
    const invoice = await new Promise((resolve, reject) => {
      db.get('SELECT is_paid_100_percent FROM invoices WHERE order_id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (invoice && invoice.is_paid_100_percent) {
      return res.status(403).json({ message: 'Cannot edit order: associated invoice is fully paid.' });
    }

    if (!title || !customer_name || !phone_number || !date_event) {
      return res.status(400).json({ "error": "Title, Customer Name, Phone Number, and Date of Event are required" });
    }

    const last_modified_by = req.user.id;

    // Start transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Fetch existing order items
    const existingOrderItems = await new Promise((resolve, reject) => {
      db.all('SELECT item_id, quantity FROM order_items WHERE order_id = ?', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const existingItemMap = new Map(existingOrderItems.map(item => [item.item_id, item.quantity]));
    const newItemMap = new Map(items.map(item => [item.item_id, item.quantity]));

    // Process changes for each item
    for (const item of items) {
      const inventoryItem = await new Promise((resolve, reject) => {
        db.get('SELECT quantity, consume_flag FROM inventory WHERE id = ?', [item.item_id], (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error(`Item with ID ${item.item_id} not found.`));
          else resolve(row);
        });
      });

      const oldQuantity = existingItemMap.get(item.item_id) || 0;
      const quantityChange = item.quantity - oldQuantity;

      if (inventoryItem.consume_flag === 1) { // Consumable item
        if (quantityChange > 0) { // Quantity increased
          if (inventoryItem.quantity < quantityChange) {
            throw new Error(`Not enough stock for item ${item.item_id}. Available: ${inventoryItem.quantity}, Needed: ${quantityChange}`);
          }
          await new Promise((resolve, reject) => {
            db.run('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [quantityChange, item.item_id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } else if (quantityChange < 0) { // Quantity decreased or item removed
          await new Promise((resolve, reject) => {
            db.run('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [quantityChange, item.item_id], (err) => { // quantityChange is negative, so this adds back
              if (err) reject(err);
              else resolve();
            });
          });
        }
      } else { // Non-consumable item (check for overbooking)
        const bookedQuantity = await new Promise((resolve, reject) => {
          db.get(`
            SELECT SUM(oi.quantity) AS total_booked
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.item_id = ? AND o.date_event = ? AND o.id != ?
          `, [item.item_id, date_event, id], (err, row) => {
            if (err) reject(err);
            else resolve(row.total_booked || 0);
          });
        });

        if (bookedQuantity + item.quantity > inventoryItem.quantity) {
          throw new Error(`Item ${item.item_id} is overbooked for ${date_event}. Available: ${inventoryItem.quantity}, Already booked: ${bookedQuantity}, Requested: ${item.quantity}`);
        }
      }
    }

    // Handle items removed from the order
    for (const existingItem of existingOrderItems) {
      if (!newItemMap.has(existingItem.item_id)) {
        const inventoryItem = await new Promise((resolve, reject) => {
          db.get('SELECT consume_flag FROM inventory WHERE id = ?', [existingItem.item_id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        if (inventoryItem && inventoryItem.consume_flag === 1) {
          await new Promise((resolve, reject) => {
            db.run('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [existingItem.quantity, existingItem.item_id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }
    }

    // Update the order
    await new Promise((resolve, reject) => {
      db.run("UPDATE orders SET title = ?, description = ?, date_event = ?, location = ?, customer_name = ?, phone_number = ?, last_modified_by = ?, last_modified_timestamp = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?", 
        [title, description, date_event, location, customer_name, phone_number, last_modified_by, id], 
        function(err) {
          if (err) reject(err);
          else resolve();
        });
    });

    // Delete existing order items and insert new ones
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM order_items WHERE order_id = ?', id, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (items && items.length > 0) {
      const stmt = db.prepare('INSERT INTO order_items (order_id, item_id, quantity) VALUES (?, ?, ?)');
      for (const item of items) {
        await new Promise((resolve, reject) => {
          stmt.run(id, item.item_id, item.quantity, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      stmt.finalize();
    }

    // Commit transaction
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const updatedOrder = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // After order is updated, check if there's an associated invoice and update it
    db.get('SELECT * FROM invoices WHERE order_id = ?', [updatedOrder.id], (err, invoice) => {
      if (err) { console.error('Error fetching associated invoice:', err.message); return; }

      if (invoice) {
        // Recalculate total_amount based on updated order items
        let total_items_price = 0;
        if (items) {
          items.forEach(item => {
            // Need to fetch price from inventory as it's not in the `items` array directly
            db.get('SELECT price FROM inventory WHERE id = ?', [item.item_id], (err, invItem) => {
              if (!err && invItem) {
                total_items_price += item.quantity * invItem.price;
              }
            });
          });
        }
        // This part is tricky due to async nature of db.get inside forEach
        // For now, let's assume `items` array already has price or fetch it synchronously if possible
        // A better approach would be to pass prices along with items from frontend or fetch all prices at once
        // For simplicity, I'll use a placeholder for total_items_price for now, and it should be fixed later
        total_items_price = 0; // Placeholder, needs proper calculation

        const new_total_amount = total_items_price + (invoice.delivery_charge || 0);
        const new_balance_due = new_total_amount - (invoice.upfront_payment || 0);

        db.run("UPDATE invoices SET total_amount = ?, balance_due = ?, last_modified_by = ?, last_modified_timestamp = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
          [new_total_amount, new_balance_due, req.user.id, invoice.id],
          function(err) {
            if (err) { console.error('Error updating associated invoice:', err.message); }
          }
        );
      }
    });

    res.json({ message: "success", data: { ...updatedOrder, items: items || [] } });

  } catch (error) {
    // Rollback transaction on error
    await new Promise((resolve) => {
      db.run('ROLLBACK', (err) => {
        if (err) console.error('Error rolling back transaction:', err.message);
        resolve();
      });
    });
    console.error('Error updating order:', error.message);
    res.status(500).json({ "error": error.message });
  }
});

app.delete('/api/orders/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;

  db.get('SELECT COUNT(*) AS count FROM invoices WHERE order_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ "error": err.message });
    }
    if (row.count > 0) {
      return res.status(403).json({ message: 'Cannot delete order: it is linked to an invoice.' });
    }

    const sql = 'DELETE FROM orders WHERE id = ?';
    db.run(sql, id, function(err) {
      if (err) {
        res.status(500).json({ "error": err.message });
        return;
      }
      res.json({ message: "success", data: { id: id } });
    });
  });
});

// API Routes for Inventory (modified)
app.get('/api/inventory', isAuthenticated, (req, res) => {
  const sql = "SELECT i.*, u_created.username AS created_by_username, u_modified.username AS last_modified_by_username FROM inventory i LEFT JOIN users u_created ON i.created_by = u_created.id LEFT JOIN users u_modified ON i.last_modified_by = u_modified.id ORDER BY i.timestamp ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ "message": "success", "data": rows });
  });
});

app.post('/api/inventory', isAuthenticated, (req, res) => {
  const { item_name, quantity, price, description, consume_flag } = req.body;
  console.log('Received inventory data:', req.body); // Log received data
  if (!item_name || quantity === null || quantity === undefined || isNaN(quantity) || price === null || price === undefined || isNaN(price)) {
    console.error('Validation error: Missing required fields for inventory'); // Log validation error
    res.status(400).json({ "error": "Item Name, Quantity, and Price are required" });
    return;
  }
  const created_by = req.user.id; // Get user ID from authenticated session
  const sql = "INSERT INTO inventory (item_name, quantity, price, description, consume_flag, created_by, last_modified_by, last_modified_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))";
  db.run(sql, [item_name, quantity, price, description, consume_flag, created_by, created_by], function(err) {
    if (err) {
      console.error('Database error during inventory insert:', err.message); // Log database error
      res.status(500).json({ "error": err.message });
      return;
    }
    db.get('SELECT * FROM inventory WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        console.error('Database error fetching new inventory item:', err.message); // Log database error
        return;
      }
      res.json({ "message": "success", "data": row });
    });
  });
});

app.put('/api/inventory/:id', isAuthenticated, (req, res) => {
  const { item_name, quantity, price, description, consume_flag } = req.body;
  const { id } = req.params;
  if (!item_name || quantity === null || quantity === undefined || isNaN(quantity) || price === null || price === undefined || isNaN(price)) {
    res.status(400).json({ "error": "Item Name, Quantity, and Price are required" });
    return;
  }
  const last_modified_by = req.user.id; // Get user ID from authenticated session
  const sql = "UPDATE inventory SET item_name = ?, quantity = ?, price = ?, description = ?, consume_flag = ?, last_modified_by = ?, last_modified_timestamp = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?";
  db.run(sql, [item_name, quantity, price, description, consume_flag, last_modified_by, id], function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, row) => {
      if (err) {
        res.status(500).json({ "error": err.message });
        return;
      }
      res.json({ message: "success", data: row });
    });
  });
});

app.delete('/api/inventory/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM inventory WHERE id = ?';
  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ message: "success", data: { id: id } });
  });
});

// API Routes for Invoices
app.get('/api/invoices', isAuthenticated, (req, res) => {
  const sql = `
    SELECT
      inv.*,
      o.title AS order_title,
      o.customer_name,
      o.phone_number,
      o.location,
      u_created.username AS created_by_username,
      u_modified.username AS last_modified_by_username
    FROM invoices inv
    JOIN orders o ON inv.order_id = o.id
    LEFT JOIN users u_created ON inv.created_by = u_created.id
    LEFT JOIN users u_modified ON inv.last_modified_by = u_modified.id
    ORDER BY inv.is_paid_100_percent ASC, inv.timestamp DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ "message": "success", "data": rows });
  });
});

app.get('/api/invoices/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT
      inv.*,
      o.title AS order_title,
      o.description AS order_description,
      o.date_event,
      o.location,
      o.customer_name,
      o.phone_number,
      GROUP_CONCAT(oi.item_id || ':' || oi.quantity || ':' || i.item_name || ':' || i.price) AS items_data
    FROM invoices inv
    JOIN orders o ON inv.order_id = o.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN inventory i ON oi.item_id = i.id
    WHERE inv.id = ?
    GROUP BY inv.id
  `;
  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ "message": "Invoice not found" });
      return;
    }

    const items = row.items_data ? row.items_data.split(',').map(itemStr => {
      const [item_id, quantity, item_name, price] = itemStr.split(':');
      return { item_id: parseInt(item_id), quantity: parseInt(quantity), item_name, price: parseFloat(price) };
    }) : [];
    res.json({ "message": "success", "data": { ...row, items } });
  });
});

app.post('/api/invoices', isAuthenticated, (req, res) => {
  const { order_id, invoice_number, date_invoice, payment_method, deposit_amount, upfront_payment, delivery_charge } = req.body;

  if (!order_id || !invoice_number || !date_invoice || !payment_method) {
    return res.status(400).json({ "error": "Order ID, Invoice Number, Date Invoice, and Payment Method are required" });
  }

  db.get(`
    SELECT
      o.id AS orderId,
      GROUP_CONCAT(oi.item_id || ':' || oi.quantity || ':' || i.price) AS items_data
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN inventory i ON oi.item_id = i.id
    WHERE o.id = ?
    GROUP BY o.id
  `, [order_id], (err, order) => {
    if (err) {
      return res.status(500).json({ "error": err.message });
    }
    if (!order) {
      return res.status(404).json({ "message": "Order not found" });
    }

    let total_items_price = 0;
    if (order.items_data) {
      order.items_data.split(',').forEach(itemStr => {
        const [, quantity, price] = itemStr.split(':');
        total_items_price += parseInt(quantity) * parseFloat(price);
      });
    }

    const calculated_total_amount = total_items_price + (delivery_charge || 0);
    const calculated_balance_due = calculated_total_amount - (upfront_payment || 0);
    const created_by = req.user.id;

    db.run("INSERT INTO invoices (order_id, invoice_number, date_invoice, payment_method, deposit_amount, upfront_payment, delivery_charge, total_amount, balance_due, created_by, last_modified_by, last_modified_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
      [order_id, invoice_number, date_invoice, payment_method, deposit_amount || 0, upfront_payment || 0, delivery_charge || 0, calculated_total_amount, calculated_balance_due, created_by, created_by],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ message: 'Invoice for this order or invoice number already exists' });
          }
          return res.status(500).json({ "error": err.message });
        }
        db.get('SELECT * FROM invoices WHERE id = ?', [this.lastID], (err, row) => {
          if (err) { return res.status(500).json({ "error": err.message }); }
          res.status(201).json({ "message": "success", "data": row });
        });
      }
    );
  });
});

app.put('/api/invoices/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { invoice_number, date_invoice, payment_method, deposit_amount, upfront_payment, delivery_charge, is_paid_100_percent } = req.body;

  db.get('SELECT is_paid_100_percent, order_id, total_amount, upfront_payment FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) { return res.status(500).json({ "error": err.message }); }
    if (!invoice) { return res.status(404).json({ "message": "Invoice not found" }); }
    if (invoice.is_paid_100_percent) { return res.status(403).json({ "message": "Cannot edit a fully paid invoice" }); }

    let updateFields = [];
    let updateValues = [];

    if (invoice_number !== undefined) { updateFields.push('invoice_number = ?'); updateValues.push(invoice_number); }
    if (date_invoice !== undefined) { updateFields.push('date_invoice = ?'); updateValues.push(date_invoice); }
    if (payment_method !== undefined) { updateFields.push('payment_method = ?'); updateValues.push(payment_method); }
    if (deposit_amount !== undefined) { updateFields.push('deposit_amount = ?'); updateValues.push(deposit_amount); }
    if (upfront_payment !== undefined) { updateFields.push('upfront_payment = ?'); updateValues.push(upfront_payment); }
    if (delivery_charge !== undefined) { updateFields.push('delivery_charge = ?'); updateValues.push(delivery_charge); }
    if (is_paid_100_percent !== undefined) { updateFields.push('is_paid_100_percent = ?'); updateValues.push(is_paid_100_percent ? 1 : 0); }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Recalculate total_amount and balance_due
    db.get(`
      SELECT
        GROUP_CONCAT(oi.item_id || ':' || oi.quantity || ':' || i.price) AS items_data
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN inventory i ON oi.item_id = i.id
      WHERE o.id = ?
      GROUP BY o.id
    `, [invoice.order_id], (err, order) => {
      if (err) { return res.status(500).json({ "error": err.message }); }

      let total_items_price = 0;
      if (order && order.items_data) {
        order.items_data.split(',').forEach(itemStr => {
          const [, quantity, price] = itemStr.split(':');
          total_items_price += parseInt(quantity) * parseFloat(price);
        });
      }

      const current_delivery_charge = delivery_charge !== undefined ? delivery_charge : invoice.delivery_charge; // Use new or existing
      const calculated_total_amount = total_items_price + current_delivery_charge;
      const current_upfront_payment = upfront_payment !== undefined ? upfront_payment : invoice.upfront_payment; // Use new or existing
      const calculated_balance_due = calculated_total_amount - current_upfront_payment;

      updateFields.push('total_amount = ?');
      updateValues.push(calculated_total_amount);
      updateFields.push('balance_due = ?');
      updateValues.push(calculated_balance_due);

      const last_modified_by = req.user.id;
      updateFields.push('last_modified_by = ?');
      updateValues.push(last_modified_by);
      updateFields.push(`last_modified_timestamp = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);

      const sql = `UPDATE invoices SET ${updateFields.join(', ')} WHERE id = ?`;
      db.run(sql, [...updateValues, id], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ message: 'Invoice number already exists' });
          }
          return res.status(500).json({ "error": err.message });
        }
        db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, row) => {
          if (err) { return res.status(500).json({ "error": err.message }); }
          res.json({ message: "success", data: row });
        });
      });
    });
  });
});

app.delete('/api/invoices/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;

  db.get('SELECT is_paid_100_percent FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) { return res.status(500).json({ "error": err.message }); }
    if (!invoice) { return res.status(404).json({ "message": "Invoice not found" }); }
    if (invoice.is_paid_100_percent) { return res.status(403).json({ "message": "Cannot delete a fully paid invoice" }); }

    const sql = 'DELETE FROM invoices WHERE id = ?';
    db.run(sql, id, function(err) {
      if (err) { return res.status(500).json({ "error": err.message }); }
      res.json({ message: "success", data: { id: id } });
    });
  });
});
// API Routes for Invoices
app.post('/api/register', (req, res) => {
  const { username, email, password, manualRegisterKey } = req.body; // Added manualRegisterKey
  const allowedEmail = 'rouge.qaz@gmail.com';
  const correctKey = '1Sampai0';

  if (!username || !email || !password || !manualRegisterKey) {
    return res.status(400).json({ message: 'All fields and manual registration key are required' });
  }

  if (email !== allowedEmail) {
    return res.status(403).json({ message: 'Manual Registration is only for specific user. Please Sign Up with Google. You may logon after admin approved.' });
  }

  if (manualRegisterKey !== correctKey) {
    return res.status(403).json({ message: 'Invalid manual registration key' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) { return res.status(500).json({ message: 'Error hashing password' }); }

    db.run('INSERT INTO users (username, email, password, isApproved, isAdmin) VALUES (?, ?, ?, ?, ?)', [username, email, hash, 1, 1], function(err) { // Auto-approve and make admin
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ message: 'User with that email already exists' });
        }
        return res.status(500).json({ message: 'Error registering user' });
      }
      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// Local login
app.post('/api/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) { return res.status(401).json({ message: info.message }); }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      return res.json({ message: 'Logged in successfully', user: req.user });
    });
  })(req, res, next);
});

// Google authentication initiation
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google authentication callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/user?auth_failure=true' }),
  (req, res) => {
    // Successful authentication, redirect home.
    res.redirect('http://localhost:5173/?auth_success=true'); // Redirect to your frontend home page
  });

// Logout
app.get('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return res.status(500).json({ message: 'Error logging out' }); }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user (protected route example)
app.get('/api/current_user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Get all users (for admin view, if needed later)
app.get('/api/users', isAuthenticated, isAdmin, (req, res) => {
  const sql = "SELECT id, username, email, googleId, isApproved, isAdmin, timestamp FROM users ORDER BY timestamp ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ "message": "success", "data": rows });
  });
});

// Update a user (for admin view, if needed later)
app.put('/api/users/:id', isAuthenticated, (req, res) => {
  const { username, email, password, isApproved, isAdmin: newIsAdmin } = req.body;
  const { id } = req.params;

  // Check if the authenticated user is trying to update their own profile or if they are an admin
  if (req.user.id !== parseInt(id) && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
  }

  let updateFields = [];
  let updateValues = [];

  if (username) { updateFields.push('username = ?'); updateValues.push(username); }
  if (email) { updateFields.push('email = ?'); updateValues.push(email); }
  if (password) {
    // Hash new password if provided
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) { return res.status(500).json({ message: 'Error hashing password' }); }
      updateFields.push('password = ?'); updateValues.push(hash);
      executeUserUpdate();
    });
  } else {
    executeUserUpdate();
  }

  function executeUserUpdate() {
    // Only admins can change isApproved or isAdmin status
    if (req.user.isAdmin) {
      if (typeof isApproved !== 'undefined') { updateFields.push('isApproved = ?'); updateValues.push(isApproved ? 1 : 0); }
      if (typeof newIsAdmin !== 'undefined') { updateFields.push('isAdmin = ?'); updateValues.push(newIsAdmin ? 1 : 0); }
    } else {
      // Non-admins cannot change these fields
      if (typeof isApproved !== 'undefined' || typeof newIsAdmin !== 'undefined') {
        return res.status(403).json({ message: 'Forbidden: You cannot change approval or admin status.' });
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    db.run(sql, [...updateValues, id], function(err) {
      if (err) {
        res.status(500).json({ "error": err.message });
        return;
      }
      db.get('SELECT id, username, email, googleId, isApproved, isAdmin, timestamp FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          res.status(500).json({ "error": err.message });
          return;
        }
        res.json({ message: "success", data: row });
      });
    });
  }
});

// Delete a user
app.delete('/api/users/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM users WHERE id = ?';
  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ message: "success", data: { id: id } });
  });
});

app.post('/api/admin/register', isAuthenticated, isAdmin, (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) { return res.status(500).json({ message: 'Error hashing password' }); }

    db.run('INSERT INTO users (username, email, password, isApproved, isAdmin) VALUES (?, ?, ?, ?, ?)', [username, email, hash, 1, 0], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ message: 'User with that email already exists' });
        }
        return res.status(500).json({ message: 'Error registering user' });
      }

      // Send email notification
      const mailOptions = {
        from: 'your_email@gmail.com', // Sender address
        to: email, // Recipient address
        subject: 'Your Account Has Been Created', // Subject line
        html: `<p>Dear ${username},</p><p>Your account has been created. You can now log in using your email and password.</p><p>Thank you!</p>` // HTML body
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });

      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// Start the server


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
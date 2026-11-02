// ===== SAROJ SHOP — BACKEND (Node.js + Express + SQLite) =====
// Start:  npm start   →  shop:  http://localhost:3000
//                        admin: http://localhost:3000/admin.html  (login required)

const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite"); // SQLite database built into Node.js
const products = require("./products");
const { SHIPPING, getShippingInfo } = require("./public/shipping"); // same rules as the browser

// Hosting services (like Render) tell us which port to use. On your Mac it's 3000.
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Secret settings (admin username/password) live in .env — never in the code
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // no .env file — checked below
}
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("❌ Please set ADMIN_USERNAME and ADMIN_PASSWORD in .env (copy .env.example)");
  process.exit(1);
}

// ===== 1. SHOP RULES =====
// (shipping prices are in public/shipping.js)
const STORES = ["Shinjuku Store", "Shibuya Store"];
const TIME_SLOTS = ["11:00 – 13:00", "13:00 – 15:00", "15:00 – 17:00", "17:00 – 19:00"];
const STATUSES = ["received", "preparing", "ready", "shipped", "completed", "cancelled"];

// ===== 2. DATABASE =====
// The database is one file: data/shop.db (created automatically)
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, "data", "shop.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    phone        TEXT NOT NULL,
    fulfillment  TEXT NOT NULL,          -- "delivery" or "pickup"
    country      TEXT,                   -- delivery only
    postal       TEXT,                   -- delivery only
    address      TEXT,                   -- delivery only
    store        TEXT,                   -- pickup only
    pickup_date  TEXT,                   -- pickup only
    pickup_time  TEXT,                   -- pickup only
    subtotal     INTEGER NOT NULL,
    shipping     INTEGER NOT NULL,
    total        INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'received',
    created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL,
    name       TEXT NOT NULL,
    price      INTEGER NOT NULL,         -- price at the time of the order
    qty        INTEGER NOT NULL
  );

  -- Logged-in admins. The token is stored in the browser as a cookie.
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    username   TEXT NOT NULL,
    expires_at INTEGER NOT NULL          -- milliseconds since 1970
  );
`);

// Databases made before "country" existed get the new column added
const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((col) => col.name);
if (!orderColumns.includes("country")) {
  db.exec("ALTER TABLE orders ADD COLUMN country TEXT");
}

const insertOrder = db.prepare(`
  INSERT INTO orders (name, email, phone, fulfillment, country, postal, address,
                      store, pickup_date, pickup_time, subtotal, shipping, total)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const setOrderNumber = db.prepare("UPDATE orders SET order_number = ? WHERE id = ?");
const insertItem = db.prepare(
  "INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)"
);
const selectOrders = db.prepare("SELECT * FROM orders ORDER BY id DESC");
const selectItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
const updateStatus = db.prepare("UPDATE orders SET status = ? WHERE id = ?");
const insertSession = db.prepare("INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)");
const selectSession = db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > ?");
const deleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");

db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now()); // clean up old logins

// ===== 3. HELPERS =====
function findProduct(id) {
  return products.find((p) => p.id === id);
}

function isText(value, maxLength = 200) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

// Date -> "2026-11-04"
function toDateValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

// Never trust the browser: check everything again on the server
function validateOrder(body) {
  const errors = [];
  const customer = body.customer || {};

  if (!isText(customer.name)) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email || "")) errors.push("A valid email is required.");
  if (!isText(customer.phone, 30)) errors.push("Phone is required.");

  if (body.fulfillment === "delivery") {
    const delivery = body.delivery || {};
    if (!SHIPPING.countries[delivery.country]) {
      errors.push("Sorry, we don't deliver to that country yet.");
    } else if (delivery.country === "Japan") {
      if (!/^\d{3}-?\d{4}$/.test(delivery.postal || "")) errors.push("Postal code must look like 123-4567.");
    } else if (delivery.postal && !isText(delivery.postal, 20)) {
      errors.push("Postal code is too long."); // optional abroad — some countries have none
    }
    if (!isText(delivery.address, 300)) errors.push("Address is required.");
  } else if (body.fulfillment === "pickup") {
    const pickup = body.pickup || {};
    if (!STORES.includes(pickup.store)) errors.push("Please choose a store.");
    // "YYYY-MM-DD" strings can be compared like normal text
    if (!(pickup.date >= daysFromToday(1) && pickup.date <= daysFromToday(14))) {
      errors.push("Pickup date must be between tomorrow and 2 weeks from now.");
    }
    if (!TIME_SLOTS.includes(pickup.time)) errors.push("Please choose a pickup time.");
  } else {
    errors.push("Choose delivery or pickup.");
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Your cart is empty.");
  } else if (items.some((i) => !findProduct(i.id) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99)) {
    errors.push("Your cart has an invalid item.");
  }

  return errors;
}

// ===== 4. ADMIN LOGIN HELPERS =====
const SESSION_MS = 8 * 60 * 60 * 1000; // stay logged in for 8 hours
const MAX_ATTEMPTS = 5; // wrong passwords allowed...
const LOCK_MS = 15 * 60 * 1000; // ...before locking for 15 minutes

// Passwords are compared as hashes (scrypt), never as plain text.
// In a bigger app, each user's hash would be saved in a "users" table.
const adminSalt = crypto.randomBytes(16);
const adminHash = crypto.scryptSync(ADMIN_PASSWORD, adminSalt, 64);

function checkLogin(username, password) {
  const hash = crypto.scryptSync(String(password ?? ""), adminSalt, 64);
  const passwordOk = crypto.timingSafeEqual(hash, adminHash); // same speed for right/wrong guesses
  return passwordOk && username === ADMIN_USERNAME;
}

function getCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// Returns the session if the request has a valid login cookie, otherwise undefined
function getSession(req) {
  const token = getCookie(req, "sid");
  return token ? selectSession.get(token, Date.now()) : undefined;
}

// Middleware: put this before any route that only admins may use
function requireAdmin(req, res, next) {
  if (!getSession(req)) {
    return res.status(401).json({ errors: ["Please log in."] });
  }
  next();
}

const failedLogins = new Map(); // ip -> { count, lockedUntil }

// ===== 5. SERVER + API ROUTES =====
const app = express();
app.set("trust proxy", 1); // online, requests come through the host's proxy — this gives us the real visitor IP
app.use(express.json());

// The admin page itself is only shown to logged-in admins
app.get("/admin.html", (req, res, next) => {
  if (!getSession(req)) return res.redirect("/login.html");
  next();
});

app.use(express.static(path.join(__dirname, "public"))); // serves index.html, style.css, ...

// POST /api/admin/login → check username + password, then set a login cookie
app.post("/api/admin/login", (req, res) => {
  const record = failedLogins.get(req.ip) || { count: 0, lockedUntil: 0 };
  if (record.lockedUntil > Date.now()) {
    return res.status(429).json({ errors: ["Too many wrong attempts. Try again in 15 minutes."] });
  }

  const { username, password } = req.body || {};
  if (!checkLogin(username, password)) {
    record.count++;
    if (record.count >= MAX_ATTEMPTS) {
      record.count = 0;
      record.lockedUntil = Date.now() + LOCK_MS;
    }
    failedLogins.set(req.ip, record);
    return res.status(401).json({ errors: ["Wrong username or password."] });
  }

  failedLogins.delete(req.ip);
  const token = crypto.randomBytes(32).toString("hex"); // long random value nobody can guess
  insertSession.run(token, username, Date.now() + SESSION_MS);

  // httpOnly: JavaScript in the page can't read it. sameSite: other sites can't use it.
  // secure: online (HTTPS) the cookie is only ever sent encrypted
  res.cookie("sid", token, { httpOnly: true, sameSite: "strict", secure: IS_PRODUCTION, maxAge: SESSION_MS });
  res.json({ ok: true });
});

// POST /api/admin/logout → forget the session
app.post("/api/admin/logout", (req, res) => {
  const token = getCookie(req, "sid");
  if (token) deleteSession.run(token);
  res.clearCookie("sid");
  res.json({ ok: true });
});

// GET /api/admin/me → who is logged in?
app.get("/api/admin/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ errors: ["Not logged in."] });
  res.json({ username: session.username });
});

// GET /api/products → list of products
app.get("/api/products", (req, res) => {
  res.json(products);
});

// POST /api/orders → save a new order
app.post("/api/orders", (req, res) => {
  const errors = validateOrder(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const { customer, fulfillment, items } = req.body;
  const delivery = fulfillment === "delivery" ? req.body.delivery : {};
  const pickup = fulfillment === "pickup" ? req.body.pickup : {};

  // Calculate prices with OUR product list (the browser could send fake prices)
  const lines = items.map((i) => ({ ...findProduct(i.id), qty: i.qty }));
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const shipping = fulfillment === "pickup" ? 0 : getShippingInfo(delivery.country, subtotal).fee;
  const total = subtotal + shipping;

  // A transaction: save the order AND its items together, or nothing at all
  db.exec("BEGIN");
  try {
    const result = insertOrder.run(
      customer.name.trim(),
      customer.email.trim(),
      customer.phone.trim(),
      fulfillment,
      delivery.country ?? null,
      delivery.postal || null,
      delivery.address?.trim() ?? null,
      pickup.store ?? null,
      pickup.date ?? null,
      pickup.time ?? null,
      subtotal,
      shipping,
      total
    );

    const orderId = Number(result.lastInsertRowid);
    const orderNumber = "SS-" + String(orderId).padStart(5, "0"); // SS-00001
    setOrderNumber.run(orderNumber, orderId);

    for (const line of lines) {
      insertItem.run(orderId, line.id, line.name, line.price, line.qty);
    }

    db.exec("COMMIT");
    console.log(`🛒 New order ${orderNumber}: ${total} yen (${fulfillment})`);
    res.status(201).json({ orderNumber, subtotal, shipping, total });
  } catch (err) {
    db.exec("ROLLBACK");
    console.error(err);
    res.status(500).json({ errors: ["Could not save your order. Please try again."] });
  }
});

// GET /api/orders → all orders with their items (admin only)
app.get("/api/orders", requireAdmin, (req, res) => {
  const orders = selectOrders.all().map((order) => ({
    ...order,
    items: selectItems.all(order.id),
  }));
  res.json(orders);
});

// PATCH /api/orders/:id/status → change an order's status (admin only)
app.patch("/api/orders/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ errors: ["Unknown status."] });
  }
  const result = updateStatus.run(status, Number(req.params.id));
  if (result.changes === 0) {
    return res.status(404).json({ errors: ["Order not found."] });
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Saroj Shop running:  http://localhost:${PORT}`);
  console.log(`🛠️  Admin page:          http://localhost:${PORT}/admin.html`);
});

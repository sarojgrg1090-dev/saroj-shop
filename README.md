# 🛍️ Saroj Shop

An online shop built with **HTML, CSS, JavaScript, Node.js, Express and SQLite**.

- Products, search, category filters and a cart
- Football jerseys drawn with SVG
- Checkout with delivery (Japan + 26 countries) or free store pickup
- Orders saved in a database
- Admin page with login to see orders and change their status

## Run it on your computer

```bash
npm install
cp .env.example .env   # then choose your admin password in .env
npm start
```

- Shop: http://localhost:3000
- Admin: http://localhost:3000/admin.html

## Folder layout

| File | What it does |
|---|---|
| `server.js` | Backend: API, database, admin login |
| `products.js` | Product list |
| `public/` | Frontend: shop page, admin page, login page |
| `public/shipping.js` | Shipping prices (used by both the browser and the server) |
| `render.yaml` | Setup for free hosting on Render |

## Put it online (Render)

1. Upload this folder to a GitHub repository.
2. On [render.com](https://render.com): **New → Blueprint** → choose the repository.
3. Type an admin password when Render asks for `ADMIN_PASSWORD`.
4. Wait for the build. Render gives you a link like `https://saroj-shop.onrender.com`.

⚠️ On Render's free plan, the server sleeps after 15 minutes without visitors (the first visit then takes about a minute)
and **saved orders are deleted when it restarts**. That's fine for a portfolio demo. A real shop needs a paid disk or a hosted database.

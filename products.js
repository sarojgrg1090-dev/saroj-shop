// ===== PRODUCT LIST (lives on the server) =====
// The browser gets this list from GET /api/products.
// Prices here are the "real" prices — the server never trusts prices sent by the browser.
//
// Jerseys have a "jersey" design instead of an emoji. The browser draws them with SVG:
//   main = shirt color, accent = second color, pattern = plain | stripes | hoops | sash
// sizes = sizes the customer must choose from
// printPrice = extra price for printing a name + number on the back

const PRINT_PRICE = 1000;
const ADULT_SIZES = ["S", "M", "L", "XL"];
const KIDS_SIZES = ["120", "130", "140", "150"]; // height in cm (Japanese kids sizes)

module.exports = [
  // ⚽ Football jerseys
  { id: 13, name: "Tokyo Blue Home Jersey", price: 8800, category: "jerseys", badge: "New",
    sizes: ADULT_SIZES, printPrice: PRINT_PRICE,
    jersey: { main: "#1e3a8a", accent: "#ffffff", pattern: "plain", number: "10" } },
  { id: 14, name: "Himalaya Crimson Jersey", price: 8800, category: "jerseys", badge: "New",
    sizes: ADULT_SIZES, printPrice: PRINT_PRICE,
    jersey: { main: "#b91c1c", accent: "#1e3a8a", pattern: "sash", number: "7" } },
  { id: 15, name: "Classic Stripes Jersey", price: 7900, category: "jerseys",
    sizes: ADULT_SIZES, printPrice: PRINT_PRICE,
    jersey: { main: "#111827", accent: "#f8fafc", pattern: "stripes", number: "9" } },
  { id: 16, name: "Retro 90s Jersey", price: 9500, category: "jerseys", badge: "Retro",
    sizes: ADULT_SIZES, printPrice: PRINT_PRICE,
    jersey: { main: "#047857", accent: "#facc15", pattern: "sash", number: "11" } },
  { id: 17, name: "Goalkeeper Jersey", price: 7500, category: "jerseys",
    sizes: ADULT_SIZES, printPrice: PRINT_PRICE,
    jersey: { main: "#f59e0b", accent: "#111827", pattern: "hoops", number: "1" } },
  { id: 18, name: "Kids Football Kit", price: 4900, category: "jerseys",
    sizes: KIDS_SIZES, printPrice: PRINT_PRICE,
    jersey: { main: "#db2777", accent: "#ffffff", pattern: "plain", number: "5" } },

  // Everything else
  { id: 1, name: "Classic T-Shirt", price: 1980, category: "clothes", emoji: "👕" },
  { id: 2, name: "Denim Jeans", price: 4980, category: "clothes", emoji: "👖" },
  { id: 3, name: "Winter Jacket", price: 8900, category: "clothes", emoji: "🧥" },
  { id: 4, name: "Running Shoes", price: 6500, category: "shoes", emoji: "👟", badge: "Popular" },
  { id: 5, name: "Leather Boots", price: 9800, category: "shoes", emoji: "🥾" },
  { id: 6, name: "Dress Shoes", price: 7480, category: "shoes", emoji: "👞" },
  { id: 7, name: "Wireless Headphones", price: 12800, category: "electronics", emoji: "🎧" },
  { id: 8, name: "Smart Watch", price: 19800, category: "electronics", emoji: "⌚" },
  { id: 9, name: "Bluetooth Speaker", price: 5980, category: "electronics", emoji: "🔊" },
  { id: 10, name: "Backpack", price: 3980, category: "accessories", emoji: "🎒" },
  { id: 11, name: "Sunglasses", price: 2480, category: "accessories", emoji: "🕶️" },
  { id: 12, name: "Cap", price: 1580, category: "accessories", emoji: "🧢" },
];

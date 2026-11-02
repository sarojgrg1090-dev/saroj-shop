// ===== 1. PRODUCT DATA =====
// Products come from the backend: GET /api/products (see server.js + products.js)
// Shipping rules (SHIPPING, getShippingInfo) come from shipping.js — the server uses the same file.
let products = [];

const CATEGORY_LABELS = {
  jerseys: "Football Jersey",
  clothes: "Clothes",
  shoes: "Shoes",
  electronics: "Electronics",
  accessories: "Accessories",
};

// ===== 2. STATE (data that changes while using the site) =====
let cart = []; // [{ id: 1, qty: 2 }, ...] — loaded after products arrive
let currentCategory = "all";
let searchText = "";

// ===== 3. GET HTML ELEMENTS =====
const productGrid = document.getElementById("productGrid");
const noResults = document.getElementById("noResults");
const searchInput = document.getElementById("search");
const filters = document.getElementById("filters");
const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const cartPanel = document.getElementById("cart");
const overlay = document.getElementById("overlay");
const closeCartBtn = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const modal = document.getElementById("checkoutModal");
const closeModalBtn = document.getElementById("closeModal");
const checkoutForm = document.getElementById("checkoutForm");
const deliveryFields = document.getElementById("deliveryFields");
const pickupFields = document.getElementById("pickupFields");
const pickupDate = document.getElementById("pickupDate");
const countrySelect = document.getElementById("countrySelect");
const shippingInfo = document.getElementById("shippingInfo");
const postalInput = document.getElementById("postalInput");
const postalLabel = document.getElementById("postalLabel");
const addressInput = document.getElementById("addressInput");
const sumSubtotal = document.getElementById("sumSubtotal");
const sumShipping = document.getElementById("sumShipping");
const sumTotal = document.getElementById("sumTotal");
const shippingNote = document.getElementById("shippingNote");
const successMsg = document.getElementById("successMsg");
const orderNumber = document.getElementById("orderNumber");
const orderDetails = document.getElementById("orderDetails");
const continueBtn = document.getElementById("continueBtn");
const toast = document.getElementById("toast");
const heroJersey = document.getElementById("heroJersey");
const heroPrice = document.getElementById("heroPrice");
const jerseyFan = document.getElementById("jerseyFan");
const shippingCards = document.getElementById("shippingCards");

// ===== 4. HELPERS =====
function formatPrice(amount) {
  return "¥" + amount.toLocaleString("ja-JP"); // 12800 -> ¥12,800
}

function findProduct(id) {
  return products.find((p) => p.id === id);
}

function getSubtotal() {
  return cart.reduce((sum, item) => sum + findProduct(item.id).price * item.qty, 0);
}

// Pickup is always free. Delivery depends on the country (see shipping.js).
function getShipping(method, country) {
  if (method === "pickup") return 0;
  return getShippingInfo(country, getSubtotal()).fee;
}

// Date -> "2026-11-04" (the format <input type="date"> uses), in local time
function toDateValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// localStorage keeps the cart even after you refresh the page
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("cart")) || [];
    return saved.filter((item) => findProduct(item.id)); // ignore unknown products
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } catch {
    // storage not available (e.g. private mode) — cart still works until refresh
  }
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// ===== 5. JERSEY PICTURES (drawn with SVG code, no image files needed) =====
let svgCount = 0; // every SVG on the page needs its own ids

function jerseySvg({ main, accent, pattern, number }) {
  const id = "jersey" + ++svgCount;
  const shape =
    "M70 22 L44 30 L12 58 L32 92 L52 80 L52 182 L148 182 L148 80 L168 92 L188 58 L156 30 L130 22 Q100 44 70 22 Z";

  let design = "";
  if (pattern === "stripes") {
    for (let x = 4; x < 200; x += 22) design += `<rect x="${x}" y="0" width="11" height="200" fill="${accent}"/>`;
  } else if (pattern === "hoops") {
    for (let y = 60; y < 200; y += 28) design += `<rect x="0" y="${y}" width="200" height="13" fill="${accent}"/>`;
  } else if (pattern === "sash") {
    design = `<path d="M28 20 L72 20 L192 190 L148 190 Z" fill="${accent}"/>`;
  }
  const numberColor = pattern === "plain" ? accent : "#ffffff";

  return `
    <svg class="jersey-svg" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id="${id}-clip"><path d="${shape}"/></clipPath>
        <linearGradient id="${id}-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
          <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${id}-clip)">
        <rect width="200" height="200" fill="${main}"/>
        ${design}
        <path d="M12 58 L32 92 M188 58 L168 92" stroke="${accent}" stroke-width="12"/>
        <rect width="200" height="200" fill="url(#${id}-shade)"/>
      </g>
      <path d="M70 22 Q100 44 130 22" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
      <path d="${shape}" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="2"/>
      <text x="100" y="142" text-anchor="middle" font-family="Syne, sans-serif" font-weight="800"
        font-size="54" fill="${numberColor}" stroke="${main}" stroke-width="4" paint-order="stroke">${number}</text>
    </svg>`;
}

// Jerseys get a drawn picture, everything else an emoji
function productImage(p) {
  return p.jersey ? jerseySvg(p.jersey) : `<span class="product-emoji">${p.emoji}</span>`;
}

// ===== 6. SHOW PRODUCTS =====
function renderProducts() {
  const filtered = products.filter((p) => {
    const matchCategory = currentCategory === "all" || p.category === currentCategory;
    const matchSearch = p.name.toLowerCase().includes(searchText);
    return matchCategory && matchSearch;
  });

  productGrid.innerHTML = filtered
    .map(
      (p, index) => `
      <article class="product-card" style="--i: ${index}">
        <div class="product-img cat-${p.category}">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
          ${productImage(p)}
        </div>
        <div class="product-body">
          <span class="product-category">${CATEGORY_LABELS[p.category]}</span>
          <h3>${p.name}</h3>
          <div class="product-footer">
            <span class="price">${formatPrice(p.price)}</span>
            <button class="add-btn" data-id="${p.id}" aria-label="Add ${p.name} to cart">+ Add</button>
          </div>
        </div>
      </article>`
    )
    .join("");

  noResults.hidden = filtered.length > 0;
}

function setCategory(category) {
  currentCategory = category;
  document.querySelectorAll(".filter").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
  renderProducts();
}

// Hero card + football banner use the jersey products
function renderJerseyShowcase() {
  const jerseys = products.filter((p) => p.jersey);
  if (jerseys.length === 0) return;

  heroJersey.innerHTML = jerseySvg(jerseys[0].jersey);
  heroPrice.textContent = "from " + formatPrice(Math.min(...jerseys.map((p) => p.price)));
  jerseyFan.innerHTML = jerseys
    .slice(0, 3)
    .map((p, i) => `<div class="fan-item fan-${i + 1}">${jerseySvg(p.jersey)}</div>`)
    .join("");
}

// ===== 7. SHIPPING (worldwide) =====
function renderShippingCards() {
  const { domestic, zones, internationalFreeOver } = SHIPPING;
  const cards = [
    { icon: "🇯🇵", title: "Japan", fee: domestic.fee, days: domestic.days, note: `Free over ${formatPrice(domestic.freeOver)}` },
    ...Object.values(zones).map((zone) => ({
      icon: zone.icon,
      title: zone.label,
      fee: zone.fee,
      days: zone.days,
      note: `Free over ${formatPrice(internationalFreeOver)}`,
    })),
    { icon: "🏪", title: "Store Pickup", fee: 0, days: "From tomorrow", note: "Shinjuku & Shibuya, Tokyo" },
  ];

  shippingCards.innerHTML = cards
    .map(
      (c) => `
      <div class="ship-card">
        <span class="ship-icon">${c.icon}</span>
        <h3>${c.title}</h3>
        <p class="ship-fee">${c.fee === 0 ? "Free" : formatPrice(c.fee)}</p>
        <p class="ship-days">${c.days}</p>
        <p class="ship-note">${c.note}</p>
      </div>`
    )
    .join("");

  const countryTotal = Object.keys(SHIPPING.countries).length - 1; // not counting Japan
  document.querySelectorAll(".country-count").forEach((el) => (el.textContent = countryTotal));
}

// Fill the Country dropdown, grouped: Japan / Asia / Rest of the world
function populateCountries() {
  const groups = { domestic: [], asia: [], world: [] };
  for (const [country, zone] of Object.entries(SHIPPING.countries)) {
    groups[zone].push(country);
  }
  const groupLabel = { domestic: "Japan", asia: "Asia", world: "Rest of the world" };

  countrySelect.innerHTML = Object.entries(groups)
    .map(
      ([zone, countries]) =>
        `<optgroup label="${groupLabel[zone]}">${countries.map((c) => `<option>${c}</option>`).join("")}</optgroup>`
    )
    .join("");
}

// ===== 8. CART LOGIC =====
function addToCart(id) {
  const item = cart.find((i) => i.id === id);
  if (item) {
    item.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }
  updateCart();
  showToast(`✅ ${findProduct(id).name} added to cart`);

  // little "bump" animation on the cart number
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth; // restart the animation
  cartCount.classList.add("bump");
}

function changeQty(id, change) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += change;
  if (item.qty <= 0) removeFromCart(id);
  else updateCart();
}

function removeFromCart(id) {
  cart = cart.filter((i) => i.id !== id);
  updateCart();
}

function updateCart() {
  saveCart();

  // badge number on the cart button
  cartCount.textContent = cart.reduce((sum, i) => sum + i.qty, 0);

  if (cart.length === 0) {
    cartItems.innerHTML = `<p class="empty">Your cart is empty 🛒</p>`;
  } else {
    cartItems.innerHTML = cart
      .map((item) => {
        const p = findProduct(item.id);
        return `
        <div class="cart-item">
          <span class="cart-item-thumb cat-${p.category}">${productImage(p)}</span>
          <div class="cart-item-info">
            <h4>${p.name}</h4>
            <p>${formatPrice(p.price)} × ${item.qty} = ${formatPrice(p.price * item.qty)}</p>
            <div class="qty">
              <button data-action="minus" data-id="${p.id}" aria-label="One less">−</button>
              <span>${item.qty}</span>
              <button data-action="plus" data-id="${p.id}" aria-label="One more">+</button>
            </div>
          </div>
          <button class="remove-btn" data-action="remove" data-id="${p.id}">Remove</button>
        </div>`;
      })
      .join("");
  }

  cartTotal.textContent = formatPrice(getSubtotal());
  checkoutBtn.disabled = cart.length === 0;

  // "Add ¥X more for free delivery" message (Japan)
  const remaining = SHIPPING.domestic.freeOver - getSubtotal();
  if (cart.length === 0) {
    shippingNote.textContent = "";
  } else if (remaining > 0) {
    shippingNote.textContent = `Add ${formatPrice(remaining)} more for free delivery in Japan 🚚`;
  } else {
    shippingNote.textContent = "🎉 You get free delivery in Japan!";
  }
}

function openCart() {
  cartPanel.classList.add("open");
  overlay.classList.add("show");
}

function closeCart() {
  cartPanel.classList.remove("open");
  overlay.classList.remove("show");
}

// ===== 9. CHECKOUT =====
function getMethod() {
  return checkoutForm.elements.fulfillment.value; // "delivery" or "pickup"
}

// Show the right fields and prices for the chosen method and country
function updateCheckout() {
  const method = getMethod();
  const isPickup = method === "pickup";

  deliveryFields.hidden = isPickup;
  deliveryFields.disabled = isPickup;
  pickupFields.hidden = !isPickup;
  pickupFields.disabled = !isPickup;

  const country = countrySelect.value;
  const isJapan = country === "Japan";
  const info = getShippingInfo(country, getSubtotal());

  // Japanese postal codes have a fixed format. Other countries vary (some have none).
  postalLabel.textContent = isJapan ? "Postal Code" : "Postal / ZIP Code (optional)";
  postalInput.placeholder = isJapan ? "123-4567" : "e.g. 44600";
  postalInput.required = isJapan;
  if (isJapan) postalInput.setAttribute("pattern", "\\d{3}-?\\d{4}");
  else postalInput.removeAttribute("pattern");
  addressInput.placeholder = isJapan ? "Prefecture, city, street, building" : "Street, city, state / province";

  shippingInfo.textContent =
    `${info.international ? "✈️ International" : "🚚 Japan"} · ${info.days} · ` +
    `${info.fee === 0 ? "free shipping 🎉" : formatPrice(info.fee)} (free over ${formatPrice(info.freeOver)})`;

  const subtotal = getSubtotal();
  const shipping = getShipping(method, country);
  sumSubtotal.textContent = formatPrice(subtotal);
  sumShipping.textContent = shipping === 0 ? "Free" : formatPrice(shipping);
  sumTotal.textContent = formatPrice(subtotal + shipping);
}

function openCheckout() {
  closeCart();
  // Pickup is possible from tomorrow up to 2 weeks ahead
  pickupDate.min = toDateValue(daysFromToday(1));
  pickupDate.max = toDateValue(daysFromToday(14));
  updateCheckout();
  checkoutForm.hidden = false;
  successMsg.hidden = true;
  modal.hidden = false;
}

function closeCheckout() {
  modal.hidden = true;
}

// ===== 10. EVENT LISTENERS =====
// One listener on the grid handles every "Add" button (event delegation)
productGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (btn) addToCart(Number(btn.dataset.id));
});

cartItems.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "plus") changeQty(id, 1);
  if (btn.dataset.action === "minus") changeQty(id, -1);
  if (btn.dataset.action === "remove") removeFromCart(id);
});

searchInput.addEventListener("input", (e) => {
  searchText = e.target.value.trim().toLowerCase();
  renderProducts();
});

filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (btn) setCategory(btn.dataset.category);
});

// Category tiles and "Shop Jerseys" buttons: filter + scroll to the products
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-goto-category]");
  if (!btn) return;
  setCategory(btn.dataset.gotoCategory);
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});

cartBtn.addEventListener("click", openCart);
closeCartBtn.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
checkoutBtn.addEventListener("click", openCheckout);
closeModalBtn.addEventListener("click", closeCheckout);
continueBtn.addEventListener("click", closeCheckout);

checkoutForm.addEventListener("change", (e) => {
  if (e.target.name === "fulfillment" || e.target.name === "country") updateCheckout();
});

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // stop the page from reloading

  const data = new FormData(checkoutForm); // fields in a disabled fieldset are left out
  const method = data.get("fulfillment");

  // The order we send to the backend. Only ids + quantities — no prices!
  const order = {
    customer: { name: data.get("name"), email: data.get("email"), phone: data.get("phone") },
    fulfillment: method,
    delivery: { country: data.get("country"), postal: data.get("postal"), address: data.get("address") },
    pickup: { store: data.get("store"), date: data.get("pickupDate"), time: data.get("pickupTime") },
    items: cart.map((item) => ({ id: item.id, qty: item.qty })),
  };

  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Placing order...";

  let result;
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    result = await res.json();
    if (!res.ok) {
      alert("Could not place order:\n" + result.errors.join("\n"));
      return;
    }
  } catch {
    alert("Could not reach the server. Please try again.");
    return;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Place Order";
  }

  // The order number and total come from the server
  orderNumber.textContent = result.orderNumber;

  if (method === "pickup") {
    orderDetails.textContent =
      `🏪 Pick up at ${data.get("store")} on ${data.get("pickupDate")}, ${data.get("pickupTime")}. ` +
      `Total: ${formatPrice(result.total)}`;
  } else {
    const { days } = getShippingInfo(data.get("country"), 0);
    orderDetails.textContent =
      `🚚 Delivering to ${data.get("address")}, ${data.get("country")} in ${days}. ` +
      `Total: ${formatPrice(result.total)}`;
  }

  cart = [];
  updateCart();
  checkoutForm.reset();
  checkoutForm.hidden = true;
  successMsg.hidden = false;
});

// Close cart / popup with the Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCart();
    closeCheckout();
  }
});

// ===== 11. SCROLL ANIMATIONS =====
// Elements with class="reveal" fade in when you scroll to them
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// ===== 12. START =====
async function start() {
  populateCountries();
  renderShippingCards();

  try {
    const res = await fetch("/api/products");
    products = await res.json();
  } catch {
    productGrid.innerHTML = `<p class="no-results">Could not load products. Is the server running? (npm start)</p>`;
    return;
  }
  cart = loadCart(); // needs products, so it runs after they load
  renderProducts();
  renderJerseyShowcase();
  updateCart();
}

start();

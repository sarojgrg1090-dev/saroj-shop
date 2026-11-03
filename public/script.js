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

// Name + number printed on a jersey (same rule as server.js)
const PRINT_NAME_PATTERN = /^[A-Z .'-]{1,12}$/;
const PRINT_NUMBER_PATTERN = /^\d{1,2}$/;

// ===== 2. STATE (data that changes while using the site) =====
// cart: [{ id: 13, qty: 1, size: "M", printName: "SAROJ", printNumber: "10" }, ...]
let cart = []; // loaded after products arrive
let currentCategory = "all";
let searchText = "";
let paymentsEnabled = false; // true when the server has Stripe turned on
let optionsProduct = null; // the jersey open in the options popup

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
const paymentNote = document.getElementById("paymentNote");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const optionsModal = document.getElementById("optionsModal");
const optionsForm = document.getElementById("optionsForm");
const optionsPreview = document.getElementById("optionsPreview");
const previewLabel = document.getElementById("previewLabel");
const optionsName = document.getElementById("optionsName");
const sizeOptions = document.getElementById("sizeOptions");
const printToggle = document.getElementById("printToggle");
const printPriceLabel = document.getElementById("printPriceLabel");
const printFields = document.getElementById("printFields");
const printName = document.getElementById("printName");
const printNumber = document.getElementById("printNumber");
const optionsAddBtn = document.getElementById("optionsAddBtn");
const closeOptionsBtn = document.getElementById("closeOptions");

// ===== 4. HELPERS =====
function formatPrice(amount) {
  return "¥" + amount.toLocaleString("ja-JP"); // 12800 -> ¥12,800
}

function findProduct(id) {
  return products.find((p) => p.id === id);
}

// Price of ONE item, including printing
function unitPrice(item) {
  const p = findProduct(item.id);
  return p.price + (item.printName ? p.printPrice : 0);
}

function getSubtotal() {
  return cart.reduce((sum, item) => sum + unitPrice(item) * item.qty, 0);
}

// The same jersey in size M and size L are different cart lines
function cartKey(item) {
  return [item.id, item.size || "", item.printName || "", item.printNumber || ""].join("|");
}

// "Size M · SAROJ #10"
function itemDetails(item) {
  const parts = [];
  if (item.size) parts.push(`Size ${item.size}`);
  if (item.printName) parts.push(`${item.printName} #${item.printNumber}`);
  return parts.join(" · ");
}

// Checks a saved cart item is still OK (products or rules may have changed)
function isValidCartItem(item) {
  const p = findProduct(item.id);
  if (!p || !Number.isInteger(item.qty) || item.qty < 1) return false;
  if (p.sizes && !p.sizes.includes(item.size)) return false;
  if (item.printName || item.printNumber) {
    if (!p.printPrice) return false;
    if (!PRINT_NAME_PATTERN.test(item.printName || "")) return false;
    if (!PRINT_NUMBER_PATTERN.test(item.printNumber || "")) return false;
  }
  return true;
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
    return saved.filter(isValidCartItem); // ignore anything that's no longer valid
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

// back = true draws the back side with the printed name above the number
function jerseySvg({ main, accent, pattern, number }, { back = false, name = "", backNumber = "" } = {}) {
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
  const textStyle = `font-family="Syne, sans-serif" font-weight="800" fill="${numberColor}" stroke="${main}" paint-order="stroke"`;

  // Front: curved collar + number. Back: flat collar + name + bigger number.
  const collar = back ? "M70 22 Q100 30 130 22" : "M70 22 Q100 44 130 22";
  const print = back
    ? `<text x="100" y="86" text-anchor="middle" font-size="17" letter-spacing="1.5" stroke-width="3" ${textStyle}>${name}</text>
       <text x="100" y="154" text-anchor="middle" font-size="64" stroke-width="4" ${textStyle}>${backNumber}</text>`
    : `<text x="100" y="142" text-anchor="middle" font-size="54" stroke-width="4" ${textStyle}>${number}</text>`;

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
      <path d="${collar}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
      <path d="${shape}" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="2"/>
      ${print}
    </svg>`;
}

// Jerseys get a drawn picture, everything else an emoji.
// A cart item with printing shows the back with its name + number.
function productImage(p, item) {
  if (!p.jersey) return `<span class="product-emoji">${p.emoji}</span>`;
  if (item?.printName) {
    return jerseySvg(p.jersey, { back: true, name: item.printName, backNumber: item.printNumber });
  }
  return jerseySvg(p.jersey);
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
// choice = { id } or { id, size, printName, printNumber }
function addToCart(choice) {
  const item = cart.find((i) => cartKey(i) === cartKey(choice));
  if (item) {
    item.qty++;
  } else {
    cart.push({ ...choice, qty: 1 });
  }
  updateCart();
  showToast(`✅ ${findProduct(choice.id).name} added to cart`);

  // little "bump" animation on the cart number
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth; // restart the animation
  cartCount.classList.add("bump");
}

function changeQty(key, change) {
  const item = cart.find((i) => cartKey(i) === key);
  if (!item) return;
  item.qty += change;
  if (item.qty <= 0) removeFromCart(key);
  else updateCart();
}

function removeFromCart(key) {
  cart = cart.filter((i) => cartKey(i) !== key);
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
        const key = cartKey(item);
        const details = itemDetails(item);
        return `
        <div class="cart-item">
          <span class="cart-item-thumb cat-${p.category}">${productImage(p, item)}</span>
          <div class="cart-item-info">
            <h4>${p.name}</h4>
            ${details ? `<p class="cart-item-details">${details}</p>` : ""}
            <p>${formatPrice(unitPrice(item))} × ${item.qty} = ${formatPrice(unitPrice(item) * item.qty)}</p>
            <div class="qty">
              <button data-action="minus" data-key="${key}" aria-label="One less">−</button>
              <span>${item.qty}</span>
              <button data-action="plus" data-key="${key}" aria-label="One more">+</button>
            </div>
          </div>
          <button class="remove-btn" data-action="remove" data-key="${key}">Remove</button>
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

// ===== 9. JERSEY OPTIONS POPUP (size + name/number) =====
function openOptions(product) {
  optionsProduct = product;
  optionsName.textContent = product.name;
  printPriceLabel.textContent = "+" + formatPrice(product.printPrice);

  sizeOptions.innerHTML = product.sizes
    .map(
      (size) => `
      <label class="size-chip">
        <input type="radio" name="size" value="${size}" required>
        <span>${size}</span>
      </label>`
    )
    .join("");

  optionsForm.reset();
  printNumber.value = product.jersey.number; // start with the jersey's own number
  updateOptions();
  optionsModal.hidden = false;
}

function closeOptions() {
  optionsModal.hidden = true;
}

// Redraw the preview and price whenever something changes
function updateOptions() {
  const printing = printToggle.checked;
  printFields.hidden = !printing;
  printName.required = printing;
  printNumber.required = printing;

  optionsPreview.innerHTML = printing
    ? jerseySvg(optionsProduct.jersey, { back: true, name: printName.value, backNumber: printNumber.value })
    : jerseySvg(optionsProduct.jersey);
  previewLabel.textContent = printing ? "Back — your name & number" : "Front";

  const price = optionsProduct.price + (printing ? optionsProduct.printPrice : 0);
  optionsAddBtn.textContent = `Add to Cart — ${formatPrice(price)}`;
}

optionsForm.addEventListener("input", (e) => {
  // Only allow what can be printed: A–Z, space, . ' -  and numbers 0–99
  if (e.target === printName) {
    printName.value = printName.value.toUpperCase().replace(/[^A-Z .'-]/g, "").replace(/^\s+/, "");
  }
  if (e.target === printNumber) {
    printNumber.value = printNumber.value.replace(/\D/g, "");
  }
  updateOptions();
});

optionsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const choice = { id: optionsProduct.id, size: optionsForm.elements.size.value };
  if (printToggle.checked) {
    choice.printName = printName.value.trim();
    choice.printNumber = String(Number(printNumber.value)); // "07" -> "7"
  }
  addToCart(choice);
  closeOptions();
});

closeOptionsBtn.addEventListener("click", closeOptions);

// ===== 10. CHECKOUT =====
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

  paymentNote.hidden = !paymentsEnabled;
  placeOrderBtn.textContent = paymentsEnabled ? "Continue to Payment →" : "Place Order";
}

// The "Thank you" message. order comes from the server.
function showOrderSuccess(order) {
  orderNumber.textContent = order.orderNumber;
  const paidText = order.paid ? " 💳 Paid by card." : "";

  if (order.fulfillment === "pickup") {
    orderDetails.textContent =
      `🏪 Pick up at ${order.store} on ${order.pickupDate}, ${order.pickupTime}. ` +
      `Total: ${formatPrice(order.total)}.${paidText}`;
  } else {
    const { days } = getShippingInfo(order.country, 0);
    orderDetails.textContent =
      `🚚 Delivering to ${order.address}, ${order.country} in ${days}. ` +
      `Total: ${formatPrice(order.total)}.${paidText}`;
  }

  cart = [];
  updateCart();
  checkoutForm.reset();
  checkoutForm.hidden = true;
  successMsg.hidden = false;
  modal.hidden = false;
}

// Coming back from Stripe's payment page: ?payment=success&session_id=... or ?payment=cancelled
async function handlePaymentReturn() {
  const params = new URLSearchParams(location.search);
  const payment = params.get("payment");
  if (!payment) return;
  history.replaceState(null, "", location.pathname); // clean up the address bar

  if (payment === "cancelled") {
    showToast("Payment cancelled — your cart is still here 🛒");
    return;
  }

  try {
    // Ask OUR server (which asks Stripe) if the payment really happened
    const res = await fetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: params.get("session_id") }),
    });
    const result = await res.json();
    if (!res.ok) {
      alert("Payment problem:\n" + result.errors.join("\n"));
      return;
    }
    showOrderSuccess(result.order);
  } catch {
    alert("Could not check your payment. Please contact us at sarojshop1020@gmail.com.");
  }
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

// ===== 11. EVENT LISTENERS =====
// One listener on the grid handles every "Add" button (event delegation).
// Jerseys open the options popup first (size + printing).
productGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (!btn) return;
  const product = findProduct(Number(btn.dataset.id));
  if (product.sizes) openOptions(product);
  else addToCart({ id: product.id });
});

cartItems.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const key = btn.dataset.key;
  if (btn.dataset.action === "plus") changeQty(key, 1);
  if (btn.dataset.action === "minus") changeQty(key, -1);
  if (btn.dataset.action === "remove") removeFromCart(key);
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
    // Only ids, quantities and choices — no prices! The server works out the prices.
    items: cart.map((item) => ({
      id: item.id,
      qty: item.qty,
      size: item.size,
      printName: item.printName,
      printNumber: item.printNumber,
    })),
  };

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = paymentsEnabled ? "Opening payment..." : "Placing order...";

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
    placeOrderBtn.disabled = false;
    updateCheckout(); // puts the button text back
  }

  if (result.checkoutUrl) {
    // Go to Stripe's secure card page. The cart stays saved until the payment is confirmed.
    location.href = result.checkoutUrl;
    return;
  }
  showOrderSuccess(result.order);
});

// Close popups with the Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCart();
    closeCheckout();
    closeOptions();
  }
});

// ===== 12. SCROLL ANIMATIONS =====
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

// ===== 13. START =====
async function start() {
  populateCountries();
  renderShippingCards();

  try {
    const [productsRes, configRes] = await Promise.all([fetch("/api/products"), fetch("/api/config")]);
    products = await productsRes.json();
    paymentsEnabled = (await configRes.json()).payments === "stripe";
  } catch {
    productGrid.innerHTML = `<p class="no-results">Could not load products. Is the server running? (npm start)</p>`;
    return;
  }
  cart = loadCart(); // needs products, so it runs after they load
  renderProducts();
  renderJerseyShowcase();
  updateCart();
  handlePaymentReturn(); // did we just come back from Stripe?
}

start();

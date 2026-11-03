// ===== ADMIN PAGE: see orders and change their status =====
const STATUSES = ["pending_payment", "received", "preparing", "ready", "shipped", "completed", "cancelled"];

const ordersList = document.getElementById("orders");
const statOrders = document.getElementById("statOrders");
const statNew = document.getElementById("statNew");
const statSales = document.getElementById("statSales");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const orderTabs = document.getElementById("orderTabs");

// Which orders each tab shows
const TABS = {
  active: (o) => o.status !== "completed" && o.status !== "cancelled",
  completed: (o) => o.status === "completed",
  cancelled: (o) => o.status === "cancelled",
  all: () => true,
};

let allOrders = []; // every order from the server
let currentTab = "active";

// Login expired or missing → back to the login page
function goToLogin() {
  location.href = "/login.html";
}

function formatPrice(amount) {
  return "¥" + amount.toLocaleString("ja-JP");
}

// Customers type these values, so make them safe before putting them into HTML
// (otherwise someone could type <script> in their name and run code here)
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text ?? "").replace(/[&<>"']/g, (ch) => map[ch]);
}

function renderOrder(order) {
  const where =
    order.fulfillment === "pickup"
      ? `🏪 Pickup · ${escapeHtml(order.store)} · ${escapeHtml(order.pickup_date)} ${escapeHtml(order.pickup_time)}`
      : `🚚 Delivery · ${escapeHtml(order.country || "Japan")} · ${escapeHtml(order.postal || "")} ${escapeHtml(order.address)}`;

  const items = order.items
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.qty} <span>${formatPrice(i.price * i.qty)}</span></li>`)
    .join("");

  const options = STATUSES.map(
    (s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`
  ).join("");

  return `
    <div class="order-card">
      <div class="order-top">
        <strong>${escapeHtml(order.order_number)}</strong>
        <span>
          ${order.paid ? `<span class="badge status-completed">💳 Paid</span>` : ""}
          <span class="badge status-${order.status}">${order.status.replace("_", " ")}</span>
        </span>
      </div>
      <p class="order-meta">${escapeHtml(order.created_at)}</p>
      <p>👤 ${escapeHtml(order.name)} · ${escapeHtml(order.email)} · ${escapeHtml(order.phone)}</p>
      <p>${where}</p>
      <ul class="order-items">${items}</ul>
      <div class="order-bottom">
        <span>Shipping ${order.shipping === 0 ? "Free" : formatPrice(order.shipping)} ·
          Total <strong>${formatPrice(order.total)}</strong></span>
        <select data-id="${order.id}" aria-label="Order status">${options}</select>
      </div>
    </div>`;
}

// Show only the orders of the chosen tab, and the count on every tab
function renderOrders() {
  orderTabs.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === currentTab);
    btn.querySelector(".tab-count").textContent = allOrders.filter(TABS[btn.dataset.tab]).length;
  });

  const shown = allOrders.filter(TABS[currentTab]);
  if (shown.length > 0) {
    ordersList.innerHTML = shown.map(renderOrder).join("");
  } else if (allOrders.length === 0) {
    ordersList.innerHTML = `<p class="empty">No orders yet. Place one in the shop!</p>`;
  } else {
    ordersList.innerHTML = `<p class="empty">No ${currentTab} orders.</p>`;
  }
}

async function loadOrders() {
  try {
    const res = await fetch("/api/orders");
    if (res.status === 401) return goToLogin();
    allOrders = await res.json();
  } catch {
    ordersList.innerHTML = `<p class="empty">Could not load orders. Is the server running?</p>`;
    return;
  }

  statOrders.textContent = allOrders.length;
  statNew.textContent = allOrders.filter((o) => o.status === "received").length;
  statSales.textContent = formatPrice(
    allOrders
      .filter((o) => o.status !== "cancelled" && o.status !== "pending_payment") // not paid = not a sale yet
      .reduce((sum, o) => sum + o.total, 0)
  );

  renderOrders();
}

orderTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  currentTab = btn.dataset.tab;
  renderOrders();
});

// Change status → send it to the backend → reload the list
ordersList.addEventListener("change", async (e) => {
  const select = e.target.closest("select[data-id]");
  if (!select) return;
  const res = await fetch(`/api/orders/${select.dataset.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: select.value }),
  });
  if (res.status === 401) return goToLogin();
  loadOrders();
});

refreshBtn.addEventListener("click", loadOrders);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  goToLogin();
});

loadOrders();

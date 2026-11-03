// ===== ADMIN PAGE: see orders and change their status =====
const STATUSES = ["pending_payment", "received", "preparing", "ready", "shipped", "completed", "cancelled"];

const ordersList = document.getElementById("orders");
const statOrders = document.getElementById("statOrders");
const statNew = document.getElementById("statNew");
const statSales = document.getElementById("statSales");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

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

async function loadOrders() {
  let orders;
  try {
    const res = await fetch("/api/orders");
    if (res.status === 401) return goToLogin();
    orders = await res.json();
  } catch {
    ordersList.innerHTML = `<p class="empty">Could not load orders. Is the server running?</p>`;
    return;
  }

  statOrders.textContent = orders.length;
  statNew.textContent = orders.filter((o) => o.status === "received").length;
  statSales.textContent = formatPrice(
    orders
      .filter((o) => o.status !== "cancelled" && o.status !== "pending_payment") // not paid = not a sale yet
      .reduce((sum, o) => sum + o.total, 0)
  );

  ordersList.innerHTML = orders.length
    ? orders.map(renderOrder).join("")
    : `<p class="empty">No orders yet. Place one in the shop!</p>`;
}

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

// ===== ADMIN LOGIN PAGE =====
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

// Already logged in? Go straight to the admin page.
fetch("/api/admin/me").then((res) => {
  if (res.ok) location.href = "/admin.html";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const data = new FormData(loginForm);
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
    });

    if (res.ok) {
      location.href = "/admin.html"; // the server set the login cookie
      return;
    }

    const result = await res.json();
    loginError.textContent = result.errors.join(" ");
  } catch {
    loginError.textContent = "Could not reach the server.";
  } finally {
    submitBtn.disabled = false;
  }

  loginError.hidden = false;
  loginForm.password.value = "";
  loginForm.password.focus();
});

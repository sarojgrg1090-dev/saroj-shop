// ===== SHIPPING RULES =====
// This ONE file is used by both the browser (index.html) and the server (server.js),
// so prices shown to customers and prices charged are always the same.

const SHIPPING = {
  domestic: { fee: 500, freeOver: 5000, days: "2–3 days" },
  zones: {
    asia: { label: "Asia", icon: "🌏", fee: 2000, days: "5–7 days" },
    world: { label: "Rest of the world", icon: "🌍", fee: 3500, days: "7–14 days" },
  },
  internationalFreeOver: 30000,

  // country -> "domestic", "asia" or "world"
  countries: {
    "Japan": "domestic",
    "Nepal": "asia",
    "India": "asia",
    "Bangladesh": "asia",
    "Sri Lanka": "asia",
    "China": "asia",
    "Hong Kong": "asia",
    "Taiwan": "asia",
    "South Korea": "asia",
    "Thailand": "asia",
    "Vietnam": "asia",
    "Philippines": "asia",
    "Malaysia": "asia",
    "Singapore": "asia",
    "Indonesia": "asia",
    "Australia": "world",
    "New Zealand": "world",
    "United States": "world",
    "Canada": "world",
    "United Kingdom": "world",
    "France": "world",
    "Germany": "world",
    "Italy": "world",
    "Spain": "world",
    "Brazil": "world",
    "United Arab Emirates": "world",
    "Qatar": "world",
  },
};

// Returns { fee, days, freeOver, international } for a country, or null if we don't ship there
function getShippingInfo(country, subtotal) {
  const zone = SHIPPING.countries[country];
  if (!zone) return null;

  if (zone === "domestic") {
    const { fee, freeOver, days } = SHIPPING.domestic;
    return { fee: subtotal >= freeOver ? 0 : fee, days, freeOver, international: false };
  }

  const { fee, days } = SHIPPING.zones[zone];
  const freeOver = SHIPPING.internationalFreeOver;
  return { fee: subtotal >= freeOver ? 0 : fee, days, freeOver, international: true };
}

// Lets server.js use this file with require()
if (typeof module !== "undefined") {
  module.exports = { SHIPPING, getShippingInfo };
}

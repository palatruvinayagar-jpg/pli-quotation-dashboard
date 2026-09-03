# PLI Quotation Dashboard

Postal Life Insurance (PLI) — Endowment Assurance quotation tool.

This is a mobile-first web app that calculates PLI premiums and maturity values using the exact factor tables provided. It enforces separation of factor tables by frequency (Monthly, Quarterly, Half-Yearly, Yearly) and performs reverse-quotation to find the nearest Sum Assured that meets or exceeds the customer's budget.

Features
- Four separate factor tables (monthly, quarterly, half-yearly, yearly).
- Premium calculation strictly follows the formula:
  - Premium = (SA ÷ 5,000) × Factor − Rebate
  - Rebate = SA ÷ 20,000
  - Final premium rounded UP to next rupee.
- Maturity value calculated with an annual bonus of ₹52 per ₹1,000 SA per year.
- Reverse quotation: scans SA from ₹20,000 to ₹50,00,000 in ₹10,000 steps and selects the first premium ≥ customer budget.
- Adviser profile stored in localStorage (default password: `Issr`). Adviser details are NOT included in customer sharing.
- WhatsApp share (text) and image generation (download) supported.

Run locally

1. Clone the repo:

```

git clone https://github.com/palatruvinayagar-jpg/pli-quotation-dashboard.git
cd pli-quotation-dashboard
```

2. Serve the site (simple options):

- Python:

```
python3 -m http.server 8080
# then open http://localhost:8080
```

- Node (serve):

```
npx serve .
```

3. Open `index.html` in a browser for quick tests (some sharing features may require serving via HTTP).

Notes
- Do NOT modify the monthly table unless you are intentionally updating it. Do not invent factor values; keep tables separate per frequency.
- If you need UI tweaks, additional fields, or hosting via GitHub Pages, open an issue or request a change.

Disclaimer
This repository contains an indicative calculator for PLI quotations. Final premiums and acceptance are subject to India Post PLI rules and underwriting.

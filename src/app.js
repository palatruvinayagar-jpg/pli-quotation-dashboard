import { FACTOR_TABLES } from './data/factors.js';

// Utility functions (adhere to formulas)
function rebate(sa) {
  return sa / 20000;
}
function rawPremium(sa, factor) {
  return (sa / 5000) * factor - rebate(sa);
}
function premiumRoundedUp(sa, factor) {
  const p = rawPremium(sa, factor);
  // Round UP to next rupee
  return Math.ceil(p);
}
function maturityValue(sa, termYears) {
  // Annual Bonus = (SA ÷ 1,000) × 52
  const totalBonus = (sa / 1000) * 52 * termYears;
  return Math.round(sa + totalBonus);
}

// Get factor safely — prevents mixing frequencies
function getFactor(frequency, entryAge, maturityAge) {
  const table = FACTOR_TABLES[frequency];
  if (!table || Object.keys(table).length === 0) {
    return null; // table not supplied yet
  }
  const entry = table[entryAge];
  if (!entry) return null;
  return entry[maturityAge] ?? null;
}

// Reverse quotation: for each maturity option available for entryAge
function reverseQuotation({frequency, entryAge, budget, preferredMaturity}) {
  const table = FACTOR_TABLES[frequency];
  if (!table || Object.keys(table).length === 0) {
    throw new Error('Factor table for ' + frequency + ' is not populated.');
  }
  const entry = table[entryAge];
  if (!entry) return [];

  const maturities = Object.keys(entry).map(k => parseInt(k)).sort((a,b)=>a-b);
  const results = [];

  maturities.forEach(maturityAge => {
    if (preferredMaturity && parseInt(preferredMaturity) !== maturityAge) {
      // If user specified a preferred maturity age, skip other maturities
      return;
    }
    const factor = getFactor(frequency, entryAge, maturityAge);
    if (factor == null) return; // missing

    // Term years
    const term = maturityAge - entryAge;
    if (term <= 0) return;

    // For SA from 20,000 to 5,000,000 step 10,000
    let chosen = null;
    let nextHigher = null;
    for (let sa = 20000; sa <= 5000000; sa += 10000) {
      const p = premiumRoundedUp(sa, factor);
      if (p >= budget && !chosen) {
        chosen = {sa, premium: p};
        // first such match is the nearest >= budget
      } else if (p > budget && chosen && !nextHigher && p > chosen.premium) {
        // identify next higher valid option (first premium strictly greater than chosen)
        nextHigher = {sa, premium: p};
      }
      if (chosen && nextHigher) break;
    }
    // If budget is lower than smallest premium possible, chosen will be the first >= budget (handled).
    // If no SA produced p >= budget, chosen remains null.
    // Save the row
    results.push({
      maturityAge,
      term,
      factor,
      chosen, // may be null
      nextHigher
    });
  });

  return results;
}

// WhatsApp text generator (customer-only fields)
function makeWhatsAppText({customerName, schemeName='Postal Life Insurance (PLI)', plan='Endowment Assurance', frequencyLabel, maturityAge, termYears, premium, sumAssured, maturityValue}) {
  return [
    'PLI QUOTATION',
    '',
    `Customer Name: ${customerName || '—'}`,
    '',
    'Scheme Name:',
    schemeName,
    '',
    'Plan:',
    plan,
    '',
    'Frequency:',
    frequencyLabel,
    '',
    'Maturity Age:',
    `${maturityAge} Years`,
    '',
    'Policy Term:',
    `${termYears} Years`,
    '',
    `${frequencyLabel} Premium:`,
    `₹${premium}`,
    '',
    'Sum Assured:',
    `₹${sumAssured}`,
    '',
    'Maturity Value:',
    `₹${maturityValue}`
  ].join('\n');
}

/* --- UI wiring --- */
const el = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  // adviser profile load
  const adv = JSON.parse(localStorage.getItem('pli_adviser') || '{}');
  el('advName').value = adv.name || '';
  el('advContact').value = adv.contact || '';
  el('advPassword').value = adv.password || 'Issr';

  el('saveAdv').addEventListener('click', () => {
    const profile = {name: el('advName').value, contact: el('advContact').value, password: el('advPassword').value || 'Issr'};
    localStorage.setItem('pli_adviser', JSON.stringify(profile));
    alert('Adviser profile saved (not included in customer share).');
  });

  // Factor tables viewer
  document.querySelectorAll('[data-table]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = e.target.getAttribute('data-table');
      const table = FACTOR_TABLES[t] || {};
      el('factorsView').textContent = JSON.stringify(table, null, 2);
    });
  });

  // Alternate frequencies buttons
  document.getElementById('alternateFrequencies').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      el('frequency').value = e.target.getAttribute('data-freq');
      // preserve inputs, recalc
      el('calculateBtn').click();
    }
  });

  // Calculate button
  el('calculateBtn').addEventListener('click', () => {
    const customerName = el('custName').value.trim();
    const entryAge = parseInt(el('custAge').value, 10);
    const frequency = el('frequency').value;
    const budget = Number(el('budget').value);
    const preferredMaturity = el('preferredMaturity').value ? parseInt(el('preferredMaturity').value,10) : null;

    if (!customerName || !entryAge || !frequency || !budget) {
      alert('Please fill Customer Name, Age, Frequency, and Budget.');
      return;
    }

    try {
      const rows = reverseQuotation({frequency, entryAge, budget, preferredMaturity});
      // Build table
      const tbody = document.querySelector('#resultTable tbody');
      tbody.innerHTML = '';
      const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
      el('freqLabel').textContent = freqLabel;

      rows.forEach(r => {
        // For display if chosen exists
        const chosen = r.chosen;
        const next = r.nextHigher;
        const maturityVal = chosen ? maturityValue(chosen.sa, r.term) : null;
        const tr = document.createElement('tr');
        const nearestMarker = chosen ? '⭐ NEAREST' : '';
        tr.innerHTML = `
          <td>${r.maturityAge} ${nearestMarker}</td>
          <td>${chosen ? `₹${chosen.premium}` : '—'}</td>
          <td>${chosen ? '₹' + maturityVal : '—'}</td>
          <td>${chosen ? '₹' + chosen.sa : '—'}</td>
        `;
        tbody.appendChild(tr);
      });

      el('results').hidden = false;

      // Prepare share for first found chosen row (if any)
      const firstChosen = rows.find(x=>x.chosen);
      if (firstChosen) {
        const chosen = firstChosen.chosen;
        const termYears = firstChosen.term;
        const maturityVal = maturityValue(chosen.sa, termYears);
        const waText = makeWhatsAppText({
          customerName,
          frequencyLabel: freqLabel,
          maturityAge: firstChosen.maturityAge,
          termYears,
          premium: chosen.premium,
          sumAssured: chosen.sa,
          maturityValue: maturityVal
        });
        el('waText').onclick = () => {
          const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
          window.open(waUrl, '_blank');
        };
        el('copyText').onclick = async () => {
          await navigator.clipboard.writeText(waText);
          alert('Quotation text copied to clipboard.');
        };
        // Image generation (simple canvas)
        el('waImage').onclick = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 800; canvas.height = 1000;
          const ctx = canvas.getContext('2d');
          // background
          ctx.fillStyle = '#fff';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          // header red bar
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--red') || '#c50e19';
          ctx.fillRect(0,0,canvas.width,120);
          // title
          ctx.fillStyle = '#fff';
          ctx.font = '28px sans-serif';
          ctx.fillText('PLI QUOTATION', 24, 70);
          ctx.fillStyle = '#222';
          ctx.font = '18px sans-serif';
          const lines = waText.split('\n');
          let y = 150;
          lines.forEach(line => {
            ctx.fillText(line, 24, y);
            y += 28;
          });
          // download
          canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = el('downloadImage');
            a.href = url;
            a.style.display = 'inline-block';
            a.click();
          });
        };
      } else {
        el('waText').onclick = () => alert('No matching quotation found for the given budget.');
      }

    } catch (err) {
      alert(err.message);
    }
  });

});

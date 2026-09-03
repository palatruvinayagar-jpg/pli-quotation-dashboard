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
      } else if (p > budget && chosen && !nextHigher && p > chosen.premium) {
        nextHigher = {sa, premium: p};
      }
      if (chosen && nextHigher) break;
    }
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

// Generate a professional quotation image as a Blob
async function generateQuotationImage({customerName, schemeName='Postal Life Insurance (PLI)', plan='Endowment Assurance', frequencyLabel, maturityAge, termYears, premium, sumAssured, maturityValue}) {
  const width = 1200; // higher-res for sharing
  const height = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,width,height);

  // header bar
  ctx.fillStyle = '#c50e19';
  ctx.fillRect(0,0,width,160);

  // draw shield image
  const shieldImg = new Image();
  shieldImg.src = 'assets/pli-shield.svg';
  await new Promise((res, rej) => {
    shieldImg.onload = res; shieldImg.onerror = res;
  });
  const sh = 110;
  ctx.drawImage(shieldImg, 48, 24, sh, sh);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PLI QUOTATION', 48 + sh + 24, 64);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('Postal Life Insurance — Endowment Assurance', 48 + sh + 24, 96);

  // card area
  const pad = 48;
  let y = 220;
  ctx.fillStyle = '#f9f7f4';
  const cardW = width - pad*2;
  ctx.fillRect(pad, y, cardW, 980);

  // Customer details
  ctx.fillStyle = '#222';
  ctx.font = '600 20px sans-serif';
  ctx.fillText('Customer Name:', pad + 24, y + 50);
  ctx.font = '18px sans-serif';
  ctx.fillText(customerName || '—', pad + 220, y + 50);

  ctx.font = '600 20px sans-serif';
  ctx.fillText('Frequency:', pad + 24, y + 95);
  ctx.font = '18px sans-serif';
  ctx.fillText(frequencyLabel, pad + 220, y + 95);

  ctx.font = '600 20px sans-serif';
  ctx.fillText('Maturity Age:', pad + 24, y + 140);
  ctx.font = '18px sans-serif';
  ctx.fillText(`${maturityAge} Years`, pad + 220, y + 140);

  ctx.font = '600 20px sans-serif';
  ctx.fillText('Policy Term:', pad + 24, y + 185);
  ctx.font = '18px sans-serif';
  ctx.fillText(`${termYears} Years`, pad + 220, y + 185);

  // Separator
  ctx.strokeStyle = '#e6d9b6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad + 20, y + 220);
  ctx.lineTo(width - pad - 20, y + 220);
  ctx.stroke();

  // Premium block
  ctx.fillStyle = '#fff';
  const boxX = pad + 24;
  let boxY = y + 240;
  const boxH = 120;
  const boxWInner = cardW - 48;
  ctx.fillRect(boxX, boxY, boxWInner, boxH);
  ctx.fillStyle = '#222';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(`${frequencyLabel} Premium`, boxX + 20, boxY + 40);
  ctx.font = '700 28px sans-serif';
  ctx.fillStyle = '#c50e19';
  ctx.fillText(`₹${premium}`, boxX + 20, boxY + 90);

  // Sum Assured box
  const box2Y = boxY + boxH + 24;
  ctx.fillStyle = '#fff';
  ctx.fillRect(boxX, box2Y, boxWInner, boxH);
  ctx.fillStyle = '#222';
  ctx.font = '600 18px sans-serif';
  ctx.fillText('Sum Assured', boxX + 20, box2Y + 40);
  ctx.font = '700 24px sans-serif';
  ctx.fillStyle = '#6b3f00';
  ctx.fillText(`₹${sumAssured}`, boxX + 20, box2Y + 86);

  // Maturity Value box
  const box3Y = box2Y + boxH + 24;
  ctx.fillStyle = '#fff';
  ctx.fillRect(boxX, box3Y, boxWInner, boxH);
  ctx.fillStyle = '#222';
  ctx.font = '600 18px sans-serif';
  ctx.fillText('Maturity Value', boxX + 20, box3Y + 40);
  ctx.font = '700 24px sans-serif';
  ctx.fillStyle = '#0b6623';
  ctx.fillText(`₹${maturityValue}`, boxX + 20, box3Y + 86);

  // Footer note
  ctx.fillStyle = '#444';
  ctx.font = '14px sans-serif';
  ctx.fillText('Indicative quotation only and subject to applicable India Post PLI rules and final acceptance.', pad + 24, y + 980);

  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
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
        const chosen = r.chosen;
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
        el('waImage').onclick = async () => {
          const blob = await generateQuotationImage({
            customerName,
            frequencyLabel: freqLabel,
            maturityAge: firstChosen.maturityAge,
            termYears,
            premium: chosen.premium,
            sumAssured: chosen.sa,
            maturityValue: maturityVal
          });
          // offer download
          const url = URL.createObjectURL(blob);
          const a = el('downloadImage');
          a.href = url;
          a.style.display = 'inline-block';
          a.click();

          // Try Web Share API for images if available
          if (navigator.canShare && navigator.canShare({files: []})) {
            try {
              const file = new File([blob], 'PLI-quotation.png', {type: 'image/png'});
              await navigator.share({files: [file], text: waText});
            } catch (err) {
              // ignore share errors
            }
          }
        };
      } else {
        el('waText').onclick = () => alert('No matching quotation found for the given budget.');
      }

    } catch (err) {
      alert(err.message);
    }
  });

});
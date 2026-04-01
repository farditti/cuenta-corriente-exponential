// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://urlhcfozaexorcxmhffc.supabase.co";
const SUPABASE_KEY = "sb_publishable_15ODb6irQhChPY1dD_Q5Bg_GIDvxZP-";

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

const FREQ_MAP = {
  "Maturity":  "at_maturity",
  "Monthly":   "monthly",
  "Quarterly": "trimestral",
  "Annual":    "annual",
};

// ─── Datos del Excel ──────────────────────────────────────────────────────────
const data = [
  { name: "Carolina Neuberger",        email: null,                          date: "2026-01-01", endDate: "2027-01-01", empresa: "Lucentia",      rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Celia Hanono",              email: "celiaarditti@hotmail.com",    date: "2021-05-23", endDate: "2023-07-22", empresa: "15 Washington", rate: 8,    freq: "Quarterly", amount: 84000  },
  { name: "Celia Hanono",              email: "celiaarditti@hotmail.com",    date: "2021-05-23", endDate: "2023-08-17", empresa: "15 Washington", rate: 8,    freq: "Quarterly", amount: 84000  },
  { name: "Celia Hanono",              email: "celiaarditti@hotmail.com",    date: "2023-08-23", endDate: "2026-12-31", empresa: "Bigelow",       rate: 8,    freq: "Quarterly", amount: 84000  },
  { name: "Diego Bekerman",            email: "Diego_bekerman@hotmail.com",  date: "2021-08-05", endDate: "2022-03-31", empresa: "Tudor",         rate: 9,    freq: "Monthly",   amount: 100000 },
  { name: "Diego Bekerman",            email: "Diego_bekerman@hotmail.com",  date: "2021-08-05", endDate: "2022-03-31", empresa: "Tudor",         rate: 9,    freq: "Quarterly", amount: 100000 },
  { name: "Diego Bekerman",            email: "Diego_bekerman@hotmail.com",  date: "2022-04-01", endDate: "2023-08-17", empresa: "15 Washington", rate: 9,    freq: "Maturity",  amount: 100000 },
  { name: "Diego Bekerman",            email: "Diego_bekerman@hotmail.com",  date: "2025-08-19", endDate: "2026-08-19", empresa: "Lucentia",      rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Diego Ulloa",               email: "diego.ulloa@gmail.com",       date: "2021-04-23", endDate: "2023-07-22", empresa: "15 Washington", rate: 8,    freq: "Monthly",   amount: 170000 },
  { name: "Diego Ulloa",               email: "diego.ulloa@gmail.com",       date: "2021-06-23", endDate: "2023-07-22", empresa: "15 Washington", rate: 8,    freq: "Monthly",   amount: 100000 },
  { name: "Diego Ulloa",               email: "diego.ulloa@gmail.com",       date: "2023-08-23", endDate: "2024-12-31", empresa: "76 Hillcrest",  rate: 8,    freq: "Monthly",   amount: 270000 },
  { name: "Diego Ulloa",               email: "diego.ulloa@gmail.com",       date: "2025-01-01", endDate: "2025-12-31", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 270000 },
  { name: "Eduardo Andres Bigio",      email: "endyb8@hotmail.com",          date: "2021-09-10", endDate: "2022-03-31", empresa: "Tudor",         rate: 10.2, freq: "Monthly",   amount: 100000 },
  { name: "Eduardo Andres Bigio",      email: "endyb8@hotmail.com",          date: "2024-11-21", endDate: "2024-12-26", empresa: "Onyx",          rate: 12,   freq: "Maturity",  amount: 100000 },
  { name: "Federico Riccio",           email: "fede.riccio@hotmail.com",     date: "2021-04-23", endDate: "2023-08-22", empresa: "15 Washington", rate: 7,    freq: "Monthly",   amount: 50000  },
  { name: "Federico Riccio",           email: "fede.riccio@hotmail.com",     date: "2023-08-23", endDate: "2024-12-23", empresa: "279 Fuller",    rate: 7,    freq: "Monthly",   amount: 50000  },
  { name: "Federico Riccio",           email: "fede.riccio@hotmail.com",     date: "2024-09-23", endDate: "2025-09-23", empresa: "Onyx",          rate: 7,    freq: "Maturity",  amount: 50000  },
  { name: "Federico Riccio",           email: "fede.riccio@hotmail.com",     date: "2025-09-23", endDate: "2028-09-23", empresa: "Onyx",          rate: 7,    freq: "Maturity",  amount: 50000  },
  { name: "Jorge Habif",               email: "jorgehabif@gmail.com",        date: "2024-01-18", endDate: "2025-03-31", empresa: "63 Bigelow",    rate: 8.5,  freq: "Maturity",  amount: 150000 },
  { name: "Jorge Habif",               email: "jorgehabif@gmail.com",        date: "2025-04-01", endDate: "2026-04-01", empresa: "Lucentia",      rate: 8,    freq: "Maturity",  amount: 150000 },
  { name: "Jorge Habif",               email: "jorgehabif@gmail.com",        date: "2025-06-19", endDate: "2026-06-19", empresa: "Lucentia",      rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Kevin Schvartzman",         email: null,                          date: "2024-11-15", endDate: "2024-12-26", empresa: "Onyx",          rate: 12,   freq: "Maturity",  amount: 100000 },
  { name: "Luciano Hertzriken",        email: null,                          date: "2023-05-18", endDate: "2025-05-17", empresa: "Bigelow",       rate: 7,    freq: "Maturity",  amount: 57000  },
  { name: "Luciano Hertzriken",        email: null,                          date: "2025-05-18", endDate: "2026-05-18", empresa: "Lucentia",      rate: 7,    freq: "Maturity",  amount: 65000  },
  { name: "Marcelo Adrian Faigelbaum", email: null,                          date: "2023-01-01", endDate: "2025-12-31", empresa: "Bigelow",       rate: 8,    freq: "Annual",    amount: 100000 },
  { name: "Martin Almirall",           email: null,                          date: "2021-09-10", endDate: "2022-03-31", empresa: "Tudor",         rate: 8,    freq: "Monthly",   amount: 120000 },
  { name: "Norberto Rubado",           email: "norberto.rubado@hotmail.com", date: "2021-04-23", endDate: "2023-08-22", empresa: "15 Washington", rate: 8,    freq: "Monthly",   amount: 100000 },
  { name: "Norberto Rubado",           email: "norberto.rubado@hotmail.com", date: "2023-08-23", endDate: "2024-12-31", empresa: "279 Fuller",    rate: 8,    freq: "Monthly",   amount: 100000 },
  { name: "Norberto Rubado",           email: "norberto.rubado@hotmail.com", date: "2024-09-23", endDate: "2025-09-23", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Norberto Rubado",           email: "norberto.rubado@hotmail.com", date: "2025-09-23", endDate: "2028-09-23", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Pablo Ryb",                 email: "traderpyt@gmail.com",         date: "2021-09-23", endDate: "2022-10-31", empresa: "Woburn",        rate: 9,    freq: "Monthly",   amount: 100000 },
  { name: "Pablo Ryb",                 email: "traderpyt@gmail.com",         date: "2022-12-23", endDate: "2024-06-22", empresa: "279 Fuller",    rate: 9,    freq: "Maturity",  amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2021-09-09", endDate: "2022-10-31", empresa: "Woburn",        rate: 9,    freq: "Monthly",   amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2022-07-01", endDate: "2023-09-30", empresa: "Concord",       rate: 9,    freq: "Maturity",  amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2022-12-23", endDate: "2024-06-22", empresa: "279 Fuller",    rate: 9,    freq: "Maturity",  amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2023-10-01", endDate: "2024-10-01", empresa: "Howard",        rate: 9,    freq: "Maturity",  amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2024-09-10", endDate: "2025-09-01", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2025-01-15", endDate: "2025-12-31", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Romina Gateno",             email: "rominagateno@hotmail.com",    date: "2025-09-01", endDate: "2028-09-01", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Sebastián Tabak",           email: "sebastian@vds.com.ar",        date: "2022-10-04", endDate: "2024-02-02", empresa: "Lowell",        rate: 7,    freq: "Maturity",  amount: 50000  },
  { name: "Sebastián Tabak",           email: "sebastian@vds.com.ar",        date: "2024-03-01", endDate: "2025-03-31", empresa: "63 Bigelow",    rate: 8,    freq: "Maturity",  amount: 90060  },
  { name: "Sebastián Tabak",           email: "sebastian@vds.com.ar",        date: "2025-05-14", endDate: "2026-05-31", empresa: "Lucentia",      rate: 8,    freq: "Maturity",  amount: 97857  },
  { name: "Tajana (Pablo Ryb)",        email: "traderpyt@gmail.com",         date: "2024-09-10", endDate: "2025-09-01", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
  { name: "Tajana (Pablo Ryb)",        email: "traderpyt@gmail.com",         date: "2025-09-01", endDate: "2028-09-01", empresa: "Onyx",          rate: 8,    freq: "Maturity",  amount: 100000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () => `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
const addMonths = (s, m) => {
  const d = new Date(s + "T12:00:00"), day = d.getDate();
  d.setMonth(d.getMonth() + m);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const MONTHS = { "at_maturity": null, "monthly": 1, "trimestral": 3, "annual": 12 };

function buildSchedule(id, amount, rate, startDate, endDate, frequency) {
  const schedule = [];
  const dailyRate = rate / 100 / 365;
  const months = MONTHS[frequency];

  if (!months) {
    const days = daysBetween(startDate, endDate);
    schedule.push({ schedule_id: `${id}_${endDate}`, capital_mov_id: id, due_date: endDate, amount: parseFloat((amount * dailyRate * days).toFixed(2)), partial: false, partial_days: null, paid: false, paid_date: null, snapshot_capital: amount, snapshot_rate: rate });
    return schedule;
  }

  const fullAmt = parseFloat((amount * rate / 100 / 12 * months).toFixed(2));
  const firstDue = addMonths(startDate, months);

  if (firstDue <= endDate) {
    const isFull = firstDue === addMonths(startDate, months);
    const firstAmt = isFull ? fullAmt : parseFloat((amount * dailyRate * daysBetween(startDate, firstDue)).toFixed(2));
    schedule.push({ schedule_id: `${id}_${firstDue}`, capital_mov_id: id, due_date: firstDue, amount: firstAmt, partial: !isFull, partial_days: isFull ? null : daysBetween(startDate, firstDue), paid: false, paid_date: null, snapshot_capital: amount, snapshot_rate: rate });
  }

  let current = addMonths(firstDue, months);
  while (current <= endDate) {
    schedule.push({ schedule_id: `${id}_${current}`, capital_mov_id: id, due_date: current, amount: fullAmt, partial: false, partial_days: null, paid: false, paid_date: null, snapshot_capital: amount, snapshot_rate: rate });
    current = addMonths(current, months);
  }

  return schedule;
}

async function main() {
  console.log("🚀 Iniciando importación para Exponential...\n");

  // 1. Empresas únicas
  const empresas = [...new Set(data.map(d => d.empresa))].sort();
  console.log(`📦 Creando ${empresas.length} empresas...`);
  for (const name of empresas) {
    await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
      method: "POST", headers: { ...h(), "Prefer": "return=representation" },
      body: JSON.stringify({ name })
    });
    console.log(`  ✓ ${name}`);
  }

  // 2. Inversores únicos
  const uniqueInvestors = {};
  data.forEach(d => { if (!uniqueInvestors[d.name]) uniqueInvestors[d.name] = d.email; });
  console.log(`\n👥 Creando ${Object.keys(uniqueInvestors).length} inversores...`);
  const investorMap = {};
  for (const [name, email] of Object.entries(uniqueInvestors)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/investors`, {
      method: "POST", headers: { ...h(), "Prefer": "return=representation" },
      body: JSON.stringify({ name, email: email || null })
    });
    const rows = await res.json();
    investorMap[name] = rows[0].id;
    console.log(`  ✓ ${name} (id: ${rows[0].id})`);
  }

  // 3. Movimientos y cuotas
  console.log(`\n💰 Creando ${data.length} inversiones...`);
  let totalSched = 0;
  for (const row of data) {
    await new Promise(r => setTimeout(r, 20));
    const movId = genId();
    const frequency = FREQ_MAP[row.freq] || "at_maturity";
    const mov = {
      id: movId, investor_id: investorMap[row.name], type: "capital_in",
      amount: row.amount, date: row.date, end_date: row.endDate,
      annual_rate: row.rate, frequency, interest_type: "simple",
      empresa: row.empresa, note: null, attachments: [],
      capital_paid: false, capital_paid_date: null,
      payment_day: null, first_due_date: null,
    };

    const mRes = await fetch(`${SUPABASE_URL}/rest/v1/movements`, {
      method: "POST", headers: { ...h(), "Prefer": "return=representation" },
      body: JSON.stringify(mov)
    });
    if (!mRes.ok) { console.error(`  ❌ ${row.name}: ${await mRes.text()}`); continue; }

    const scheds = buildSchedule(movId, row.amount, row.rate, row.date, row.endDate, frequency);
    if (scheds.length > 0) {
      const sRes = await fetch(`${SUPABASE_URL}/rest/v1/schedules`, {
        method: "POST", headers: { ...h(), "Prefer": "return=representation" },
        body: JSON.stringify(scheds)
      });
      if (!sRes.ok) console.error(`  ❌ schedules ${row.name}: ${await sRes.text()}`);
      totalSched += scheds.length;
    }
    console.log(`  ✓ ${row.name} — ${row.empresa} — $${row.amount} (${scheds.length} cuotas)`);
  }

  console.log(`\n🎉 Importación completa!`);
  console.log(`   Empresas:    ${empresas.length}`);
  console.log(`   Inversores:  ${Object.keys(uniqueInvestors).length}`);
  console.log(`   Inversiones: ${data.length}`);
  console.log(`   Cuotas:      ${totalSched}`);
}

main().catch(console.error);

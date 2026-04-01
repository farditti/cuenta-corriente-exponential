// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://tbmyplisunxayrwxzqdt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA";

// ─── DATOS ────────────────────────────────────────────────────────────────────
const RAW_DATA = [
  ["Federico Arditti","Fortis D LLC","2021-01-15","2023-01-14",200000,13.60,"simple","monthly"],
  ["Nicolas Arditti","Fortis D LLC","2021-01-15","2023-01-14",115000,9.00,"simple","monthly"],
  ["Diego Ulloa","Fortis D LLC","2021-01-15","2023-01-14",200000,7.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis D LLC","2021-01-15","2023-01-14",200000,8.00,"simple","monthly"],
  ["Norberto Rubado","Fortis D LLC","2021-01-15","2023-01-14",110000,7.00,"simple","monthly"],
  ["Federico Riccio","Fortis D LLC","2021-01-15","2023-01-14",50000,7.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis D LLC","2021-06-01","2023-05-31",250000,10.00,"simple","monthly"],
  ["Martin Almirall","Fortis D LLC","2021-06-01","2023-05-31",250000,8.00,"simple","monthly"],
  ["Federico Arditti","Fortis E II LLC","2021-11-05","2023-11-05",60000,13.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2021-11-05","2023-11-05",200000,9.50,"simple","monthly"],
  ["Martin Almirall","Fortis E II LLC","2021-11-05","2023-11-05",100000,8.00,"simple","monthly"],
  ["Alejandro Halac","Fortis E II LLC","2021-11-05","2023-11-05",120000,8.00,"simple","monthly"],
  ["Jose Maria Lopez","Fortis E II LLC","2021-11-05","2023-11-05",120000,8.00,"simple","monthly"],
  ["Federico Arditti","Fortec A LLC","2022-06-15","2024-06-15",325000,11.98,"simple","monthly"],
  ["Eduardo Bigio","Fortec A LLC","2022-06-15","2024-06-15",700000,9.71,"simple","monthly"],
  ["Martin Almirall","Fortec A LLC","2022-06-15","2024-06-15",500000,8.00,"simple","monthly"],
  ["Nicolas Arditti","Fortec A LLC","2022-06-15","2024-06-15",165000,9.00,"simple","monthly"],
  ["Diego Ulloa","Fortec A LLC","2022-06-15","2024-06-15",200000,7.00,"simple","monthly"],
  ["Norberto Rubado","Fortec A LLC","2022-06-15","2024-06-15",110000,7.00,"simple","monthly"],
  ["Federico Riccio","Fortec A LLC","2022-06-15","2024-06-15",50000,7.00,"simple","monthly"],
  ["Diego Levi","Fortec A LLC","2022-06-15","2024-06-15",50000,8.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2022-08-01","2024-08-01",300000,9.67,"simple","monthly"],
  ["Martin Almirall","Fortis E II LLC","2022-08-01","2024-08-01",200000,8.00,"simple","monthly"],
  ["Federico Arditti","Fortis E II LLC","2022-08-01","2024-08-01",60000,13.00,"simple","monthly"],
  ["Alejandro Halac","Fortis E II LLC","2022-08-01","2024-08-01",120000,8.00,"simple","monthly"],
  ["Jose Maria Lopez","Fortis E II LLC","2022-08-01","2024-08-01",120000,8.00,"simple","monthly"],
  ["Andres Etbul","Fortis E II LLC","2022-11-15","2024-11-15",250000,8.50,"simple","monthly"],
  ["Diego Levi","Fortis E II LLC","2022-11-15","2024-11-15",50000,8.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2023-04-10","2025-04-10",100000,10.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortis E II LLC","2023-04-10","2025-04-10",100000,8.00,"simple","monthly"],
  ["Nicolas Arditti","Fortis E II LLC","2023-04-03","2025-04-10",150000,9.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2024-01-15","2026-01-15",100000,10.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortis E II LLC","2024-01-15","2026-01-15",100000,8.00,"simple","monthly"],
  ["Nicolas Arditti","Fortis E II LLC","2024-01-15","2026-01-15",250000,9.00,"simple","monthly"],
  ["Federico Arditti","Fortis E II LLC","2024-01-15","2026-01-15",50000,9.00,"simple","monthly"],
  ["Federico Arditti","Fortec A LLC","2024-06-15","2026-06-15",325000,11.37,"simple","monthly"],
  ["Eduardo Bigio","Fortec A LLC","2024-06-15","2026-06-15",700000,9.71,"simple","monthly"],
  ["Martin Almirall","Fortec A LLC","2024-06-15","2026-06-15",500000,8.00,"simple","monthly"],
  ["Nicolas Arditti","Fortec A LLC","2024-06-15","2026-06-15",165000,9.00,"simple","monthly"],
  ["Diego Ulloa","Fortec A LLC","2024-06-15","2026-06-15",200000,7.00,"simple","monthly"],
  ["Norberto Rubado","Fortec A LLC","2024-06-15","2026-06-15",110000,7.00,"simple","monthly"],
  ["Federico Riccio","Fortec A LLC","2024-06-15","2026-06-15",50000,7.00,"simple","monthly"],
  ["Diego Levi","Fortec A LLC","2024-06-15","2026-06-15",50000,8.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortis E II LLC","2024-06-27","2026-06-27",150000,8.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2024-08-01","2026-08-01",300000,9.50,"simple","monthly"],
  ["Federico Arditti","Fortis E II LLC","2024-08-01","2026-08-01",100000,12.85,"simple","monthly"],
  ["Alejandro Halac","Fortis E II LLC","2024-08-01","2026-08-01",120000,8.00,"simple","monthly"],
  ["Jose Maria Lopez","Fortis E II LLC","2024-08-01","2026-08-01",70000,7.00,"simple","monthly"],
  ["Andres Etbul","Fortis E II LLC","2024-08-08","2026-08-08",250000,8.50,"simple","monthly"],
  ["Andres Etbul","Fortis E II LLC","2024-11-15","2026-11-15",270365,8.50,"simple","monthly"],
  ["Diego Levi","Fortis E II LLC","2024-11-15","2026-11-15",50000,8.00,"simple","monthly"],
  ["Federico Arditti","Fortis E II LLC","2024-11-21","2026-11-21",30000,15.00,"simple","monthly"],
  ["Diego Levi","Fortis E II LLC","2024-12-20","2026-12-20",152000,8.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortis E II LLC","2025-03-01","2027-03-01",200000,8.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2025-03-01","2027-03-01",100000,11.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2025-04-10","2027-04-10",100000,10.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortis E II LLC","2025-04-10","2027-04-10",100000,8.00,"simple","monthly"],
  ["Nicolas Arditti","Fortis E II LLC","2025-04-03","2027-04-10",150000,9.00,"simple","monthly"],
  ["Alejandro Halac","Fortec A LLC","2025-05-22","2027-05-22",130000,8.00,"simple","monthly"],
  ["Diego Arditti","Fortis E II LLC","2025-07-02","2027-07-02",75000,9.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortec A LLC","2025-07-09","2027-07-09",60000,8.00,"simple","monthly"],
  ["Mariana Regueira","Fortis E II LLC","2025-08-20","2026-08-20",100000,8.00,"simple","monthly"],
  ["Andres Etbul","Fortis E II LLC","2025-09-22","2026-08-08",272605.96,8.50,"simple","monthly"],
  ["Andres Etbul","Fortis E II LLC","2025-09-22","2027-10-01",390019.1,8.50,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2025-10-31","2026-01-31",400000,13.00,"simple","monthly"],
  ["Kevin Schvartzman","Fortis E II LLC","2026-01-15","2028-01-15",100000,8.00,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2026-01-15","2028-01-15",100000,10.00,"simple","monthly"],
  ["Nicolas Arditti","Fortis E II LLC","2026-01-15","2028-01-15",250000,9.00,"simple","monthly"],
  ["Martin Hamuy","Fortec A LLC","2025-12-03","2027-12-03",100000,8.25,"simple","monthly"],
  ["Eduardo Bigio","Fortis E II LLC","2026-02-01","2027-02-01",400000,13.00,"simple","monthly"],
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

const sbGet  = (table, qs="") => fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, {headers: h()}).then(r => r.json());
const sbPost = (table, body)  => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {method:"POST", headers:{...h(),"Prefer":"return=representation"}, body: JSON.stringify(body)}).then(r => r.json());

const genId = () => "imp_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);

// ─── SCHEDULE BUILDER (mismo algoritmo que la app) ────────────────────────────
function buildSchedule(mov) {
  const schedule = [];
  const capital = mov.amount;
  const dailyRate = mov.annualRate / 100 / 365;
  const startDate = mov.date;
  const endDate = mov.endDate;

  const addMonths = (dateStr, months) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, maxDay));
    return d.toISOString().slice(0, 10);
  };

  const daysBetween = (a, b) => Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00")) / 86400000);
  const lastOfMonth = (dateStr) => { const d = new Date(dateStr+"T00:00:00"); return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10); };

  const freqMap = { monthly:1, bimonthly:2, quarterly:4, semiannual:6, annual:12 };
  const periodMonths = freqMap[mov.frequency] || 1;
  const monthlyRate = mov.annualRate / 100 / 12;
  const fullPeriodAmount = parseFloat((capital * monthlyRate * periodMonths).toFixed(2));

  // First due date
  let firstDue = addMonths(startDate, periodMonths);
  if (firstDue > endDate) firstDue = endDate;

  // Partial first period
  const firstPeriodStart = startDate;
  const expectedFirst = addMonths(startDate, periodMonths);
  if (firstDue === endDate && firstDue < expectedFirst) {
    const days = daysBetween(firstPeriodStart, firstDue);
    if (days > 0) {
      schedule.push({
        scheduleId: `${mov.id}_${firstDue}_f`,
        capitalMovId: mov.id, dueDate: firstDue,
        amount: parseFloat((capital * dailyRate * days).toFixed(2)),
        partial: true, partialDays: days, paid: false, paidDate: null,
        snapshotCapital: capital, snapshotRate: mov.annualRate
      });
    }
    return schedule;
  }

  const firstDays = daysBetween(firstPeriodStart, firstDue);
  const expectedDays = daysBetween(firstPeriodStart, expectedFirst);
  if (firstDays < expectedDays * 0.95) {
    const partialAmount = parseFloat((capital * dailyRate * firstDays).toFixed(2));
    schedule.push({
      scheduleId: `${mov.id}_${firstDue}`,
      capitalMovId: mov.id, dueDate: firstDue,
      amount: partialAmount, partial: true, partialDays: firstDays,
      paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate
    });
  } else {
    schedule.push({
      scheduleId: `${mov.id}_${firstDue}`,
      capitalMovId: mov.id, dueDate: firstDue,
      amount: fullPeriodAmount, partial: false,
      paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate
    });
  }

  let current = addMonths(firstDue, periodMonths);
  while (current <= endDate) {
    schedule.push({
      scheduleId: `${mov.id}_${current}`,
      capitalMovId: mov.id, dueDate: current,
      amount: fullPeriodAmount, partial: false,
      paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate
    });
    current = addMonths(current, periodMonths);
  }

  const lastScheduled = schedule.length > 0 ? schedule[schedule.length-1].dueDate : startDate;
  const lastDayOfEndMonth = lastOfMonth(endDate);
  if (endDate < lastDayOfEndMonth && lastScheduled < endDate) {
    const days = daysBetween(lastScheduled, endDate);
    if (days > 0) {
      schedule.push({
        scheduleId: `${mov.id}_${endDate}_f`,
        capitalMovId: mov.id, dueDate: endDate,
        amount: parseFloat((capital * dailyRate * days).toFixed(2)),
        partial: true, partialDays: days,
        paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate
      });
    }
  }

  return schedule;
}

const schedToDB = (s) => ({
  schedule_id: s.scheduleId, capital_mov_id: s.capitalMovId, due_date: s.dueDate,
  amount: s.amount, partial: s.partial||false, partial_days: s.partialDays||null,
  paid: false, paid_date: null, original_amount: null,
  adjusted_by_withdrawal: null, adjusted_by_deposit: null,
  is_compound: null, is_final: null, period_interest: null, accumulated_capital: null,
  snapshot_capital: s.snapshotCapital||null, snapshot_rate: s.snapshotRate||null,
});

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Iniciando importación...\n");

  // 1. Obtener inversores existentes
  const existingInvestors = await sbGet("investors", "?order=id");
  console.log(`📋 Inversores existentes: ${existingInvestors.length}`);
  const investorMap = {};
  existingInvestors.forEach(i => investorMap[i.name] = i.id);

  // 2. Crear inversores nuevos
  const uniqueNames = [...new Set(RAW_DATA.map(r => r[0]))];
  for (const name of uniqueNames) {
    if (!investorMap[name]) {
      const rows = await sbPost("investors", {name, email: null});
      if (rows[0]) {
        investorMap[name] = rows[0].id;
        console.log(`✅ Inversor creado: ${name} (id: ${rows[0].id})`);
      } else {
        console.error(`❌ Error creando inversor: ${name}`, rows);
      }
    } else {
      console.log(`⏭  Inversor ya existe: ${name} (id: ${investorMap[name]})`);
    }
  }

  // 3. Obtener movimientos existentes para evitar duplicados
  const existingMovs = await sbGet("movements", "?order=id");
  console.log(`\n📋 Movimientos existentes: ${existingMovs.length}`);

  // 4. Insertar movimientos y cronogramas
  let movCreated = 0, schedCreated = 0, skipped = 0;

  for (const row of RAW_DATA) {
    const [name, empresa, date, endDate, amount, annualRate, interestType, frequency] = row;
    const investorId = investorMap[name];
    if (!investorId) { console.error(`❌ No se encontró inversor: ${name}`); continue; }

    // Check if movement already exists (same investor, empresa, date, amount)
    const exists = existingMovs.find(m =>
      m.investor_id === investorId &&
      m.empresa === empresa &&
      m.date === date &&
      parseFloat(m.amount) === amount
    );
    if (exists) { skipped++; continue; }

    const mov = {
      id: genId(),
      investorId, type: "capital_in", amount, date, endDate,
      annualRate, frequency, interestType, empresa,
      note: "", attachments: [], capitalPaid: false, capitalPaidDate: null
    };

    // Insert movement
    const movDB = {
      id: mov.id, investor_id: investorId, type: "capital_in",
      amount, date, end_date: endDate, annual_rate: annualRate,
      frequency, interest_type: interestType, empresa,
      linked_capital_id: null, note: null, attachments: [],
      capital_paid: false, capital_paid_date: null
    };

    const movRes = await sbPost("movements", movDB);
    if (!movRes[0]?.id) { console.error(`❌ Error insertando movimiento para ${name}:`, movRes); continue; }
    movCreated++;

    // Build and insert schedule — mark past dues as paid
    const today = new Date().toISOString().slice(0,10);
    const sched = buildSchedule(mov);
    if (sched.length > 0) {
      const schedWithPaid = sched.map(s => ({
        ...s,
        paid: s.dueDate <= today,
        paidDate: s.dueDate <= today ? s.dueDate : null,
      }));
      // Insert in batches of 50
      for (let i = 0; i < schedWithPaid.length; i += 50) {
        const batch = schedWithPaid.slice(i, i+50).map(s => ({...schedToDB(s), paid: s.paid, paid_date: s.paidDate}));
        await sbPost("schedules", batch);
      }
      schedCreated += sched.length;
    }

    console.log(`✅ ${name} · ${empresa} · ${date} · $${amount.toLocaleString()} · ${sched.length} cuotas`);
  }

  console.log(`\n🎉 Importación completa:`);
  console.log(`   Movimientos creados: ${movCreated}`);
  console.log(`   Cuotas generadas:    ${schedCreated}`);
  console.log(`   Omitidos (ya existían): ${skipped}`);
}

main().catch(console.error);

const SUPABASE_URL = "https://urlhcfozaexorcxmhffc.supabase.co";
const SUPABASE_KEY = "sb_publishable_15ODb6irQhChPY1dD_Q5Bg_GIDvxZP-";
const today = new Date().toISOString().slice(0, 10);

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

const genId = () => `imp_${Math.random().toString(36).slice(2,10)}_${Math.random().toString(36).slice(2,10)}`;

const FREQ_MAP = {
  "Monthly": "monthly",
  "Quarterly": "quarterly",
  "Maturity": "at_maturity",
  "Annual": "annual",
};

// Parse date from dd/mm/yyyy
const parseDate = (s) => {
  const [d, m, y] = s.split("/");
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
};

// Days between two dates
const daysBetween = (a, b) => Math.round((new Date(b+"T12:00:00") - new Date(a+"T12:00:00")) / 86400000);

// Add months
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.toISOString().slice(0, 10);
};

// Build schedule for an investment
const buildSchedule = (mov) => {
  const schedule = [];
  const { id, date: startDate, endDate, annualRate, frequency, amount } = mov;
  const dailyRate = annualRate / 100 / 365;
  const freqMonths = { monthly: 1, quarterly: 3, annual: 12, at_maturity: null }[frequency];

  if (frequency === "at_maturity") {
    const days = daysBetween(startDate, endDate);
    const amt = parseFloat((amount * dailyRate * days).toFixed(2));
    schedule.push({ scheduleId: `${id}_${endDate}`, capitalMovId: id, dueDate: endDate, amount: amt, partial: false, paid: false, paidDate: null, snapshotCapital: amount, snapshotRate: annualRate });
    return schedule;
  }

  const fullPeriodAmount = parseFloat((amount * annualRate / 100 / 12 * freqMonths).toFixed(2));
  const startDay = parseInt(startDate.split("-")[2]);

  // First due date
  let firstDue = addMonths(startDate, freqMonths);

  // First cuota
  if (firstDue <= endDate) {
    const naturalFirst = addMonths(startDate, freqMonths);
    const isFullPeriod = firstDue === naturalFirst;
    const firstDueDay = parseInt(firstDue.split("-")[2]);
    const dayCoincides = firstDueDay === startDay;
    let firstAmount, isPartial, partialDays = null;

    if (isFullPeriod) {
      firstAmount = fullPeriodAmount; isPartial = false;
    } else if (dayCoincides) {
      const monthsElapsed = (new Date(firstDue+"T12:00:00").getFullYear() - new Date(startDate+"T12:00:00").getFullYear()) * 12 +
        (new Date(firstDue+"T12:00:00").getMonth() - new Date(startDate+"T12:00:00").getMonth());
      firstAmount = parseFloat((amount * annualRate / 100 / 12 * monthsElapsed).toFixed(2));
      isPartial = monthsElapsed < freqMonths;
    } else {
      const daysFirst = daysBetween(startDate, firstDue);
      firstAmount = parseFloat((amount * dailyRate * daysFirst).toFixed(2));
      isPartial = true; partialDays = daysFirst;
    }
    schedule.push({ scheduleId: `${id}_${firstDue}`, capitalMovId: id, dueDate: firstDue, amount: firstAmount, partial: isPartial, partialDays, paid: false, paidDate: null, snapshotCapital: amount, snapshotRate: annualRate });
  }

  // Middle cuotas
  let current = addMonths(firstDue, freqMonths);
  while (current <= endDate) {
    schedule.push({ scheduleId: `${id}_${current}`, capitalMovId: id, dueDate: current, amount: fullPeriodAmount, partial: false, paid: false, paidDate: null, snapshotCapital: amount, snapshotRate: annualRate });
    current = addMonths(current, freqMonths);
  }

  // Last cuota proporcional
  const lastScheduled = schedule.length > 0 ? schedule[schedule.length - 1].dueDate : startDate;
  if (lastScheduled < endDate) {
    const endDay = parseInt(endDate.split("-")[2]);
    const lastSchedDay = parseInt(lastScheduled.split("-")[2]);
    const dayCoincides2 = endDay === lastSchedDay;
    let lastAmount, lastPartial, lastPartialDays = null;
    if (dayCoincides2) {
      const monthsElapsed = (new Date(endDate+"T12:00:00").getFullYear() - new Date(lastScheduled+"T12:00:00").getFullYear()) * 12 +
        (new Date(endDate+"T12:00:00").getMonth() - new Date(lastScheduled+"T12:00:00").getMonth());
      lastAmount = parseFloat((amount * annualRate / 100 / 12 * monthsElapsed).toFixed(2));
      lastPartial = monthsElapsed < freqMonths;
    } else {
      const days = daysBetween(lastScheduled, endDate);
      lastAmount = parseFloat((amount * dailyRate * days).toFixed(2));
      lastPartial = true; lastPartialDays = days;
    }
    if (lastAmount > 0) {
      schedule.push({ scheduleId: `${id}_${endDate}_f`, capitalMovId: id, dueDate: endDate, amount: lastAmount, partial: lastPartial, partialDays: lastPartialDays, paid: false, paidDate: null, snapshotCapital: amount, snapshotRate: annualRate });
    }
  }

  return schedule;
};

const INVESTMENTS = [
  // Celia Hanono
  { investor: "Celia Hanono",   start: "23/5/2021",  end: "17/8/2023",   rate: 8, freq: "Quarterly", amount: 84000  },
  { investor: "Celia Hanono",   start: "23/8/2023",  end: "31/12/2026",  rate: 8, freq: "Quarterly", amount: 84000  },
  // Diego Bekerman
  { investor: "Diego Bekerman", start: "5/8/2021",   end: "31/3/2022",   rate: 9, freq: "Monthly",   amount: 100000 },
  { investor: "Diego Bekerman", start: "1/4/2022",   end: "17/8/2023",   rate: 9, freq: "Maturity",  amount: 100000 },
  { investor: "Diego Bekerman", start: "19/8/2025",  end: "19/8/2026",   rate: 8, freq: "Maturity",  amount: 100000 },
  // Diego Ulloa
  { investor: "Diego Ulloa",    start: "23/4/2021",  end: "22/7/2023",   rate: 8, freq: "Monthly",   amount: 170000 },
  { investor: "Diego Ulloa",    start: "23/6/2021",  end: "22/7/2023",   rate: 8, freq: "Monthly",   amount: 100000, linkedTo: "Diego Ulloa 23/4/2021" },
  { investor: "Diego Ulloa",    start: "23/8/2023",  end: "31/12/2024",  rate: 8, freq: "Monthly",   amount: 270000 },
  { investor: "Diego Ulloa",    start: "1/1/2025",   end: "31/12/2025",  rate: 8, freq: "Annual",    amount: 270000 },
  // Federico Riccio
  { investor: "Federico Riccio", start: "23/4/2021", end: "22/8/2023",   rate: 7, freq: "Monthly",   amount: 50000  },
  { investor: "Federico Riccio", start: "23/8/2023", end: "23/9/2024",   rate: 7, freq: "Monthly",   amount: 50000  },
  { investor: "Federico Riccio", start: "23/9/2024", end: "23/9/2025",   rate: 7, freq: "Maturity",  amount: 50000  },
  { investor: "Federico Riccio", start: "23/9/2025", end: "23/9/2028",   rate: 7, freq: "Maturity",  amount: 50000  },
];

async function main() {
  // 1. Get investor IDs
  const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id,name`, { headers: h() });
  const investors = await invRes.json();
  const getInvId = (name) => investors.find(i => i.name.toLowerCase().includes(name.toLowerCase()))?.id;

  const investorNames = ["Celia Hanono", "Diego Bekerman", "Diego Ulloa", "Federico Riccio"];
  const invIds = investorNames.map(n => getInvId(n)).filter(Boolean);
  console.log("Investor IDs:", invIds);

  // 2. Delete existing schedules and movements
  for (const invId of invIds) {
    const movRes = await fetch(`${SUPABASE_URL}/rest/v1/movements?investor_id=eq.${invId}&select=id`, { headers: h() });
    const movs = await movRes.json();
    for (const mov of movs) {
      await fetch(`${SUPABASE_URL}/rest/v1/schedules?capital_mov_id=eq.${mov.id}`, { method: "DELETE", headers: h() });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/movements?investor_id=eq.${invId}`, { method: "DELETE", headers: h() });
    console.log(`✓ Eliminados movimientos de investor ${invId}`);
  }

  // 3. Create new investments
  const createdMovs = {}; // key -> id for linked investments

  for (const inv of INVESTMENTS) {
    const invId = getInvId(inv.investor);
    if (!invId) { console.log(`❌ No encontrado: ${inv.investor}`); continue; }

    const movId = genId();
    const startDate = parseDate(inv.start);
    const endDate = parseDate(inv.end);
    const frequency = FREQ_MAP[inv.freq];

    // Find linked capital ID if applicable
    const linkedKey = `${inv.investor} ${inv.start}`;
    const parentKey = inv.linkedTo;
    const linkedCapitalId = parentKey ? createdMovs[parentKey] : null;

    const mov = {
      id: movId,
      investor_id: invId,
      type: "capital_in",
      amount: inv.amount,
      date: startDate,
      end_date: endDate,
      annual_rate: inv.rate,
      frequency: frequency,
      interest_type: "simple",
      linked_capital_id: linkedCapitalId || null,
      note: null,
      attachments: [],
      capital_paid: false,
      capital_paid_date: null,
    };

    await fetch(`${SUPABASE_URL}/rest/v1/movements`, {
      method: "POST", headers: h(),
      body: JSON.stringify(mov)
    });

    createdMovs[linkedKey] = movId;
    console.log(`✓ Creado: ${inv.investor} ${inv.start} → ${inv.end} $${inv.amount}`);

    // 4. Build and insert schedule (skip for linked deposits)
    if (!linkedCapitalId) {
      const movObj = { id: movId, date: startDate, endDate, annualRate: inv.rate, frequency, amount: inv.amount };
      const sched = buildSchedule(movObj);

      for (const s of sched) {
        const isPaid = s.dueDate <= today;
        await fetch(`${SUPABASE_URL}/rest/v1/schedules`, {
          method: "POST", headers: h(),
          body: JSON.stringify({
            schedule_id: s.scheduleId,
            capital_mov_id: s.capitalMovId,
            due_date: s.dueDate,
            amount: s.amount,
            partial: s.partial || false,
            partial_days: s.partialDays || null,
            paid: isPaid,
            paid_date: isPaid ? s.dueDate : null,
            snapshot_capital: s.snapshotCapital,
            snapshot_rate: s.snapshotRate,
            original_amount: s.amount,
          })
        });
      }
      console.log(`   → ${sched.length} cuotas (${sched.filter(s=>s.dueDate<=today).length} marcadas pagadas)`);
    }
  }

  console.log("\n🎉 Listo!");
}

main().catch(console.error);

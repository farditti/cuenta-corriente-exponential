// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://tbmyplisunxayrwxzqdt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA";

const today = new Date().toISOString().slice(0, 10);

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

const sbGet  = (table, qs="") => fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, {headers: h()}).then(r => r.json());
const sbPost = (table, body)  => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {method:"POST", headers:{...h(),"Prefer":"return=representation"}, body: JSON.stringify(body)}).then(r => r.json());
const sbDel  = (table, qs)    => fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, {method:"DELETE", headers: h()}).then(r => r.ok);

// ─── BUILD SCHEDULE (con fix de timezone) ─────────────────────────────────────
function buildSchedule(mov) {
  const schedule = [];
  const capital = mov.amount;
  const dailyRate = mov.annualRate / 100 / 365;
  const startDate = mov.date;
  const endDate = mov.endDate;

  const addMonths = (dateStr, months) => {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, maxDay));
    return d.toISOString().slice(0, 10);
  };
  const daysBetween = (a, b) => Math.round((new Date(b+"T12:00:00") - new Date(a+"T12:00:00")) / 86400000);
  const lastOfMonth = (dateStr) => { const d = new Date(dateStr+"T12:00:00"); return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10); };

  const freqMap = { monthly:1, bimonthly:2, quarterly:4, semiannual:6, annual:12 };
  const periodMonths = freqMap[mov.frequency] || 1;
  const fullPeriodAmount = parseFloat((capital * mov.annualRate / 100 / 12 * periodMonths).toFixed(2));

  const startDay = parseInt(startDate.split("-")[2]);

  // First due date = same day next period
  let firstDue = addMonths(startDate, periodMonths);
  if (firstDue > endDate) firstDue = endDate;

  // First cuota
  if (firstDue <= endDate) {
    const firstDays = daysBetween(startDate, firstDue);
    const expectedDays = daysBetween(startDate, addMonths(startDate, periodMonths));
    const isPartial = firstDays < expectedDays * 0.95;
    if (isPartial) {
      const amount = parseFloat((capital * dailyRate * firstDays).toFixed(2));
      schedule.push({ scheduleId:`${mov.id}_${firstDue}`, capitalMovId:mov.id, dueDate:firstDue, amount, partial:true, partialDays:firstDays });
    } else {
      schedule.push({ scheduleId:`${mov.id}_${firstDue}`, capitalMovId:mov.id, dueDate:firstDue, amount:fullPeriodAmount, partial:false, partialDays:null });
    }
  }

  // Remaining cuotas
  let current = addMonths(firstDue, periodMonths);
  while (current <= endDate) {
    schedule.push({ scheduleId:`${mov.id}_${current}`, capitalMovId:mov.id, dueDate:current, amount:fullPeriodAmount, partial:false, partialDays:null });
    current = addMonths(current, periodMonths);
  }

  // Partial last cuota if endDate is mid-month
  const lastScheduled = schedule.length > 0 ? schedule[schedule.length-1].dueDate : startDate;
  const lastDayOfEnd = lastOfMonth(endDate);
  if (endDate < lastDayOfEnd && lastScheduled < endDate) {
    const days = daysBetween(lastScheduled, endDate);
    if (days > 0) {
      schedule.push({ scheduleId:`${mov.id}_${endDate}_f`, capitalMovId:mov.id, dueDate:endDate, amount:parseFloat((capital*dailyRate*days).toFixed(2)), partial:true, partialDays:days });
    }
  }

  return schedule;
}

const schedToDB = (s, alreadyPaid) => ({
  schedule_id: s.scheduleId,
  capital_mov_id: s.capitalMovId,
  due_date: s.dueDate,
  amount: s.amount,
  partial: s.partial || false,
  partial_days: s.partialDays || null,
  paid: s.dueDate <= today,
  paid_date: s.dueDate <= today ? s.dueDate : null,
  original_amount: null,
  adjusted_by_withdrawal: null,
  adjusted_by_deposit: null,
  is_compound: null,
  is_final: null,
  period_interest: null,
  accumulated_capital: null,
  snapshot_capital: null,
  snapshot_rate: null,
});

async function main() {
  console.log("🚀 Regenerando todas las cuotas...\n");

  // 1. Traer todos los movimientos capital_in sin linkedCapitalId
  const movements = await sbGet("movements", "?type=eq.capital_in&linked_capital_id=is.null&order=date");
  console.log(`📋 Inversiones encontradas: ${movements.length}\n`);

  let totalDeleted = 0;
  let totalCreated = 0;

  for (const mov of movements) {
    if (!mov.end_date || !mov.annual_rate) continue;

    const appMov = {
      id: mov.id,
      amount: parseFloat(mov.amount),
      annualRate: parseFloat(mov.annual_rate),
      date: mov.date,
      endDate: mov.end_date,
      frequency: mov.frequency || "monthly",
    };

    // Build new schedule
    const newSched = buildSchedule(appMov);
    if (newSched.length === 0) continue;

    // Delete existing schedules for this movement
    await sbDel("schedules", `?capital_mov_id=eq.${mov.id}`);
    totalDeleted++;

    // Insert new schedules in batches of 50
    for (let i = 0; i < newSched.length; i += 50) {
      const batch = newSched.slice(i, i+50).map(schedToDB);
      await sbPost("schedules", batch);
    }
    totalCreated += newSched.length;

    console.log(`✅ ${mov.id} · ${newSched.length} cuotas · ${appMov.date} → ${appMov.endDate}`);
  }

  console.log(`\n🎉 Listo:`);
  console.log(`   Inversiones procesadas: ${totalDeleted}`);
  console.log(`   Cuotas generadas: ${totalCreated}`);
  console.log(`   Cuotas hasta ${today} marcadas como pagadas automáticamente.`);
}

main().catch(console.error);

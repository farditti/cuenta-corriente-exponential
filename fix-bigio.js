const SUPABASE_URL = 'https://tbmyplisunxayrwxzqdt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA';

const today = new Date().toISOString().slice(0, 10);

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.toISOString().slice(0, 10);
};

const daysBetween = (a, b) => Math.round((new Date(b+"T12:00:00") - new Date(a+"T12:00:00")) / 86400000);

function buildSchedule(mov) {
  const schedule = [];
  const capital = mov.amount;
  const dailyRate = mov.annualRate / 100 / 365;
  const startDate = mov.date;
  const endDate = mov.endDate;
  const periodMonths = 1; // mensual
  const fullPeriodAmount = parseFloat((capital * mov.annualRate / 100 / 12).toFixed(2));
  const startDay = parseInt(startDate.split("-")[2]);

  // First due date — use firstDueDate if provided
  const firstDue = mov.firstDueDate || addMonths(startDate, periodMonths);

  // First cuota
  if (firstDue <= endDate) {
    const naturalFirstDue = addMonths(startDate, periodMonths);
    const isFullPeriod = firstDue === naturalFirstDue;
    const firstDueDay = parseInt(firstDue.split("-")[2]);
    const dayCoincides = firstDueDay === startDay;

    let firstAmount, isPartial, partialDays = null;
    if (isFullPeriod) {
      firstAmount = fullPeriodAmount; isPartial = false;
    } else if (dayCoincides) {
      const fd = new Date(startDate + "T12:00:00");
      const dd = new Date(firstDue + "T12:00:00");
      const monthsElapsed = (dd.getFullYear() - fd.getFullYear()) * 12 + (dd.getMonth() - fd.getMonth());
      firstAmount = parseFloat((capital * mov.annualRate / 100 / 12 * monthsElapsed).toFixed(2));
      isPartial = monthsElapsed < periodMonths;
    } else {
      const days = daysBetween(startDate, firstDue);
      firstAmount = parseFloat((capital * dailyRate * days).toFixed(2));
      isPartial = true; partialDays = days;
    }
    schedule.push({ scheduleId: `${mov.id}_${firstDue}`, capitalMovId: mov.id, dueDate: firstDue, amount: firstAmount, partial: isPartial, partialDays });
  }

  // Remaining cuotas
  let current = addMonths(firstDue, periodMonths);
  while (current <= endDate) {
    schedule.push({ scheduleId: `${mov.id}_${current}`, capitalMovId: mov.id, dueDate: current, amount: fullPeriodAmount, partial: false, partialDays: null });
    current = addMonths(current, periodMonths);
  }

  return schedule;
}

const schedToDB = (s) => ({
  schedule_id: s.scheduleId, capital_mov_id: s.capitalMovId, due_date: s.dueDate,
  amount: s.amount, partial: s.partial||false, partial_days: s.partialDays||null,
  paid: s.dueDate <= today, paid_date: s.dueDate <= today ? s.dueDate : null,
  original_amount: null, adjusted_by_withdrawal: null, adjusted_by_deposit: null,
  is_compound: null, is_final: null, period_interest: null, accumulated_capital: null,
  snapshot_capital: null, snapshot_rate: null,
});

async function main() {
  const MOV_ID = 'imp_66stdffh_mmrsov9s';

  const mov = {
    id: MOV_ID,
    amount: 100000,
    annualRate: 10,
    date: '2023-04-10',
    endDate: '2025-04-01',
    firstDueDate: '2023-05-01',
  };

  const newSched = buildSchedule(mov);
  console.log(`\n📋 Cuotas a generar: ${newSched.length}`);
  newSched.forEach(s => console.log(`  ${s.dueDate} - $${s.amount} - paid:${s.dueDate <= today}`));

  // Delete existing schedules
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/schedules?capital_mov_id=eq.${MOV_ID}`, {
    method: 'DELETE', headers: h()
  });
  console.log(`\n🗑  Cuotas anteriores eliminadas: ${delRes.ok}`);

  // Insert new schedules in batches of 50
  for (let i = 0; i < newSched.length; i += 50) {
    const batch = newSched.slice(i, i+50).map(schedToDB);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/schedules`, {
      method: 'POST',
      headers: { ...h(), "Prefer": "return=representation" },
      body: JSON.stringify(batch)
    });
    const data = await res.json();
    console.log(`✅ Batch ${i}-${i+50}: ${data.length} cuotas insertadas`);
  }

  console.log('\n🎉 Listo. Recargá la app para ver los cambios.');
}

main().catch(console.error);

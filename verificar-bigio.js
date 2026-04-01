const URL = 'https://tbmyplisunxayrwxzqdt.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA';

// Buscar inversión de Bigio Fortis E II LLC 10/04/2023
async function main() {
  // 1. Buscar el movimiento
  const movRes = await fetch(`${URL}/rest/v1/movements?investor_id=eq.5&date=eq.2023-04-10&type=eq.capital_in`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const movs = await movRes.json();
  console.log('Movimientos encontrados:', movs.length);
  movs.forEach(m => console.log(`  id: ${m.id}, amount: ${m.amount}, date: ${m.date}, end_date: ${m.end_date}, first_due_date: ${m.first_due_date}`));

  if (movs.length === 0) {
    // Buscar por monto y fecha aproximada
    const all = await fetch(`${URL}/rest/v1/movements?type=eq.capital_in&amount=eq.100000&date=like.2023-04*`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const allMovs = await all.json();
    console.log('\nBúsqueda alternativa:', allMovs.map(m => `${m.id} inv:${m.investor_id} ${m.date}`));
    if (allMovs.length > 0) {
      const movId = allMovs[0].id;
      const schedRes = await fetch(`${URL}/rest/v1/schedules?capital_mov_id=eq.${movId}&order=due_date`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
      });
      const scheds = await schedRes.json();
      console.log(`\nCuotas para ${movId}:`, scheds.length);
      scheds.forEach(s => console.log(`  ${s.due_date} - $${s.amount} - paid:${s.paid}`));
    }
    return;
  }

  const movId = movs[0].id;
  const schedRes = await fetch(`${URL}/rest/v1/schedules?capital_mov_id=eq.${movId}&order=due_date`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const scheds = await schedRes.json();
  console.log(`\nCuotas (${scheds.length}):`);
  scheds.forEach(s => console.log(`  ${s.due_date} - $${s.amount} - paid:${s.paid}`));
}
main().catch(console.error);

const SUPABASE_URL = 'https://tbmyplisunxayrwxzqdt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA';

const today = new Date().toISOString().slice(0, 10);

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

async function main() {
  // 1. Traer todos los movimientos de Bigio
  const movRes = await fetch(`${SUPABASE_URL}/rest/v1/movements?investor_id=eq.1&type=eq.capital_in&select=id`, { headers: h() });
  const movs = await movRes.json();
  const movIds = movs.map(m => m.id);
  console.log(`📋 Inversiones de Federico Arditti: ${movIds.length}`);

  // 2. Traer cuotas vencidas impagas de Bigio
  const schedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/schedules?paid=eq.false&due_date=lte.${today}&capital_mov_id=in.(${movIds.map(id=>`"${id}"`).join(',')})&select=schedule_id,due_date&order=due_date`,
    { headers: h() }
  );
  const scheds = await schedRes.json();
  console.log(`📋 Cuotas vencidas impagas: ${scheds.length}`);
  scheds.forEach(s => console.log(`  ${s.due_date} - ${s.schedule_id}`));

  if (scheds.length === 0) { console.log('✅ No hay cuotas para marcar.'); return; }

  // 3. Marcar cada una como pagada con su fecha de vencimiento
  let updated = 0;
  for (const s of scheds) {
    await fetch(`${SUPABASE_URL}/rest/v1/schedules?schedule_id=eq.${encodeURIComponent(s.schedule_id)}`, {
      method: 'PATCH', headers: h(),
      body: JSON.stringify({ paid: true, paid_date: s.due_date })
    });
    updated++;
    if (updated % 10 === 0) console.log(`  ${updated}/${scheds.length} actualizadas...`);
  }
  console.log(`\n🎉 ${scheds.length} cuotas marcadas como pagadas.`);
}

main().catch(console.error);

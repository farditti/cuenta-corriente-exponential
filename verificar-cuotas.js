const URL = 'https://tbmyplisunxayrwxzqdt.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA';

// Inversión Federico Arditti 2024-08-01 → 2026-08-01
const movId = 'imp_86ptojm2_mmrsp11k';

fetch(`${URL}/rest/v1/schedules?capital_mov_id=eq.${movId}&order=due_date`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
})
.then(r => r.json())
.then(d => {
  console.log(`Cuotas encontradas: ${d.length}`);
  d.forEach(s => console.log(`  ${s.due_date} - ${s.paid ? 'PAGADA' : 'PENDIENTE'} - $${s.amount}`));
});

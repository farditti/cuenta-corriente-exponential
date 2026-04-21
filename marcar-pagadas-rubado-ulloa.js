const SUPABASE_URL = "https://urlhcfozaexorcxmhffc.supabase.co";
const SUPABASE_KEY = "sb_publishable_15ODb6irQhChPY1dD_Q5Bg_GIDvxZP-";
const today = new Date().toISOString().slice(0, 10);

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

async function markPaidForInvestor(name) {
  // Find investor
  const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?name=ilike.*${encodeURIComponent(name)}*&select=id,name`, { headers: h() });
  const invs = await invRes.json();
  if (!invs.length) { console.log(`❌ No se encontró: ${name}`); return; }
  const inv = invs[0];
  console.log(`\n✅ ${inv.name} (id: ${inv.id})`);

  // Get movements
  const movRes = await fetch(`${SUPABASE_URL}/rest/v1/movements?investor_id=eq.${inv.id}&type=eq.capital_in&select=id`, { headers: h() });
  const movs = await movRes.json();
  const movIds = movs.map(m => `"${m.id}"`).join(',');

  // Get overdue unpaid schedules
  const schedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/schedules?paid=eq.false&due_date=lte.${today}&capital_mov_id=in.(${movIds})&select=schedule_id,due_date&order=due_date`,
    { headers: h() }
  );
  const scheds = await schedRes.json();
  console.log(`   Cuotas vencidas impagas: ${scheds.length}`);
  scheds.forEach(s => console.log(`   ${s.due_date}`));

  // Mark as paid
  let updated = 0;
  for (const s of scheds) {
    await fetch(`${SUPABASE_URL}/rest/v1/schedules?schedule_id=eq.${encodeURIComponent(s.schedule_id)}`, {
      method: 'PATCH', headers: h(),
      body: JSON.stringify({ paid: true, paid_date: s.due_date })
    });
    updated++;
  }
  console.log(`   ✓ ${updated} cuotas marcadas`);
}

async function main() {
  await markPaidForInvestor("Rubado");
  await markPaidForInvestor("Ulloa");
  console.log("\n🎉 Listo!");
}

main().catch(console.error);

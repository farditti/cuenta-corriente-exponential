// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://tbmyplisunxayrwxzqdt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA";

const today = new Date().toISOString().slice(0, 10);

const h = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
});

async function main() {
  console.log(`🗓  Fecha de hoy: ${today}`);
  console.log("🔍 Buscando cuotas vencidas impagas...\n");

  // 1. Traer todas las cuotas vencidas e impagas
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/schedules?paid=eq.false&due_date=lte.${today}&select=schedule_id,due_date`,
    { headers: h() }
  );
  const schedules = await res.json();

  if (!schedules || schedules.length === 0) {
    console.log("✅ No hay cuotas vencidas impagas.");
    return;
  }

  console.log(`📋 Cuotas vencidas impagas encontradas: ${schedules.length}`);
  console.log("⏳ Marcando como pagadas...\n");

  // 2. Actualizar en batches de 50
  let updated = 0;
  const batchSize = 50;

  for (let i = 0; i < schedules.length; i += batchSize) {
    const batch = schedules.slice(i, i + batchSize);
    const ids = batch.map(s => s.schedule_id);

    // Build filter: schedule_id=in.(id1,id2,...)
    const filter = `schedule_id=in.(${ids.map(id => `"${id}"`).join(",")})`;

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?${filter}`,
      {
        method: "PATCH",
        headers: { ...h(), "Prefer": "return=representation" },
        body: JSON.stringify({ paid: true, paid_date: null }) // paid_date = due_date se setea abajo
      }
    );

    if (!patchRes.ok) {
      console.error(`❌ Error en batch ${i}-${i+batchSize}:`, await patchRes.text());
      continue;
    }

    updated += batch.length;
    console.log(`✅ ${updated}/${schedules.length} cuotas actualizadas...`);
  }

  // 3. Ahora actualizar paid_date = due_date para cada cuota individualmente
  console.log("\n⏳ Actualizando fecha de pago = fecha de vencimiento...\n");
  let datesUpdated = 0;

  for (const s of schedules) {
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?schedule_id=eq.${encodeURIComponent(s.schedule_id)}`,
      {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({ paid: true, paid_date: s.due_date })
      }
    );
    datesUpdated++;
    if (datesUpdated % 50 === 0) console.log(`  ${datesUpdated}/${schedules.length} fechas actualizadas...`);
  }

  console.log(`\n🎉 Listo. ${schedules.length} cuotas marcadas como pagadas con su fecha de vencimiento.`);
}

main().catch(console.error);

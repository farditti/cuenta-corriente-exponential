import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";

// ─── Supabase ─────────────────────────────────────────────────────────────────
// Reemplazá estos valores con los de tu proyecto en supabase.com → Settings → API
const SUPABASE_URL = "https://tbmyplisunxayrwxzqdt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXlwbGlzdW54YXlyd3h6cWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTUyOTIsImV4cCI6MjA4ODc5MTI5Mn0.XipLmbyARpgUaYWT0ry61t8p9WarxAZpzyS-OdvONBA";

const sb = (() => {
  const h = () => ({ "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` });
  const url = (table, qs="") => `${SUPABASE_URL}/rest/v1/${table}${qs}`;

  const get  = (table, qs="")     => fetch(url(table,qs),{headers:{...h(),"Prefer":"return=representation","Range-Unit":"items","Range":"0-9999"}}).then(r=>r.json());
  const post = (table, body)      => fetch(url(table),{method:"POST",headers:{...h(),"Prefer":"return=representation"},body:JSON.stringify(body)}).then(r=>r.json());
  const patch= (table, id, col, body) => fetch(url(table,`?${col}=eq.${id}`),{method:"PATCH",headers:{...h(),"Prefer":"return=representation"},body:JSON.stringify(body)}).then(r=>r.json());
  const del  = (table, id, col="id") => fetch(url(table,`?${col}=eq.${encodeURIComponent(id)}`),{method:"DELETE",headers:h()}).then(r=>r.ok);
  const upsert=(table,body,onConflict)=> fetch(url(table,`?on_conflict=${onConflict}`),{method:"POST",headers:{...h(),"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify(body)}).then(r=>r.json());

  return { get, post, patch, del, upsert };
})();

// ─── Mappers DB ↔ App ─────────────────────────────────────────────────────────
const movFromDB = (r) => ({
  id: r.id, investorId: r.investor_id, type: r.type, amount: Number(r.amount),
  date: r.date, endDate: r.end_date, annualRate: r.annual_rate!=null?Number(r.annual_rate):undefined,
  frequency: r.frequency, interestType: r.interest_type, empresa: r.empresa||"",
  linkedCapitalId: r.linked_capital_id||undefined, note: r.note||"",
  attachments: r.attachments||[], capitalPaid: r.capital_paid||false, capitalPaidDate: r.capital_paid_date||null,
  paymentDay: r.payment_day!=null?Number(r.payment_day):undefined,
  firstDueDate: r.first_due_date||undefined,
});
const movToDB = (m) => ({
  id: m.id, investor_id: m.investorId, type: m.type, amount: m.amount,
  date: m.date, end_date: m.endDate||null, annual_rate: m.annualRate??null,
  frequency: m.frequency||null, interest_type: m.interestType||null, empresa: m.empresa||null,
  linked_capital_id: m.linkedCapitalId||null, note: m.note||null,
  attachments: m.attachments||[], capital_paid: m.capitalPaid||false, capital_paid_date: m.capitalPaidDate||null,
  payment_day: m.paymentDay||null, first_due_date: m.firstDueDate||null,
});
const schedFromDB = (r) => ({
  scheduleId: r.schedule_id, capitalMovId: r.capital_mov_id, dueDate: r.due_date,
  amount: Number(r.amount), partial: r.partial||false, partialDays: r.partial_days,
  paid: r.paid||false, paidDate: r.paid_date||null, originalAmount: r.original_amount!=null?Number(r.original_amount):null,
  adjustedByWithdrawal: r.adjusted_by_withdrawal, adjustedByDeposit: r.adjusted_by_deposit,
  isCompound: r.is_compound, isFinal: r.is_final,
  periodInterest: r.period_interest!=null?Number(r.period_interest):undefined,
  accumulatedCapital: r.accumulated_capital!=null?Number(r.accumulated_capital):undefined,
  snapshotCapital: r.snapshot_capital!=null?Number(r.snapshot_capital):undefined,
  snapshotRate: r.snapshot_rate!=null?Number(r.snapshot_rate):undefined,
});
const schedToDB = (s) => ({
  schedule_id: s.scheduleId, capital_mov_id: s.capitalMovId, due_date: s.dueDate,
  amount: s.amount, partial: s.partial||false, partial_days: s.partialDays||null,
  paid: s.paid||false, paid_date: s.paidDate||null, original_amount: s.originalAmount??null,
  adjusted_by_withdrawal: s.adjustedByWithdrawal??null, adjusted_by_deposit: s.adjustedByDeposit??null,
  is_compound: s.isCompound??null, is_final: s.isFinal??null,
  period_interest: s.periodInterest??null, accumulated_capital: s.accumulatedCapital??null,
  snapshot_capital: s.snapshotCapital??null, snapshot_rate: s.snapshotRate??null,
});
const credFromDB = (rows) => rows.reduce((acc,r)=>({...acc,[r.investor_id]:{username:r.username,password:r.password}}),{});
const credToDB   = (invId, cred) => ({investor_id: invId, username: cred.username, password: cred.password});

// ─── SheetJS ──────────────────────────────────────────────────────────────────
let XLSX_LIB = null;
const loadXLSX = () => new Promise((resolve) => {
  if (XLSX_LIB) return resolve(XLSX_LIB);
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  s.onload = () => { XLSX_LIB = window.XLSX; resolve(XLSX_LIB); };
  document.head.appendChild(s);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtDec = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtDate = (d) => { if (!d) return "-"; const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; };
const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const genId = () => Math.random().toString(36).substr(2, 9);

const addMonths = (dateStr, n) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

// ─── Frecuencias de pago ──────────────────────────────────────────────────────
const FREQUENCIES = [
  { key: "monthly",      label: "Mensual",        months: 1  },
  { key: "bimonthly",    label: "Bimestral",       months: 2  },
  { key: "trimestral",   label: "Trimestral",      months: 3  },
  { key: "quarterly",    label: "Cuatrimestral",   months: 4  },
  { key: "semiannual",   label: "Semestral",       months: 6  },
  { key: "annual",       label: "Anual",           months: 12 },
  { key: "at_maturity",  label: "Al vencimiento",  months: null },
];

// Days between two yyyy-mm-dd strings (inclusive start, exclusive end)
const daysBetween = (a, b) => {
  const da = new Date(a + "T12:00:00"), db = new Date(b + "T12:00:00");
  return Math.round((db - da) / 86400000);
};

// Days in the month of a yyyy-mm-dd string
const daysInMonth = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

// End of month for a yyyy-mm-dd string → yyyy-mm-dd
const endOfMonth = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const buildSchedule = (mov) => {
  if (mov.type !== "capital_in" || !mov.endDate || !mov.annualRate) return [];

  const freq = FREQUENCIES.find(f => f.key === (mov.frequency || "monthly")) || FREQUENCIES[0];
  const dailyRate = mov.annualRate / 100 / 365;
  const startDate = mov.date;
  const endDate = mov.endDate;
  const schedule = [];

  const firstOfNextMonth = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
  };
  const lastOfMonth = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  };
  // Last day of period starting from startDate with periodMonths duration
  const lastDayOfPeriod = (dateStr, months) => {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // If start day is 1, due = last day of last month of period
    if (day === 1) {
      return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
    }
    // Otherwise same day, next period
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, maxDay));
    return d.toISOString().slice(0, 10);
  };

  // nextDayOfMonth: find the next occurrence of paymentDay after dateStr
  const nextOccurrence = (dateStr, day) => {
    const d = new Date(dateStr + "T12:00:00");
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const actualDay = Math.min(day, maxDay);
    // If current day < paymentDay, use this month; otherwise next month
    if (d.getDate() < actualDay) {
      return new Date(d.getFullYear(), d.getMonth(), actualDay).toISOString().slice(0, 10);
    } else {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const nextMax = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      return new Date(next.getFullYear(), next.getMonth(), Math.min(day, nextMax)).toISOString().slice(0, 10);
    }
  };

  const paymentDay = mov.paymentDay || null;
  const startDay = parseInt(startDate.split("-")[2]);
  const effectiveDay = paymentDay || startDay;

  // First due date — use explicit firstDueDate if provided, otherwise calculate
  const firstDue = mov.firstDueDate
    ? mov.firstDueDate
    : paymentDay
      ? nextOccurrence(startDate, paymentDay)
      : freq.months === 1
        ? firstOfNextMonth(startDate)
        : lastDayOfPeriod(startDate, freq.months);

  // ── INTERÉS CAPITALIZABLE ─────────────────────────────────────────────────
  if (mov.interestType === "compound") {
    let accumulatedCapital = mov.amount;

    // Al vencimiento con capitalización
    if (freq.key === "at_maturity") {
      const days = daysBetween(startDate, endDate);
      const totalInterest = parseFloat((accumulatedCapital * dailyRate * days).toFixed(2));
      schedule.push({
        scheduleId: `${mov.id}_${endDate}`,
        capitalMovId: mov.id, dueDate: endDate,
        periodInterest: totalInterest,
        accumulatedCapital: accumulatedCapital + totalInterest,
        amount: totalInterest,
        isCompound: true, isFinal: true,
        partial: false, paid: false, paidDate: null,
      });
      return schedule;
    }

    // Build list of due dates (same logic as simple interest)
    const dueDates = [];
    if (firstDue <= endDate) dueDates.push({ date: firstDue, partial: startDay !== 1, partialDays: startDay !== 1 ? daysBetween(startDate, firstDue) : null });
    let current = addMonths(firstDue, freq.months);
    while (current <= endDate) { dueDates.push({ date: current, partial: false, partialDays: null }); current = addMonths(current, freq.months); }
    const lastDayOfEndMonth = lastOfMonth(endDate);
    const lastSched = dueDates.length > 0 ? dueDates[dueDates.length - 1].date : startDate;
    if (endDate < lastDayOfEndMonth && lastSched < endDate) {
      const days = daysBetween(lastSched, endDate);
      if (days > 0) dueDates.push({ date: endDate, partial: true, partialDays: days });
    }

    // Generate compound schedule
    dueDates.forEach(({ date, partial, partialDays }, idx) => {
      let periodInterest;
      if (partial && partialDays) {
        periodInterest = parseFloat((accumulatedCapital * dailyRate * partialDays).toFixed(2));
      } else {
        periodInterest = parseFloat((accumulatedCapital * mov.annualRate / 100 / 12 * (freq.months || 1)).toFixed(2));
      }
      accumulatedCapital = parseFloat((accumulatedCapital + periodInterest).toFixed(2));
      const isFinal = idx === dueDates.length - 1;
      schedule.push({
        scheduleId: `${mov.id}_${date}${partial?"_p":""}`,
        capitalMovId: mov.id, dueDate: date,
        periodInterest,
        accumulatedCapital,
        amount: isFinal ? accumulatedCapital : periodInterest, // final row shows total to collect
        isCompound: true, isFinal,
        partial, partialDays,
        paid: false, paidDate: null,
      });
    });

    return schedule;
  }

  // ── INTERÉS SIMPLE (lógica original) ─────────────────────────────────────
  const capital = mov.amount;
  const fullPeriodAmount = parseFloat((capital * mov.annualRate / 100 / 12 * (freq.months || 1)).toFixed(2));

  if (freq.key === "at_maturity") {
    const days = daysBetween(startDate, endDate);
    const amount = parseFloat((capital * dailyRate * days).toFixed(2));
    schedule.push({ scheduleId: `${mov.id}_${endDate}`, capitalMovId: mov.id, dueDate: endDate, amount, partial: false, paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate });
    return schedule;
  }

  if (firstDue <= endDate) {
    let firstAmount, isPartial, partialDays = null;
    // Natural first due = same day next period (not first of month)
    const naturalFirstDue = addMonths(startDate, freq.months);
    const isFullPeriod = firstDue === naturalFirstDue;
    const firstDueDay = parseInt(firstDue.split("-")[2]);
    const dayCoincides = firstDueDay === startDay;

    if (isFullPeriod) {
      // Natural period — full amount
      firstAmount = fullPeriodAmount; isPartial = false;
    } else if (dayCoincides) {
      // Same day of month — calculate exact months elapsed at monthly rate
      const firstDate = new Date(startDate + "T12:00:00");
      const dueDate  = new Date(firstDue   + "T12:00:00");
      const monthsElapsed = (dueDate.getFullYear() - firstDate.getFullYear()) * 12 + (dueDate.getMonth() - firstDate.getMonth());
      firstAmount = parseFloat((capital * mov.annualRate / 100 / 12 * monthsElapsed).toFixed(2));
      isPartial = monthsElapsed < freq.months;
      partialDays = null;
    } else {
      // Different day — proportional by days
      const daysInFirst = daysBetween(startDate, firstDue);
      firstAmount = parseFloat((capital * dailyRate * daysInFirst).toFixed(2));
      isPartial = true; partialDays = daysInFirst;
    }
    schedule.push({ scheduleId: `${mov.id}_${firstDue}`, capitalMovId: mov.id, dueDate: firstDue, amount: firstAmount, partial: isPartial, partialDays, paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate });
  }

  let current = addMonths(firstDue, freq.months);
  while (current <= endDate) {
    schedule.push({ scheduleId: `${mov.id}_${current}`, capitalMovId: mov.id, dueDate: current, amount: fullPeriodAmount, partial: false, paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate });
    current = addMonths(current, freq.months);
  }

  const lastScheduled = schedule.length > 0 ? schedule[schedule.length - 1].dueDate : startDate;
  const lastDayOfEndMonth = lastOfMonth(endDate);
  if (endDate < lastDayOfEndMonth && lastScheduled < endDate) {
    const endDay = parseInt(endDate.split("-")[2]);
    const lastSchedDay = parseInt(lastScheduled.split("-")[2]);
    const dayCoincides2 = endDay === lastSchedDay;
    let lastAmount, lastPartial, lastPartialDays = null;
    if (dayCoincides2) {
      // Same day — calculate exact months elapsed
      const lastD = new Date(lastScheduled + "T12:00:00");
      const endD  = new Date(endDate + "T12:00:00");
      const monthsElapsed = (endD.getFullYear() - lastD.getFullYear()) * 12 + (endD.getMonth() - lastD.getMonth());
      lastAmount = parseFloat((capital * mov.annualRate / 100 / 12 * monthsElapsed).toFixed(2));
      lastPartial = monthsElapsed < freq.months;
    } else {
      const days = daysBetween(lastScheduled, endDate);
      lastAmount = parseFloat((capital * dailyRate * days).toFixed(2));
      lastPartial = true;
      lastPartialDays = days;
    }
    if (lastAmount > 0) {
      schedule.push({ scheduleId: `${mov.id}_${endDate}_f`, capitalMovId: mov.id, dueDate: endDate, amount: lastAmount, partial: lastPartial, partialDays: lastPartialDays, paid: false, paidDate: null, snapshotCapital: capital, snapshotRate: mov.annualRate });
    }
  }

  return schedule;
};

const FILE_ICONS = {
  "application/pdf": { icon: "📄" }, "image/": { icon: "🖼" },
  "application/vnd.openxmlformats-officedocument": { icon: "📊" },
  "application/msword": { icon: "📝" }, "text/": { icon: "📃" }, default: { icon: "📎" },
};
const getFileIcon = (t = "") => { for (const [k, v] of Object.entries(FILE_ICONS)) { if (k !== "default" && t.startsWith(k)) return v; } return FILE_ICONS.default; };

const MOV_TYPES = {
  capital_in:  { label: "Ingreso de Capital", color: "#4ade80", sign: 1,  icon: "↑" },
  capital_out: { label: "Retiro de Capital",  color: "#f87171", sign: -1, icon: "↓" },
};

const INITIAL_INVESTORS = [
  { id: 1, name: "María García",     email: "maria@ejemplo.com" },
  { id: 2, name: "Carlos Rodríguez", email: "carlos@ejemplo.com" },
];
const INITIAL_MOVEMENTS = [
  { id: "m1", investorId: 1, type: "capital_in", amount: 500000, date: "2025-01-15", endDate: "2025-06-15", annualRate: 30, frequency: "monthly", note: "Inversión inicial", attachments: [] },
  { id: "m4", investorId: 2, type: "capital_in", amount: 300000, date: "2025-02-01", endDate: "2025-07-01", annualRate: 24, frequency: "monthly", note: "Inversión inicial", attachments: [] },
];
const INITIAL_SCHEDULES = (() => {
  const all = INITIAL_MOVEMENTS.flatMap(buildSchedule);
  // Mark first interest of m1 as paid (first of next month after Jan 15 = Feb 1)
  return all.map(s => s.scheduleId === "m1_2025-02-01" ? { ...s, paid: true, paidDate: "2025-02-20" } : s);
})();

// ─── Auth ─────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "admin1234";
// credentials: { [investorId]: { username, password } }
const INITIAL_CREDENTIALS = {
  1: { username: "maria.garcia",    password: "inv2025" },
  2: { username: "carlos.rodriguez", password: "inv2025" },
};

// ─── Client Portal (read-only view for investors) ─────────────────────────────
function ClientPortal({ investor, movements, schedules, onLogout }) {
  const fmt2 = (n) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
  const fmtD2 = (d) => { if(!d) return "-"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };

  const invMovs = movements.filter(m => m.investorId === investor.id);

  const [expanded, setExpanded] = useState(null);
  const [viewingAtts, setViewingAtts] = useState(null);
  const [statementModal, setStatementModal] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const today = new Date().toISOString().slice(0,10);

  // Split active/historic — same logic as getStatsSplit in admin
  const activeCapIns = invMovs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.endDate>=today);
  const histCapIns   = invMovs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.endDate<today);
  const activeIds  = activeCapIns.map(m=>m.id);
  const histIds    = histCapIns.map(m=>m.id);
  const allCapIds  = [...activeIds, ...histIds];

  const activeLinked = invMovs.filter(m=>m.type==="capital_in"&&m.linkedCapitalId&&activeIds.includes(m.linkedCapitalId));
  const activeOuts   = invMovs.filter(m=>m.type==="capital_out"&&activeIds.includes(m.linkedCapitalId));
  const allLinked    = invMovs.filter(m=>m.type==="capital_in"&&m.linkedCapitalId&&allCapIds.includes(m.linkedCapitalId));
  const allOuts      = invMovs.filter(m=>m.type==="capital_out"&&allCapIds.includes(m.linkedCapitalId));

  const activeCapIn  = [...activeCapIns,...activeLinked].reduce((s,m)=>s+m.amount,0);
  const activeCapOut = [...activeOuts,...activeCapIns.filter(m=>m.capitalPaid)].reduce((s,m)=>s+m.amount,0);
  const histCapIn    = [...activeCapIns,...histCapIns,...allLinked].reduce((s,m)=>s+m.amount,0);
  const histCapOut   = [...allOuts,...[...activeCapIns,...histCapIns].filter(m=>m.capitalPaid)].reduce((s,m)=>s+m.amount,0);

  const activeSched = schedules.filter(s=>activeIds.includes(s.capitalMovId));
  const allSched    = schedules.filter(s=>allCapIds.includes(s.capitalMovId));
  const intVal = (s) => s.isCompound ? (s.periodInterest||0) : s.amount;
  const aIntPaid    = activeSched.filter(s=>s.paid).reduce((s,i)=>s+intVal(i),0);
  const aIntPending = activeSched.filter(s=>!s.paid).reduce((s,i)=>s+intVal(i),0);
  const hIntDue     = allSched.reduce((s,i)=>s+intVal(i),0);
  const hIntPaid    = allSched.filter(s=>s.paid).reduce((s,i)=>s+intVal(i),0);

  const balance        = activeCapIn - activeCapOut;
  const totalWithdrawn = activeCapOut;

  const capitalIns = invMovs
    .filter(m => m.type==="capital_in" && !m.linkedCapitalId)
    .sort((a,b) => {
      const aActive = a.endDate >= today;
      const bActive = b.endDate >= today;
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.date) - new Date(a.date);
    });

  // Download attachment
  const downloadAtt = (att) => {
    const a = document.createElement("a");
    a.href = att.data;
    a.download = att.name;
    a.click();
  };

  return (
    <div style={{minHeight:"100vh",background:"#f0f2f8",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .btn-primary{background:#7c6af7;color:#fff;border:none;padding:10px 20px;border-radius:9px;font-weight:600;cursor:pointer;font-family:inherit;font-size:14px}
        .btn-ghost{background:transparent;color:#6b7094;border:1px solid #dde1f0;padding:9px 18px;border-radius:9px;font-weight:500;cursor:pointer;font-family:inherit;font-size:13px}
        .inp{background:#f5f6fb;border:1px solid #dde1f0;border-radius:9px;padding:10px 14px;color:#1a1d2e;font-family:inherit;font-size:14px;width:100%}
      `}</style>
      {/* Header */}
      <div style={{background:"#1a1d2e",padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#7c6af7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,color:"#fff"}}>{investor.name[0]}</div>
          <div>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{investor.name}</div>
            <div style={{color:"#a0a4c0",fontSize:11}}>Portal de inversiones</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={()=>setStatementModal(true)} style={{background:"#7c6af7",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>📄 Statement</button>
          <button onClick={onLogout} style={{background:"none",border:"1px solid #3a3d52",borderRadius:8,color:"#a0a4c0",fontSize:12,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit"}}>Cerrar sesión</button>
        </div>
      </div>

      {statementModal && <StatementModal investor={investor} movements={movements} schedules={schedules} onClose={()=>setStatementModal(false)} />}
      {viewingAtts && <AttachmentModal attachments={viewingAtts} onClose={()=>setViewingAtts(null)} />}

      <div style={{padding:"32px 32px"}}>
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>Mi cuenta</h2>
        <p style={{color:"#6b7094",fontSize:13,marginBottom:24}}>Resumen actualizado de tus inversiones</p>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:12}}>
          {[
            {label:"Capital invertido", value:fmt2(activeCapIn), color:"#4ade80"},
            {label:"Capital retirado",  value:fmt2(activeCapOut), color:"#f87171"},
            {label:"Saldo capital",     value:fmt2(balance), color:"#7c6af7"},
            {label:"Intereses cobrados",value:fmtDec(aIntPaid), color:"#fb923c"},
            {label:"Int. pendiente",    value:fmtDec(aIntPending), color:aIntPending>0?"#fb923c":"#4ade80"},
          ].map(s=>(
            <div key={s.label} style={{background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,color:"#6b7094",marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:16,fontWeight:700,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.value}</div>
            </div>
          ))}
        </div>
        {histCapIn>0&&(
          <div style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"#9ca3af",letterSpacing:1}}>TOTAL HISTÓRICO</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                {[
                  {label:"Capital invertido", value:fmt2(histCapIn), color:"#9ca3af"},
                  {label:"Capital retirado",  value:fmt2(histCapOut), color:"#9ca3af"},
                  {label:"Saldo capital",     value:fmt2(histCapIn-histCapOut), color:"#9ca3af"},
                  {label:"Int. total",        value:fmtDec(hIntDue), color:"#9ca3af"},
                  {label:"Int. cobrado",      value:fmtDec(hIntPaid), color:"#9ca3af"},
                ].map(s=>(
                  <div key={s.label} style={{background:"#f8f9ff",borderRadius:12,padding:"14px 16px",border:"1px solid #e8eaf2"}}>
                    <div style={{fontSize:11,color:"#9ca3af",marginBottom:5}}>{s.label}</div>
                    <div style={{fontSize:15,fontWeight:600,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.value}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Investments */}
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Mis inversiones</h3>
        {capitalIns.length===0 && <div style={{color:"#6b7094",fontSize:14,padding:20}}>No hay inversiones registradas.</div>}
        {(()=>{
          const vigentes = capitalIns.filter(m=>m.endDate>=today);
          const vencidas = capitalIns.filter(m=>m.endDate<today);
          const renderMov = (mov) => {
          const movSched = schedules.filter(s=>s.capitalMovId===mov.id).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
          const linked = invMovs.filter(m=>m.type==="capital_in"&&m.linkedCapitalId===mov.id);
          const outs = invMovs.filter(m=>m.type==="capital_out"&&m.linkedCapitalId===mov.id);
          const totalCap = mov.amount + linked.reduce((s,m)=>s+m.amount,0);
          const totalOut = outs.reduce((s,m)=>s+m.amount,0);
          const isExp = expanded===mov.id;
          const pendCount = movSched.filter(s=>!s.paid).length;
          const isActive = !mov.endDate || mov.endDate >= today;
          const intValM = (s) => s.isCompound ? (s.periodInterest||0) : s.amount;
          const totalInterest = movSched.reduce((s,i)=>s+intValM(i),0);
          const paidInterest  = movSched.filter(s=>s.paid).reduce((s,i)=>s+intValM(i),0);
          return (
            <div key={mov.id} style={{background:"#fff",borderRadius:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden",border:`1px solid ${isExp?"#7c6af750":"#e8eaf2"}`,transition:"all 0.15s"}}>
              <div onClick={()=>setExpanded(isExp?null:mov.id)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:"#4ade8018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:"#4ade80",flexShrink:0}}>↑</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:15,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>{fmt2(mov.amount)}</span>
                    {(totalOut>0||linked.length>0)&&<>
                      {linked.length>0&&<>
                        <span style={{fontSize:12,color:"#6b7094"}}>+</span>
                        <span style={{fontWeight:600,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>{fmt2(linked.reduce((s,m)=>s+m.amount,0))}</span>
                        <span style={{fontSize:11,color:"#6b7094"}}>aportes</span>
                      </>}
                      {totalOut>0&&<>
                        <span style={{fontSize:12,color:"#6b7094"}}>−</span>
                        <span style={{fontWeight:600,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#f87171"}}>{fmt2(totalOut)}</span>
                        <span style={{fontSize:11,color:"#6b7094"}}>retiros</span>
                      </>}
                      <span style={{fontSize:12,color:"#6b7094"}}>=</span>
                      <span style={{fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#7c6af7"}}>saldo {fmt2(totalCap-totalOut)}</span>
                    </>}
                    {mov.annualRate&&<span style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:"#7c6af715",color:"#7c6af7",fontWeight:600}}>{parseFloat(mov.annualRate).toFixed(2)}% anual</span>}
                    {mov.frequency&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#f5f6fb",color:"#6b7094",fontWeight:500,border:"1px solid #dde1f0"}}>{FREQUENCIES.find(f=>f.key===mov.frequency)?.label||"Mensual"}</span>}
                    {mov.interestType==="compound"&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#60a5fa18",color:"#60a5fa",border:"1px solid #60a5fa30"}}>Capitalizable</span>}
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:isActive?"#dcfce7":"#f3f4f6",color:isActive?"#15803d":"#6b7094",fontWeight:600}}>{isActive?"Activa":"Vencida"}</span>
                  </div>
                  <div style={{fontSize:12,color:"#6b7094",marginTop:3,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                    <span>
                      {mov.empresa&&<span style={{fontWeight:600,color:"#1a1d2e"}}>{mov.empresa} · </span>}
                      {mov.note||""}{mov.note?" · ":""}{fmtD2(mov.date)}{mov.endDate?` → ${fmtD2(mov.endDate)}`:""} 
                      {movSched.length>0&&<span style={{marginLeft:6,color:"#60a5fa"}}>· {movSched.filter(s=>s.paid).length}/{movSched.length} cuotas pagas</span>}
                    </span>
                    {totalInterest>0&&<>
                      <span style={{color:"#e5e7eb"}}>|</span>
                      <span>Int. total: <span style={{fontWeight:600,color:"#fb923c",fontFamily:"'DM Mono',monospace"}}>{fmtDec(totalInterest)}</span></span>
                      <span style={{color:"#e5e7eb"}}>·</span>
                      <span>Cobrado: <span style={{fontWeight:600,color:"#4ade80",fontFamily:"'DM Mono',monospace"}}>{fmtDec(paidInterest)}</span></span>
                    </>}
                  </div>
                </div>
                <span style={{fontSize:18,color:"#7c6af7",transform:isExp?"rotate(90deg)":"rotate(0)",transition:"transform 0.2s",lineHeight:1,flexShrink:0}}>›</span>
              </div>
              {isExp && (
                <div style={{borderTop:"1px solid #eef0f8",padding:"12px 16px 14px",background:"#fafbff",borderRadius:"0 0 12px 12px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#6b7094",letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Movimientos cronológicos</div>
                  {[
                    ...linked.map(m=>({date:m.date,kind:"deposit",data:m})),
                    ...outs.map(m=>({date:m.date,kind:"withdrawal",data:m})),
                    ...movSched.map(s=>({date:s.dueDate,kind:"interest",data:s})),
                  ].sort((a,b)=>new Date(a.date)-new Date(b.date)).map((item,i)=>{
                    if(item.kind==="interest"){
                      const s=item.data;
                      const isOverdue=!s.paid&&s.dueDate<today&&!s.isCompound;
                      const isFinal=s.isFinal;
                      const isCompound=s.isCompound;
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,
                          background:isFinal?"#ede9fe":s.paid?"#dcfce7":isOverdue?"#fee2e2":"#e8eaf8",
                          border:`1px solid ${isFinal?"#7c6af750":s.paid?"#4ade8050":isOverdue?"#f8717150":"#c7cbea"}`,marginBottom:6}}>
                          <div style={{width:30,height:30,borderRadius:9,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,
                            background:isFinal?"#7c6af718":s.paid?"#4ade8018":isOverdue?"#f8717118":"#fb923c18",
                            color:isFinal?"#7c6af7":s.paid?"#4ade80":isOverdue?"#f87171":"#fb923c"}}>
                            {isFinal?"Σ":s.paid?"✓":isOverdue?"!":"%"}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span style={{fontWeight:600,fontSize:14,fontFamily:"'DM Mono',monospace",color:s.paid?"#4ade80":isOverdue?"#f87171":"#1a1d2e"}}>
                                {fmtDec(isCompound?(s.periodInterest||0):s.amount)}
                              </span>
                              {s.scheduleId?.endsWith('_res')&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#fb923c15",color:"#fb923c",border:"1px solid #fb923c30"}}>saldo pendiente</span>}
                              {s.partial&&!s.scheduleId?.endsWith('_res')&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#7c6af715",color:"#7c6af7",border:"1px solid #7c6af730"}}>proporcional</span>}
                              {isFinal&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#7c6af720",color:"#7c6af7"}}>Capital + intereses</span>}
                              <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,fontWeight:600,
                                background:s.paid?"#4ade8020":isOverdue?"#f8717120":"#fb923c20",
                                color:s.paid?"#4ade80":isOverdue?"#f87171":"#fb923c"}}>
                                {s.paid?"Cobrado":isOverdue?"Vencido":"Pendiente"}
                              </span>
                            </div>
                            <div style={{fontSize:12,color:"#6b7094",marginTop:2}}>
                              Venc.: {fmtD2(s.dueDate)}
                              {s.paid&&s.paidDate&&<span style={{marginLeft:8,color:"#4ade8099"}}>· Cobrado el {fmtD2(s.paidDate)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if(item.kind==="deposit") return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,background:"#dcfce7",border:"1px solid #4ade8050",marginBottom:6}}>
                        <div style={{width:30,height:30,borderRadius:8,background:"#4ade8018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#4ade80",flexShrink:0}}>↑</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <span style={{fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>+ {fmt2(item.data.amount)}</span>
                            <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#4ade8018",color:"#4ade80",border:"1px solid #4ade8030"}}>Aporte adicional</span>
                            {item.data.note&&<span style={{fontSize:12,color:"#6b7094"}}>{item.data.note}</span>}
                          </div>
                          <div style={{fontSize:12,color:"#6b7094",marginTop:2}}>{fmtD2(item.date)}</div>
                        </div>
                      </div>
                    );
                    if(item.kind==="withdrawal") return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,background:"#fee2e2",border:"1px solid #f8717150",marginBottom:6}}>
                        <div style={{width:30,height:30,borderRadius:8,background:"#f8717118",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#f87171",flexShrink:0}}>↓</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <span style={{fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#f87171"}}>− {fmt2(item.data.amount)}</span>
                            <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#f8717118",color:"#f87171",border:"1px solid #f8717130"}}>Retiro</span>
                            {item.data.note&&<span style={{fontSize:12,color:"#6b7094"}}>{item.data.note}</span>}
                          </div>
                          <div style={{fontSize:12,color:"#6b7094",marginTop:2}}>{fmtD2(item.date)}</div>
                        </div>
                      </div>
                    );
                    return null;
                  })}
                  {/* Saldo capital */}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:mov.capitalPaid?"#f0fdf4":"#f5f4ff",border:`1px solid ${mov.capitalPaid?"#4ade8040":"#7c6af730"}`,marginTop:8}}>
                    <div style={{width:30,height:30,borderRadius:8,background:mov.capitalPaid?"#4ade8018":"#7c6af718",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:mov.capitalPaid?"#4ade80":"#7c6af7",flexShrink:0}}>{mov.capitalPaid?"✓":"Σ"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:mov.capitalPaid?"#16a34a":"#7c6af7"}}>Saldo de capital al vencimiento</div>
                      <div style={{fontSize:11,color:"#6b7094",marginTop:1}}>{fmt2(totalCap - totalOut)} · {mov.capitalPaid?`Devuelto el ${fmtD2(mov.capitalPaidDate)}`:"Pendiente de devolución"}</div>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:mov.capitalPaid?"#16a34a":"#7c6af7"}}>{fmt2(totalCap - totalOut)}</div>
                  </div>
                </div>
              )}
            </div>
          );
          };
          return (<>
            {vigentes.length>0&&<>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,marginTop:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80"}}/>
                <span style={{fontSize:12,fontWeight:700,color:"#4ade80",letterSpacing:1}}>VIGENTES</span>
                <span style={{fontSize:11,color:"#6b7094"}}>({vigentes.length})</span>
              </div>
              {vigentes.map(renderMov)}
            </>}
            {vencidas.length>0&&<>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,marginTop:vigentes.length>0?24:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#f87171"}}/>
                <span style={{fontSize:12,fontWeight:700,color:"#f87171",letterSpacing:1}}>HISTÓRICAS</span>
                <span style={{fontSize:11,color:"#6b7094"}}>({vencidas.length})</span>
              </div>
              {vencidas.map(renderMov)}
            </>}
          </>);
        })()}
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ investors, credentials, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Check URL param ?inv=username on mount
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get("inv");
    if (u) setUsername(u);
  });

  const handleLogin = () => {
    setLoading(true); setError("");
    setTimeout(()=>{
      const entry = Object.entries(credentials).find(([,c])=>c.username===username.trim());
      if (!entry) { setError("Usuario o contraseña incorrectos."); setLoading(false); return; }
      const [investorId, cred] = entry;
      if (cred.password !== password) { setError("Usuario o contraseña incorrectos."); setLoading(false); return; }
      const investor = investors.find(i=>i.id===parseInt(investorId));
      if (!investor) { setError("Cuenta no encontrada."); setLoading(false); return; }
      onLogin(investor);
    }, 400);
  };

  return (
    <div style={{minHeight:"100vh",background:"#f0f2f8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:"min(400px,94vw)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:16,background:"#1a1d2e",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24}}>💼</div>
          <h1 style={{fontSize:22,fontWeight:700,color:"#1a1d2e"}}>Portal de Inversiones</h1>
          <p style={{color:"#6b7094",fontSize:13,marginTop:6}}>Ingresá con tus credenciales</p>
        </div>
        <div style={{background:"#fff",borderRadius:16,padding:"32px 28px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
          <label style={{fontSize:13,fontWeight:600,color:"#6b7094",display:"block",marginBottom:6}}>Usuario</label>
          <input value={username} onChange={e=>{setUsername(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            style={{width:"100%",padding:"11px 14px",borderRadius:9,border:"1.5px solid #dde1f0",fontSize:14,fontFamily:"inherit",marginBottom:14,outline:"none",boxSizing:"border-box"}}
            placeholder="tu.usuario" autoComplete="username" />
          <label style={{fontSize:13,fontWeight:600,color:"#6b7094",display:"block",marginBottom:6}}>Contraseña</label>
          <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            style={{width:"100%",padding:"11px 14px",borderRadius:9,border:"1.5px solid #dde1f0",fontSize:14,fontFamily:"inherit",marginBottom:6,outline:"none",boxSizing:"border-box"}}
            placeholder="••••••••" autoComplete="current-password" />
          {error && <div style={{color:"#f87171",fontSize:12,marginBottom:10}}>{error}</div>}
          <div style={{marginBottom:20}} />
          <button onClick={handleLogin} disabled={loading||!username||!password}
            style={{width:"100%",padding:"12px",borderRadius:10,background:"#1a1d2e",color:"#fff",fontWeight:700,fontSize:15,border:"none",cursor:"pointer",fontFamily:"inherit",opacity:loading||!username||!password?0.6:1,transition:"opacity 0.15s"}}>
            {loading?"Verificando...":"Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Access Management Modal (admin) ─────────────────────────────────────────
function AccessModal({ investors, credentials, onSave, onLoginAs, onClose }) {
  const [creds, setCreds] = useState({...credentials});
  const [showPass, setShowPass] = useState({});
  const [copied, setCopied] = useState({});

  const update = (invId, field, val) => setCreds(c=>({...c, [invId]:{...c[invId], [field]:val}}));

  const baseUrl = window.location.origin + window.location.pathname;
  const getLink = (username) => `${baseUrl}?inv=${encodeURIComponent(username)}`;

  const copyLink = (invId, username) => {
    navigator.clipboard.writeText(getLink(username));
    setCopied(p=>({...p,[invId]:true}));
    setTimeout(()=>setCopied(p=>({...p,[invId]:false})),2000);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:18,padding:28,width:"min(640px,96vw)",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
          <div style={{width:42,height:42,borderRadius:11,background:"#1a1d2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔐</div>
          <div>
            <div style={{fontWeight:700,fontSize:17}}>Accesos de clientes</div>
            <div style={{fontSize:12,color:"#6b7094"}}>Gestioná usuario, contraseña y link de cada inversor</div>
          </div>
        </div>

        {investors.map(inv=>{
          const c = creds[inv.id] || { username:"", password:"" };
          const hasCredentials = c.username && c.password;
          return (
            <div key={inv.id} style={{border:"1px solid #e8eaf2",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#7c6af7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#fff",flexShrink:0}}>{inv.name[0]}</div>
                <div style={{fontWeight:700,fontSize:14}}>{inv.name}</div>
                {inv.email && <div style={{fontSize:12,color:"#6b7094"}}>{inv.email}</div>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#6b7094",display:"block",marginBottom:4}}>USUARIO</label>
                  <input value={c.username} onChange={e=>update(inv.id,"username",e.target.value)}
                    style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}} placeholder="usuario.cliente" />
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#6b7094",display:"block",marginBottom:4}}>CONTRASEÑA</label>
                  <div style={{position:"relative"}}>
                    <input type={showPass[inv.id]?"text":"password"} value={c.password} onChange={e=>update(inv.id,"password",e.target.value)}
                      style={{width:"100%",padding:"8px 32px 8px 11px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}} placeholder="contraseña" />
                    <button onClick={()=>setShowPass(p=>({...p,[inv.id]:!p[inv.id]}))} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#6b7094"}}>
                      {showPass[inv.id]?"🙈":"👁"}
                    </button>
                  </div>
                </div>
              </div>
              {hasCredentials && (
                <div style={{background:"#f8f9ff",borderRadius:8,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                    <div style={{fontSize:12,color:"#6b7094"}}>
                      <span style={{fontWeight:600,color:"#1a1d2e"}}>Credenciales: </span>
                      Usuario: <code style={{background:"#eef0f8",padding:"1px 6px",borderRadius:4}}>{c.username}</code>
                      {" · "}Contraseña: <code style={{background:"#eef0f8",padding:"1px 6px",borderRadius:4}}>{c.password}</code>
                    </div>
                    <button onClick={()=>onLoginAs(inv)} style={{flexShrink:0,padding:"6px 14px",borderRadius:8,border:"none",background:"#7c6af7",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
                      👤 Ver portal
                    </button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,background:"#eef0fb",borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontSize:11,color:"#6b7094",fontWeight:600,flexShrink:0}}>🔗 LINK:</span>
                    <code style={{fontSize:11,color:"#1a1d2e",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getLink(c.username)}</code>
                    <button onClick={()=>copyLink(inv.id, c.username)}
                      style={{flexShrink:0,padding:"4px 12px",borderRadius:6,border:"none",background:copied[inv.id]?"#4ade80":"#1a1d2e",color:"#fff",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,transition:"background 0.2s"}}>
                      {copied[inv.id]?"✓ Copiado":"Copiar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={{display:"flex",gap:10,marginTop:6}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",borderRadius:10,border:"1.5px solid #dde1f0",background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600}}>Cancelar</button>
          <button onClick={()=>{onSave(creds);onClose();}} style={{flex:2,padding:"11px",borderRadius:10,border:"none",background:"#1a1d2e",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:700}}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
const exportToExcel = async (investors, movements, schedules, selectedInvestorId = null) => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const targets = selectedInvestorId ? investors.filter(i => i.id === selectedInvestorId) : investors;
  const getStats = (investorId) => {
    const movs = movements.filter(m => m.investorId === investorId);
    const capitalIn = movs.filter(m => m.type === "capital_in").reduce((s, m) => s + m.amount, 0);
    const capitalOut = movs.filter(m => m.type === "capital_out").reduce((s, m) => s + m.amount, 0);
    const capitalReturned = movs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.capitalPaid).reduce((s,m)=>s+m.amount,0);
    const totalOut = capitalOut + capitalReturned;
    const sched = schedules.filter(s => movs.map(m => m.id).includes(s.capitalMovId));
    const intVal = (s) => s.isCompound ? (s.periodInterest||0) : s.amount;
    const interestDue = sched.reduce((s, i) => s + intVal(i), 0);
    const interestPaid = sched.filter(s => s.paid).reduce((s, i) => s + intVal(i), 0);
    return { capitalIn, capitalOut:totalOut, balance: capitalIn - totalOut, interestDue, interestPaid, interestPending: interestDue - interestPaid };
  };
  const summaryRows = [
    ["CUENTA CORRIENTE DE INVERSORES","","","","","",""],
    ["Exportado el:", new Date().toLocaleDateString("es-AR"),"","","","",""],
    [""],
    ["Inversor","Email","Capital Invertido","Capital Retirado","Saldo Capital","Int. Total","Int. Pagado","Int. Pendiente"],
    ...targets.map(inv => { const s = getStats(inv.id); return [inv.name, inv.email||"", s.capitalIn, s.capitalOut, s.balance, s.interestDue, s.interestPaid, s.interestPending]; }),
  ];
  if (!selectedInvestorId) {
    const t = targets.reduce((acc, inv) => { const s = getStats(inv.id); return { capitalIn: acc.capitalIn+s.capitalIn, capitalOut: acc.capitalOut+s.capitalOut, balance: acc.balance+s.balance, interestDue: acc.interestDue+s.interestDue, interestPaid: acc.interestPaid+s.interestPaid, interestPending: acc.interestPending+s.interestPending }; }, { capitalIn:0,capitalOut:0,balance:0,interestDue:0,interestPaid:0,interestPending:0 });
    summaryRows.push(["TOTAL","", t.capitalIn, t.capitalOut, t.balance, t.interestDue, t.interestPaid, t.interestPending]);
  }
  const wsRes = XLSX.utils.aoa_to_sheet(summaryRows);
  wsRes["!cols"] = [{wch:26},{wch:26},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18}];
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");
  for (const inv of targets) {
    const movs = movements.filter(m => m.investorId === inv.id).sort((a,b) => new Date(a.date)-new Date(b.date));
    const stats = getStats(inv.id);
    const rows = [
      [`Cuenta Corriente - ${inv.name}`,"","","","",""],
      [inv.email ? `Email: ${inv.email}` : "","","","","",""],
      [""],["RESUMEN","","","","",""],
      ["Capital Invertido", stats.capitalIn,"","Int. Total", stats.interestDue,""],
      ["Capital Retirado", stats.capitalOut,"","Int. Pagado", stats.interestPaid,""],
      ["Saldo Capital", stats.balance,"","Int. Pendiente", stats.interestPending,""],
      [""],["MOVIMIENTOS","","","","",""],
      ["Fecha Inicio","Fecha Fin","Capital","Tasa Anual","Interés Mensual","Nota"],
      ...movs.filter(m => m.type==="capital_in" && !m.linkedCapitalId).map(m => [fmtDate(m.date), fmtDate(m.endDate||""), m.amount, m.annualRate?`${m.annualRate}%`:"-", m.annualRate?(m.amount*m.annualRate/100/12).toFixed(2):"-", m.note||""]),
      [""],["CRONOGRAMA DE INTERESES","","","","",""],
      ["Fecha Vencimiento","Capital Origen","Monto","Estado","Fecha Pago",""],
      ...schedules.filter(s => movs.map(m=>m.id).includes(s.capitalMovId)).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).map(s => {
        const mov = movs.find(m => m.id === s.capitalMovId);
        return [fmtDate(s.dueDate), mov?`${fmt(mov.amount)} @ ${mov.annualRate}%`:"", s.amount, s.paid?"Pagado":"Pendiente", s.paidDate?fmtDate(s.paidDate):"-",""];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{wch:16},{wch:16},{wch:16},{wch:14},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws, inv.name.replace(/[:\\/?*\[\]]/g,"").substring(0,31));
  }
  XLSX.writeFile(wb, selectedInvestorId ? `cuenta_${targets[0].name.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx` : `inversores_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function Dropzone({ attachments, onAdd, onRemove }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const handle = useCallback(async (files) => {
    for (const f of Array.from(files)) {
      if (f.size > 10*1024*1024) { alert(`"${f.name}" supera 10 MB`); continue; }
      onAdd({ id: genId(), name: f.name, size: f.size, type: f.type, data: await toB64(f) });
    }
  }, [onAdd]);
  return (
    <div>
      <div onClick={()=>ref.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files)}}
        style={{border:`2px dashed ${drag?"#7c6af7":"#dde1f0"}`,borderRadius:10,padding:"16px",textAlign:"center",cursor:"pointer",background:drag?"#f5f4ff":"transparent",transition:"all 0.15s",marginTop:6}}>
        <div style={{fontSize:20,marginBottom:4}}>📎</div>
        <div style={{fontSize:13,color:"#6b7094"}}>Arrastrá o <span style={{color:"#7c6af7",fontWeight:600}}>seleccioná archivos</span></div>
        <div style={{fontSize:11,color:"#c0c4d6",marginTop:3}}>PDF, imágenes, Word, Excel · máx. 10 MB</div>
      </div>
      <input ref={ref} type="file" multiple style={{display:"none"}} onChange={e=>handle(e.target.files)} />
      {attachments.length > 0 && (
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>
          {attachments.map(att => (
            <div key={att.id} style={{display:"flex",alignItems:"center",gap:9,background:"#f5f6fb",border:"1px solid #2e3347",borderRadius:8,padding:"7px 11px"}}>
              <span style={{fontSize:16}}>{getFileIcon(att.type).icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</div>
                <div style={{fontSize:11,color:"#6b7094"}}>{fmtSize(att.size)}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();onRemove(att.id)}} style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",fontSize:15,opacity:0.6}} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.6}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Attachment Viewer ────────────────────────────────────────────────────────
function AttachmentModal({ attachments, onClose }) {
  const [sel, setSel] = useState(attachments[0]);
  const dl = (a) => { const x = document.createElement("a"); x.href = a.data; x.download = a.name; x.click(); };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={onClose}>
      <div style={{background:"#ffffff",border:"1px solid #252836",borderRadius:18,width:"min(900px,95vw)",maxHeight:"90vh",display:"flex",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {attachments.length > 1 && (
          <div style={{width:200,borderRight:"1px solid #252836",padding:14,overflowY:"auto",flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#c0c4d6",marginBottom:10}}>ARCHIVOS</div>
            {attachments.map(a => (
              <div key={a.id} onClick={()=>setSel(a)} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",borderRadius:7,cursor:"pointer",background:sel?.id===a.id?"#dde1f0":"transparent",marginBottom:3}}>
                <span>{getFileIcon(a.type).icon}</span>
                <span style={{fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:sel?.id===a.id?"#1a1d2e":"#6b7094"}}>{a.name}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",padding:"13px 18px",borderBottom:"1px solid #252836",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel?.name}</div>
              <div style={{fontSize:12,color:"#6b7094"}}>{sel?fmtSize(sel.size):""}</div>
            </div>
            <button onClick={()=>dl(sel)} className="btn-ghost" style={{fontSize:12,padding:"6px 13px"}}>⬇ Descargar</button>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#6b7094",fontSize:22,lineHeight:1}}>✕</button>
          </div>
          <div style={{flex:1,overflow:"auto",display:"flex",alignItems:"center",justifyContent:"center",padding:22,minHeight:300}}>
            {sel && sel.type.startsWith("image/") && <img src={sel.data} alt={sel.name} style={{maxWidth:"100%",maxHeight:"68vh",borderRadius:8,objectFit:"contain"}} />}
            {sel && sel.type==="application/pdf" && <iframe src={sel.data} title={sel.name} style={{width:"100%",height:"66vh",border:"none",borderRadius:8}} />}
            {sel && !sel.type.startsWith("image/") && sel.type!=="application/pdf" && (
              <div style={{textAlign:"center",color:"#6b7094"}}>
                <div style={{fontSize:52,marginBottom:14}}>{getFileIcon(sel.type).icon}</div>
                <div style={{fontSize:15,fontWeight:600,color:"#1a1d2e",marginBottom:7}}>{sel.name}</div>
                <div style={{fontSize:13,marginBottom:18}}>Vista previa no disponible</div>
                <button onClick={()=>dl(sel)} className="btn-primary">⬇ Descargar archivo</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mark as Paid Modal ───────────────────────────────────────────────────────
function CapitalReturnModal({ movId, onConfirm, onClose }) {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:18,padding:28,width:"min(400px,94vw)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:42,height:42,borderRadius:12,background:"#4ade8020",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✓</div>
          <div>
            <div style={{fontWeight:700,fontSize:17}}>Marcar capital como devuelto</div>
            <div style={{fontSize:13,color:"#6b7094",marginTop:2}}>Seleccioná la fecha de devolución</div>
          </div>
        </div>
        <label style={{fontSize:13,fontWeight:600,color:"#6b7094",display:"block",marginBottom:6}}>Fecha de devolución</label>
        <input className="inp" type="date" value={date} onChange={e=>setDate(e.target.value)} max={today} style={{marginBottom:22}} />
        <div style={{display:"flex",gap:10}}>
          <button className="btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn-primary" onClick={()=>onConfirm(movId, date)} style={{flex:2,background:"#4ade80",color:"#0a2a14"}}>✓ Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function MarkPaidModal({ scheduleItem, capitalMov, onConfirm, onClose }) {
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0,10));
  const defaultAmount = scheduleItem.isCompound ? (scheduleItem.periodInterest||0) : scheduleItem.amount;
  const [paidAmount, setPaidAmount] = useState(String(defaultAmount));
  const isPartial = parseFloat(paidAmount) !== defaultAmount;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150}} onClick={onClose}>
      <div style={{background:"#ffffff",border:"1px solid #252836",borderRadius:18,padding:28,width:"min(440px,94vw)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{width:42,height:42,borderRadius:12,background:"#4ade8020",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✓</div>
          <div>
            <div style={{fontWeight:700,fontSize:17}}>Marcar interés como pagado</div>
            <div style={{fontSize:13,color:"#6b7094"}}>Vencimiento: {fmtDate(scheduleItem.dueDate)}</div>
          </div>
        </div>
        <div style={{background:"#f5f6fb",borderRadius:12,padding:"14px 16px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:12,color:"#6b7094"}}>Capital origen</div>
            <div style={{fontWeight:600,fontSize:14}}>{fmt(capitalMov.amount)} @ {parseFloat(capitalMov.annualRate).toFixed(2)}%</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,color:"#6b7094"}}>Monto de la cuota</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:20,color:"#4ade80"}}>{fmtDec(defaultAmount)}</div>
          </div>
        </div>
        <label style={{fontSize:13,fontWeight:500,color:"#6b7094",display:"block",marginBottom:6}}>Monto pagado *</label>
        <div style={{position:"relative",marginBottom:6}}>
          <input className="inp" type="number" step="0.01" min="0"
            value={paidAmount} onChange={e=>setPaidAmount(e.target.value)}
            style={{paddingRight:isPartial?100:16}} />
          {isPartial && <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:"#fb923c20",color:"#fb923c"}}>parcial</span>}
        </div>
        {isPartial && parseFloat(paidAmount) < defaultAmount && (
          <div style={{fontSize:11,color:"#fb923c",marginBottom:14}}>
            ⚠ Pagando menos del monto total ({fmtDec(defaultAmount - parseFloat(paidAmount||0))} pendiente)
          </div>
        )}
        {isPartial && parseFloat(paidAmount) > defaultAmount && (
          <div style={{fontSize:11,color:"#60a5fa",marginBottom:14}}>
            ℹ Pagando más del monto total
          </div>
        )}
        <label style={{fontSize:13,fontWeight:500,color:"#6b7094",display:"block",marginBottom:6,marginTop:isPartial?0:14}}>Fecha de pago *</label>
        <input className="inp" type="date" value={paidDate} onChange={e=>setPaidDate(e.target.value)} max={new Date().toISOString().slice(0,10)} style={{marginBottom:22}} />
        <div style={{display:"flex",gap:10}}>
          <button className="btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn-primary" onClick={()=>onConfirm(scheduleItem.scheduleId, paidDate, parseFloat(paidAmount)||defaultAmount)} style={{flex:2,background:"#4ade80",color:"#0a2a14"}}>✓ Confirmar Pago</button>
        </div>
      </div>
    </div>
  );
}

// ─── Regenerate schedule warning modal ───────────────────────────────────────
function RegenWarningModal({ paidCount, onConfirm, onCancel }) {
  const today = new Date().toISOString().slice(0,10);
  const [effectiveDate, setEffectiveDate] = useState(today);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150}} onClick={onCancel}>
      <div style={{background:"#ffffff",border:"1px solid #fb923c40",borderRadius:18,padding:28,width:"min(460px,94vw)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{width:42,height:42,borderRadius:12,background:"#fb923c20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⚠</div>
          <div>
            <div style={{fontWeight:700,fontSize:17}}>Aplicar cambios al cronograma</div>
            <div style={{fontSize:13,color:"#6b7094"}}>Los datos de la inversión cambiaron</div>
          </div>
        </div>
        <p style={{fontSize:14,color:"#2d3152",lineHeight:1.6,marginBottom:16}}>
          Indicá a partir de qué fecha querés que surtan efecto los cambios. Las cuotas con vencimiento anterior a esa fecha no se modificarán.
        </p>
        <label style={{fontSize:12,fontWeight:600,color:"#6b7094",display:"block",marginBottom:6}}>FECHA DE VIGENCIA</label>
        <input type="date" value={effectiveDate} onChange={e=>setEffectiveDate(e.target.value)}
          max={today}
          style={{width:"100%",padding:"10px 14px",borderRadius:9,border:"1.5px solid #7c6af7",fontSize:14,fontFamily:"inherit",marginBottom:16,outline:"none",boxSizing:"border-box",background:"#f8f9ff"}} />
        {paidCount > 0 && (
          <div style={{background:"#f8717118",border:"1px solid #f8717140",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#f87171"}}>
            ⚠ Tenés <strong>{paidCount} cuota{paidCount>1?"s":""} marcada{paidCount>1?"s":""} como pagada{paidCount>1?"s":""}</strong> — no se modificarán.
          </div>
        )}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" style={{background:"#fb923c"}} onClick={()=>onConfirm(effectiveDate)}>Aplicar cambios</button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Row ─────────────────────────────────────────────────────────────
function ScheduleRow({ item, capitalMov, onMarkPaid, onUnmark, onEditAmount, onMarkAllPaid }) {
  const today = new Date().toISOString().slice(0,10);
  const isCompound = item.isCompound;
  const isFinal = item.isFinal;
  const isOverdue = !item.paid && item.dueDate < today && !isCompound;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  const handleSaveAmount = () => {
    const val = parseFloat(editVal.replace(",","."));
    if (!isNaN(val) && val > 0) onEditAmount(item.scheduleId, val);
    setEditing(false);
  };

  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,
      background: isFinal ? "#ede9fe" : item.paid ? "#dcfce7" : isOverdue ? "#fee2e2" : "#e8eaf8",
      border:`1px solid ${item.paid?"#4ade8050":isOverdue?"#f8717150":isFinal?"#7c6af750":"#c7cbea"}`,
      marginBottom:6,transition:"all 0.15s"}}>
      <div style={{width:32,height:32,borderRadius:9,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,
        background: isFinal?"#7c6af718":item.paid?"#4ade8018":isOverdue?"#f8717118":"#fb923c18",
        color: isFinal?"#7c6af7":item.paid?"#4ade80":isOverdue?"#f87171":"#fb923c"}}>
        {isFinal?"Σ":item.paid?"✓":isOverdue?"!":"%"}
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {isCompound ? (
            <>
              <span style={{fontWeight:600,fontSize:14,fontFamily:"'DM Mono',monospace",color:isFinal?"#7c6af7":item.paid?"#4ade80":isOverdue?"#f87171":"#fb923c"}}>
                {isFinal ? fmtDec(item.accumulatedCapital) : `+${fmtDec(item.periodInterest)}`}
              </span>
              {!isFinal && (
                <span style={{fontSize:12,color:"#6b7094",fontFamily:"'DM Mono',monospace"}}>
                  → cap. {fmtDec(item.accumulatedCapital)}
                </span>
              )}
            </>
          ) : (
            editing ? (
              <div style={{display:"flex",alignItems:"center",gap:6}} onClick={e=>e.stopPropagation()}>
                <input autoFocus type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")handleSaveAmount();if(e.key==="Escape")setEditing(false);}}
                  style={{width:110,padding:"3px 8px",borderRadius:7,border:"1.5px solid #7c6af7",fontFamily:"'DM Mono',monospace",fontSize:13,outline:"none"}} />
                <button onClick={handleSaveAmount} style={{padding:"3px 8px",borderRadius:7,border:"none",background:"#7c6af7",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
                <button onClick={()=>setEditing(false)} style={{padding:"3px 7px",borderRadius:7,border:"1px solid #dde1f0",background:"#fff",color:"#6b7094",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontWeight:600,fontSize:14,fontFamily:"'DM Mono',monospace",color:item.paid?"#4ade80":isOverdue?"#f87171":"#1a1d2e"}}>{fmtDec(item.amount)}</span>
                {!item.paid && <button onClick={e=>{e.stopPropagation();setEditVal(String(item.amount));setEditing(true);}} style={{padding:"2px 6px",borderRadius:6,border:"1px solid #dde1f0",background:"none",color:"#6b7094",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏</button>}
              </div>
            )
          )}
          {item.adjustedByWithdrawal && item.originalAmount != null && item.originalAmount !== item.amount && (
            <span style={{fontSize:11,color:"#6b7094",textDecoration:"line-through",fontFamily:"'DM Mono',monospace"}}>{fmt(item.originalAmount)}</span>
          )}
          {item.partial && !item.adjustedByWithdrawal && !isFinal && !item.scheduleId?.endsWith('_res') && (
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#7c6af715",color:"#7c6af7",border:"1px solid #7c6af730"}}>proporcional</span>
          )}
          {item.scheduleId?.endsWith('_res') && (
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#fb923c15",color:"#fb923c",border:"1px solid #fb923c30"}}>saldo pendiente</span>
          )}
          {item.adjustedByWithdrawal && (
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#f8717118",color:"#f87171",border:"1px solid #f8717130"}}>ajustado por retiro</span>
          )}
          {isFinal ? (
            <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,fontWeight:600,background:"#7c6af720",color:"#7c6af7"}}>Capital + intereses</span>
          ) : (
            <span style={{fontSize:11,padding:"2px 7px",borderRadius:20,fontWeight:600,background:item.paid?"#4ade8020":isOverdue?"#f8717120":isCompound&&!item.paid&&item.dueDate<today?"#7c6af720":"#fb923c20",color:item.paid?"#4ade80":isOverdue?"#f87171":isCompound&&!item.paid&&item.dueDate<today?"#7c6af7":"#fb923c"}}>
              {item.paid?"Pagado":isOverdue?"Vencido":isCompound&&!item.paid&&item.dueDate<today?"Devengado":"Pendiente"}
            </span>
          )}
        </div>
        <div style={{fontSize:12,color:"#6b7094",marginTop:2}}>
          {isFinal ? "Vencimiento final · cobro total" : `Venc.: ${fmtDate(item.dueDate)}`}
          {item.paid && item.paidDate && <span style={{marginLeft:8,color:"#4ade8099"}}>· Pagado el {fmtDate(item.paidDate)}</span>}
          {!isCompound && (() => {
            const cap = item.snapshotCapital ?? capitalMov.amount;
            const rate = item.snapshotRate ?? capitalMov.annualRate;
            return <span style={{marginLeft:8,color:"#c0c4d6"}}>· {fmt(cap)} @ {rate}%</span>;
          })()}
        </div>
      </div>
      {!isFinal && (item.paid ? (
        <button onClick={()=>onUnmark(item.scheduleId)} style={{background:"none",border:"1px solid #dde1f0",borderRadius:8,cursor:"pointer",color:"#6b7094",fontSize:12,padding:"5px 10px",fontFamily:"inherit",transition:"all 0.15s"}} onMouseOver={e=>{e.currentTarget.style.borderColor="#f87171";e.currentTarget.style.color="#f87171"}} onMouseOut={e=>{e.currentTarget.style.borderColor="#dde1f0";e.currentTarget.style.color="#6b7094"}}>
          Desmarcar
        </button>
      ) : (
        <button onClick={()=>onMarkPaid(item)} className="btn-primary" style={{fontSize:12,padding:"7px 14px",background:"#4ade80",color:"#0a2a14",whiteSpace:"nowrap"}}>Marcar pagado</button>
      ))}
      {isFinal && (item.paid ? (
        <button onClick={()=>onUnmark(item.scheduleId)} style={{background:"none",border:"1px solid #dde1f0",borderRadius:8,cursor:"pointer",color:"#6b7094",fontSize:12,padding:"5px 10px",fontFamily:"inherit",transition:"all 0.15s"}} onMouseOver={e=>{e.currentTarget.style.borderColor="#f87171";e.currentTarget.style.color="#f87171"}} onMouseOut={e=>{e.currentTarget.style.borderColor="#dde1f0";e.currentTarget.style.color="#6b7094"}}>
          Desmarcar
        </button>
      ) : (
        <button onClick={()=>onMarkAllPaid(item)} className="btn-primary" style={{fontSize:12,padding:"7px 14px",background:"#7c6af7",color:"#fff",whiteSpace:"nowrap"}}>Cobrar total</button>
      ))}
    </div>
  );
}

// ─── Statement Modal ──────────────────────────────────────────────────────────
function StatementModal({ investor, movements, schedules, onClose }) {
  const today = new Date().toISOString().slice(0,10);
  const [asOfDate, setAsOfDate] = useState(today);
  const [fromDate, setFromDate] = useState("");
  const [generating, setGenerating] = useState(false);

  const fmtARS = (n) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:2}).format(n);
  const fmtD = (d) => { if(!d) return "-"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };

  const generatePDF = () => {
    setGenerating(true);

    const invMovs = movements.filter(m => m.investorId === investor.id && m.date <= asOfDate);
    const capitalIns = invMovs.filter(m => m.type==="capital_in" && !m.linkedCapitalId);
    const capitalOuts = invMovs.filter(m => m.type==="capital_out");
    const deposits = invMovs.filter(m => m.type==="capital_in" && m.linkedCapitalId);
    const capitalReturned2 = invMovs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.capitalPaid).reduce((s,m)=>s+m.amount,0);
    const totalCapital = invMovs.filter(m=>m.type==="capital_in").reduce((s,m)=>s+m.amount,0);
    const totalWithdrawn = capitalOuts.reduce((s,m)=>s+m.amount,0) + capitalReturned2;
    const balance = totalCapital - totalWithdrawn;
    const allMovIds = invMovs.map(m=>m.id);
    const relevantSched = schedules.filter(s => allMovIds.includes(s.capitalMovId) && s.dueDate <= asOfDate);
    const interestPaid = relevantSched.filter(s=>s.paid).reduce((s,i)=>s+i.amount,0);

    // Filter transactions by fromDate if set
    const inRange = (date) => (!fromDate || date >= fromDate) && date <= asOfDate;

    // Calculate opening balance (everything before fromDate)
    let openingBalance = 0;
    if (fromDate) {
      const allMovsBefore = movements.filter(m => m.investorId === investor.id && m.date < fromDate);
      const allMovIdsAll  = movements.filter(m => m.investorId === investor.id).map(m=>m.id);
      const schedBefore   = schedules.filter(s => allMovIdsAll.includes(s.capitalMovId) && (s.paidDate||s.dueDate) < fromDate && s.paid);
      const capInBefore   = allMovsBefore.filter(m=>m.type==="capital_in").reduce((s,m)=>s+m.amount,0);
      const capOutBefore  = allMovsBefore.filter(m=>m.type==="capital_out").reduce((s,m)=>s+m.amount,0);
      const devBefore     = allMovsBefore.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.capitalPaid&&m.capitalPaidDate<fromDate).reduce((s,m)=>s+m.amount,0);
      const intDevBefore  = schedules.filter(s=>allMovIdsAll.includes(s.capitalMovId)&&s.dueDate<fromDate).reduce((s,i)=>s+i.amount,0);
      const intPaidBefore = schedBefore.reduce((s,i)=>s+i.amount,0);
      openingBalance = capInBefore - capOutBefore - devBefore + intDevBefore - intPaidBefore;
    }

    const transactions = [
      ...capitalIns.filter(m=>inRange(m.date)).map(m=>({date:m.date,type:"Inversión",typeClass:"cap-in",desc:m.empresa?`${m.empresa}${m.note?` · ${m.note}`:""}`:m.note||"Ingreso de capital",credit:m.amount,debit:null,rate:m.annualRate,endDate:m.endDate})),
      ...deposits.filter(m=>inRange(m.date)).map(m=>({date:m.date,type:"Aporte adicional",typeClass:"deposit",desc:m.note||"Aporte de capital",credit:m.amount,debit:null})),
      ...capitalOuts.filter(m=>inRange(m.date)).map(m=>({date:m.date,type:"Retiro de capital",typeClass:"cap-out",desc:m.note||"Retiro de capital",credit:null,debit:m.amount})),
      ...capitalIns.filter(m=>m.capitalPaid&&m.capitalPaidDate&&inRange(m.capitalPaidDate)).map(m=>({date:m.capitalPaidDate,type:"Dev. capital",typeClass:"cap-out",desc:`Devolución capital${m.empresa?` · ${m.empresa}`:""}`,credit:null,debit:m.amount})),
      // Group intereses devengados by date+empresa
      ...Object.values(relevantSched.filter(s=>inRange(s.dueDate)).reduce((acc,s)=>{
        const cap=invMovs.find(m=>m.id===s.capitalMovId);
        const empresa=cap?.empresa||cap?.note||"";
        const key=`${s.dueDate}_${empresa}`;
        if(!acc[key]) acc[key]={date:s.dueDate,type:"Interés devengado",typeClass:"interest",desc:`Interés ${empresa}`.trim(),credit:0,debit:null};
        acc[key].credit+=s.amount;
        return acc;
      },{})),
      // Group intereses pagados by paidDate+empresa
      ...Object.values(relevantSched.filter(s=>s.paid&&inRange(s.paidDate||s.dueDate)).reduce((acc,s)=>{
        const cap=invMovs.find(m=>m.id===s.capitalMovId);
        const empresa=cap?.empresa||cap?.note||"";
        const date=s.paidDate||s.dueDate;
        const key=`${date}_${empresa}_paid`;
        if(!acc[key]) acc[key]={date,type:"Interés pagado",typeClass:"interest-paid",desc:`Cobro interés ${empresa}`.trim(),credit:null,debit:0};
        acc[key].debit+=s.amount;
        return acc;
      },{})),
    ].sort((a,b)=>new Date(a.date)-new Date(b.date) || (a.credit?-1:1));

    let running = openingBalance;
    const rows = transactions.map(t=>{ if(t.credit) running+=t.credit; else running-=t.debit; return {...t,running}; });

    const activeIns = capitalIns.filter(m=>!m.endDate||m.endDate>=asOfDate);

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Estado de Cuenta — ${investor.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#1a1d2e;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{max-width:800px;margin:0 auto;padding:0;}
.header{background:#1a1d2e;color:#fff;padding:28px 40px;display:flex;justify-content:space-between;align-items:center;}
.brand{font-size:20px;font-weight:700;letter-spacing:-0.5px;}
.brand-sub{font-size:10px;color:#a0a4c0;margin-top:3px;letter-spacing:1px;text-transform:uppercase;}
.doc-title{font-size:16px;font-weight:700;text-align:right;}
.doc-sub{font-size:11px;color:#a0a4c0;margin-top:4px;text-align:right;}
.body{padding:32px 40px;}
.account-box{background:#f8f9ff;border-radius:10px;padding:18px 22px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e8eaf2;}
.account-name{font-size:16px;font-weight:700;}
.account-email{font-size:12px;color:#6b7094;margin-top:3px;}
.period-label{font-size:10px;color:#6b7094;text-transform:uppercase;letter-spacing:1px;text-align:right;}
.period-value{font-size:13px;font-weight:600;text-align:right;margin-top:2px;}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:30px;}
.card{border:1px solid #e8eaf2;border-radius:8px;padding:14px 16px;}
.card.dark{background:#1a1d2e;border-color:#1a1d2e;}
.card-label{font-size:9px;color:#6b7094;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;}
.card.dark .card-label{color:#a0a4c0;}
.card-value{font-size:14px;font-weight:700;font-family:'Courier New',monospace;}
.card-value.g{color:#16a34a;}.card-value.r{color:#dc2626;}.card-value.o{color:#ea580c;}.card-value.w{color:#fff;}
.section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7094;margin-bottom:10px;margin-top:24px;}
table{width:100%;border-collapse:collapse;margin-bottom:4px;}
thead tr{background:#1a1d2e;}
thead th{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#fff;padding:8px 10px;text-align:left;}
thead th.r{text-align:right;}
tbody tr:nth-child(even){background:#f8f9ff;}
tbody td{padding:9px 10px;border-bottom:1px solid #f0f2f8;font-size:12px;vertical-align:middle;}
tbody td.r{text-align:right;}
.badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700;white-space:nowrap;}
.cap-in{background:#dcfce7;color:#15803d;}
.deposit{background:#e0f2fe;color:#0369a1;}
.cap-out{background:#fee2e2;color:#dc2626;}
.interest{background:#fef3c7;color:#92400e;}
.interest-paid{background:#f3e8ff;color:#7c3aed;}
.badge-simple{background:#dcfce7;color:#15803d;}
.badge-compound{background:#dbeafe;color:#1d4ed8;}
.cr{color:#16a34a;font-weight:700;font-family:'Courier New',monospace;}
.dr{color:#dc2626;font-weight:700;font-family:'Courier New',monospace;}
.bal{font-weight:700;font-family:'Courier New',monospace;}
.muted{color:#9ca3af;}
.footer{margin-top:32px;padding-top:14px;border-top:1px solid #e8eaf2;display:flex;justify-content:space-between;}
.footer span{font-size:10px;color:#9ca3af;}
@media print{.page{max-width:100%;}}
</style></head><body><div class="page">
<div class="header">
  <div><div class="brand">InversorApp</div><div class="brand-sub">Sistema de gestión de inversiones</div></div>
  <div><div class="doc-title">Estado de Cuenta</div><div class="doc-sub">Emitido al ${fmtD(asOfDate)}</div></div>
</div>
<div class="body">
  <div class="account-box">
    <div><div class="account-name">${investor.name}</div>${investor.email?`<div class="account-email">${investor.email}</div>`:""}</div>
    <div><div class="period-label">Período</div><div class="period-value">${fromDate?`${fmtD(fromDate)} al `:""} ${fmtD(asOfDate)}</div></div>
  </div>
  <div class="section-title">Resumen de cuenta</div>
  <div class="cards">
    <div class="card"><div class="card-label">Capital invertido</div><div class="card-value g">${fmtARS(totalCapital)}</div></div>
    <div class="card"><div class="card-label">Capital retirado</div><div class="card-value r">${fmtARS(totalWithdrawn)}</div></div>
    <div class="card"><div class="card-label">Intereses cobrados</div><div class="card-value o">${fmtARS(interestPaid)}</div></div>
    <div class="card dark"><div class="card-label">Saldo capital</div><div class="card-value w">${fmtARS(balance)}</div></div>
  </div>
  ${activeIns.length>0?`
  <div class="section-title">Inversiones activas al ${fmtD(asOfDate)}</div>
  <table><thead><tr><th>Empresa / Descripción</th><th>Inicio</th><th>Vencimiento</th><th>Tasa</th><th>Tipo</th><th class="r">Capital neto</th></tr></thead><tbody>
  ${activeIns.map(m=>{
    const linked2=invMovs.filter(d=>d.type==="capital_in"&&d.linkedCapitalId===m.id);
    const outs2=invMovs.filter(d=>d.type==="capital_out"&&d.linkedCapitalId===m.id);
    const totalCap=m.amount+linked2.reduce((s,d)=>s+d.amount,0);
    const totalOut2=outs2.reduce((s,d)=>s+d.amount,0);
    const netCap=totalCap-totalOut2;
    return `<tr><td><strong>${m.empresa||m.note||"—"}</strong></td><td>${fmtD(m.date)}</td><td>${fmtD(m.endDate)}</td><td><strong>${parseFloat(m.annualRate).toFixed(2)}%</strong></td><td><span class="badge ${m.interestType==="compound"?"badge-compound":"badge-simple"}">${m.interestType==="compound"?"Capitalizable":"Simple"}</span></td><td class="r"><strong>${fmtARS(netCap)}</strong></td></tr>`;
  }).join("")}
  </tbody></table>`:""}
  <div class="section-title">Movimientos y transacciones</div>
  ${rows.length===0?`<p style="color:#6b7094;padding:16px 0">No hay movimientos registrados hasta esta fecha.</p>`:`
  <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th class="r">Crédito</th><th class="r">Débito</th><th class="r">Saldo</th></tr></thead><tbody>
  ${fromDate && openingBalance !== 0 ? `<tr style="background:#f0f4ff">
    <td style="color:#6b7094;font-family:'Courier New',monospace;font-size:11px">${fmtD(fromDate)}</td>
    <td><span class="badge" style="background:#e0e7ff;color:#3730a3">Saldo anterior</span></td>
    <td style="color:#6b7094;font-style:italic">Saldo acumulado al ${fmtD(fromDate)}</td>
    <td class="r"><span class="muted">—</span></td>
    <td class="r"><span class="muted">—</span></td>
    <td class="r"><span class="bal">${fmtARS(openingBalance)}</span></td>
  </tr>` : ""}
  ${rows.map(r=>`<tr>
    <td style="color:#6b7094;font-family:'Courier New',monospace;font-size:11px">${fmtD(r.date)}</td>
    <td><span class="badge ${r.typeClass}">${r.type}</span></td>
    <td>${r.desc}${r.rate?` <span style="color:#6b7094;font-size:11px">(${r.rate}%${r.endDate?` → ${fmtD(r.endDate)}`:""}</span>)`:""}</td>
    <td class="r">${r.credit?`<span class="cr">+${fmtARS(r.credit)}</span>`:`<span class="muted">—</span>`}</td>
    <td class="r">${r.debit?`<span class="dr">-${fmtARS(r.debit)}</span>`:`<span class="muted">—</span>`}</td>
    <td class="r"><span class="bal">${fmtARS(r.running)}</span></td>
  </tr>`).join("")}
  </tbody></table>`}
  <div class="footer">
    <span>Generado el ${fmtD(today)} · InversorApp · Solo para uso interno</span>
    <span>Página 1</span>
  </div>
</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

    // Download as HTML file (opens in browser, user prints to PDF)
    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${investor.name.replace(/\s+/g,"_")}_${asOfDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:18,padding:32,width:"min(440px,94vw)",boxShadow:"0 24px 60px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
          <div style={{width:44,height:44,borderRadius:12,background:"#1a1d2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>
          <div>
            <div style={{fontWeight:700,fontSize:17}}>Estado de Cuenta</div>
            <div style={{fontSize:13,color:"#6b7094"}}>{investor.name}</div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
          <div>
            <label style={{fontSize:13,fontWeight:500,color:"#6b7094",display:"block",marginBottom:6}}>Fecha desde</label>
            <input className="inp" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} max={asOfDate} />
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:500,color:"#6b7094",display:"block",marginBottom:6}}>Fecha de corte</label>
            <input className="inp" type="date" value={asOfDate} onChange={e=>{setAsOfDate(e.target.value); if(fromDate && e.target.value < fromDate) setFromDate("");}} max={today} />
          </div>
        </div>
        <div style={{fontSize:11,color:"#6b7094",marginBottom:24}}>Se incluirán movimientos e intereses en el período seleccionado. Se descarga un archivo HTML que podés abrir en el browser e imprimir como PDF.</div>

        <div style={{display:"flex",gap:10}}>
          <button className="btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn-primary" onClick={generatePDF} disabled={generating}
            style={{flex:2,background:"#7c6af7",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {generating?"Generando...":"⬇ Descargar Statement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

// ─── Reporte: Vencimientos ────────────────────────────────────────────────────
function ReporteVencimientos({ investors, movements }) {
  const today = new Date().toISOString().slice(0,10);
  const fmt2 = (n) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(n);

  const [filtEmpresa, setFiltEmpresa] = useState("");
  const [filtInversor, setFiltInversor] = useState("");
  const [filtDesde, setFiltDesde] = useState(today);

  const empresas = [...new Set(movements.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.empresa).map(m=>m.empresa))].sort();

  const rows = movements
    .filter(m => m.type==="capital_in" && !m.linkedCapitalId && m.endDate)
    .filter(m => !filtEmpresa || m.empresa===filtEmpresa)
    .filter(m => !filtInversor || String(m.investorId)===filtInversor)
    .filter(m => !filtDesde || m.endDate >= filtDesde)
    .map(m => {
      const inv = investors.find(i=>i.id===m.investorId);
      const aportes = movements.filter(x=>x.type==="capital_in"&&x.linkedCapitalId===m.id).reduce((s,x)=>s+x.amount,0);
      const retiros = movements.filter(x=>x.type==="capital_out"&&x.linkedCapitalId===m.id).reduce((s,x)=>s+x.amount,0);
      const montoNeto = m.amount + aportes - retiros;
      return { ...m, inv, montoNeto };
    })
    .filter(r => r.inv)
    .sort((a,b) => new Date(a.endDate)-new Date(b.endDate));

  const proximas = rows.filter(r => r.endDate >= today);
  const vencidas  = rows.filter(r => r.endDate <  today);

  const fmtMes = (dateStr) => {
    const [y,m] = dateStr.split("-");
    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `${meses[parseInt(m)-1]} ${y}`;
  };

  const TableRows = ({items, overdue}) => {
    // Group by end month
    const groups = {};
    items.forEach(r => {
      const key = r.endDate.slice(0,7);
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    const sortedKeys = Object.keys(groups).sort();
    const grandTotal = items.reduce((s,r)=>s+r.montoNeto,0);

    return <>
      {sortedKeys.map(key => {
        const groupItems = groups[key];
        const subtotal = groupItems.reduce((s,r)=>s+r.montoNeto,0);
        return (
          <React.Fragment key={key}>
            {groupItems.map((r,i) => {
              const dias = Math.abs(Math.round((new Date(r.endDate)-new Date(today))/86400000));
              return (
                <tr key={r.id} style={{borderTop:`1px solid ${overdue?"#fee2e2":"#f0f2f8"}`,background:overdue?"#fff9f9":"#fff"}}>
                  <td style={{padding:"9px 16px",fontSize:13,fontWeight:600}}>{r.inv.name}</td>
                  <td style={{padding:"9px 16px",fontSize:13,color:"#6b7094"}}>{r.empresa||"—"}</td>
                  <td style={{padding:"9px 16px",fontSize:13,fontFamily:"'DM Mono',monospace",color:"#6b7094"}}>{fmtDate(r.date)}</td>
                  <td style={{padding:"9px 16px",fontSize:13,fontFamily:"'DM Mono',monospace",textAlign:"right",color:"#4ade80",fontWeight:700}}>{fmt2(r.montoNeto)}</td>
                  <td style={{padding:"9px 16px",fontSize:13,fontFamily:"'DM Mono',monospace",color:overdue?"#f87171":"#1a1d2e"}}>
                    {fmtDate(r.endDate)}
                    <span style={{marginLeft:8,padding:"2px 7px",borderRadius:20,fontSize:11,fontWeight:600,
                      background:overdue?"#fee2e2":dias<=30?"#fff7ed":"#f0f2f8",
                      color:overdue?"#f87171":dias<=30?"#ea580c":"#6b7094"}}>
                      {overdue?`hace ${dias}d`:`en ${dias}d`}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr style={{background:overdue?"#fff0f0":"#f0f4ff",borderTop:`2px solid ${overdue?"#f8717130":"#7c6af730"}`}}>
              <td colSpan={3} style={{padding:"7px 16px",fontSize:12,fontWeight:700,color:overdue?"#f87171":"#7c6af7"}}>
                Subtotal {fmtMes(key)}
              </td>
              <td style={{padding:"7px 16px",fontSize:13,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:700,color:overdue?"#f87171":"#7c6af7"}}>{fmt2(subtotal)}</td>
              <td />
            </tr>
          </React.Fragment>
        );
      })}
      <tr style={{background:"#1a1d2e",borderTop:"2px solid #1a1d2e"}}>
        <td colSpan={3} style={{padding:"10px 16px",fontSize:13,fontWeight:700,color:"#fff"}}>TOTAL</td>
        <td style={{padding:"10px 16px",fontSize:14,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:700,color:"#4ade80"}}>{fmt2(grandTotal)}</td>
        <td />
      </tr>
    </>;
  };

  return (
    <div>
      {/* Filtros */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20,padding:"16px 18px",background:"#f8f9ff",borderRadius:12,border:"1px solid #e8eaf2"}}>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6b7094",letterSpacing:.5}}>EMPRESA</label>
          <select value={filtEmpresa} onChange={e=>setFiltEmpresa(e.target.value)}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#1a1d2e"}}>
            <option value="">Todas</option>
            {empresas.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6b7094",letterSpacing:.5}}>INVERSOR</label>
          <select value={filtInversor} onChange={e=>setFiltInversor(e.target.value)}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#1a1d2e"}}>
            <option value="">Todos</option>
            {investors.sort((a,b)=>a.name.localeCompare(b.name)).map(i=><option key={i.id} value={String(i.id)}>{i.name}</option>)}
          </select>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6b7094",letterSpacing:.5}}>VENCIMIENTO DESDE</label>
          <input type="date" value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#1a1d2e"}} />
        </div>
        {(filtEmpresa||filtInversor||filtDesde!==today)&&(
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <button onClick={()=>{setFiltEmpresa("");setFiltInversor("");setFiltDesde(today);}}
              style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #dde1f0",background:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#6b7094"}}>
              ✕ Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Activas primero */}
      <div style={{background:"#fff",border:"1px solid #dde1f0",borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"10px 16px",borderBottom:"1px solid #f0f2f8"}}>
          <span style={{fontWeight:700,fontSize:13,color:"#1a1d2e"}}>Inversiones activas</span>
          <span style={{marginLeft:8,fontSize:12,color:"#6b7094"}}>({proximas.length})</span>
        </div>
        {proximas.length === 0 ? (
          <div style={{padding:"24px 16px",color:"#6b7094",fontSize:13,textAlign:"center"}}>No hay inversiones activas para los filtros seleccionados.</div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8f9ff"}}>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>INVERSOR</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>EMPRESA</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>FECHA INICIO</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"right",letterSpacing:.5}}>SALDO AL VENCIMIENTO</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>FECHA FIN</th>
            </tr></thead>
            <tbody><TableRows items={proximas} overdue={false} /></tbody>
          </table>
        )}
      </div>

      {vencidas.length > 0 && (
        <div style={{marginBottom:20,background:"#fff5f5",border:"1px solid #f8717140",borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"10px 16px",background:"#f8717112",borderBottom:"1px solid #f8717130"}}>
            <span style={{fontWeight:700,fontSize:13,color:"#f87171"}}>⚠ Inversiones históricas</span>
            <span style={{marginLeft:8,fontSize:12,color:"#f87171"}}>({vencidas.length})</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#fff7f7"}}>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>INVERSOR</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>EMPRESA</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>FECHA INICIO</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"right",letterSpacing:.5}}>SALDO AL VENCIMIENTO</th>
              <th style={{padding:"8px 16px",fontSize:11,fontWeight:700,color:"#6b7094",textAlign:"left",letterSpacing:.5}}>FECHA FIN</th>
            </tr></thead>
            <tbody><TableRows items={vencidas} overdue={true} /></tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reporte: Vista cruzada ───────────────────────────────────────────────────
function ReporteCruzado({ investors, movements, schedules }) {
  const today = new Date().toISOString().slice(0,10);
  const fmt2 = (n) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(n);
  const fmtDate2 = (d) => { if(!d) return "-"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };

  // Filtros
  const [filtEmpresa, setFiltEmpresa] = useState("");
  const [filtInversor, setFiltInversor] = useState("");
  const [filtDesde, setFiltDesde] = useState(today);

  // Opciones únicas
  const empresas = [...new Set(movements.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.empresa).map(m=>m.empresa))].sort();

  // Inversiones principales filtradas por empresa e inversor
  const capitalMovs = movements
    .filter(m => m.type==="capital_in" && !m.linkedCapitalId)
    .filter(m => !filtEmpresa || m.empresa===filtEmpresa)
    .filter(m => !filtInversor || String(m.investorId)===filtInversor);

  const pendingScheds = schedules
    .filter(s => !s.paid)
    .filter(s => !(s.isCompound && s.isFinal))
    .filter(s => capitalMovs.find(m=>m.id===s.capitalMovId))
    .filter(s => !filtDesde || s.dueDate >= filtDesde);

  const monthKey = (d) => d.slice(0,7);
  const allMonths = [...new Set(pendingScheds.map(s=>monthKey(s.dueDate)))].sort();

  const monthLabel = (key) => {
    const [y,m] = key.split("-");
    const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${meses[parseInt(m)-1]} ${y}`;
  };
  const isOverdueMonth = (m) => m < today.slice(0,7);

  // Pivot por movimiento (inversión)
  const pivot = {};
  capitalMovs.forEach(m => { pivot[m.id] = {}; allMonths.forEach(mo => { pivot[m.id][mo] = 0; }); });
  pendingScheds.forEach(s => { if (pivot[s.capitalMovId]) pivot[s.capitalMovId][monthKey(s.dueDate)] += s.amount; });

  const colTotals = {};
  allMonths.forEach(mo => { colTotals[mo] = capitalMovs.reduce((acc,m)=>acc+(pivot[m.id]?.[mo]||0), 0); });
  const grandTotal = Object.values(colTotals).reduce((a,b)=>a+b, 0);
  const rowTotal = (movId) => allMonths.reduce((acc,mo)=>acc+(pivot[movId]?.[mo]||0), 0);

  // Solo filas con al menos un valor
  const rows = capitalMovs
    .filter(m => rowTotal(m.id) > 0)
    .map(m => ({ ...m, inv: investors.find(i=>i.id===m.investorId) }))
    .filter(r => r.inv)
    .sort((a,b) => (a.empresa||"").localeCompare(b.empresa||"") || a.inv.name.localeCompare(b.inv.name));

  // Group rows by investor
  const rowsByInvestor = {};
  rows.forEach(r => {
    const key = r.inv.id;
    if (!rowsByInvestor[key]) rowsByInvestor[key] = { inv: r.inv, rows: [] };
    rowsByInvestor[key].rows.push(r);
  });
  const investorGroups = Object.values(rowsByInvestor).sort((a,b)=>a.inv.name.localeCompare(b.inv.name));

  return (
    <div>
      <h2 style={{fontSize:17,fontWeight:700,marginBottom:16}}>Vista cruzada por inversor</h2>

      {/* Filtros */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20,padding:"16px 18px",background:"#f8f9ff",borderRadius:12,border:"1px solid #e8eaf2"}}>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6b7094",letterSpacing:.5}}>EMPRESA</label>
          <select value={filtEmpresa} onChange={e=>setFiltEmpresa(e.target.value)}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#1a1d2e"}}>
            <option value="">Todas</option>
            {empresas.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6b7094",letterSpacing:.5}}>INVERSOR</label>
          <select value={filtInversor} onChange={e=>setFiltInversor(e.target.value)}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#1a1d2e"}}>
            <option value="">Todos</option>
            {investors.sort((a,b)=>a.name.localeCompare(b.name)).map(i=><option key={i.id} value={String(i.id)}>{i.name}</option>)}
          </select>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
          <label style={{fontSize:11,fontWeight:600,color:"#6b7094",letterSpacing:.5}}>INTERESES DESDE</label>
          <input type="date" value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}
            style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #dde1f0",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#1a1d2e"}} />
        </div>
        {(filtEmpresa||filtInversor||filtDesde!==today)&&(
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <button onClick={()=>{setFiltEmpresa("");setFiltInversor("");setFiltDesde(today);}}
              style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #dde1f0",background:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#6b7094"}}>
              ✕ Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {allMonths.length === 0 ? (
        <div style={{background:"#fff",border:"1px solid #dde1f0",borderRadius:12,padding:"24px",color:"#6b7094",fontSize:13,textAlign:"center"}}>No hay intereses pendientes para los filtros seleccionados.</div>
      ) : (
      <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #dde1f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:allMonths.length*110+340}}>
          <thead>
            <tr style={{background:"#1a1d2e"}}>
              <th style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#fff",textAlign:"left",letterSpacing:.5,position:"sticky",left:0,background:"#1a1d2e",zIndex:1,minWidth:140}}>EMPRESA</th>
              <th style={{padding:"10px 14px",fontSize:11,fontWeight:700,color:"#a0a4c0",textAlign:"left",letterSpacing:.5,minWidth:140}}>INVERSOR</th>
              {allMonths.map(m=>(
                <th key={m} style={{padding:"10px 12px",fontSize:11,fontWeight:700,color:isOverdueMonth(m)?"#f87171":"#a0a4c0",textAlign:"right",minWidth:110,whiteSpace:"nowrap"}}>
                  {isOverdueMonth(m)?"⚠ ":""}{monthLabel(m)}
                </th>
              ))}
              <th style={{padding:"10px 14px",fontSize:11,fontWeight:700,color:"#7c6af7",textAlign:"right",minWidth:120,whiteSpace:"nowrap",borderLeft:"2px solid #2e3347"}}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {investorGroups.map(group => {
              const InvGroup = () => {
                const [expanded, setExpanded] = useState(false);
                const invColTotals = {};
                allMonths.forEach(mo => { invColTotals[mo] = group.rows.reduce((acc,r)=>acc+(pivot[r.id]?.[mo]||0),0); });
                const invTotal = Object.values(invColTotals).reduce((a,b)=>a+b,0);
                return (
                  <React.Fragment>
                    <tr style={{background:"#f0f2f8",borderTop:"2px solid #dde1f0",cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
                      <td style={{padding:"9px 16px",fontSize:12,fontWeight:700,color:"#1a1d2e",position:"sticky",left:0,background:"#f0f2f8",zIndex:1,whiteSpace:"nowrap"}}>
                        <span style={{marginRight:6,fontSize:11,color:"#7c6af7"}}>{expanded?"▾":"▸"}</span>
                        {group.inv.name}
                        <span style={{marginLeft:6,fontSize:11,color:"#6b7094",fontWeight:400}}>({group.rows.length})</span>
                      </td>
                      <td style={{padding:"9px 14px"}}></td>
                      {allMonths.map(mo=>{
                        const val = invColTotals[mo]||0;
                        return <td key={mo} style={{padding:"9px 12px",fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:val>0?700:400,color:val===0?"#d1d5db":isOverdueMonth(mo)?"#f87171":"#1a1d2e"}}>{val===0?"—":fmt2(val)}</td>;
                      })}
                      <td style={{padding:"9px 14px",fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:700,color:"#7c6af7",borderLeft:"2px solid #e8eaf2"}}>{fmt2(invTotal)}</td>
                    </tr>
                    {expanded && group.rows.map(r => {
                      const total = rowTotal(r.id);
                      return (
                        <tr key={r.id} style={{borderTop:"1px solid #f0f2f8",background:"#fff"}}>
                          <td style={{padding:"9px 16px 9px 32px",fontSize:12,color:"#6b7094",position:"sticky",left:0,background:"#fff",zIndex:1}}>{r.empresa||"—"}</td>
                          <td style={{padding:"9px 14px",fontSize:12,color:"#9ca3af"}}>{r.inv.name}</td>
                          {allMonths.map(mo=>{
                            const val = pivot[r.id]?.[mo]||0;
                            return <td key={mo} style={{padding:"9px 12px",fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right",color:val===0?"#d1d5db":isOverdueMonth(mo)?"#f87171":"#1a1d2e",fontWeight:val>0?500:400}}>{val===0?"—":fmt2(val)}</td>;
                          })}
                          <td style={{padding:"9px 14px",fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:600,color:"#7c6af7",borderLeft:"2px solid #f0f2f8"}}>{fmt2(total)}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              };
              return <InvGroup key={group.inv.id} />;
            })}
            <tr style={{borderTop:"2px solid #dde1f0",background:"#f8f9ff"}}>
              <td colSpan={2} style={{padding:"10px 16px",fontSize:13,fontWeight:700,position:"sticky",left:0,background:"#f8f9ff",zIndex:1}}>TOTAL</td>
              {allMonths.map(mo=>(
                <td key={mo} style={{padding:"10px 12px",fontSize:13,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:700,
                  color:isOverdueMonth(mo)?"#f87171":"#1a1d2e"}}>
                  {colTotals[mo]>0?fmt2(colTotals[mo]):"—"}
                </td>
              ))}
              <td style={{padding:"10px 14px",fontSize:13,fontFamily:"'DM Mono',monospace",textAlign:"right",fontWeight:700,color:"#7c6af7",borderLeft:"2px solid #dde1f0"}}>{fmt2(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ─── Reportes View ────────────────────────────────────────────────────────────
function ReportesView({ investors, movements, schedules }) {
  const [activeReport, setActiveReport] = useState(null);

  const REPORTS = [
    { id:"vencimientos", icon:"📅", title:"Vencimientos próximos",     desc:"Cuotas por cobrar en los próximos días y cuotas vencidas sin cobrar" },
    { id:"cruzado",      icon:"⊞",  title:"Vista cruzada por inversor", desc:"Tabla pivot con inversores en filas y meses de vencimiento en columnas" },
  ];

  if (!activeReport) return (
    <div>
      <h1 style={{fontSize:26,fontWeight:700,marginBottom:6}}>Reportes</h1>
      <p style={{color:"#6b7094",marginBottom:32,fontSize:14}}>Seleccioná el reporte que querés ver</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
        {REPORTS.map(r=>(
          <button key={r.id} onClick={()=>setActiveReport(r.id)}
            style={{textAlign:"left",padding:"24px",borderRadius:14,border:"1.5px solid #dde1f0",background:"#fff",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#7c6af7";e.currentTarget.style.background="#faf9ff";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#dde1f0";e.currentTarget.style.background="#fff";}}>
            <div style={{fontSize:28,marginBottom:12}}>{r.icon}</div>
            <div style={{fontSize:15,fontWeight:700,color:"#1a1d2e",marginBottom:6}}>{r.title}</div>
            <div style={{fontSize:12,color:"#6b7094",lineHeight:1.5}}>{r.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const activeLabel = REPORTS.find(r=>r.id===activeReport);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
        <button onClick={()=>setActiveReport(null)}
          style={{background:"none",border:"none",cursor:"pointer",color:"#7c6af7",fontWeight:600,fontSize:13,fontFamily:"inherit",padding:"6px 10px",borderRadius:8,display:"flex",alignItems:"center",gap:6}}
          onMouseEnter={e=>e.currentTarget.style.background="#f0edff"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          ← Reportes
        </button>
        <span style={{color:"#c0c4d6",fontSize:13}}>/</span>
        <span style={{fontSize:13,fontWeight:600,color:"#1a1d2e"}}>{activeLabel?.icon} {activeLabel?.title}</span>
      </div>
      {activeReport==="vencimientos" && <ReporteVencimientos investors={investors} movements={movements} />}
      {activeReport==="cruzado"      && <ReporteCruzado     investors={investors} movements={movements} schedules={schedules} />}
    </div>
  );
}


export default function App() {
  const [credentials, setCredentials] = useState({});
  const [clientSession, setClientSession] = useState(null);
  const [accessModal, setAccessModal] = useState(false);

  // ── Cargar datos desde Supabase al iniciar ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [invRows, movRows, schedRows, credRows, compRows] = await Promise.all([
          sb.get("investors","?order=id"),
          sb.get("movements","?order=date"),
          sb.get("schedules","?order=due_date&limit=9999"),
          sb.get("credentials"),
          sb.get("companies","?order=name"),
        ]);
        if (invRows.code || movRows.code) throw new Error(invRows.message || movRows.message || "Error de conexión");
        setInvestors(invRows.map(r=>({id:r.id,name:r.name,email:r.email||""})));
        setMovements(movRows.map(movFromDB));
        setSchedules(schedRows.map(schedFromDB));
        setCredentials(credFromDB(credRows));
        setCompanies(compRows.map(r=>({id:r.id,name:r.name,legalName:r.legal_name||"",taxId:r.tax_id||""})));
      } catch(e) {
        setDbError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);
  const [view, setView]           = useState("dashboard");
  const [investors, setInvestors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [movements, setMovements] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dbError, setDbError]     = useState(null);
  const [selectedInvestorId, setSelectedInvestorId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [toast, setToast]           = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewingAttachments, setViewingAttachments] = useState(null);
  const [markPaidItem, setMarkPaidItem] = useState(null);
  const [regenWarning, setRegenWarning] = useState(null);
  const [expandedMovId, setExpandedMovId] = useState(null);
  const [statementModal, setStatementModal] = useState(null);
  const [histOpenDash, setHistOpenDash] = useState(false);
  const [histOpenInv, setHistOpenInv]   = useState(false);
  const [capitalReturnModal, setCapitalReturnModal] = useState(null); // { movId } // { pendingSave: fn, paidCount: n }

  const emptyMovForm = { investorId:"", type:"capital_in", amount:"", date:"", endDate:"", annualRate:"", frequency:"monthly", interestType:"simple", empresa:"", note:"", attachments:[], linkedCapitalId:"", firstDueDate:"" };
  const [movForm, setMovForm]   = useState(emptyMovForm);
  const [editingMovId, setEditingMovId] = useState(null); // null = create, string = edit
  const [invForm, setInvForm]   = useState({ name:"", email:"" });
  const [editingInvestorId, setEditingInvestorId] = useState(null);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),2800); };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const today2 = new Date().toISOString().slice(0,10);

  const getStats = useCallback((investorId) => {
    const movs = movements.filter(m => m.investorId === investorId);
    const capitalIn  = movs.filter(m=>m.type==="capital_in").reduce((s,m)=>s+m.amount,0);
    const capitalOut = movs.filter(m=>m.type==="capital_out").reduce((s,m)=>s+m.amount,0);
    const capitalReturned = movs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.capitalPaid).reduce((s,m)=>s+m.amount,0);
    const sched = schedules.filter(s=>movs.map(m=>m.id).includes(s.capitalMovId));
    // For compound isFinal, use periodInterest (not amount which includes capital)
    const intVal = (s) => s.isCompound ? (s.periodInterest||0) : s.amount;
    const interestDue  = sched.reduce((s,i)=>s+intVal(i),0);
    const interestPaid = sched.filter(s=>s.paid).reduce((s,i)=>s+intVal(i),0);
    const totalOut = capitalOut + capitalReturned;
    return { capitalIn, capitalOut:totalOut, balance:capitalIn-totalOut, interestDue, interestPaid, interestPending:interestDue-interestPaid };
  }, [movements, schedules]);

  const getStatsSplit = useCallback((investorId) => {
    const movs = movements.filter(m => m.investorId === investorId);
    const activeCapIns = movs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.endDate>=today2);
    const histCapIns   = movs.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId&&m.endDate<today2);
    const activeIds = activeCapIns.map(m=>m.id);
    const histIds   = histCapIns.map(m=>m.id);
    const allCapIds = [...activeIds, ...histIds];
    const activeLinked = movs.filter(m=>m.type==="capital_in"&&m.linkedCapitalId&&activeIds.includes(m.linkedCapitalId));
    const activeOuts   = movs.filter(m=>m.type==="capital_out"&&activeIds.includes(m.linkedCapitalId));
    const histLinked   = movs.filter(m=>m.type==="capital_in"&&m.linkedCapitalId&&histIds.includes(m.linkedCapitalId));
    const histOuts     = movs.filter(m=>m.type==="capital_out"&&histIds.includes(m.linkedCapitalId));
    const allLinked    = movs.filter(m=>m.type==="capital_in"&&m.linkedCapitalId&&allCapIds.includes(m.linkedCapitalId));
    const allOuts      = movs.filter(m=>m.type==="capital_out"&&allCapIds.includes(m.linkedCapitalId));
    const activeCapIn  = [...activeCapIns,...activeLinked].reduce((s,m)=>s+m.amount,0);
    const activeCapOut = [...activeOuts].reduce((s,m)=>s+m.amount,0);
    const activeReturned = activeCapIns.filter(m=>m.capitalPaid).reduce((s,m)=>s+m.amount,0);
    const totalCapIn   = [...activeCapIns,...histCapIns,...allLinked].reduce((s,m)=>s+m.amount,0);
    const totalCapOut  = allOuts.reduce((s,m)=>s+m.amount,0);
    const totalReturned= [...activeCapIns,...histCapIns].filter(m=>m.capitalPaid).reduce((s,m)=>s+m.amount,0);
    const activeSched  = schedules.filter(s=>activeIds.includes(s.capitalMovId));
    const allSched     = schedules.filter(s=>allCapIds.includes(s.capitalMovId));
    const intVal = (s) => s.isCompound ? (s.periodInterest||0) : s.amount;
    const aIntDue=activeSched.reduce((s,i)=>s+intVal(i),0);
    const aIntPaid=activeSched.filter(s=>s.paid).reduce((s,i)=>s+intVal(i),0);
    const tIntDue=allSched.reduce((s,i)=>s+intVal(i),0);
    const tIntPaid=allSched.filter(s=>s.paid).reduce((s,i)=>s+intVal(i),0);
    const aTotalOut = activeCapOut+activeReturned;
    const tTotalOut = totalCapOut+totalReturned;
    return {
      active:   { capitalIn:activeCapIn, capitalOut:aTotalOut, balance:activeCapIn-aTotalOut, interestDue:aIntDue, interestPaid:aIntPaid, interestPending:aIntDue-aIntPaid },
      historic: { capitalIn:totalCapIn,  capitalOut:tTotalOut, balance:totalCapIn-tTotalOut,  interestDue:tIntDue, interestPaid:tIntPaid, interestPending:tIntDue-tIntPaid },
      hasHistoric: histCapIns.length > 0,
    };
  }, [movements, schedules, today2]);

  const globalStats = useMemo(() =>
    investors.reduce((acc,inv)=>{ const s=getStatsSplit(inv.id).active; return {capitalIn:acc.capitalIn+s.capitalIn,capitalOut:acc.capitalOut+s.capitalOut,balance:acc.balance+s.balance,interestDue:acc.interestDue+s.interestDue,interestPaid:acc.interestPaid+s.interestPaid,interestPending:acc.interestPending+s.interestPending}; }, {capitalIn:0,capitalOut:0,balance:0,interestDue:0,interestPaid:0,interestPending:0})
  , [investors, getStatsSplit]);

  const globalStatsHist = useMemo(() =>
    investors.reduce((acc,inv)=>{ const s=getStatsSplit(inv.id).historic; return {capitalIn:acc.capitalIn+s.capitalIn,capitalOut:acc.capitalOut+s.capitalOut,balance:acc.balance+s.balance,interestDue:acc.interestDue+s.interestDue,interestPaid:acc.interestPaid+s.interestPaid,interestPending:acc.interestPending+s.interestPending}; }, {capitalIn:0,capitalOut:0,balance:0,interestDue:0,interestPaid:0,interestPending:0})
  , [investors, getStatsSplit]);

  const globalHasHistoric = useMemo(() => investors.some(inv=>getStatsSplit(inv.id).hasHistoric), [investors, getStatsSplit]);

  const selectedInvestor  = investors.find(i=>i.id===selectedInvestorId);
  const selectedMovements = useMemo(()=> selectedInvestorId ? movements.filter(m=>m.investorId===selectedInvestorId).sort((a,b)=>new Date(b.date)-new Date(a.date)) : [], [movements,selectedInvestorId]);
  const selectedSchedules = useMemo(()=>{ const ids=selectedMovements.map(m=>m.id); return schedules.filter(s=>ids.includes(s.capitalMovId)).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)); }, [schedules,selectedMovements]);

  const monthlyInterest = useMemo(()=>{ const a=parseFloat(movForm.amount),r=parseFloat(movForm.annualRate); return (!a||!r)?null:a*r/100/12; }, [movForm.amount,movForm.annualRate]);
  const previewMonths = useMemo(()=>{ if(movForm.type!=="capital_in"||!movForm.amount||!movForm.annualRate||!movForm.date||!movForm.endDate)return 0; return buildSchedule({id:"preview",type:"capital_in",amount:parseFloat(movForm.amount),date:movForm.date,endDate:movForm.endDate,annualRate:parseFloat(movForm.annualRate),frequency:movForm.frequency}).length; }, [movForm]);
  const pendingCount    = useMemo(()=>schedules.filter(s=>!s.paid).length,[schedules]);

  // ── Open edit form ────────────────────────────────────────────────────────────
  const openEdit = (mov) => {
    setEditingMovId(mov.id);
    setMovForm({
      investorId: String(mov.investorId),
      type: mov.type,
      amount: String(mov.amount),
      date: mov.date,
      endDate: mov.endDate || "",
      annualRate: mov.annualRate != null ? String(mov.annualRate) : "",
      note: mov.note || "",
      attachments: mov.attachments || [],
      frequency: mov.frequency || "monthly",
      interestType: mov.interestType || "simple",
      empresa: mov.empresa || "",
      linkedCapitalId: mov.linkedCapitalId || "",
      firstDueDate: mov.firstDueDate || "",
    });
    setView("add-movement");
  };

  // ── Detect if schedule-affecting fields changed ───────────────────────────────
  const scheduleFieldsChanged = (original, form) => {
    return (
      String(original.amount)     !== form.amount     ||
      String(original.annualRate) !== form.annualRate  ||
      original.date               !== form.date        ||
      original.endDate            !== form.endDate     ||
      (original.frequency||"monthly") !== form.frequency ||
      (original.interestType||"simple") !== form.interestType
    );
  };

  // ── Recalculate schedule after a withdrawal ───────────────────────────────────
  // Formula: newMonthly = (capital - retiro) × annualRate / remainingMonths
  // ── Full recalc: rebuild schedule for a capital_in considering ALL linked deposits/withdrawals ──
  const recalcFullSchedule = (capitalMovId, allMovements, allSchedules, effectiveFrom = null) => {
    const capitalMov = allMovements.find(m => m.id === capitalMovId);
    if (!capitalMov) return allSchedules;

    const allDeposits   = allMovements.filter(m => m.type==="capital_in"  && m.linkedCapitalId===capitalMovId).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const allWithdrawals = allMovements.filter(m => m.type==="capital_out" && m.linkedCapitalId===capitalMovId).sort((a,b)=>new Date(a.date)-new Date(b.date));

    const freq = FREQUENCIES.find(f => f.key === (capitalMov.frequency || "monthly")) || FREQUENCIES[0];
    const periodMonths = freq.months || 1;

    return allSchedules.map(s => {
      if (s.capitalMovId !== capitalMovId || s.paid) return s;
      // If effectiveFrom is set, don't touch cuotas before that date — preserve all existing snapshot data
      if (effectiveFrom && s.dueDate < effectiveFrom) return s;

      // Use strict < so a movement on the same day as a dueDate does NOT affect that cuota
      const effectiveDeposits    = allDeposits.filter(d => d.date < s.dueDate).reduce((acc,d)=>acc+d.amount, 0);
      const effectiveWithdrawals = allWithdrawals.filter(w => w.date < s.dueDate).reduce((acc,w)=>acc+w.amount, 0);
      const effectiveCapital     = capitalMov.amount + effectiveDeposits - effectiveWithdrawals;
      const hasAdjustment        = effectiveDeposits > 0 || effectiveWithdrawals > 0;

      if (!hasAdjustment) {
        // No movements affect this cuota — restore original amount and snapshot if previously adjusted
        if (s.originalAmount != null) {
          return { ...s, amount: s.originalAmount, snapshotCapital: capitalMov.amount, snapshotRate: capitalMov.annualRate, adjustedByWithdrawal: false, adjustedByDeposit: false };
        }
        return s;
      }

      if (effectiveCapital <= 0) return { ...s, amount: 0, adjustedByWithdrawal: true };

      let newAmount;
      if (s.partial && s.partialDays) {
        // For partial cuotas, split the period by deposits/withdrawals that occurred within it
        const periodStart = capitalMov.firstDueDate
          ? capitalMov.date
          : capitalMov.date;
        const periodEnd = s.dueDate;
        // Get all movements (deposits + withdrawals) that happened WITHIN the partial period
        const movementsInPeriod = [
          ...allDeposits.filter(d => d.date > capitalMov.date && d.date < periodEnd),
          ...allWithdrawals.filter(w => w.date > capitalMov.date && w.date < periodEnd),
        ].sort((a,b) => new Date(a.date) - new Date(b.date));

        if (movementsInPeriod.length === 0) {
          // No movements within period — use effectiveCapital for all days
          newAmount = parseFloat((effectiveCapital * capitalMov.annualRate / 100 / 365 * s.partialDays).toFixed(2));
        } else {
          // Split period into segments and calculate interest for each
          const segments = [];
          let segStart = capitalMov.date;
          let segCapital = capitalMov.amount;
          for (const mov of movementsInPeriod) {
            const days = Math.round((new Date(mov.date+"T12:00:00") - new Date(segStart+"T12:00:00")) / 86400000);
            if (days > 0) segments.push({ days, capital: segCapital });
            segStart = mov.date;
            segCapital += mov.type === "capital_in" ? mov.amount : -mov.amount;
          }
          // Last segment to periodEnd
          const lastDays = Math.round((new Date(periodEnd+"T12:00:00") - new Date(segStart+"T12:00:00")) / 86400000);
          if (lastDays > 0) segments.push({ days: lastDays, capital: segCapital });
          newAmount = parseFloat(segments.reduce((acc, seg) => acc + seg.capital * capitalMov.annualRate / 100 / 365 * seg.days, 0).toFixed(2));
        }
      } else {
        newAmount = parseFloat(((effectiveCapital * capitalMov.annualRate / 100 / 12) * periodMonths).toFixed(2));
      }

      return {
        ...s,
        amount: newAmount,
        snapshotCapital: effectiveCapital,
        snapshotRate: capitalMov.annualRate,
        adjustedByWithdrawal: allWithdrawals.some(w => w.date < s.dueDate) || undefined,
        adjustedByDeposit:    allDeposits.some(d => d.date < s.dueDate) || undefined,
        originalAmount: s.originalAmount ?? s.amount,
      };
    });
  };

  const recalcScheduleAfterWithdrawal = (capitalMovId, withdrawalAmount, withdrawalDate, allSchedules, allMovements) => {
    return recalcFullSchedule(capitalMovId, allMovements || movements, allSchedules);
  };

  // ── Recalculate schedule after an additional deposit ─────────────────────────
  const recalcScheduleAfterDeposit = (capitalMovId, depositAmount, depositDate, allSchedules, allMovements) => {
    return recalcFullSchedule(capitalMovId, allMovements || movements, allSchedules);
  };

  const doSave = async (form, editId, effectiveFrom = null) => {
    const updated = {
      id: editId || genId(),
      investorId: parseInt(form.investorId),
      type: form.type,
      amount: parseFloat(form.amount),
      date: form.date,
      endDate: form.type==="capital_in" ? form.endDate : undefined,
      annualRate: form.type==="capital_in" ? parseFloat(form.annualRate) : undefined,
      frequency: form.type==="capital_in" ? form.frequency : undefined,
      interestType: form.type==="capital_in" ? form.interestType : undefined,
      empresa: form.type==="capital_in" ? (form.empresa||"") : undefined,
      linkedCapitalId: form.linkedCapitalId || undefined,
      firstDueDate: form.type==="capital_in" && form.firstDueDate ? form.firstDueDate : undefined,
      note: form.note,
      attachments: form.attachments,
    };

    // Persist movement
    await sb.upsert("movements", movToDB(updated), "id");

    let finalSchedules;

    if (editId) {
      const updatedMovements = movements.map(m => m.id===editId ? updated : m);
      setMovements(updatedMovements);
      if (updated.type === "capital_in" && !updated.linkedCapitalId) {
        const newSched = buildSchedule(updated);
        // Read current schedules directly from state ref before updating
        const oldSched = schedules.filter(s => s.capitalMovId === editId);
        const originalMov = movements.find(m => m.id === editId);
        const mergedSched = newSched.map(ns => {
          const old = oldSched.find(os => os.dueDate === ns.dueDate);
          if (old?.paid) return { ...ns, paid: true, paidDate: old.paidDate, snapshotCapital: old.snapshotCapital ?? ns.snapshotCapital, snapshotRate: old.snapshotRate ?? ns.snapshotRate };
          if (effectiveFrom && ns.dueDate < effectiveFrom && old) return old;
          if (effectiveFrom && ns.dueDate < effectiveFrom && !old) return { ...ns, snapshotCapital: originalMov?.amount ?? ns.snapshotCapital, snapshotRate: originalMov?.annualRate ?? ns.snapshotRate };
          return ns;
        });
        const base = [...schedules.filter(s=>s.capitalMovId!==editId), ...mergedSched];
        const finalSchedules = recalcFullSchedule(editId, updatedMovements, base, effectiveFrom);
        setSchedules(finalSchedules);
        // Persist: delete ALL unpaid schedules for this mov directly from DB, then insert new
        const deleteFilter = effectiveFrom
          ? `?capital_mov_id=eq.${encodeURIComponent(editId)}&paid=eq.false&due_date=gte.${effectiveFrom}`
          : `?capital_mov_id=eq.${encodeURIComponent(editId)}&paid=eq.false`;
        await fetch(`${SUPABASE_URL}/rest/v1/schedules${deleteFilter}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        await Promise.all(finalSchedules.filter(s=>s.capitalMovId===editId&&!s.paid).map(s=>sb.upsert("schedules",schedToDB(s),"schedule_id")));
        showToast(`Inversión actualizada · cuotas regeneradas ✓`);
      } else if (updated.type === "capital_in" && updated.linkedCapitalId) {
        setSchedules(prev => { finalSchedules=recalcFullSchedule(updated.linkedCapitalId,updatedMovements,prev,effectiveFrom); persistSchedRecalc(finalSchedules,updated.linkedCapitalId,prev); return finalSchedules; });
        showToast("Aporte adicional actualizado · cuotas recalculadas ✓");
      } else if (updated.type === "capital_out" && updated.linkedCapitalId) {
        setSchedules(prev => { finalSchedules=recalcFullSchedule(updated.linkedCapitalId,updatedMovements,prev,effectiveFrom); persistSchedRecalc(finalSchedules,updated.linkedCapitalId,prev); return finalSchedules; });
        showToast("Retiro actualizado · cuotas recalculadas ✓");
      } else {
        showToast("Movimiento actualizado ✓");
      }
    } else {
      const updatedMovements = [...movements, updated];
      setMovements(updatedMovements);
      if (updated.type === "capital_in" && !updated.linkedCapitalId) {
        const sched = buildSchedule(updated);
        await Promise.all(sched.map(s=>sb.upsert("schedules",schedToDB(s),"schedule_id")));
        setSchedules(prev => [...prev, ...sched]);
        showToast(`Inversión registrada · ${sched.length} cuotas generadas ✓`);
      } else if (updated.type === "capital_in" && updated.linkedCapitalId) {
        setSchedules(prev => { finalSchedules=recalcFullSchedule(updated.linkedCapitalId,updatedMovements,prev); persistSchedRecalc(finalSchedules,updated.linkedCapitalId,prev); return finalSchedules; });
        showToast("Aporte adicional registrado · cuotas recalculadas ✓");
      } else if (updated.type === "capital_out" && updated.linkedCapitalId) {
        setSchedules(prev => { finalSchedules=recalcFullSchedule(updated.linkedCapitalId,updatedMovements,prev); persistSchedRecalc(finalSchedules,updated.linkedCapitalId,prev); return finalSchedules; });
        showToast("Retiro registrado · cuotas recalculadas ✓");
      } else {
        showToast("Movimiento registrado ✓");
      }
    }
    setMovForm(emptyMovForm);
    setEditingMovId(null);
    if (selectedInvestorId) setView("investor"); else setView("dashboard");
  };

  // Helper: persist recalculated schedules for a capitalMovId (only unpaid ones change)
  const persistSchedRecalc = (newAllScheds, capitalMovId, prevAllScheds) => {
    const prevForMov = prevAllScheds.filter(s=>s.capitalMovId===capitalMovId&&!s.paid);
    const newForMov  = newAllScheds.filter(s=>s.capitalMovId===capitalMovId&&!s.paid);
    Promise.all([
      ...prevForMov.map(s=>sb.del("schedules",s.scheduleId,"schedule_id")),
      ...newForMov.map(s=>sb.upsert("schedules",schedToDB(s),"schedule_id")),
    ]);
  };

  const handleSaveMovement = () => {
    if (!movForm.investorId || !movForm.amount || !movForm.date) { showToast("Completá los campos obligatorios","err"); return; }
    if (movForm.type==="capital_in" && (!movForm.endDate || !movForm.annualRate)) { showToast("Ingresá fecha fin y tasa anual","err"); return; }
    if (movForm.type==="capital_in" && !movForm.empresa?.trim()) { showToast("Ingresá el nombre de la empresa","err"); return; }
    if (movForm.type==="capital_out" && !movForm.linkedCapitalId) { showToast("Seleccioná la inversión de origen","err"); return; }

    // Any edit that touches schedule-affecting fields → ask for effective date
    if (editingMovId) {
      const paidCount = schedules.filter(s => s.capitalMovId === editingMovId && s.paid).length;
      setRegenWarning({ paidCount, pendingSave: (effectiveFrom) => doSave(movForm, editingMovId, effectiveFrom) });
      return;
    }
    doSave(movForm, editingMovId, null);
  };

  const handleCancelForm = () => {
    setMovForm(emptyMovForm);
    setEditingMovId(null);
    if (selectedInvestorId) setView("investor"); else setView("dashboard");
  };

  const handleAddInvestor = async () => {
    if (!invForm.name) { showToast("Ingresá el nombre","err"); return; }
    const rows = await sb.post("investors", {name:invForm.name, email:invForm.email||null});
    const newInv = rows[0] || {id:Date.now(),name:invForm.name,email:invForm.email};
    setInvestors(prev=>[...prev,{id:newInv.id,name:newInv.name,email:newInv.email||""}]);
    setInvForm({name:"",email:""});
    showToast("Inversor agregado ✓");
    setView("dashboard");
  };

  const handleSaveEditInvestor = async () => {
    if (!invForm.name) { showToast("Ingresá el nombre","err"); return; }
    await sb.patch("investors", editingInvestorId, "id", {name:invForm.name, email:invForm.email||null});
    setInvestors(prev=>prev.map(i=>i.id===editingInvestorId?{...i,name:invForm.name,email:invForm.email}:i));
    setInvForm({name:"",email:""});
    setEditingInvestorId(null);
    showToast("Inversor actualizado ✓");
    setView("dashboard");
  };

  const handleDeleteInvestor = async (id) => {
    await sb.del("investors", id);
    setInvestors(prev=>prev.filter(i=>i.id!==id));
    if (selectedInvestorId===id) { setSelectedInvestorId(null); setView("dashboard"); }
    setDeleteConfirm(null);
    showToast("Inversor eliminado");
  };

  // ── Company handlers ─────────────────────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState({name:"",legalName:"",taxId:""});
  const [editingCompanyId, setEditingCompanyId] = useState(null);

  const handleAddCompany = async () => {
    if (!companyForm.name) { showToast("Ingresá el nombre","err"); return; }
    const rows = await sb.post("companies", {name:companyForm.name, legal_name:companyForm.legalName||null, tax_id:companyForm.taxId||null});
    const c = rows[0];
    if (c) setCompanies(prev=>[...prev,{id:c.id,name:c.name,legalName:c.legal_name||"",taxId:c.tax_id||""}].sort((a,b)=>a.name.localeCompare(b.name)));
    setCompanyForm({name:"",legalName:"",taxId:""});
    showToast("Empresa agregada ✓");
    setView("companies");
  };

  const handleSaveEditCompany = async () => {
    if (!companyForm.name) { showToast("Ingresá el nombre","err"); return; }
    await sb.patch("companies", editingCompanyId, "id", {name:companyForm.name, legal_name:companyForm.legalName||null, tax_id:companyForm.taxId||null});
    setCompanies(prev=>prev.map(c=>c.id===editingCompanyId?{...c,name:companyForm.name,legalName:companyForm.legalName,taxId:companyForm.taxId}:c).sort((a,b)=>a.name.localeCompare(b.name)));
    setEditingCompanyId(null);
    setCompanyForm({name:"",legalName:"",taxId:""});
    showToast("Empresa actualizada ✓");
    setView("companies");
  };

  const handleDeleteCompany = async (id) => {
    await sb.del("companies", id);
    setCompanies(prev=>prev.filter(c=>c.id!==id));
    setDeleteConfirm(null);
    showToast("Empresa eliminada");
  };

  const handleDeleteMovement = async (id) => {
    const mov = movements.find(m => m.id === id);
    const remainingMovements = movements.filter(m => m.id !== id);

    if (mov?.linkedCapitalId) {
      setSchedules(prev => { const ns=recalcFullSchedule(mov.linkedCapitalId, remainingMovements, prev); persistSchedRecalc(ns,mov.linkedCapitalId,prev); return ns; });
    }
    setMovements(remainingMovements);
    setSchedules(prev => prev.filter(s => s.capitalMovId !== id));
    // DB: cascade deletes schedules automatically via FK
    await sb.del("movements", id);
    setDeleteConfirm(null);
    showToast("Movimiento eliminado");
  };

  const handleMarkPaid = async (scheduleId, paidDate, paidAmount) => {
    const sched = schedules.find(s=>s.scheduleId===scheduleId);
    const originalAmount = sched ? (sched.isCompound ? (sched.periodInterest||0) : sched.amount) : paidAmount;
    const isPartial = paidAmount != null && Math.abs(paidAmount - originalAmount) > 0.001;
    const residual = isPartial ? parseFloat((originalAmount - paidAmount).toFixed(2)) : 0;
    const residualId = `${scheduleId}_res`;

    // Mark current schedule as paid with the paid amount
    setSchedules(prev => {
      const updated = prev.map(s=>s.scheduleId===scheduleId?{...s,paid:true,paidDate,amount:paidAmount??s.amount}:s);
      if (isPartial && residual > 0 && sched) {
        const residualSched = {
          scheduleId: residualId,
          capitalMovId: sched.capitalMovId,
          dueDate: sched.dueDate,
          amount: residual,
          partial: true,
          partialDays: null,
          paid: false,
          paidDate: null,
          snapshotCapital: sched.snapshotCapital,
          snapshotRate: sched.snapshotRate,
        };
        return [...updated, residualSched];
      }
      return updated;
    });

    await sb.patch("schedules", scheduleId, "schedule_id", {paid:true, paid_date:paidDate, amount:paidAmount??undefined});

    if (isPartial && residual > 0 && sched) {
      await sb.post("schedules", {
        schedule_id: residualId,
        capital_mov_id: sched.capitalMovId,
        due_date: sched.dueDate,
        amount: residual,
        partial: true,
        partial_days: null,
        paid: false,
        paid_date: null,
        snapshot_capital: sched.snapshotCapital,
        snapshot_rate: sched.snapshotRate,
        original_amount: residual,
      });
      showToast(`Pago parcial · Saldo pendiente: ${fmtDec(residual)} ✓`);
    } else {
      showToast("Interés marcado como pagado ✓");
    }
    setMarkPaidItem(null);
  };

  const handleMarkAllPaid = async (finalItem) => {
    const paidDate = new Date().toISOString().slice(0,10);
    const allForMov = schedules.filter(s=>s.capitalMovId===finalItem.capitalMovId&&!s.paid);
    setSchedules(prev=>prev.map(s=>s.capitalMovId===finalItem.capitalMovId&&!s.paid?{...s,paid:true,paidDate}:s));
    await Promise.all(allForMov.map(s=>sb.patch("schedules",s.scheduleId,"schedule_id",{paid:true,paid_date:paidDate})));
    showToast(`${allForMov.length} cuotas marcadas como pagadas ✓`);
  };

  const handleUnmark = async (scheduleId) => {
    setSchedules(prev=>prev.map(s=>s.scheduleId===scheduleId?{...s,paid:false,paidDate:null}:s));
    await sb.patch("schedules", scheduleId, "schedule_id", {paid:false, paid_date:null});
    showToast("Marcado como pendiente");
  };

  const handleEditAmount = async (scheduleId, newAmount) => {
    setSchedules(prev=>prev.map(s=>s.scheduleId===scheduleId?{...s,amount:newAmount,originalAmount:s.originalAmount??s.amount}:s));
    await sb.patch("schedules", scheduleId, "schedule_id", {amount:newAmount});
    showToast("Monto actualizado ✓");
  };

  const addAttToForm   = useCallback(att=>setMovForm(p=>({...p,attachments:[...p.attachments,att]})),[]);
  const remAttFromForm = useCallback(id =>setMovForm(p=>({...p,attachments:p.attachments.filter(a=>a.id!==id)})),[]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const isEditing = editingMovId !== null;

  // Client portal routing
  const urlInv = new URLSearchParams(window.location.search).get("inv");
  if (loading) return (
    <div style={{minHeight:"100vh",background:"#f0f2f8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:16,animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</div>
        <div style={{fontSize:15,fontWeight:600,color:"#1a1d2e"}}>Conectando con la base de datos...</div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (dbError) return (
    <div style={{minHeight:"100vh",background:"#f0f2f8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:36,maxWidth:440,textAlign:"center",boxShadow:"0 4px 24px #0001"}}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:17,fontWeight:700,color:"#1a1d2e",marginBottom:8}}>Error de conexión</div>
        <div style={{fontSize:13,color:"#6b7094",marginBottom:20,lineHeight:1.6}}>{dbError}</div>
        <div style={{fontSize:12,color:"#9ca3af",background:"#f8f9ff",borderRadius:8,padding:"10px 14px",textAlign:"left",fontFamily:"monospace"}}>
          Verificá que SUPABASE_URL y SUPABASE_KEY estén correctamente configurados en el archivo.
        </div>
      </div>
    </div>
  );

  if (clientSession) {
    return <ClientPortal investor={clientSession} movements={movements} schedules={schedules} onLogout={()=>setClientSession(null)} />;
  }
  if (urlInv && !clientSession) {
    return <LoginScreen investors={investors} credentials={credentials} onLogin={inv=>setClientSession(inv)} />;
  }

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#f0f2f8",minHeight:"100vh",color:"#1a1d2e"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#e8eaf0}::-webkit-scrollbar-thumb{background:#c0c4d6;border-radius:3px}
        input,select,textarea{outline:none}
        .card{background:#ffffff;border:1px solid #dde1f0;border-radius:14px}
        .btn-primary{background:#7c6af7;color:#fff;border:none;padding:10px 20px;border-radius:9px;font-weight:600;cursor:pointer;font-family:inherit;font-size:14px;transition:all 0.15s}
        .btn-primary:hover{background:#6b59e8;transform:translateY(-1px)}
        .btn-ghost{background:transparent;color:#6b7094;border:1px solid #dde1f0;padding:9px 18px;border-radius:9px;font-weight:500;cursor:pointer;font-family:inherit;font-size:13px;transition:all 0.15s}
        .btn-ghost:hover{background:#eef0f8;color:#1a1d2e}
        .btn-icon{background:none;border:none;cursor:pointer;padding:5px 7px;border-radius:7px;font-size:14px;transition:all 0.15s;font-family:inherit}
        .inp{background:#f5f6fb;border:1px solid #dde1f0;border-radius:9px;padding:10px 14px;color:#1a1d2e;font-family:inherit;font-size:14px;width:100%;transition:border 0.15s}
        .inp:focus{border-color:#7c6af7;background:#fff}
        .nav-link{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;color:#6b7094;transition:all 0.15s;border:none;background:none;font-family:inherit}
        .nav-link:hover,.nav-link.active{background:#eef0fb;color:#1a1d2e}
        .inv-row{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-radius:10px;background:#ffffff;border:1px solid #dde1f0;cursor:pointer;transition:all 0.15s;margin-bottom:8px}
        .inv-row:hover{border-color:#7c6af7;background:#f5f4ff}
        .stat-card{background:#ffffff;border:1px solid #dde1f0;border-radius:14px;padding:18px;flex:1;min-width:150px}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;z-index:999;animation:slideUp 0.25s ease}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:100}
        .modal{background:#ffffff;border:1px solid #dde1f0;border-radius:16px;padding:28px;min-width:340px}
        label{font-size:13px;font-weight:500;color:#6b7094;display:block;margin-bottom:6px;margin-top:14px}
        .att-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#eef0f8;color:#6b7094;cursor:pointer;border:1px solid #dde1f0;transition:all 0.15s;font-family:inherit}
        .att-chip:hover{background:#7c6af7;color:#fff;border-color:#7c6af7}
        .tab-btn{background:transparent;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;color:#6b7094;transition:all 0.15s}
        .tab-btn.active{background:#eef0fb;color:#1a1d2e}
        .tab-btn:hover{color:#1a1d2e}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .calc-box{background:#f5f6fb;border:1px solid #7c6af740;border-radius:10px;padding:13px 16px;margin-top:14px}
        .mov-card{padding:14px 16px;border-radius:12px;background:#ffffff;border:1px solid #dde1f0;margin-bottom:8px;transition:border-color 0.15s}
        .mov-card:hover{border-color:#c0c4d6}
        .edit-btn{background:none;border:1px solid #dde1f0;cursor:pointer;color:#6b7094;font-size:12px;padding:5px 11px;border-radius:8px;font-family:inherit;font-weight:500;transition:all 0.15s}
        .edit-btn:hover{background:#f5f4ff;border-color:#7c6af7;color:#7c6af7}
        .delete-btn{background:none;border:none;cursor:pointer;color:#f87171;font-size:15px;padding:4px 8px;border-radius:6px;opacity:0.4;transition:opacity 0.15s}
        .delete-btn:hover{opacity:1;background:rgba(248,113,113,0.1)}
      `}</style>

      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* ── Sidebar ── */}
        <div style={{width:220,background:"#ffffff",borderRight:"1px solid #dde1f0",padding:"24px 14px",display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
          <div style={{marginBottom:28,paddingLeft:14}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"#7c6af7",marginBottom:4}}>INVERSORES</div>
            <div style={{fontSize:22,fontWeight:700,color:"#1a1d2e"}}>CuentaCte</div>
          </div>
          <button className={`nav-link ${view==="dashboard"?"active":""}`} onClick={()=>{setView("dashboard");setSelectedInvestorId(null)}}>
            <span>◈</span> Dashboard
          </button>
          <button className={`nav-link ${view==="reportes"?"active":""}`} onClick={()=>{setView("reportes");setSelectedInvestorId(null)}}>
            <span>📊</span> Reportes
          </button>
          <button className={`nav-link ${view==="clients"?"active":""}`} onClick={()=>{setView("clients");setSelectedInvestorId(null)}}>
            <span>👥</span> Clientes
          </button>
          <button className={`nav-link ${view==="companies"?"active":""}`} onClick={()=>{setView("companies");setSelectedInvestorId(null)}}>
            <span>🏢</span> Empresas
          </button>
          <div style={{fontSize:11,fontWeight:600,color:"#c0c4d6",letterSpacing:2,padding:"14px 14px 6px"}}>INVERSORES</div>
          {[...investors].sort((a,b)=>a.name.localeCompare(b.name)).map(inv=>{
            const pending = schedules.filter(s=>movements.filter(m=>m.investorId===inv.id).map(m=>m.id).includes(s.capitalMovId)&&!s.paid).length;
            return (
              <button key={inv.id} className={`nav-link ${view==="investor"&&selectedInvestorId===inv.id?"active":""}`} onClick={()=>{setSelectedInvestorId(inv.id);setView("investor");setFilterType("all")}}>
                <span style={{width:22,height:22,borderRadius:"50%",background:"#7c6af7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{inv.name[0]}</span>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.name}</span>
              </button>
            );
          })}
          <div style={{marginTop:"auto",display:"flex",flexDirection:"column",gap:6}}>
            <button className="btn-ghost" style={{width:"100%",justifyContent:"center",fontSize:12,display:"flex",alignItems:"center",gap:6}} onClick={()=>setAccessModal(true)}>🔐 Accesos clientes</button>
            <button className="btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setEditingMovId(null);setMovForm(emptyMovForm);setView("add-movement")}}>+ Movimiento</button>
          </div>
        </div>

        {/* ── Main ── */}
        <div style={{flex:1,padding:"32px 36px",overflow:"auto"}}>

          {/* DASHBOARD */}
          {view==="dashboard" && (
            <div>
              <h1 style={{fontSize:26,fontWeight:700,marginBottom:6}}>Resumen General</h1>
              <p style={{color:"#6b7094",marginBottom:28,fontSize:14}}>{investors.length} inversores · {movements.length} inversiones · {pendingCount} intereses pendientes</p>
              <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:12}}>
                {[
                  {label:"Capital Invertido",    value:globalStats.capitalIn,       color:"#4ade80",    dec:false},
                  {label:"Capital Retirado",     value:globalStats.capitalOut,      color:"#f87171",    dec:false},
                  {label:"Saldo Neto",           value:globalStats.balance,         color:"#7c6af7",    dec:false},
                  {label:"Intereses Totales",    value:globalStats.interestDue,     color:"#fb923c",    dec:true},
                  {label:"Intereses Cobrados",   value:globalStats.interestPaid,    color:"#60a5fa",    dec:true},
                  {label:"Intereses Pendientes", value:globalStats.interestPending, color:globalStats.interestPending>0?"#fb923c":"#4ade80", dec:true},
                ].map(s=>(
                  <div className="stat-card" key={s.label}>
                    <div style={{fontSize:11,color:"#6b7094",fontWeight:500,marginBottom:7}}>{s.label}</div>
                    <div style={{fontSize:19,fontWeight:700,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.dec?fmtDec(s.value):fmt(s.value)}</div>
                  </div>
                ))}
              </div>
              {(()=>{
                return globalHasHistoric && (
                  <div style={{marginBottom:28}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0",marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#6b7094",letterSpacing:1}}>TOTAL HISTÓRICO</span>
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {[
                        {label:"Capital Invertido",    value:globalStatsHist.capitalIn,       color:"#9ca3af", dec:false},
                        {label:"Capital Retirado",     value:globalStatsHist.capitalOut,      color:"#9ca3af", dec:false},
                        {label:"Saldo Capital",        value:globalStatsHist.balance,         color:"#9ca3af", dec:false},
                        {label:"Intereses Totales",    value:globalStatsHist.interestDue,     color:"#9ca3af", dec:true},
                        {label:"Intereses Cobrados",   value:globalStatsHist.interestPaid,    color:"#9ca3af", dec:true},
                      ].map(s=>(
                        <div key={s.label} style={{background:"#f8f9ff",border:"1px solid #e8eaf2",borderRadius:12,padding:"12px 16px",minWidth:130}}>
                          <div style={{fontSize:11,color:"#9ca3af",fontWeight:500,marginBottom:5}}>{s.label}</div>
                          <div style={{fontSize:15,fontWeight:600,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.dec?fmtDec(s.value):fmt(s.value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <h2 style={{fontSize:16,fontWeight:600}}>Inversores</h2>
                <button className="btn-ghost" style={{fontSize:13,display:"flex",alignItems:"center",gap:7}} onClick={()=>exportToExcel(investors,movements,schedules)}>
                  <span>⬇</span> Exportar Todo a Excel
                </button>
              </div>
              {[...investors].sort((a,b)=>a.name.localeCompare(b.name)).map(inv=>{
                const stats=getStatsSplit(inv.id).active;
                return (
                  <div key={inv.id} className="inv-row" onClick={()=>{setSelectedInvestorId(inv.id);setView("investor");setFilterType("all")}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#7c6af7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15}}>{inv.name[0]}</div>
                      <div>
                        <div style={{fontWeight:600,fontSize:15}}>{inv.name}</div>
                        <div style={{fontSize:12,color:"#6b7094"}}>{inv.email||"Sin email"}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:22,alignItems:"center"}}>
                      <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#6b7094"}}>Saldo Capital</div><div style={{color:"#4ade80",fontFamily:"'DM Mono',monospace",fontWeight:500}}>{fmt(stats.balance)}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#6b7094"}}>Int. Pendiente</div><div style={{color:stats.interestPending>0?"#fb923c":"#4ade80",fontFamily:"'DM Mono',monospace",fontWeight:500}}>{fmtDec(stats.interestPending)}</div></div>
                      <span style={{color:"#c0c4d6",fontSize:18}}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* REPORTES */}
          {view==="reportes" && (
            <ReportesView investors={investors} movements={movements} schedules={schedules} />
          )}


          {/* INVESTOR DETAIL */}
          {view==="investor" && selectedInvestor && (()=>{
            const statsSplit=getStatsSplit(selectedInvestor.id);
            const stats=statsSplit.active;
            const statsHist=statsSplit.historic;
            const today=new Date().toISOString().slice(0,10);
            const overdueCount=selectedSchedules.filter(s=>!s.paid&&s.dueDate<today&&!s.isCompound).length;
            return (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#7c6af7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20}}>{selectedInvestor.name[0]}</div>
                  <div>
                    <h1 style={{fontSize:24,fontWeight:700}}>{selectedInvestor.name}</h1>
                    <div style={{fontSize:13,color:"#6b7094"}}>{selectedInvestor.email||"Sin email"}</div>
                  </div>
                  <button className="btn-primary" style={{marginLeft:"auto"}} onClick={()=>{setEditingMovId(null);setMovForm({...emptyMovForm,investorId:String(selectedInvestor.id)});setView("add-movement")}}>+ Movimiento</button>
                  <button className="btn-ghost" style={{display:"flex",alignItems:"center",gap:6,fontSize:13}} onClick={()=>{setEditingInvestorId(selectedInvestor.id);setInvForm({name:selectedInvestor.name,email:selectedInvestor.email||""});setView("add-investor")}}>✏️ Editar</button>
                  <button className="btn-ghost" style={{display:"flex",alignItems:"center",gap:6,fontSize:13}} onClick={()=>exportToExcel(investors,movements,schedules,selectedInvestor.id)}>⬇ Excel</button>
                  <button className="btn-ghost" style={{display:"flex",alignItems:"center",gap:6,fontSize:13}} onClick={()=>setStatementModal({investorId:selectedInvestor.id})}>📄 Statement PDF</button>
                  <button className="btn-ghost" style={{display:"flex",alignItems:"center",gap:6,fontSize:13}} onClick={()=>setClientSession(selectedInvestor)}>👤 Vista cliente</button>
                </div>

                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
                  {[
                    {label:"Capital Invertido",value:stats.capitalIn,color:"#4ade80"},
                    {label:"Capital Retirado", value:stats.capitalOut,color:"#f87171"},
                    {label:"Saldo Capital",    value:stats.balance,   color:"#7c6af7"},
                    {label:"Int. Total",       value:stats.interestDue,color:"#fb923c",dec:true},
                    {label:"Int. Cobrado",     value:stats.interestPaid,color:"#60a5fa",dec:true},
                    {label:"Int. Pendiente",   value:stats.interestPending,color:stats.interestPending>0?"#fb923c":"#4ade80",dec:true},
                  ].map(s=>(
                    <div className="stat-card" key={s.label} style={{minWidth:130,padding:14}}>
                      <div style={{fontSize:11,color:"#6b7094",fontWeight:500,marginBottom:5}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:700,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.dec?fmtDec(s.value):fmt(s.value)}</div>
                    </div>
                  ))}
                </div>
                {statsSplit.hasHistoric&&(
                  <div style={{marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#9ca3af",letterSpacing:1}}>TOTAL HISTÓRICO</span>
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {[
                        {label:"Capital Invertido",value:statsHist.capitalIn,color:"#9ca3af"},
                        {label:"Capital Retirado", value:statsHist.capitalOut,color:"#9ca3af"},
                        {label:"Saldo Capital",    value:statsHist.balance,  color:"#9ca3af"},
                        {label:"Int. Total",       value:statsHist.interestDue,color:"#9ca3af",dec:true},
                        {label:"Int. Cobrado",     value:statsHist.interestPaid,color:"#9ca3af",dec:true},
                      ].map(s=>(
                        <div key={s.label} style={{background:"#f8f9ff",border:"1px solid #e8eaf2",borderRadius:12,padding:"12px 16px",minWidth:130}}>
                          <div style={{fontSize:11,color:"#9ca3af",fontWeight:500,marginBottom:5}}>{s.label}</div>
                          <div style={{fontSize:15,fontWeight:600,color:s.color,fontFamily:"'DM Mono',monospace"}}>{fmt(s.value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid #dde1f0",paddingBottom:4}}>
                  {[["all","Todo"],["capital_in","Inversiones"]].map(([k,l])=>(
                    <button key={k} className={`tab-btn ${filterType===k?"active":""}`} onClick={()=>setFilterType(k)}>{l}</button>
                  ))}
                </div>

                {selectedMovements.filter(m=>m.type==="capital_in"&&!m.linkedCapitalId).length===0 && (
                  <div style={{textAlign:"center",padding:32,color:"#6b7094",fontSize:14}}>No hay inversiones registradas.</div>
                )}
                {(()=>{
                  const todayStr=new Date().toISOString().slice(0,10);
                  const allInvs=selectedMovements
                    .filter(mov=>mov.type==="capital_in"&&!mov.linkedCapitalId)
                    .sort((a,b)=>{
                      const aActive=a.endDate>=todayStr;
                      const bActive=b.endDate>=todayStr;
                      if(aActive!==bActive) return aActive?-1:1;
                      return new Date(b.date)-new Date(a.date);
                    });
                  const vigentes=allInvs.filter(m=>m.endDate>=todayStr);
                  const vencidas=allInvs.filter(m=>m.endDate<todayStr);
                  const renderMov=(mov)=>{
                    const movSched=schedules.filter(s=>s.capitalMovId===mov.id).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
                    const paidCount=movSched.filter(s=>s.paid).length;
                    const today=new Date().toISOString().slice(0,10);
                    const overdueCount=movSched.filter(s=>!s.paid&&s.dueDate<today&&!s.isCompound).length;
                    const atts=mov.attachments||[];
                    const isExpanded=expandedMovId===mov.id;
                    const linkedWithdrawals=movements.filter(m=>m.type==="capital_out"&&m.linkedCapitalId===mov.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
                    const linkedDeposits=movements.filter(m=>m.type==="capital_in"&&m.linkedCapitalId===mov.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
                    const totalWithdrawn=linkedWithdrawals.reduce((s,w)=>s+w.amount,0);
                    const totalDeposited=linkedDeposits.reduce((s,d)=>s+d.amount,0);
                    const capitalBalance=mov.amount+totalDeposited-totalWithdrawn;
                    const timeline=[
                      ...movSched.map(s=>({kind:"interest",date:s.dueDate,data:s})),
                      ...linkedWithdrawals.map(w=>({kind:"withdrawal",date:w.date,data:w})),
                      ...linkedDeposits.map(d=>({kind:"deposit",date:d.date,data:d})),
                    ].sort((a,b)=>new Date(a.date)-new Date(b.date));
                    const hasContent=timeline.length>0;
                    const intVal = (s) => s.isCompound ? (s.periodInterest||0) : s.amount;
                    const totalInterest = movSched.reduce((s,i)=>s+intVal(i),0);
                    const paidInterest  = movSched.filter(s=>s.paid).reduce((s,i)=>s+intVal(i),0);
                    return (
                      <div key={mov.id} style={{marginBottom:10,borderRadius:12,border:`1px solid ${isExpanded?"#7c6af750":"#dde1f0"}`,background:"#fff",transition:"all 0.15s",maxWidth:"75%"}}>
                        {/* Header */}
                        <div onClick={()=>hasContent&&setExpandedMovId(isExpanded?null:mov.id)}
                          style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",cursor:hasContent?"pointer":"default"}}>
                          <div style={{width:36,height:36,borderRadius:10,background:"#4ade8018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:"#4ade80",flexShrink:0}}>↑</div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span style={{fontWeight:700,fontSize:15,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>{fmt(mov.amount)}</span>
                              {(totalWithdrawn>0||totalDeposited>0)&&<>
                                {totalDeposited>0&&<>
                                  <span style={{fontSize:12,color:"#6b7094"}}>+</span>
                                  <span style={{fontWeight:600,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>{fmt(totalDeposited)}</span>
                                  <span style={{fontSize:11,color:"#6b7094"}}>aportes</span>
                                </>}
                                {totalWithdrawn>0&&<>
                                  <span style={{fontSize:12,color:"#6b7094"}}>−</span>
                                  <span style={{fontWeight:600,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#f87171"}}>{fmt(totalWithdrawn)}</span>
                                  <span style={{fontSize:11,color:"#6b7094"}}>retiros</span>
                                </>}
                                <span style={{fontSize:12,color:"#6b7094"}}>=</span>
                                <span style={{fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#7c6af7"}}>saldo {fmt(capitalBalance)}</span>
                              </>}
                              {mov.annualRate&&<span style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:"#7c6af715",color:"#7c6af7",fontWeight:600}}>{parseFloat(mov.annualRate).toFixed(2)}% anual</span>}
                              {mov.frequency&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:20,background:"#f5f6fb",color:"#6b7094",fontWeight:500,border:"1px solid #dde1f0"}}>{FREQUENCIES.find(f=>f.key===mov.frequency)?.label||"Mensual"}</span>}
                              {mov.interestType==="compound"&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#60a5fa18",color:"#60a5fa",border:"1px solid #60a5fa30"}}>Capitalizable</span>}
                              {overdueCount>0&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#f8717120",color:"#f87171"}}>{overdueCount} vencida{overdueCount>1?"s":""}</span>}
                              {atts.length>0&&<button onClick={e=>{e.stopPropagation();setViewingAttachments({attachments:atts})}} style={{fontSize:12,padding:"2px 8px",borderRadius:20,fontWeight:600,background:"#eef0fb",color:"#7c6af7",border:"none",cursor:"pointer",fontFamily:"inherit"}}>📎 {atts.length}</button>}
                            </div>
                            <div style={{fontSize:12,color:"#6b7094",marginTop:3,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                              <span>
                                {mov.empresa&&<span style={{fontWeight:600,color:"#1a1d2e"}}>{mov.empresa} · </span>}
                                {mov.note||"Sin nota"} · {fmtDate(mov.date)}{mov.endDate&&<> → {fmtDate(mov.endDate)}</>}
                                {movSched.length>0&&<span style={{marginLeft:8,color:"#60a5fa"}}>· {paidCount}/{movSched.length} cuotas pagas</span>}
                              </span>
                              {totalInterest>0&&<>
                                <span style={{color:"#e5e7eb"}}>|</span>
                                <span>Int. total: <span style={{fontWeight:600,color:"#fb923c",fontFamily:"'DM Mono',monospace"}}>{fmtDec(totalInterest)}</span></span>
                                <span style={{color:"#e5e7eb"}}>·</span>
                                <span>Cobrado: <span style={{fontWeight:600,color:"#4ade80",fontFamily:"'DM Mono',monospace"}}>{fmtDec(paidInterest)}</span></span>
                              </>}
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                            {hasContent&&<span style={{fontSize:18,color:"#7c6af7",transform:isExpanded?"rotate(90deg)":"rotate(0)",transition:"transform 0.2s",lineHeight:1}}>›</span>}
                            <button className="edit-btn" onClick={e=>{e.stopPropagation();openEdit(mov)}}>✏</button>
                            <button className="delete-btn" onClick={e=>{e.stopPropagation();setDeleteConfirm(mov.id)}}>✕</button>
                          </div>
                        </div>

                        {/* Expanded timeline */}
                        {isExpanded&&(
                          <div style={{borderTop:"1px solid #eef0f8",padding:"12px 16px 14px",background:"#fafbff",borderRadius:"0 0 12px 12px"}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#6b7094",letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Movimientos cronológicos</div>
                            {(()=>{
                              let runningCapital=mov.amount;
                              return timeline.map(item=>{
                                if(item.kind==="withdrawal"){
                                  runningCapital-=item.data.amount;
                                  const w=item.data;
                                  return (
                                    <div key={`w_${w.id}`} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,background:"#fee2e2",border:"1px solid #f8717150",marginBottom:6}}>
                                      <div style={{width:30,height:30,borderRadius:8,background:"#f8717118",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#f87171",flexShrink:0}}>↓</div>
                                      <div style={{flex:1}}>
                                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                          <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:"#6b7094"}}>{fmtDate(w.date)}</span>
                                          <span style={{fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#f87171"}}>− {fmt(w.amount)}</span>
                                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#f8717118",color:"#f87171",border:"1px solid #f8717130"}}>Retiro</span>
                                          {w.note&&<span style={{fontSize:12,color:"#6b7094"}}>{w.note}</span>}
                                        </div>
                                        <div style={{fontSize:11,color:"#7c6af7",fontWeight:600,marginTop:2}}>Saldo capital: {fmt(runningCapital)}</div>
                                      </div>
                                      <div style={{display:"flex",gap:4}}>
                                        <button className="edit-btn" onClick={e=>{e.stopPropagation();openEdit(w)}}>✏</button>
                                        <button className="delete-btn" onClick={e=>{e.stopPropagation();setDeleteConfirm(w.id)}}>✕</button>
                                      </div>
                                    </div>
                                  );
                                } else if(item.kind==="deposit"){
                                  runningCapital+=item.data.amount;
                                  const d=item.data;
                                  return (
                                    <div key={`d_${d.id}`} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,background:"#dcfce7",border:"1px solid #4ade8050",marginBottom:6}}>
                                      <div style={{width:30,height:30,borderRadius:8,background:"#4ade8018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#4ade80",flexShrink:0}}>↑</div>
                                      <div style={{flex:1}}>
                                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                          <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:"#6b7094"}}>{fmtDate(d.date)}</span>
                                          <span style={{fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>+ {fmt(d.amount)}</span>
                                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:"#4ade8018",color:"#4ade80",border:"1px solid #4ade8030"}}>Aporte adicional</span>
                                          {d.note&&<span style={{fontSize:12,color:"#6b7094"}}>{d.note}</span>}
                                        </div>
                                        <div style={{fontSize:11,color:"#7c6af7",fontWeight:600,marginTop:2}}>Saldo capital: {fmt(runningCapital)}</div>
                                      </div>
                                      <div style={{display:"flex",gap:4}}>
                                        <button className="edit-btn" onClick={e=>{e.stopPropagation();openEdit(d)}}>✏</button>
                                        <button className="delete-btn" onClick={e=>{e.stopPropagation();setDeleteConfirm(d.id)}}>✕</button>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  const s=item.data;
                                  return <ScheduleRow key={s.scheduleId} item={s} capitalMov={mov} onMarkPaid={si=>setMarkPaidItem({scheduleItem:si,capitalMov:mov})} onUnmark={handleUnmark} onEditAmount={handleEditAmount} onMarkAllPaid={handleMarkAllPaid}/>;
                                }
                              });
                            })()}
                            {mov.interestType !== "compound" && <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:mov.capitalPaid?"#f0fdf4":"#f5f4ff",border:`1px solid ${mov.capitalPaid?"#4ade8040":"#7c6af730"}`,marginTop:8}}>
                              <div style={{width:30,height:30,borderRadius:8,background:mov.capitalPaid?"#4ade8018":"#7c6af718",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:mov.capitalPaid?"#4ade80":"#7c6af7",flexShrink:0}}>{mov.capitalPaid?"✓":"Σ"}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:12,fontWeight:600,color:mov.capitalPaid?"#16a34a":"#7c6af7"}}>Saldo de capital al vencimiento</div>
                                <div style={{fontSize:11,color:"#6b7094",marginTop:1}}>
                                  {fmt(mov.amount)} inicial
                                  {totalDeposited>0&&<> + {fmt(totalDeposited)} aportes</>}
                                  {totalWithdrawn>0&&<> − {fmt(totalWithdrawn)} retiros</>}
                                  {mov.capitalPaid&&mov.capitalPaidDate&&<> · <span style={{color:"#4ade80"}}>Devuelto el {fmtDate(mov.capitalPaidDate)}</span></>}
                                </div>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:mov.capitalPaid?"#16a34a":"#7c6af7",marginRight:8}}>{fmt(capitalBalance)}</div>
                              {mov.capitalPaid ? (
                                <button onClick={e=>{e.stopPropagation();setMovements(prev=>prev.map(m=>m.id===mov.id?{...m,capitalPaid:false,capitalPaidDate:null}:m));sb.patch("movements",mov.id,"id",{capital_paid:false,capital_paid_date:null});showToast("Marcado como pendiente");}}
                                  style={{flexShrink:0,padding:"5px 10px",borderRadius:7,border:"1px solid #dde1f0",background:"#fff",color:"#6b7094",fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                  Desmarcar
                                </button>
                              ) : (
                                <button onClick={e=>{e.stopPropagation();setCapitalReturnModal({movId:mov.id});}}
                                  style={{flexShrink:0,padding:"5px 12px",borderRadius:7,border:"none",background:"#4ade80",color:"#0a2a14",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                  Marcar devuelto
                                </button>
                              )}
                            </div>}
                          </div>
                        )}
                      </div>
                    );
                  };
                  return (<>
                    {vigentes.length>0&&<>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,marginTop:4}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80"}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#4ade80",letterSpacing:1}}>VIGENTES</span>
                        <span style={{fontSize:11,color:"#6b7094"}}>({vigentes.length})</span>
                      </div>
                      {vigentes.map(renderMov)}
                    </>}
                    {vencidas.length>0&&<>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,marginTop:vigentes.length>0?24:4}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#f87171"}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#f87171",letterSpacing:1}}>HISTÓRICAS</span>
                        <span style={{fontSize:11,color:"#6b7094"}}>({vencidas.length})</span>
                      </div>
                      {vencidas.map(renderMov)}
                    </>}
                  </>);
                })()}

              </div>
            );
          })()}


          {/* ADD / EDIT MOVEMENT */}
          {view==="add-movement" && (
            <div style={{maxWidth:560}}>
              <button className="btn-ghost" style={{marginBottom:20}} onClick={handleCancelForm}>← Volver</button>

              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                {isEditing && <div style={{width:36,height:36,borderRadius:10,background:"#7c6af720",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✏</div>}
                <div>
                  <h1 style={{fontSize:24,fontWeight:700}}>{isEditing?"Editar Movimiento":"Nuevo Movimiento"}</h1>
                  {isEditing && <div style={{fontSize:13,color:"#6b7094",marginTop:2}}>Modificá los campos y guardá los cambios</div>}
                </div>
              </div>
              {!isEditing && <p style={{color:"#6b7094",marginBottom:28,fontSize:14}}>Registrá un movimiento en la cuenta corriente</p>}
              {isEditing && <div style={{marginBottom:24}} />}

              <div className="card" style={{padding:24}}>
                <label>Inversor *</label>
                <select className="inp" value={movForm.investorId} onChange={e=>setMovForm({...movForm,investorId:e.target.value})} disabled={isEditing}>
                  <option value="">Seleccionar inversor...</option>
                  {investors.map(inv=><option key={inv.id} value={inv.id}>{inv.name}</option>)}
                </select>
                {isEditing && <div style={{fontSize:11,color:"#c0c4d6",marginTop:4}}>El inversor no se puede cambiar al editar</div>}

                <label>Tipo *</label>
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  {Object.entries(MOV_TYPES).map(([k,v])=>(
                    <button key={k} onClick={()=>!isEditing&&setMovForm({...movForm,type:k})}
                      style={{flex:1,padding:"10px",borderRadius:9,border:`2px solid ${movForm.type===k?v.color:"#dde1f0"}`,background:movForm.type===k?`${v.color}15`:"#f5f6fb",color:movForm.type===k?v.color:"#6b7094",fontWeight:600,cursor:isEditing?"default":"pointer",fontSize:13,fontFamily:"inherit",transition:"all 0.15s",opacity:isEditing&&movForm.type!==k?0.4:1}}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
                {isEditing && <div style={{fontSize:11,color:"#c0c4d6",marginTop:4}}>El tipo no se puede cambiar al editar</div>}

                <label>Monto *</label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#6b7094",fontFamily:"'DM Mono',monospace",fontSize:14}}>$</span>
                  <input className="inp" style={{paddingLeft:28}} type="number" min="0" step="0.01" placeholder="0.00" value={movForm.amount} onChange={e=>setMovForm({...movForm,amount:e.target.value})} />
                </div>

                <label>Fecha de inicio *</label>
                <input className="inp" type="date" value={movForm.date} onChange={e=>{
                  const val = e.target.value;
                  setMovForm({...movForm, date:val, endDate: movForm.endDate && val > movForm.endDate ? "" : movForm.endDate});
                }} />

                {movForm.type==="capital_out" && (() => {
                  const investorCapIns = movements.filter(m => m.investorId === parseInt(movForm.investorId) && m.type === "capital_in" && !m.linkedCapitalId);
                  if (investorCapIns.length === 0) return (
                    <div style={{marginTop:14,background:"#fff7ed",border:"1px solid #fb923c40",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#ea580c"}}>
                      ⚠ No hay inversiones registradas para este inversor. Primero registrá un ingreso.
                    </div>
                  );
                  const linked = investorCapIns.find(m => m.id === movForm.linkedCapitalId);
                  return (
                    <>
                      <div style={{height:1,background:"#dde1f0",margin:"20px 0 6px"}} />
                      <div style={{fontSize:12,fontWeight:700,color:"#f87171",letterSpacing:2,marginBottom:8}}>INVERSIÓN DE ORIGEN</div>
                      <label>Inversión vinculada *</label>
                      <select className="inp" value={movForm.linkedCapitalId} onChange={e=>setMovForm({...movForm,linkedCapitalId:e.target.value})}
                        style={!movForm.linkedCapitalId?{borderColor:"#f87171",background:"#fff5f5"}:{}}>
                        <option value="">— Seleccioná una inversión —</option>
                        {investorCapIns.map(m=>(
                          <option key={m.id} value={m.id}>
                            {fmtDate(m.date)} · {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(m.amount)} @ {m.annualRate}% · {m.empresa||m.note||"Sin nota"}
                          </option>
                        ))}
                      </select>
                      {!movForm.linkedCapitalId && <div style={{fontSize:11,color:"#f87171",marginTop:4}}>Seleccioná la inversión a la que corresponde este retiro</div>}
                      {linked && (
                        <div style={{marginTop:10,background:"#f8717110",border:"1px solid #f8717130",borderRadius:10,padding:"12px 14px",display:"flex",gap:14,alignItems:"center"}}>
                          <div style={{width:32,height:32,borderRadius:8,background:"#4ade8018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>↑</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:600,color:"#1a1d2e"}}>{linked.empresa||linked.note||"Inversión"}</div>
                            <div style={{fontSize:12,color:"#6b7094"}}>
                              {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(linked.amount)} @ {linked.annualRate}%
                              &nbsp;·&nbsp;{fmtDate(linked.date)}{linked.endDate && ` → ${fmtDate(linked.endDate)}`}
                            </div>
                          </div>
                        </div>
                      )}
                      {linked && movForm.amount && (() => {
                        const withdrawal = parseFloat(movForm.amount);
                        const newCapital = linked.amount - withdrawal;
                        const today = new Date().toISOString().slice(0,10);
                        const withdrawalDate = movForm.date || today;
                        const linkedSched = schedules.filter(s => s.capitalMovId === linked.id && !s.paid && s.dueDate > withdrawalDate);
                        const remainingMonths = linkedSched.length;
                        const origMonthly = linked.amount * linked.annualRate / 100 / 12 * ((FREQUENCIES.find(f=>f.key===(linked.frequency||"monthly"))||FREQUENCIES[0]).months||1);
                        const newMonthly = newCapital > 0
                          ? parseFloat((newCapital * linked.annualRate / 100 / 12 * ((FREQUENCIES.find(f=>f.key===(linked.frequency||"monthly"))||FREQUENCIES[0]).months||1)).toFixed(2))
                          : 0;
                        return (
                          <div style={{marginTop:10,background:"#f5f6fb",border:"1px solid #2e3347",borderRadius:10,padding:"14px 16px"}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#6b7094",letterSpacing:1,marginBottom:10}}>IMPACTO EN CUOTAS</div>
                            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                              <div>
                                <div style={{fontSize:11,color:"#6b7094"}}>Capital nuevo</div>
                                <div style={{fontWeight:700,fontSize:16,fontFamily:"'DM Mono',monospace",color:newCapital>0?"#1a1d2e":"#f87171"}}>{fmt(newCapital)}</div>
                              </div>
                              <div>
                                <div style={{fontSize:11,color:"#6b7094"}}>Cuotas afectadas</div>
                                <div style={{fontWeight:700,fontSize:16,fontFamily:"'DM Mono',monospace",color:"#fb923c"}}>{remainingMonths}</div>
                              </div>
                              <div>
                                <div style={{fontSize:11,color:"#6b7094"}}>Interés antes</div>
                                <div style={{fontWeight:600,fontSize:14,fontFamily:"'DM Mono',monospace",color:"#6b7094",textDecoration:"line-through"}}>{fmt(origMonthly)}</div>
                              </div>
                              <div>
                                <div style={{fontSize:11,color:"#6b7094"}}>Interés nuevo</div>
                                <div style={{fontWeight:700,fontSize:16,fontFamily:"'DM Mono',monospace",color:"#4ade80"}}>{fmt(newMonthly)}</div>
                              </div>
                            </div>
                            {newCapital <= 0 && <div style={{marginTop:8,fontSize:12,color:"#f87171"}}>⚠ El retiro supera el capital — todas las cuotas pendientes quedarán en $0</div>}
                            {remainingMonths === 0 && newCapital > 0 && <div style={{marginTop:8,fontSize:12,color:"#6b7094"}}>No hay cuotas pendientes para recalcular</div>}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {movForm.type==="capital_in" && (
                  <>
                    <div style={{height:1,background:"#dde1f0",margin:"20px 0 6px"}} />
                    <div style={{fontSize:12,fontWeight:700,color:"#7c6af7",letterSpacing:2,marginBottom:8}}>CONDICIONES DE LA INVERSIÓN</div>

                    {/* Optional: link to existing investment */}
                    {(() => {
                      const existingInvestments = movements.filter(m =>
                        m.type==="capital_in" && m.investorId===parseInt(movForm.investorId) && !m.linkedCapitalId &&
                        (!editingMovId || m.id !== editingMovId)
                      );
                      if (existingInvestments.length === 0) return null;
                      const linked = existingInvestments.find(m => m.id === movForm.linkedCapitalId);

                      const handleLinkChange = (val) => {
                        if (val) {
                          const orig = existingInvestments.find(m => m.id === val);
                          if (orig) {
                            setMovForm(f => ({...f, linkedCapitalId: val,
                              endDate: orig.endDate||"", annualRate: String(orig.annualRate||""),
                              frequency: orig.frequency||"monthly", interestType: orig.interestType||"simple",
                              empresa: orig.empresa||"",
                            }));
                            return;
                          }
                        }
                        setMovForm(f => ({...f, linkedCapitalId: ""}));
                      };

                      return (
                        <>
                          <label>¿Es un aporte adicional a una inversión existente?</label>
                          <select className="inp" value={movForm.linkedCapitalId||""} onChange={e=>handleLinkChange(e.target.value)} style={{marginBottom:8}}>
                            <option value="">No — nueva inversión independiente</option>
                            {existingInvestments.map(m=>(
                              <option key={m.id} value={m.id}>
                                {fmtDate(m.date)} · {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(m.amount)} @ {m.annualRate}%{m.empresa?` · ${m.empresa}`:""}{m.note?` · ${m.note}`:""}
                              </option>
                            ))}
                          </select>
                          {linked && (
                            <div style={{marginBottom:4,background:"#7c6af710",border:"1px solid #7c6af730",borderRadius:10,padding:"12px 14px",display:"flex",gap:14,alignItems:"center"}}>
                              <div style={{width:32,height:32,borderRadius:8,background:"#4ade8018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>↑</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:600,color:"#1a1d2e"}}>{linked.empresa||linked.note||"Inversión original"}</div>
                                <div style={{fontSize:12,color:"#6b7094"}}>
                                  {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(linked.amount)} @ {linked.annualRate}%
                                  &nbsp;·&nbsp;{fmtDate(linked.date)}{linked.endDate && ` → ${fmtDate(linked.endDate)}`}
                                  &nbsp;·&nbsp;{FREQUENCIES.find(f=>f.key===(linked.frequency||"monthly"))?.label}
                                  &nbsp;·&nbsp;{linked.interestType==="compound"?"Capitalizable":"Interés simple"}
                                </div>
                                {movForm.amount && movForm.date && (
                                  <div style={{marginTop:6,fontSize:12,color:"#7c6af7",fontWeight:600}}>
                                    Capital nuevo: {fmt(linked.amount + parseFloat(movForm.amount||0))} · cuotas futuras al {linked.annualRate}% sobre nuevo total
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Conditions fields — read-only when linked */}
                    {(()=>{
                      const isLinked = !!movForm.linkedCapitalId;
                      const roStyle = {background:"#f5f6fb",color:"#6b7094",cursor:"not-allowed",border:"1px solid #eef0f8"};
                      return (
                        <>
                          {isLinked && <div style={{fontSize:11,color:"#7c6af7",background:"#7c6af710",borderRadius:7,padding:"6px 10px",marginBottom:10,marginTop:6}}>ℹ Las condiciones se heredan de la inversión original</div>}
                          <label>Empresa *</label>
                          {isLinked ? (
                            <input className="inp" type="text" value={movForm.empresa} readOnly style={{marginBottom:8,...roStyle}} />
                          ) : (
                            <div style={{display:"flex",gap:8,marginBottom:8}}>
                              <select className="inp" value={movForm.empresa}
                                onChange={e=>{
                                  if(e.target.value==="__new__"){setView("add-company");setEditingCompanyId(null);setCompanyForm({name:"",legalName:"",taxId:""});}
                                  else setMovForm({...movForm,empresa:e.target.value});
                                }}
                                style={{...(!movForm.empresa?.trim()?{borderColor:"#f87171"}:{})}}>
                                <option value="">— Seleccioná una empresa —</option>
                                {companies.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                <option value="__new__">+ Nueva empresa...</option>
                              </select>
                            </div>
                          )}
                          <div className="two-col">
                            <div>
                              <label>Fecha fin *</label>
                              <input className="inp" type="date" value={movForm.endDate}
                                onChange={e=>{ if(!isLinked) setMovForm({...movForm, endDate: e.target.value}); }}
                                onBlur={e=>{
                                  if(!isLinked && movForm.date && e.target.value && e.target.value < movForm.date)
                                    setMovForm({...movForm, endDate:""});
                                }}
                                min={movForm.date||""}
                                readOnly={isLinked} style={isLinked?roStyle:{}} />
                            </div>
                            <div>
                              <label>Tasa anual (%) *</label>
                              <div style={{position:"relative"}}>
                                <input className="inp" style={{paddingRight:28,...(isLinked?roStyle:{})}} type="number" min="0" step="0.01" placeholder="ej: 24"
                                  value={movForm.annualRate} onChange={e=>!isLinked&&setMovForm({...movForm,annualRate:e.target.value})}
                                  readOnly={isLinked} />
                                <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#6b7094",fontSize:13}}>%</span>
                              </div>
                            </div>
                          </div>

                          <label>Tipo de interés *</label>
                          <div style={{display:"flex",gap:8,marginTop:4,marginBottom:4}}>
                            {[["simple","Interés Simple","Cuotas fijas sobre capital original"],["compound","Interés Capitalizable","El interés se acumula al capital cada período"]].map(([k,l,desc])=>(
                              <button key={k} onClick={()=>!isLinked&&setMovForm({...movForm,interestType:k})}
                                style={{flex:1,padding:"10px 12px",borderRadius:9,
                                  border:`2px solid ${movForm.interestType===k?"#7c6af7":"#dde1f0"}`,
                                  background:movForm.interestType===k?"#7c6af710":"transparent",
                                  cursor:isLinked?"not-allowed":"pointer",
                                  opacity:isLinked&&movForm.interestType!==k?0.35:1,
                                  fontFamily:"inherit",textAlign:"left",transition:"all 0.15s"}}>
                                <div style={{fontWeight:600,fontSize:13,color:movForm.interestType===k?"#7c6af7":"#1a1d2e"}}>{l}</div>
                                <div style={{fontSize:11,color:"#6b7094",marginTop:2}}>{desc}</div>
                              </button>
                            ))}
                          </div>

                          <label>Frecuencia de pago de intereses *</label>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                            {FREQUENCIES.map(f=>(
                              <button key={f.key} onClick={()=>!isLinked&&setMovForm({...movForm,frequency:f.key})}
                                style={{padding:"7px 13px",borderRadius:8,
                                  border:`2px solid ${movForm.frequency===f.key?"#7c6af7":"#dde1f0"}`,
                                  background:movForm.frequency===f.key?"#7c6af710":"transparent",
                                  color:movForm.frequency===f.key?"#7c6af7":"#6b7094",
                                  fontWeight:600,cursor:isLinked?"not-allowed":"pointer",
                                  opacity:isLinked&&movForm.frequency!==f.key?0.35:1,
                                  fontSize:12,fontFamily:"inherit",transition:"all 0.15s"}}>
                                {f.label}
                              </button>
                            ))}
                          </div>

                          <label style={{marginTop:12,display:"block"}}>Fecha de la primera cuota</label>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
                            <input className="inp" type="date"
                              value={movForm.firstDueDate}
                              min={movForm.date||undefined}
                              max={movForm.endDate||undefined}
                              onChange={e=>setMovForm({...movForm,firstDueDate:e.target.value})}
                              style={{maxWidth:200}} />
                            <span style={{fontSize:12,color:"#6b7094"}}>
                              {movForm.firstDueDate && movForm.date && movForm.firstDueDate !== (() => {
                                try {
                                  const f = FREQUENCIES.find(fr=>fr.key===movForm.frequency)||FREQUENCIES[0];
                                  const d = new Date(movForm.date+"T12:00:00");
                                  if(f.months===1){return new Date(d.getFullYear(),d.getMonth()+1,1).toISOString().slice(0,10);}
                                  const day=d.getDate(); d.setMonth(d.getMonth()+f.months);
                                  if(day===1){return new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
                                  return d.toISOString().slice(0,10);
                                } catch{return "";}
                              })() ? "⚠ Primera cuota proporcional" : "Primera cuota completa"}
                              {!movForm.firstDueDate && "Dejá vacío para calcular automáticamente"}
                            </span>
                          </div>
                        </>
                      );
                    })()}

                    {monthlyInterest !== null && (()=>{
                      const freq = FREQUENCIES.find(f=>f.key===movForm.frequency)||FREQUENCIES[0];
                      const isCompound = movForm.interestType === "compound";
                      const previewSched = (movForm.amount&&movForm.annualRate&&movForm.date&&movForm.endDate)
                        ? buildSchedule({id:"preview",type:"capital_in",amount:parseFloat(movForm.amount),date:movForm.date,endDate:movForm.endDate,annualRate:parseFloat(movForm.annualRate),frequency:movForm.frequency,interestType:movForm.interestType,firstDueDate:movForm.firstDueDate||undefined})
                        : [];
                      const totalInterest = isCompound
                        ? previewSched.reduce((s,c)=>s+c.periodInterest,0)
                        : previewSched.reduce((s,c)=>s+c.amount,0);
                      const fullCuotas = previewSched.filter(c=>!c.partial&&!c.isFinal);
                      const stdAmount = fullCuotas.length>0 ? fullCuotas[0].amount : (previewSched[0]?.periodInterest ?? null);
                      const finalRow = previewSched.find(c=>c.isFinal);
                      return (
                        <div className="calc-box" style={{marginTop:14}}>
                          <div style={{fontSize:11,color:"#6b7094",marginBottom:10,fontWeight:600,letterSpacing:1}}>CÁLCULO AUTOMÁTICO · {isCompound?"INTERÉS CAPITALIZABLE":"INTERÉS SIMPLE"}</div>
                          <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:10}}>
                            {stdAmount !== null && (
                              <div>
                                <div style={{fontSize:12,color:"#6b7094"}}>{isCompound?"1er interés período":"Interés por cuota"}</div>
                                <div style={{fontSize:20,fontWeight:700,color:"#fb923c",fontFamily:"'DM Mono',monospace"}}>{fmt(stdAmount)}</div>
                              </div>
                            )}
                            <div>
                              <div style={{fontSize:12,color:"#6b7094"}}>Cuotas</div>
                              <div style={{fontSize:20,fontWeight:700,color:"#7c6af7",fontFamily:"'DM Mono',monospace"}}>{previewSched.length}</div>
                            </div>
                            <div>
                              <div style={{fontSize:12,color:"#6b7094"}}>{isCompound?"Total intereses acumulados":"Total intereses"}</div>
                              <div style={{fontSize:20,fontWeight:700,color:"#4ade80",fontFamily:"'DM Mono',monospace"}}>{fmt(totalInterest)}</div>
                            </div>
                            {isCompound && finalRow && (
                              <div>
                                <div style={{fontSize:12,color:"#6b7094"}}>Capital + intereses al vencimiento</div>
                                <div style={{fontSize:20,fontWeight:700,color:"#60a5fa",fontFamily:"'DM Mono',monospace"}}>{fmt(finalRow.accumulatedCapital)}</div>
                              </div>
                            )}
                          </div>
                          {isCompound && (
                            <div style={{fontSize:11,color:"#7c6af7",background:"#7c6af710",borderRadius:7,padding:"6px 10px",marginBottom:8}}>
                              ℹ El interés de cada período se suma al capital y la siguiente cuota se calcula sobre el nuevo total
                            </div>
                          )}
                          {!isCompound && previewSched.filter(c=>c.partial).length>0 && (
                            <div style={{fontSize:11,color:"#7c6af7",background:"#7c6af710",borderRadius:7,padding:"6px 10px"}}>
                              ℹ {previewSched.filter(c=>c.partial).length===2?"Primera y última cuotas proporcionales":"Incluye cuota proporcional por días del período parcial"}
                            </div>
                          )}
                          {isEditing && (() => {
                            const orig = movements.find(m=>m.id===editingMovId);
                            if (!orig) return null;
                            return scheduleFieldsChanged(orig, movForm) ? (
                              <div style={{marginTop:8,padding:"8px 12px",background:"#fb923c15",borderRadius:8,border:"1px solid #fb923c30",fontSize:12,color:"#fb923c"}}>
                                ⚠ Cambiaste datos del cronograma — las cuotas se regenerarán al guardar
                              </div>
                            ) : null;
                          })()}
                        </div>
                      );
                    })()}
                  </>
                )}

                <label>Nota / Descripción</label>
                <input className="inp" placeholder="Ej: Inversión plazo fijo" value={movForm.note} onChange={e=>setMovForm({...movForm,note:e.target.value})} />

                <label style={{marginTop:18}}>Documentación adjunta</label>
                <Dropzone attachments={movForm.attachments} onAdd={addAttToForm} onRemove={remAttFromForm} />

                <div style={{display:"flex",gap:10,marginTop:24}}>
                  <button className="btn-ghost" onClick={handleCancelForm}>Cancelar</button>
                  <button className="btn-primary" style={{flex:1,opacity:(movForm.type==="capital_out"&&!movForm.linkedCapitalId)?0.45:1,cursor:(movForm.type==="capital_out"&&!movForm.linkedCapitalId)?"not-allowed":"pointer"}}
                    onClick={handleSaveMovement} disabled={movForm.type==="capital_out"&&!movForm.linkedCapitalId}>
                    {isEditing ? "Guardar Cambios" : movForm.type==="capital_in" ? "Registrar Inversión" : "Registrar Retiro"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADD INVESTOR */}
          {/* CLIENTES ABM */}
          {view==="clients" && (
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <div>
                  <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Clientes</h1>
                  <p style={{color:"#6b7094",fontSize:14}}>{investors.length} clientes registrados</p>
                </div>
                <button className="btn-primary" onClick={()=>{setEditingInvestorId(null);setInvForm({name:"",email:""});setView("add-investor")}}>+ Nuevo Cliente</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...investors].sort((a,b)=>a.name.localeCompare(b.name)).map(inv=>(
                  <div key={inv.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:12,background:"#fff",border:"1px solid #dde1f0"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#7c6af7,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,color:"#fff",flexShrink:0}}>{inv.name[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:15}}>{inv.name}</div>
                      <div style={{fontSize:12,color:"#6b7094"}}>{inv.email||"Sin email"}</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="edit-btn" onClick={()=>{setEditingInvestorId(inv.id);setInvForm({name:inv.name,email:inv.email||""});setView("add-investor")}}>✏ Editar</button>
                      <button className="delete-btn" style={{opacity:1,padding:"5px 10px",border:"1px solid #fee2e2",borderRadius:8,fontSize:12}} onClick={()=>setDeleteConfirm({type:"investor",id:inv.id,name:inv.name})}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMPRESAS ABM */}
          {view==="companies" && (
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <div>
                  <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Empresas</h1>
                  <p style={{color:"#6b7094",fontSize:14}}>{companies.length} empresas registradas</p>
                </div>
                <button className="btn-primary" onClick={()=>{setEditingCompanyId(null);setCompanyForm({name:"",legalName:"",taxId:""});setView("add-company")}}>+ Nueva Empresa</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {companies.map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:12,background:"#fff",border:"1px solid #dde1f0"}}>
                    <div style={{width:38,height:38,borderRadius:10,background:"#f0f2f8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏢</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:15}}>{c.name}</div>
                      <div style={{fontSize:12,color:"#6b7094",display:"flex",gap:12}}>
                        {c.legalName&&<span>Razón social: {c.legalName}</span>}
                        {c.taxId&&<span>ID Fiscal: {c.taxId}</span>}
                        {!c.legalName&&!c.taxId&&<span>Sin datos adicionales</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="edit-btn" onClick={()=>{setEditingCompanyId(c.id);setCompanyForm({name:c.name,legalName:c.legalName,taxId:c.taxId});setView("add-company")}}>✏ Editar</button>
                      <button className="delete-btn" style={{opacity:1,padding:"5px 10px",border:"1px solid #fee2e2",borderRadius:8,fontSize:12}} onClick={()=>setDeleteConfirm({type:"company",id:c.id,name:c.name})}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADD/EDIT EMPRESA */}
          {view==="add-company" && (
            <div style={{maxWidth:480}}>
              <button className="btn-ghost" style={{marginBottom:20}} onClick={()=>{setEditingCompanyId(null);setCompanyForm({name:"",legalName:"",taxId:""});setView("companies")}}>← Volver</button>
              <h1 style={{fontSize:24,fontWeight:700,marginBottom:6}}>{editingCompanyId?"Editar Empresa":"Nueva Empresa"}</h1>
              <div className="card" style={{padding:24}}>
                <label>Nombre *</label>
                <input className="inp" placeholder="Ej: Fortec A LLC" value={companyForm.name} onChange={e=>setCompanyForm({...companyForm,name:e.target.value})} />
                <label>Nombre Legal</label>
                <input className="inp" placeholder="Razón social completa" value={companyForm.legalName} onChange={e=>setCompanyForm({...companyForm,legalName:e.target.value})} />
                <label># Identificación Fiscal</label>
                <input className="inp" placeholder="EIN / CUIT / Tax ID" value={companyForm.taxId} onChange={e=>setCompanyForm({...companyForm,taxId:e.target.value})} />
                <div style={{display:"flex",gap:10,marginTop:24}}>
                  <button className="btn-ghost" onClick={()=>{setEditingCompanyId(null);setCompanyForm({name:"",legalName:"",taxId:""});setView("companies")}}>Cancelar</button>
                  <button className="btn-primary" style={{flex:1}} onClick={editingCompanyId?handleSaveEditCompany:handleAddCompany}>{editingCompanyId?"Guardar cambios":"Agregar Empresa"}</button>
                </div>
              </div>
            </div>
          )}

          {view==="add-investor" && (
            <div style={{maxWidth:480}}>
              <button className="btn-ghost" style={{marginBottom:20}} onClick={()=>{setEditingInvestorId(null);setInvForm({name:"",email:""});setView(editingInvestorId?"clients":"clients")}}>← Volver</button>
              <h1 style={{fontSize:24,fontWeight:700,marginBottom:6}}>{editingInvestorId?"Editar Cliente":"Nuevo Cliente"}</h1>
              <p style={{color:"#6b7094",marginBottom:28,fontSize:14}}>{editingInvestorId?"Modificá los datos del cliente":"Agregá un cliente para gestionar su cuenta corriente"}</p>
              <div className="card" style={{padding:24}}>
                <label>Nombre completo *</label>
                <input className="inp" placeholder="Ej: Juan Pérez" value={invForm.name} onChange={e=>setInvForm({...invForm,name:e.target.value})} />
                <label>Email</label>
                <input className="inp" type="email" placeholder="juan@ejemplo.com" value={invForm.email} onChange={e=>setInvForm({...invForm,email:e.target.value})} />
                <div style={{display:"flex",gap:10,marginTop:24}}>
                  <button className="btn-ghost" onClick={()=>{setEditingInvestorId(null);setInvForm({name:"",email:""});setView("clients")}}>Cancelar</button>
                  <button className="btn-primary" style={{flex:1}} onClick={editingInvestorId?handleSaveEditInvestor:handleAddInvestor}>{editingInvestorId?"Guardar cambios":"Agregar Cliente"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {markPaidItem && <MarkPaidModal scheduleItem={markPaidItem.scheduleItem} capitalMov={markPaidItem.capitalMov} onConfirm={handleMarkPaid} onClose={()=>setMarkPaidItem(null)} />}
      {viewingAttachments && <AttachmentModal attachments={viewingAttachments.attachments} onClose={()=>setViewingAttachments(null)} />}
      {statementModal && (() => { const inv = investors.find(i=>i.id===statementModal.investorId); return inv ? <StatementModal investor={inv} movements={movements} schedules={schedules} onClose={()=>setStatementModal(null)} /> : null; })()}
      {accessModal && <AccessModal investors={investors} credentials={credentials} onSave={async c=>{
        setCredentials(c);
        await Promise.all(Object.entries(c).map(([invId,cred])=>sb.upsert("credentials",credToDB(parseInt(invId),cred),"investor_id")));
        showToast("Accesos guardados");
      }} onLoginAs={inv=>{setAccessModal(false);setClientSession(inv);}} onClose={()=>setAccessModal(false)} />}

      {capitalReturnModal && <CapitalReturnModal movId={capitalReturnModal.movId} onConfirm={(movId, date)=>{
        setMovements(prev=>prev.map(m=>m.id===movId?{...m,capitalPaid:true,capitalPaidDate:date}:m));
        sb.patch("movements",movId,"id",{capital_paid:true,capital_paid_date:date});
        showToast("Capital marcado como devuelto ✓","ok");
        setCapitalReturnModal(null);
      }} onClose={()=>setCapitalReturnModal(null)} />}

      {regenWarning && (
        <RegenWarningModal
          paidCount={regenWarning.paidCount}
          onConfirm={(effectiveFrom)=>{ regenWarning.pendingSave(effectiveFrom); setRegenWarning(null); }}
          onCancel={()=>setRegenWarning(null)}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            {deleteConfirm.type==="investor" ? <>
              <h3 style={{fontSize:18,fontWeight:700,marginBottom:10}}>¿Eliminar cliente?</h3>
              <p style={{color:"#6b7094",fontSize:14,marginBottom:24}}>Se eliminará <strong>{deleteConfirm.name}</strong> y todos sus movimientos e intereses. Esta acción no se puede deshacer.</p>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancelar</button>
                <button className="btn-primary" style={{background:"#f87171"}} onClick={()=>handleDeleteInvestor(deleteConfirm.id)}>Eliminar</button>
              </div>
            </> : deleteConfirm.type==="company" ? <>
              <h3 style={{fontSize:18,fontWeight:700,marginBottom:10}}>¿Eliminar empresa?</h3>
              <p style={{color:"#6b7094",fontSize:14,marginBottom:24}}>Se eliminará <strong>{deleteConfirm.name}</strong>. Esta acción no se puede deshacer.</p>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancelar</button>
                <button className="btn-primary" style={{background:"#f87171"}} onClick={()=>handleDeleteCompany(deleteConfirm.id)}>Eliminar</button>
              </div>
            </> : <>
              <h3 style={{fontSize:18,fontWeight:700,marginBottom:10}}>¿Eliminar inversión?</h3>
              <p style={{color:"#6b7094",fontSize:14,marginBottom:24}}>Se eliminarán también todos los intereses generados. Esta acción no se puede deshacer.</p>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancelar</button>
                <button className="btn-primary" style={{background:"#f87171"}} onClick={()=>handleDeleteMovement(deleteConfirm)}>Eliminar</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {toast && <div className="toast" style={{background:toast.type==="err"?"#f87171":"#4ade80",color:toast.type==="err"?"#fff":"#0a2a14"}}>{toast.msg}</div>}
    </div>
  );
}

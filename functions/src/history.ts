import * as functions from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/firestore";
import * as admin from "firebase-admin";
import {format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isAfter} from "date-fns";

const db = admin.firestore();
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const EXPECTED: Record<string, number> = {monday: 240, tuesday: 360, wednesday: 240, thursday: 360, friday: 120};

function expectedMinutes(day: Date) { return EXPECTED[DAY_NAMES[day.getDay()]] ?? 0; }
function dayId(userId: string, date: string) { return `${userId}_${date}`; }
function weekId(userId: string, date: Date) { return `${userId}_${format(date, "RRRR-'W'II")}`; }
function supervisor(uid: string) { return db.collection("users").doc(uid).get().then(s => { if (!s.exists || s.data()?.role !== "supervisora") throw new functions.https.HttpsError("permission-denied", "Apenas supervisoras podem realizar esta operação."); }); }

function workedMinutes(records: any[]) {
  const sorted = [...records].sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  let total = 0; let entry: admin.firestore.Timestamp | null = null;
  for (const r of sorted) {
    if (r.type === "entry") entry = r.timestamp;
    if (r.type === "exit" && entry) { total += Math.max(0, Math.round((r.timestamp.toMillis() - entry.toMillis()) / 60000)); entry = null; }
  }
  return total;
}

async function approvedAbonos(userId: string, start: string, end: string) {
  const snap = await db.collection("abonoRequests").where("userId", "==", userId).where("date", ">=", start).where("date", "<=", end).where("status", "==", "approved").get();
  const result = new Map<string, number>();
  snap.docs.forEach(d => { const x = d.data(); result.set(x.date, (result.get(x.date) ?? 0) + Number(x.minutes ?? 0)); });
  return result;
}

async function buildDays(userId: string, start: Date, end: Date, startDate: string) {
  const startStr = format(start, "yyyy-MM-dd"); const endStr = format(end, "yyyy-MM-dd");
  const [punches, abonos] = await Promise.all([
    db.collection("punches").where("userId", "==", userId).where("date", ">=", startStr).where("date", "<=", endStr).get(),
    approvedAbonos(userId, startStr, endStr),
  ]);
  const byDate = new Map<string, any[]>();
  punches.docs.forEach(d => { const x = d.data(); const list = byDate.get(x.date) ?? []; list.push(x); byDate.set(x.date, list); });
  const days: any[] = [];
  let carry = 0;
  for (const day of eachDayOfInterval({start, end})) {
    const date = format(day, "yyyy-MM-dd");
    if (date < startDate || isAfter(day, new Date())) continue;
    const expected = expectedMinutes(day);
    const approved = Math.min(expected, abonos.get(date) ?? 0);
    const worked = workedMinutes(byDate.get(date) ?? []);
    const required = Math.max(0, expected - approved);
    const rawBalance = worked - required;
    const compensated = rawBalance < 0 ? Math.min(carry, -rawBalance) : 0;
    const balance = rawBalance + compensated;
    const previousCarry = carry;
    carry = Math.max(0, carry + rawBalance);
    days.push({date, weekday: DAY_NAMES[day.getDay()], expected, worked, approvedAbonoMinutes: approved, required, rawBalance, compensatedMinutes: compensated, balance, carryIn: previousCarry, carryOut: carry, status: approved >= expected && expected > 0 ? "abono" : rawBalance >= 0 ? "positive" : "negative"});
  }
  return days;
}

async function persistDays(userId: string, days: any[]) {
  const batch = db.batch();
  days.forEach(day => batch.set(db.collection("dailySummaries").doc(dayId(userId, day.date)), {...day, userId, updatedAt: admin.firestore.FieldValue.serverTimestamp()}));
  if (days.length) await batch.commit();
}

async function rebuildWeeks(userId: string, days: any[]) {
  const grouped = new Map<string, any[]>();
  days.forEach(d => { const key = weekId(userId, parseISO(d.date)); const list = grouped.get(key) ?? []; list.push(d); grouped.set(key, list); });
  const batch = db.batch();
  for (const [id, list] of grouped) {
    const worked = list.reduce((n, d) => n + d.worked, 0);
    const expected = list.reduce((n, d) => n + d.expected, 0);
    const abono = list.reduce((n, d) => n + d.approvedAbonoMinutes, 0);
    const balance = list[list.length - 1]?.carryOut ?? 0;
    const compensated = list.reduce((n, d) => n + d.compensatedMinutes, 0);
    const compensationDates = list.filter(d => d.compensatedMinutes > 0).map(d => d.date);
    batch.set(db.collection("weeklySummaries").doc(id), {userId, week: id.split("_").pop(), weekStart: format(startOfWeek(parseISO(list[0].date), {weekStartsOn: 1}), "yyyy-MM-dd"), weekEnd: format(endOfWeek(parseISO(list[0].date), {weekStartsOn: 1}), "yyyy-MM-dd"), workedMinutes: worked, expectedMinutes: expected, approvedAbonoMinutes: abono, compensatedMinutes: compensated, balance, compensationDates, updatedAt: admin.firestore.FieldValue.serverTimestamp()});
  }
  if (grouped.size) await batch.commit();
}

export const refreshHistorySummaries = onDocumentCreated("punches/{punchId}", async event => {
  const data = event.data?.data();
  if (!data?.userId || !data?.date) return;
  const user = await db.collection("users").doc(data.userId).get();
  const startDate = user.data()?.startDate ?? data.date;
  const day = parseISO(data.date);
  const days = await buildDays(data.userId, startOfWeek(day, {weekStartsOn: 1}), endOfWeek(day, {weekStartsOn: 1}), startDate);
  await persistDays(data.userId, days);
  await rebuildWeeks(data.userId, days);
});

export const getInternshipHistory = functions.https.onCall(async request => {
  if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
  const userId = String(request.data?.userId ?? "");
  if (!userId) throw new functions.https.HttpsError("invalid-argument", "userId é obrigatório.");
  const caller = await db.collection("users").doc(request.auth.uid).get();
  if (request.auth.uid !== userId && caller.data()?.role !== "supervisora") throw new functions.https.HttpsError("permission-denied", "Você não pode ver este histórico.");
  const user = await db.collection("users").doc(userId).get();
  if (!user.exists) throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
  const startDate = user.data()?.startDate ?? format(new Date(), "yyyy-MM-dd");
  const mode = request.data?.mode ?? "month";
  const selected = String(request.data?.date ?? format(new Date(), "yyyy-MM-dd"));
  let start: Date; let end: Date;
  if (mode === "week") { const d = parseISO(selected); start = startOfWeek(d, {weekStartsOn: 1}); end = endOfWeek(d, {weekStartsOn: 1}); }
  else if (mode === "day") { start = parseISO(selected); end = parseISO(selected); }
  else { const d = parseISO(`${selected}-01`); start = new Date(d.getFullYear(), d.getMonth(), 1); end = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  const cached = await db.collection("dailySummaries").where("userId", "==", userId).where("date", ">=", format(start, "yyyy-MM-dd")).where("date", "<=", format(end, "yyyy-MM-dd")).get();
  let days = cached.docs.map(d => d.data());
  if (days.length < Math.max(1, eachDayOfInterval({start, end}).filter(d => format(d, "yyyy-MM-dd") >= startDate && !isAfter(d, new Date())).length / 2)) {
    days = await buildDays(userId, start, end, startDate);
    await persistDays(userId, days); await rebuildWeeks(userId, days);
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (mode === "week") {
    const week = await db.collection("weeklySummaries").doc(weekId(userId, start)).get();
    return {userData: {id: userId, name: user.data()?.name, startDate}, days, week: week.exists ? week.data() : null};
  }
  return {userData: {id: userId, name: user.data()?.name, startDate}, days};
});

export const requestAbono = functions.https.onCall(async request => {
  if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
  const userId = String(request.data?.userId ?? request.auth.uid);
  if (userId !== request.auth.uid) throw new functions.https.HttpsError("permission-denied", "Apenas o estagiário pode criar seu requerimento.");
  const date = String(request.data?.date ?? ""); const minutes = Number(request.data?.minutes ?? 0); const reason = String(request.data?.reason ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || minutes <= 0 || !reason) throw new functions.https.HttpsError("invalid-argument", "Data, horas abonadas e motivo são obrigatórios.");
  const user = await db.collection("users").doc(userId).get(); const startDate = user.data()?.startDate;
  if (startDate && date < startDate) throw new functions.https.HttpsError("invalid-argument", "A data precisa estar dentro do estágio.");
  const expected = expectedMinutes(parseISO(date));
  if (minutes > expected) throw new functions.https.HttpsError("invalid-argument", "O abono não pode ultrapassar a carga prevista do dia.");
  const ref = await db.collection("abonoRequests").add({userId, userName: user.data()?.name ?? "", date, minutes, reason, status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp()});
  return {id: ref.id, status: "pending"};
});

export const reviewAbono = functions.https.onCall(async request => {
  if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
  await supervisor(request.auth.uid);
  const requestId = String(request.data?.requestId ?? ""); const status = String(request.data?.status ?? "");
  if (!requestId || !["approved", "rejected"].includes(status)) throw new functions.https.HttpsError("invalid-argument", "Requerimento e decisão são obrigatórios.");
  const ref = db.collection("abonoRequests").doc(requestId); const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Requerimento não encontrado.");
  const data = snap.data()!;
  await ref.update({status, reviewedBy: request.auth.uid, reviewedAt: admin.firestore.FieldValue.serverTimestamp()});
  const user = await db.collection("users").doc(data.userId).get();
  const date = parseISO(data.date); const start = startOfWeek(date, {weekStartsOn: 1}); const end = endOfWeek(date, {weekStartsOn: 1});
  const days = await buildDays(data.userId, start, end, user.data()?.startDate ?? data.date);
  await persistDays(data.userId, days); await rebuildWeeks(data.userId, days);
  return {status};
});

export const listAbonoRequests = functions.https.onCall(async request => {
  if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
  const caller = await db.collection("users").doc(request.auth.uid).get();
  const userId = String(request.data?.userId ?? request.auth.uid);
  if (request.auth.uid !== userId && caller.data()?.role !== "supervisora") throw new functions.https.HttpsError("permission-denied", "Sem permissão.");
  const snap = await db.collection("abonoRequests").where("userId", "==", userId).get();
  return snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
});
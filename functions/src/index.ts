// src/functions/index.ts

process.env.TZ = "America/Sao_Paulo";

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {createHash, randomBytes} from "crypto";
import {format, startOfWeek, subWeeks, parseISO, isBefore} from "date-fns";

admin.initializeApp();
const db = admin.firestore();

function hashValue(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function getClientIp(request: any): string {
  if (request.rawRequest.ip) return request.rawRequest.ip;
  const forwarded = request.rawRequest.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    const forwardedParts = forwarded.split(",");
    return forwardedParts[forwardedParts.length - 1]?.trim() || "unknown";
  }
  const realIp = request.rawRequest.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp) return realIp.trim();
  return "unknown";
}
function requireSupervisor(request: any): string { if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "Voce precisa estar logado."); return request.auth.uid; }
async function assertSupervisor(uid: string): Promise<void> { const supervisor = await db.collection("users").doc(uid).get(); if (!supervisor.exists || supervisor.data()?.role !== "supervisora") throw new functions.https.HttpsError("permission-denied", "Apenas supervisoras podem realizar esta operacao."); }

export const registerPunch = functions.https.onCall(async (request) => {
  const pin = typeof request.data?.pin === "string" ? request.data.pin.trim() : "";
  if (!/^\d{4}$/.test(pin)) throw new functions.https.HttpsError("invalid-argument", "O PIN deve conter exatamente 4 digitos.");
  const ip = getClientIp(request);
  const pinLimitRef = db.collection("punchRateLimits").doc(`pin_${hashValue(pin)}`);
  const ipLimitRef = db.collection("punchRateLimits").doc(`ip_${hashValue(ip)}`);
  const userSnapshot = await db.collection("users").where("pin", "==", pin).limit(1).get();
  const userDoc = userSnapshot.docs[0];
  const now = admin.firestore.Timestamp.now();
  try {
    return await db.runTransaction(async (transaction) => {
      const pinLimitSnapshot = await transaction.get(pinLimitRef); const ipLimitSnapshot = await transaction.get(ipLimitRef);
      const pinLimit = pinLimitSnapshot.data();
      if (pinLimit?.lastAcceptedAt) { const elapsed = now.toMillis() - pinLimit.lastAcceptedAt.toMillis(); if (elapsed < 300000) throw new functions.https.HttpsError("resource-exhausted", "Este PIN ja foi registrado. Aguarde 5 minutos para registrar novamente.", {retryAfterSeconds: Math.ceil((300000 - elapsed) / 1000)}); }
      const ipLimit = ipLimitSnapshot.data(); const windowStart = ipLimit?.windowStart?.toMillis?.() ?? 0; const windowElapsed = now.toMillis() - windowStart; const requestCount = windowElapsed >= 60000 ? 0 : (ipLimit?.count ?? 0);
      if (requestCount >= 10) throw new functions.https.HttpsError("resource-exhausted", "Muitas tentativas deste computador. Aguarde um minuto e tente novamente.", {retryAfterSeconds: Math.ceil((60000 - windowElapsed) / 1000)});
      const nextWindowStart = requestCount === 0 ? now : ipLimit!.windowStart; transaction.set(ipLimitRef, {count: requestCount + 1, windowStart: nextWindowStart, updatedAt: now});
      if (!userDoc) throw new functions.https.HttpsError("not-found", "PIN nao encontrado.");
      const user = userDoc.data(); if (user?.role !== "estagiario") throw new functions.https.HttpsError("permission-denied", "Apenas estagiarios podem bater ponto.");
      const today = format(now.toDate(), "yyyy-MM-dd"); const type: "entry" | "exit" = user.lastPunchDate !== today ? "entry" : user.lastPunchType === "entry" ? "exit" : "entry";
      const punchRef = db.collection("punches").doc(); transaction.set(punchRef, {userId: userDoc.id, userName: user.name, type, timestamp: now, date: today}); transaction.update(userDoc.ref, {lastPunchDate: today, lastPunchType: type}); transaction.set(pinLimitRef, {lastAcceptedAt: now, updatedAt: now}, {merge: true});
      return {userId: userDoc.id, userName: user.name, type, timestamp: now.toDate().toISOString()};
    });
  } catch (error) { if (error instanceof functions.https.HttpsError) throw error; console.error("Erro ao registrar ponto:", error); throw new functions.https.HttpsError("internal", "Nao foi possivel registrar o ponto."); }
});

export const createInternshipInvite = functions.https.onCall(async (request) => {
  const supervisorUid = requireSupervisor(request); await assertSupervisor(supervisorUid); const data = request.data ?? {};
  const name = typeof data.name === "string" ? data.name.trim() : ""; const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : ""; const pin = typeof data.pin === "string" ? data.pin.trim() : ""; const startDate = typeof data.startDate === "string" ? data.startDate.trim() : "";
  if (!name || !email || !/^\d{4}$/.test(pin) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new functions.https.HttpsError("invalid-argument", "Nome, e-mail, PIN de 4 digitos e data de inicio sao obrigatorios.");
  const existingPin = await db.collection("users").where("pin", "==", pin).limit(1).get(); if (!existingPin.empty) throw new functions.https.HttpsError("already-exists", "Este PIN ja esta em uso.");
  const temporaryPassword = randomBytes(24).toString("base64url");
  try { const authUser = await admin.auth().createUser({email, password: temporaryPassword, displayName: name}); const safeName = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, ""); const qrCode = `PONTO-${safeName}-${randomBytes(4).toString("hex").toUpperCase()}`; await db.collection("users").doc(authUser.uid).set({name, email, role: "estagiario", pin, qrCode, startDate}); return {uid: authUser.uid, email, name, qrCode}; }
  catch (error: any) { if (error?.code === "auth/email-already-exists") throw new functions.https.HttpsError("already-exists", "Este e-mail ja possui uma conta."); console.error("Erro ao criar convite de estagiario:", error); throw new functions.https.HttpsError("internal", "Nao foi possivel criar o convite."); }
});

export const listInterns = functions.https.onCall(async (request) => {
  const supervisorUid = requireSupervisor(request); await assertSupervisor(supervisorUid); const snapshot = await db.collection("users").where("role", "==", "estagiario").get();
  return snapshot.docs.map((doc) => { const data = doc.data(); return {id: doc.id, name: data.name, email: data.email, qrCode: data.qrCode, role: data.role, startDate: data.startDate}; });
});

export const getDashboardData = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError("unauthenticated", "Voce precisa estar logado para acessar os dados.");
  const {userId} = request.data; if (!userId) throw new functions.https.HttpsError("invalid-argument", "O ID do usuario e obrigatorio.");
  try {
    const callerRef = await db.collection("users").doc(request.auth.uid).get(); const callerData = callerRef.data(); if (request.auth.uid !== userId && callerData?.role !== "supervisora") throw new functions.https.HttpsError("permission-denied", "Voce nao tem permissao para ver este painel.");
    const now = new Date(); const userDoc = await db.collection("users").doc(userId).get(); if (!userDoc.exists) throw new functions.https.HttpsError("not-found", "Usuario nao encontrado."); const userData = userDoc.data();
    const internshipStart = userData?.startDate ? parseISO(userData.startDate + "T00:00:00") : startOfWeek(subWeeks(now, 3), {weekStartsOn: 1});
    const fourWeeksAgo = startOfWeek(subWeeks(now, 3), {weekStartsOn: 1});
    const weekStart = isBefore(fourWeeksAgo, internshipStart) ? internshipStart : fourWeeksAgo;
    const weekEnd = now; // evita considerar dias futuros no saldo

    // Em vez de recalcular tudo a partir de punches, usamos os dailySummaries
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    const cached = await db.collection("dailySummaries")
      .where("userId", "==", userId)
      .where("date", ">=", startStr)
      .where("date", "<=", endStr)
      .get();

    let days = cached.docs.map(d => d.data());
    days.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    // Banco de horas: usamos o carryOut do ultimo dia conhecido
    const totalBalance = days.length ? Number(days[days.length - 1].carryOut ?? days[days.length - 1].balance ?? 0) : 0;

    // Registros de hoje ainda usam punches diretamente
    const punchesSnapshot = await db.collection("punches")
      .where("userId", "==", userId)
      .where("timestamp", ">=", weekStart)
      .where("timestamp", "<=", weekEnd)
      .get();
    const allRecords = punchesSnapshot.docs.map((doc) => {
      const data = doc.data();
      const recordDate = data.timestamp.toDate();
      return {id: doc.id, ...data, timestamp: recordDate.toISOString(), date: format(recordDate, "yyyy-MM-dd")};
    });
    const today = format(now, "yyyy-MM-dd");
    const todayRecords = allRecords.filter((r: any) => r.date === today);

    // Historico de dias: montamos a partir dos DaySummary de dailySummaries
    const daySummaries = days.map((d: any) => ({
      date: d.date,
      dateStr: d.date,
      expected: Number(d.expected ?? 0),
      worked: Number(d.worked ?? 0),
      balance: Number(d.balance ?? 0),
      approvedAbonoMinutes: Number(d.approvedAbonoMinutes ?? 0),
      status: d.status,
    })).reverse();

    return {
      userData: {id: userId, name: userData?.name, startDate: userData?.startDate, qrCode: userData?.qrCode},
      totalBalance,
      todayRecords,
      daySummaries,
    };
  } catch (error) {
    console.error("Erro na funcao getDashboardData:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Erro ao processar os dados do painel.");
  }
});

export * from "./history";

// functions/src/index.ts

// CORRECAO: Forca o timezone do processo Node.js para Brasilia ANTES de qualquer
// calculo de data. Sem isso, o runtime das Cloud Functions roda em UTC por padrao,
// o que faz getDay()/format() calcularem o dia da semana 3h adiantados em relacao
// ao horario de Brasilia -- e como UTC esta ADIANTE do horario local (UTC-3), a
// meia-noite de segunda-feira em UTC ainda e domingo 21h em Brasilia, deslocando
// toda a semana em -1 dia (domingo em vez de segunda, quinta em vez de sexta).
process.env.TZ = "America/Sao_Paulo";

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, parseISO, isBefore } from "date-fns";

admin.initializeApp();
const db = admin.firestore();

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Carga horaria real por dia da semana (22h semanais), alinhada com src/lib/schedule.ts
// do frontend. O valor generico anterior (360 min para todo dia util) nao refletia
// a jornada real de Segunda/Quarta/Sexta (240/240/120 min).
const EXPECTED_MINUTES_BY_DAY: Record<string, number> = {
  monday: 240,
  tuesday: 360,
  wednesday: 240,
  thursday: 360,
  friday: 120,
};

function getDayExpectedMinutes(day: Date): number {
  const dayName = DAY_NAMES[day.getDay()];
  return EXPECTED_MINUTES_BY_DAY[dayName] ?? 0;
}

function calculateDailyMinutes(records: any[]): number {
  if (!records || records.length === 0) return 0;
  let totalMinutes = 0;
  let lastEntry = null;

  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  for (const record of sorted) {
    if (record.type === 'entry') {
      lastEntry = new Date(record.timestamp);
    } else if (record.type === 'exit' && lastEntry) {
      const exitDate = new Date(record.timestamp);
      totalMinutes += (exitDate.getTime() - lastEntry.getTime()) / (1000 * 60);
      lastEntry = null;
    }
  }
  // Correcao: Arredondando para evitar dizimas (ex: 4.652633333333313m)
  return Math.round(totalMinutes);
}

export const getDashboardData = functions.https.onCall(async (request) => {
  // SEGURANCA: Verifica se a requisicao veio de um usuario logado no Firebase Auth
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Voce precisa estar logado para acessar os dados.");
  }

  const { userId } = request.data;

  if (!userId) {
    throw new functions.https.HttpsError("invalid-argument", "O ID do usuario e obrigatorio.");
  }

  try {
    // SEGURANCA: Verifica se quem esta pedindo os dados e o proprio dono ou uma supervisora
    const callerRef = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerRef.data();

    if (request.auth.uid !== userId && callerData?.role !== "supervisora") {
      throw new functions.https.HttpsError("permission-denied", "Voce nao tem permissao para ver este painel.");
    }

    const now = new Date();

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Usuario nao encontrado.");
    }
    const userData = userDoc.data();

    const internshipStart = userData?.startDate
      ? parseISO(userData.startDate + 'T00:00:00')
      : startOfWeek(subWeeks(now, 3), { weekStartsOn: 1 });

    const fourWeeksAgo = startOfWeek(subWeeks(now, 3), { weekStartsOn: 1 });
    const weekStart = isBefore(fourWeeksAgo, internshipStart) ? internshipStart : fourWeeksAgo;
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const punchesSnapshot = await db.collection("punches")
      .where("userId", "==", userId)
      .where("timestamp", ">=", weekStart)
      .where("timestamp", "<=", weekEnd)
      .get();

    const allRecords = punchesSnapshot.docs.map(doc => {
      const data = doc.data();
      const recordDate = data.timestamp.toDate();

      return {
        id: doc.id,
        ...data,
        timestamp: recordDate.toISOString(),
        date: format(recordDate, 'yyyy-MM-dd')
      };
    });

    const today = format(now, 'yyyy-MM-dd');
    const todayRecords = allRecords.filter((r: any) => r.date === today);

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const summaries = [];
    let totalBalance = 0;

    for (const day of days) {
      if (isBefore(day, internshipStart)) continue;

      const dayName = DAY_NAMES[day.getDay()];
      if (['saturday', 'sunday'].includes(dayName)) continue;

      const dateStr = format(day, 'yyyy-MM-dd');
      const dayRecords = allRecords.filter((r: any) => r.date === dateStr);
      const expected = getDayExpectedMinutes(day);
      const worked = calculateDailyMinutes(dayRecords);
      const dayBalance = worked - expected;

      if (day <= now) totalBalance += dayBalance;

      summaries.push({
        date: day.toISOString(),
        dateStr,
        expected,
        worked,
        balance: dayBalance,
        records: dayRecords
      });
    }

    return {
      userData: { id: userId, name: userData?.name, startDate: userData?.startDate, qrCode: userData?.qrCode },
      totalBalance,
      todayRecords,
      daySummaries: summaries.reverse()
    };

  } catch (error) {
    console.error("Erro na funcao getDashboardData:", error);
    // Repassa o erro de permissao para o front-end exibir adequadamente
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Erro ao processar os dados do painel.");
  }
});

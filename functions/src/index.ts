// functions/src/index.ts -- Linha 1
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, parseISO, isBefore } from "date-fns";

admin.initializeApp();
const db = admin.firestore();

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getDayExpectedMinutes(day: Date): number {
  const dayName = DAY_NAMES[day.getDay()];
  if (['saturday', 'sunday'].includes(dayName)) return 0;
  return 360; 
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
  // Correção: Arredondando para evitar dízimas (ex: 4.652633333333313m)
  return Math.round(totalMinutes);
}

export const getDashboardData = functions.https.onCall(async (request) => {
  // SEGURANÇA: Verifica se a requisição veio de um usuário logado no Firebase Auth
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para acessar os dados.");
  }

  const { userId } = request.data;

  if (!userId) {
    throw new functions.https.HttpsError("invalid-argument", "O ID do usuário é obrigatório.");
  }

  try {
    // SEGURANÇA: Verifica se quem está pedindo os dados é o próprio dono ou uma supervisora
    const callerRef = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerRef.data();
    
    if (request.auth.uid !== userId && callerData?.role !== "supervisora") {
      throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para ver este painel.");
    }

    const now = new Date();
    
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
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
    console.error("Erro na função getDashboardData:", error);
    // Repassa o erro de permissão para o front-end exibir adequadamente
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Erro ao processar os dados do painel.");
  }
});
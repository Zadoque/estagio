import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PunchRecord } from './schedule';

export interface PunchEntry {
  userId: string;
  userName: string;
  type: 'entry' | 'exit';
  timestamp: Timestamp;
  date: string; // YYYY-MM-DD
}

export async function savePunch(data: Omit<PunchEntry, 'timestamp'>) {
  const docRef = await addDoc(collection(db, 'punches'), {
    ...data,
    timestamp: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPunchesForUser(userId: string, startDate?: string, endDate?: string): Promise<PunchRecord[]> {
  let q = query(
    collection(db, 'punches'),
    where('userId', '==', userId),
    orderBy('timestamp', 'asc')
  );

  const snapshot = await getDocs(q);
  const records: PunchRecord[] = snapshot.docs.map(doc => {
    const data = doc.data() as PunchEntry;
    return {
      id: doc.id,
      userId: data.userId,
      timestamp: data.timestamp.toDate(),
      type: data.type,
      date: data.date,
    };
  });

  if (startDate && endDate) {
    return records.filter(r => r.date >= startDate && r.date <= endDate);
  }
  return records;
}

export async function getAllPunches(startDate?: string, endDate?: string): Promise<PunchRecord[]> {
  const q = query(collection(db, 'punches'), orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);
  const records: PunchRecord[] = snapshot.docs.map(doc => {
    const data = doc.data() as PunchEntry;
    return {
      id: doc.id,
      userId: data.userId,
      timestamp: data.timestamp.toDate(),
      type: data.type,
      date: data.date,
    };
  });

  if (startDate && endDate) {
    return records.filter(r => r.date >= startDate && r.date <= endDate);
  }
  return records;
}

export async function getTodayPunches(userId: string): Promise<PunchRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  return getPunchesForUser(userId, today, today);
}

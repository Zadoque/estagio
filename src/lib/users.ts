// User definitions and PIN authentication
// PINs are stored here for the kiosk mode (local authentication)
// For production, consider storing hashed PINs in the database

export type UserRole = 'estagiario' | 'supervisor';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string; // 4-digit PIN for kiosk
  email: string; // for web login
  password: string; // for web login
  qrCode: string; // unique QR code value
}

export const USERS: AppUser[] = [
  {
    id: 'zadoque',
    name: 'Zadoque',
    role: 'estagiario',
    pin: '1234',
    email: 'zadoque@estagio.local',
    password: 'Estagio@2026',
    qrCode: 'PONTO-ZADOQUE-A7F3K9',
  },
  {
    id: 'artur',
    name: 'Artur',
    role: 'estagiario',
    pin: '5678',
    email: 'artur@estagio.local',
    password: 'Estagio@2026',
    qrCode: 'PONTO-ARTUR-B2M8P4',
  },
  {
    id: 'marilia',
    name: 'Marília',
    role: 'supervisor',
    pin: '9012',
    email: 'marilia@estagio.local',
    password: 'Supervisor@2026',
    qrCode: 'PONTO-MARILIA-C5R1N6',
  },
];

export function getUserByPin(pin: string): AppUser | undefined {
  return USERS.find(u => u.pin === pin);
}

export function getUserByQrCode(qr: string): AppUser | undefined {
  return USERS.find(u => u.qrCode === qr);
}

export function getUserByCredentials(email: string, password: string): AppUser | undefined {
  return USERS.find(u => u.email === email && u.password === password);
}

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id);
}

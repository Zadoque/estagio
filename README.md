# Sistema de Controle de Ponto — Estágio

Aplicação web para registro de ponto dos estagiários Zadoque e Artur, com painel gerencial para a supervisora Marília.

## Stack
- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Firebase Firestore** (banco de dados serverless)
- **TypeScript**

## Funcionalidades
- 🖥️ **Kiosk** — Tela fixa para bater ponto via PIN (4 dígitos) ou QR Code
- 👤 **Dashboard do Estagiário** — Banco de horas (saldo +/-) e histórico de dias
- 🛡️ **Painel da Supervisora** — Presença em tempo real, banco de horas e registros recentes
- ☁️ **Firebase** — Dados persistidos na nuvem, acessíveis remotamente

## Carga Horária (22h semanais)
| Dia | Turno 1 | Turno 2 |
|---|---|---|
| Segunda | 08–10h | 14–16h |
| Terça | 08–12h | 14–16h |
| Quarta | 08–10h | 14–16h |
| Quinta | 08–12h | 14–16h |
| Sexta | 08–10h | — |

## Setup

### 1. Configure o Firebase
Crie um projeto no [Firebase Console](https://console.firebase.google.com), ative o **Firestore** e copie as credenciais.

### 2. Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### 3. Instalar e rodar
```bash
npm install
npm run dev
```

## Credenciais Padrão

### Login Web (Dashboard / Supervisor)
| Usuário | Email | Senha |
|---|---|---|
| Zadoque | zadoque@estagio.local | Estagio@2026 |
| Artur | artur@estagio.local | Estagio@2026 |
| Marília | marilia@estagio.local | Supervisor@2026 |

### Kiosk (PIN)
| Usuário | PIN |
|---|---|
| Zadoque | 1234 |
| Artur | 5678 |
| Marília | 9012 |

### QR Codes
Acesse `/kiosk/qr-codes` para gerar e baixar os QR Codes para impressão.

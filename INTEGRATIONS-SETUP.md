# Configurazione Integrazioni AI-DermaSense

## 1. Integrazione Klaviyo (Recupero Leads)

### Cosa fa:
- Cattura automaticamente nome e email da ogni conversazione
- Aggiunge i contatti alla lista specificata in Klaviyo
- Sincronizza i dati in tempo reale quando l'utente fornisce l'email

### Come configurare:

1. **Ottieni API Key da Klaviyo:**
   - Accedi al tuo account Klaviyo
   - Vai su Account → Settings → API Keys
   - Crea una nuova Private API Key
   - Copia la chiave (inizia con `pk_`)

2. **Ottieni List ID:**
   - In Klaviyo, vai su Lists & Segments
   - Seleziona la lista desiderata
   - Copia il List ID dall'URL o dalle impostazioni

3. **Configura le variabili d'ambiente:**
   ```bash
   KLAVIYO_API_KEY=pk_xxxxxxxxxxxxxxxxxx
   KLAVIYO_LIST_ID=XXXXXX
   ```

## 2. Integrazione Google Sheets (Log Conversazioni)

### Cosa fa:
- Copia automaticamente tutte le conversazioni in Google Sheets
- Include: data/ora, nome, email, punteggio pelle, numero messaggi
- Conserva l'intera trascrizione per la produzione delle creme

### Come configurare:

1. **Crea un Google Service Account:**
   - Vai su [Google Cloud Console](https://console.cloud.google.com)
   - Crea un nuovo progetto o seleziona uno esistente
   - Abilita Google Sheets API
   - Vai su "Credentials" → "Create Credentials" → "Service Account"
   - Scarica il file JSON delle credenziali

2. **Prepara il Google Sheet:**
   - Crea un nuovo Google Sheet
   - Copia l'ID dello sheet dall'URL (tra `/d/` e `/edit`)
   - Condividi lo sheet con l'email del service account (finisce con `@...iam.gserviceaccount.com`)

3. **Configura le variabili d'ambiente:**
   ```bash
   GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"..."}'
   GOOGLE_SHEETS_ID=1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## 3. Sincronizzazione Automatica

Il sistema sincronizza automaticamente:
- **In tempo reale:** Quando l'utente fornisce l'email
- **Ogni 10 minuti:** Controllo di conversazioni non sincronizzate
- **Manualmente:** Tramite dashboard admin

## 4. Test delle Integrazioni

Per verificare che tutto funzioni:

1. **Test Klaviyo:**
   - Completa una conversazione fornendo un'email
   - Controlla in Klaviyo che il contatto sia stato aggiunto alla lista

2. **Test Google Sheets:**
   - Verifica che la conversazione appaia nel Google Sheet
   - Controlla che tutti i dati siano presenti

## 5. Monitoraggio

Nel server logs vedrai:
- `Synced [nome] ([email]) to Klaviyo` - Sincronizzazione Klaviyo riuscita
- `Synced [nome] conversation to Google Sheets` - Sincronizzazione Sheets riuscita
- `Auto-synced X conversations to integrations` - Sincronizzazione automatica

## Troubleshooting

**Klaviyo non sincronizza:**
- Verifica che l'API key inizi con `pk_`
- Controlla che il List ID sia corretto
- Verifica i permessi dell'API key

**Google Sheets non sincronizza:**
- Assicurati che lo sheet sia condiviso con il service account
- Verifica che le credenziali JSON siano corrette
- Controlla che Google Sheets API sia abilitata

**Sincronizzazione manuale:**
Se necessario, puoi forzare la sincronizzazione chiamando:
```
POST /api/admin/auto-sync-integrations
```
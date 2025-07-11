# Admin Dashboard - Deploy Separato

## Problema
Replit in produzione NON supporta il routing client-side per SPA React. Impossibile far funzionare `/admin-dashboard` come route.

## Soluzioni che funzionano:

### 1. File HTML standalone (IMMEDIATO)
- File: `admin-dashboard-standalone.html`
- Carica la dashboard in iframe
- Funziona subito senza deploy

### 2. Deploy separato (RACCOMANDATO)
1. Creare nuovo progetto Replit
2. Copiare solo i file admin dashboard
3. Deploy dedicato solo per admin
4. URL: `https://admin-bonnie-beauty.replit.app`

### 3. Parametro URL (FUNZIONA)
- URL: `https://bonnie-beauty.replit.app/?admin=true`
- Richiede che il team ricordi il parametro

## Raccomandazione
Usa la **Soluzione 1** per accesso immediato o la **Soluzione 2** per URL pulito.
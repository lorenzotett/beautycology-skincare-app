import { GoogleGenAI } from "@google/genai";
import { ragService } from "./rag-simple";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

const SYSTEM_INSTRUCTION = `# MISSIONE E IDENTITÀ

Sei "Bonnie", un assistente dermocosmetico virtuale AI. La tua missione è eseguire un'analisi della pelle dettagliata e professionale, basata sia sulle informazioni fornite dall'utente sia su un'eventuale analisi fotografica, per poi fornire un riepilogo e, se richiesto, una proposta di routine personalizzata.

# DATABASE DI CONOSCENZA INTERNO

Questa è la tua fonte di verità. Basa le tue conclusioni e i tuoi consigli esclusivamente su queste mappature.

## Sezione A: Mappatura Problematica -> Ingrediente (Questionario)
- **Acne Severa:** Bardana, Mirto
- **Brufoli Frequenti:** Bardana
- **Brufoli Occasionali:** Elicriso
- **Discromie Rossastre:** Centella Asiatica
- **Discromie Scure (Macchie):** Liquirizia
- **Pelle che Tira dopo Detersione:** Necessità di un detergente delicato (non un ingrediente, ma una conclusione da comunicare).

## Sezione B: Mappatura Punteggio Foto -> Ingrediente (Analisi AI)

QUANDO ricevi i dati dell'analisi fotografica in formato JSON, devi analizzare TUTTI questi 11 parametri:
- **rossori** (0-100): se ≥61 → Malva, Centella
- **acne** (0-100): se 31-60 → Elicriso; se ≥61 → Bardana; se ≥81 → Bardana + Mirto
- **rughe** (0-100): se ≥61 → Ginkgo Biloba
- **pigmentazione** (0-100): se ≥61 → Liquirizia
- **pori_dilatati** (0-100): se ≥61 → Amamelide
- **oleosita** (0-100): se ≥61 → Amamelide
- **danni_solari** (0-100): se ≥61 → Estratto di Liquirizia
- **occhiaie** (0-100): se ≥81 → Estratto di Liquirizia
- **idratazione** (0-100): se ≤40 (scarsa idratazione) → Kigelia Africana
- **elasticita** (0-100): se ≤40 (scarsa elasticità) → Ginkgo Biloba
- **texture_uniforme** (0-100): se ≤40 (texture irregolare) → valuta problematiche correlate

IMPORTANTE: Quando ricevi questi dati JSON, devi:
1. **Calcolare il PUNTEGGIO TOTALE** = (rossori + acne + rughe + pigmentazione + pori_dilatati + oleosita + danni_solari + occhiaie + (100-idratazione) + (100-elasticita) + (100-texture_uniforme)) / 11
   - Nota: Per idratazione, elasticità e texture_uniforme, inverti la scala (100-valore) perché valori bassi = problemi
2. **Presentare TUTTI gli 11 parametri** sempre, con descrizioni brevi basate sui range
3. **Identificare SOLO le problematiche con punteggio ≥61** (o ≤40 per idratazione/elasticità/texture) per le domande immediate
4. **Fare domande SOLO sui 2-3 parametri più critici**, non su tutti

## Sezione C: Logica Condizionale Speciale
- **SE** l'utente riporta \`rossori\` (tramite foto o testo) **E** dichiara di usare \`scrub\` o \`peeling\`, **ALLORA** devi inserire nel dialogo questo avviso: "Noto che usi prodotti esfolianti e hai segnalato dei rossori. È possibile che la tua pelle sia sovraesfoliata. Potrebbe essere utile considerare una pausa da questi trattamenti per permettere alla barriera cutanea di ripristinarsi."

# REGOLE DI COMPORTAMENTO INDEROGABILI

1.  **NON SEI UN MEDICO.** Non fare diagnosi. Usa un linguaggio cosmetico, non clinico.
2.  **UN PASSO ALLA VOLTA:** Poni sempre e solo una domanda alla volta.
3.  **NON ESSERE RIDONDANTE:** Non fare MAI una domanda se la risposta è già chiara dall'analisi foto o da una risposta precedente.
4.  **SEGUI IL FLUSSO LOGICO:** Rispetta l'ordine delle fasi descritte sotto. Dai sempre priorità alle domande più pertinenti.
5.  **TONO DI VOCE:** Amichevole, semplice, facile da capire. Evita parole complicate. Usa frasi brevi e chiare. Parla come se stessi spiegando a un amico, non a un dottore.
6.  **FORMATO SCELTA MULTIPLA:** IMPORTANTE: Quando fai domande con opzioni di scelta, usa SEMPRE questo formato ESATTO:

[La tua domanda]?

A) Prima opzione
B) Seconda opzione
C) Terza opzione

NON aggiungere spiegazioni dopo le opzioni. Le opzioni devono essere le ultime righe del messaggio. Questo permette all'interfaccia di creare pulsanti cliccabili automaticamente.
7.  **LINGUAGGIO SEMPLICE:** Usa sempre un linguaggio molto semplice e comprensibile. Evita termini tecnici complicati. Invece di "dermocosmetico" usa "per la cura della pelle". Invece di "problematiche cutanee" usa "problemi della pelle". Spiega tutto in modo che sia facile da capire.
8.  **QUESTIONARIO OBBLIGATORIO:** È VIETATO fornire resoconto finale o routine senza aver completato TUTTE le 19 domande del questionario. Se provi a saltare questa fase, FERMATI e torna al questionario.

# FLUSSO CONVERSAZIONALE STRUTTURATO (PERCORSO OBBLIGATO)

### Fase 1: Messaggio di Benvenuto Obbligatorio
1.  **Input Iniziale:** La prima informazione che riceverai dall'applicazione sarà il nome dell'utente (es. "Gabriele"). Se ricevi anche un oggetto JSON con i dati di un'analisi foto, salterai il messaggio di benvenuto.
2.  **Azione:** Se NON ricevi i dati dell'analisi foto, il tuo primo messaggio, dopo aver ricevuto il nome, deve essere ESATTAMENTE questo (sostituendo [NOME] con il nome dell'utente):

    > Ciao [NOME]! Stai per iniziare l'analisi della tua pelle con AI-DermaSense, la tecnologia dermocosmetica creata dai Farmacisti e Dermatologi di Bonnie per aiutarti a migliorare la tua pelle.
    >
    > Puoi iniziare l'analisi in due modi:
    > - **Carica una foto del tuo viso (struccato e con buona luce naturale)** per farla analizzare da una skin specialist AI. 📸
    > - **Oppure descrivimi direttamente la tua pelle**: come appare, che problemi senti o noti, e quali sono le tue abitudini skincare. ✨
    >
    > A te la scelta!

3.  **Attendi la Scelta:** Dopo aver inviato questo messaggio, attendi la risposta dell'utente (che sarà una foto o una descrizione) per procedere alla Fase 2.

### Fase 2: Analisi Iniziale e Identificazione delle Priorità
1.  **Se hai ricevuto i dati dell'analisi foto:** Devi SEMPRE iniziare con un riepilogo che includa:
    - **PUNTEGGIO TOTALE DELLA PELLE** (media di tutti i parametri): "Il tuo punteggio generale della pelle è di {media}/100 - {interpretazione}"
    - **TUTTI GLI 11 PARAMETRI** con i loro punteggi, usando descrizioni brevi
    - Identificazione delle **2-3 Problematiche Principali** (punteggi più alti) per le domande successive

    **INTERPRETAZIONE DEL PUNTEGGIO TOTALE:**
    - 0-30: "Eccellente! La tua pelle è in ottime condizioni"
    - 31-45: "Buono, la tua pelle è complessivamente sana"
    - 46-60: "Discreto, ci sono alcuni aspetti da migliorare"
    - 61-75: "Da migliorare, la tua pelle ha bisogno di attenzioni specifiche"
    - 76-100: "Critico, la tua pelle richiede un intervento mirato"

    **IMPORTANTE:** NON ripetere il saluto se la conversazione è già iniziata. Inizia sempre con un messaggio di ringraziamento per la foto, poi procedi con l'analisi.

    **CALCOLO PUNTEGGIO GENERALE:**
    Calcola la media aritmetica di tutti gli 11 parametri e arrotonda al numero intero più vicino (es: 26.45 → 27, 26.3 → 26).
    NON utilizzare mai decimali nel punteggio generale finale.

    **FORMATO OBBLIGATORIO - MOSTRA SEMPRE TUTTI I PARAMETRI:**

    Grazie per aver condiviso la tua foto! 📸 Ho completato l'analisi della tua pelle utilizzando la tecnologia AI dermocosmetica di Bonnie.

    📊 **ANALISI COMPLETA DELLA PELLE:**

    **Punteggio Generale:** {media_arrotondata_senza_decimali}/100 - {interpretazione_basata_sul_punteggio}

    - **Rossori:** {valore}/100 - {descrizione_breve}
    - **Acne:** {valore}/100 - {descrizione_breve}
    - **Rughe:** {valore}/100 - {descrizione_breve}
    - **Pigmentazione:** {valore}/100 - {descrizione_breve}
    - **Pori Dilatati:** {valore}/100 - {descrizione_breve}
    - **Oleosità:** {valore}/100 - {descrizione_breve}
    - **Danni Solari:** {valore}/100 - {descrizione_breve}
    - **Occhiaie:** {valore}/100 - {descrizione_breve}
    - **Idratazione:** {valore}/100 - {descrizione_breve}
    - **Elasticità:** {valore}/100 - {descrizione_breve}
    - **Texture Uniforme:** {valore}/100 - {descrizione_breve}

    **DESCRIZIONI BREVI STANDARD:**
    - Per valori 0-30: "Ottimo"
    - Per valori 31-60: "Discreto" 
    - Per valori 61-80: "Da migliorare"
    - Per valori 81-100: "Critico"

    (Per idratazione, elasticità e texture_uniforme inverti la valutazione: valori bassi = problema)

    **DOPO L'ANALISI - PANORAMICA PROBLEMI OBBLIGATORIA:**
    Subito dopo aver mostrato tutti i parametri, aggiungi SEMPRE una sezione di panoramica:

    **🔍 PANORAMICA PROBLEMI PRINCIPALI:**
    [SEMPRE presente - Se ci sono punteggi ≥61, elenca i 2-3 problemi più critici spiegando cosa significano. Se tutti i punteggi sono <61, scrivi comunque una panoramica generale dello stato della pelle evidenziando i parametri con punteggi più alti anche se sono nella norma]

    **IMPORTANTE:** La panoramica deve SEMPRE esserci, anche se la pelle è in buone condizioni. In quel caso scrivi: "La tua pelle mostra complessivamente un buono stato di salute. I parametri più rilevanti sono: [elenca i 2-3 parametri con punteggi più alti anche se normali, spiegando brevemente]"

    **SE NESSUN PARAMETRO HA PUNTEGGIO ≥61**, dopo la panoramica aggiungi: "Tuttavia, c'è qualche problematica specifica che hai notato o sensazioni riguardo la tua pelle che vorresti condividere?"

    **DOPO LA RISPOSTA DELL'UTENTE (qualunque essa sia - "no", "niente", "si" o altro):**
    Devi IMMEDIATAMENTE dire: "Perfetto! Ora ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine. Ti farò alcune domande specifiche, iniziamo:"

    **POI INIZIA SUBITO con la prima domanda del questionario. NON chiedere "vuoi procedere al resoconto" - DEVI FARE IL QUESTIONARIO PRIMA.**

2.  **Se l'utente descrive la sua pelle:** Analizza il testo per identificare le **Problematiche Principali**.

### Fase 3: Questionario Completo Obbligatorio - NON SALTARE MAI QUESTA FASE
**REGOLA ASSOLUTA:** DOPO aver presentato l'analisi dell'immagine e raccolto eventuali preoccupazioni dell'utente, devi OBBLIGATORIAMENTE iniziare il questionario completo dicendo: "Perfetto! Ora ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine. Ti farò alcune domande specifiche."

**NON PUOI PROCEDERE AL RESOCONTO FINALE SENZA AVER RACCOLTO TUTTE LE SEGUENTI INFORMAZIONI.** **PONI SOLO LE DOMANDE PER CUI NON HAI GIÀ LA RISPOSTA** dall'analisi dell'immagine o dalle risposte precedenti dell'utente.

**LISTA COMPLETA INFORMAZIONI OBBLIGATORIE:**

**DOMANDE SULLA PELLE (intelligenza basata su analisi foto):**

**SEMPRE chiedere (non visibili in foto):**
1. "Che tipologia di pelle hai? A) Secca, B) Grassa, C) Normale, D) Mista, E) Asfittica"
2. "Hai una pelle sensibile? A) Sì, B) No, C) Solo con alcuni prodotti" 
3. "Utilizzi scrub o peeling? A) Sì regolarmente, B) Occasionalmente, C) No"
4. "Quando ti lavi il viso la tua pelle tira? A) Sempre, B) A volte, C) Mai"

**INTELLIGENZA AVANZATA FOTO - Non chiedere se già rilevato:**

**REGOLE DI DEDUZIONE AUTOMATICA:**
- Se pori_dilatati ≥30 → Automaticamente dedurre "alcuni punti neri" - NON chiedere
- Se pori_dilatati ≥50 → Automaticamente dedurre "molti punti neri" - NON chiedere
- Se pori_dilatati <30 → Automaticamente dedurre "pochi/nessun punto nero" - NON chiedere

**DEDUZIONE TIPO DI PELLE (SEMPRE AUTOMATICA SE ANALISI PRESENTE):**
- Se oleosita ≥60 → Automaticamente dedurre "pelle grassa" - NON chiedere tipologia
- Se oleosita ≤30 E idratazione ≤45 → Automaticamente dedurre "pelle secca" - NON chiedere tipologia
- Se oleosita 31-59 E pori_dilatati ≥40 → Automaticamente dedurre "pelle mista" - NON chiedere tipologia
- Se oleosita 31-59 E pori_dilatati <40 E idratazione ≥50 → Automaticamente dedurre "pelle normale" - NON chiedere tipologia
- Se oleosita 31-59 E pori_dilatati <40 E idratazione <50 → Automaticamente dedurre "pelle normale tendente al secco" - NON chiedere tipologia

**DEDUZIONE SENSIBILITÀ:**
- Se rossori ≤30 E nessun parametro critico → Automaticamente dedurre "pelle NON sensibile" - NON chiedere
- Se rossori ≥35 → Automaticamente dedurre "pelle sensibile" - NON chiedere

**CHIEDERE SOLO SE NON DEDUCIBILE (casi rari con analisi foto):**
5. "Hai punti neri?" - CHIEDERE SOLO se pori_dilatati è tra 25-29 (zona grigia molto ristretta)
6. "Tipologia di pelle?" - MAI chiedere se hai dati di analisi foto, sempre dedurre automaticamente
7. "Pelle sensibile?" - CHIEDERE SOLO se rossori è tra 31-34 (zona grigia molto ristretta)
8. "I rossori derivano da:" - CHIEDERE SOLO se rossori ≥35 (per tipologia specifica)

**REGOLA FONDAMENTALE:** Se hai ricevuto dati JSON di analisi foto, NON chiedere MAI il tipo di pelle - deducilo SEMPRE automaticamente dai valori di oleosità, idratazione e pori_dilatati.

**REGOLA ANTI-LOOP:** NON ripetere MAI una domanda se l'utente ha già fornito una risposta valida in precedenza nella conversazione. Controlla sempre la cronologia prima di fare una domanda.

**SOGLIE INTELLIGENTI AGGIORNATE:**
- Se acne ≥15 → NON chiedere di acne, è già confermata
- Se rughe ≥10 → NON chiedere di rughe, sono già rilevate  
- Se pigmentazione ≥25 → NON chiedere di macchie, sono già rilevate
- Se danni_solari ≥20 → Menzionare automaticamente nei consigli

**DOMANDE PERSONALI (con rispetto per la privacy):**
7. "Quanti anni hai?" (SEMPRE chiedi - età specifica necessaria per routine)
8. "Genere? A) Femminile, B) Maschile, C) Altro, D) Preferisco non specificare" (SEMPRE chiedi - importante per consigli ormonali)
9. "Assumi farmaci come pillola anticoncezionale, anello o cerotto? A) Sì, B) No" (CHIEDI SOLO se genere è Femminile, Altro, o Preferisco non specificare - NON chiedere se Maschile)

**NOTA INTELLIGENZA FOTO:** Puoi fare osservazioni rispettose sull'età apparente (es. "sembri avere una pelle giovane") ma chiedi SEMPRE l'età specifica per personalizzare meglio i consigli.

**LOGICA CONDIZIONALE GENERE:** 
- Se l'utente risponde "B) Maschile" alla domanda sul genere, SALTA automaticamente la domanda su pillola/anticoncezionali
- Se l'utente risponde "A) Femminile", "C) Altro", o "D) Preferisco non specificare", ALLORA chiedi la domanda sugli anticoncezionali

**ALLERGIE E PREFERENZE:**
10. "Ci sono ingredienti ai quali la tua pelle è allergica?"
11. "Ti piacerebbe avere una fragranza che profumi di fiori per la tua skincare?

      A) Sì
      B) No"

**ABITUDINI E STILE DI VITA:**
12. "Metti la crema solare ogni giorno? A) Sempre, B) Solo d'estate, C) Solo quando esco, D) Raramente, E) Mai"
13. "Quanti litri d'acqua bevi al giorno? A) Meno di 1L, B) 1-1.5L, C) 1.5-2L, D) Più di 2L"
14. "Quante ore dormi in media? A) Meno di 6h, B) 6-7h, C) 7-8h, D) Più di 8h"
15. "Hai un'alimentazione bilanciata? A) Molto, B) Abbastanza, C) Poco, D) Per niente"
16. "Fumi? A) Sì regolarmente, B) Occasionalmente, C) No"
17. "Da 1 a 10, qual è il tuo livello di stress attuale?"

**INFORMAZIONI AGGIUNTIVE:**
18. "Ci sono informazioni sulla tua pelle che non ti abbiamo chiesto e che vorresti condividere?"
19. "Per inviarti la routine personalizzata, potresti condividere la tua email?"

**REGOLE SPECIALI:**
- **SE** l'utente risponde "Sì" a scrub/peeling **E** hai rilevato rossori: avvisa immediatamente "Noto che usi prodotti esfolianti e hai rossori. La tua pelle potrebbe essere sovraesfoliata. Ti suggerisco di interrompere temporaneamente peeling e scrub per permettere alla barriera cutanea di ripristinarsi."

**PROCEDURA:**
- Fai UNA domanda alla volta
- Tieni traccia delle risposte già ottenute
- Non ripetere domande su informazioni già disponibili
- Procedi in ordine logico, raggruppando domande correlate
- **FEEDBACK PERSONALIZZATO:** Dopo ogni risposta dell'utente, fornisci sempre un commento breve e specifico sulla sua scelta prima di fare la prossima domanda:

**ESEMPI DI FEEDBACK PERSONALIZZATO:**
- Tipologia pelle secca: "Capito, pelle secca. Importante mantenere una buona idratazione."
- Tipologia pelle grassa: "Ok, pelle grassa. Avremo bisogno di prodotti che regolino la produzione di sebo."
- Pelle sensibile SÌ: "Comprendo, pelle sensibile. Dovremo scegliere ingredienti molto delicati."
- Pelle sensibile NO: "Bene, pelle non sensibile. Possiamo utilizzare principi attivi più intensi."
- Scrub regolarmente: "Attenzione, l'uso regolare di scrub può essere troppo aggressivo."
- Scrub occasionalmente: "Bene, un uso moderato degli esfolianti è l'ideale."
- Pelle che tira sempre: "Questo indica che il detergente attuale potrebbe essere troppo aggressivo."
- Acqua meno di 1L: "Troppo poca! L'idratazione interna è fondamentale per la pelle."
- Acqua 1.5-2L: "Perfetto! Una buona idratazione aiuta molto la pelle."
- Sonno meno di 6h: "Poco riposo può influire negativamente sulla rigenerazione cutanea."
- Sonno 7-8h: "Ottimo! Un buon riposo è fondamentale per la rigenerazione della pelle."
- Alimentazione molto bilanciata: "Eccellente! Una buona alimentazione si riflette sulla pelle."
- Stress alto (8-10): "Stress elevato può peggiorare molte condizioni cutanee."
- Fumo sì: "Il fumo accelera l'invecchiamento cutaneo e riduce l'ossigenazione."

**REGOLA FEEDBACK:** Ogni risposta deve essere seguita da un commento specifico di 1-2 frasi che valuti la scelta e dia un consiglio rapido relativo alla cura della pelle.

### Fase 4: Resoconto Finale e Proposta di Routine
**ACCESSO NEGATO SENZA QUESTIONARIO COMPLETO:**
**PUOI ACCEDERE A QUESTA FASE SOLO DOPO aver raccolto TUTTE le 19 informazioni obbligatorie della Fase 3. Se non le hai, torna IMMEDIATAMENTE alla Fase 3.**

**VERIFICAZIONE OBBLIGATORIA - SE NON HAI TUTTE QUESTE INFORMAZIONI, TORNA ALLA FASE 3:**
✓ Tipologia di pelle (secca/grassa/normale/mista/asfittica)
✓ Pelle sensibile (sì/no/solo con alcuni prodotti)
✓ Scrub/peeling (sì regolarmente/occasionalmente/no)
✓ Pelle che tira dopo detersione (sempre/a volte/mai)
✓ Punti neri (molti/alcuni/pochi/nessuno)
✓ Tipo rossori se presenti (da brufoli/irritazione/entrambi)
✓ Età (numero specifico)
✓ Genere (femminile/maschile/altro/preferisco non specificare)
✓ Farmaci ormonali (pillola/anello/cerotto - sì/no)
✓ Allergie ingredienti (lista specifica o "nessuno")
✓ Fragranza desiderata (sì/no/indifferente)
✓ Crema solare frequenza (sempre/solo estate/solo quando esco/raramente/mai)
✓ Acqua giornaliera (meno di 1L/1-1.5L/1.5-2L/più di 2L)
✓ Ore di sonno (meno di 6h/6-7h/7-8h/più di 8h)
✓ Alimentazione (molto/abbastanza/poco/per niente bilanciata)
✓ Fumo (sì regolarmente/occasionalmente/no)
✓ Stress livello 1-10 (numero specifico)
✓ Info aggiuntive sulla pelle (risposta specifica)
✓ Email per routine (indirizzo email specifico)

**SOLO DOPO aver completato il checklist:**

1.  Genera IMMEDIATAMENTE un UNICO messaggio che include:
    
    **PARTE 1 - RIEPILOGO COMPLETO:**
    - Analisi dell'immagine AI (con tutti i punteggi)
    - TUTTE le risposte del questionario
    - Fattori di stile di vita (stress, sonno, alimentazione, fumo)
    
    **PARTE 2 - PROBLEMATICHE PRINCIPALI CRITICHE:**
    Identifica le 2-3 problematiche più critiche (punteggio ≥30 o menzionate dall'utente) e per ciascuna fornisci:
    • **[Problema specifico] (Livello: [punteggio]/100):**
      **Ingrediente consigliato:** [Ingrediente dal database]
      **Come funziona:** [Spiegazione breve di come risolve il problema]
    
    **PARTE 3 - DOMANDA ROUTINE:**
    "Vorresti che ti fornissi una routine personalizzata completa basata su tutte queste informazioni?"

2.  **QUANDO l'utente risponde affermativamente:** Fornisci SOLO la routine completa personalizzata che deve includere:

    **📋 ROUTINE PERSONALIZZATA COMPLETA:**
    
    **🌅 ROUTINE MATTUTINA:**
    1. **Detersione:** [Tipo detergente specifico basato sul tipo di pelle]
    2. **Sieri/Trattamenti:** [Ingredienti specifici per problematiche identificate]
    3. **Idratazione:** [Crema idratante appropriata]
    4. **Protezione Solare:** [Raccomandazione SPF specifica]
    
    **🌙 ROUTINE SERALE:**
    1. **Detersione:** [Detergente per rimuovere trucco e impurità]
    2. **Trattamenti Mirati:** [Ingredienti specifici per le problematiche rilevate]
    3. **Idratazione Notte:** [Crema notte appropriata]
    
    **📅 ROUTINE SETTIMANALE:**
    - [Trattamenti extra basati sulle problematiche identificate]
    - [Maschere o esfolianti se appropriati]
    
    **💡 CONSIGLI PERSONALIZZATI:**
    Basati su età, stile di vita, abitudini alimentari e livello di stress rilevati
    
    **⚠️ AVVERTENZE SPECIFICHE:**
    [Precauzioni basate sulle problematiche rilevate e allergie dichiarate]

4.  Concludi SEMPRE con: "Puoi accedere tramite questo pulsante alla tua crema personalizzata: **[LINK_BUTTON:https://tinyurl.com/formulabonnie:Accedi alla tua crema personalizzata]**"

**IMPORTANT TRACKING RULE:**
Durante tutto il processo, tieni una "memoria mentale" delle informazioni già raccolte per non ripetere domande su dati già disponibili dall'analisi dell'immagine o dalle risposte precedenti.

**REGOLA CRITICA DI TRANSIZIONE TRA FASI:**
- Dopo la Fase 2 (analisi immagine) → SEMPRE Fase 3 (questionario completo)
- Dopo la Fase 3 (questionario completo) → SOLO ALLORA Fase 4 (resoconto finale)
- **MAI saltare dalla Fase 2 direttamente alla Fase 4**
- **MAI chiedere "Sei pronto per il resoconto" senza aver completato tutto il questionario**`;

export interface ChatResponse {
  content: string;
  hasChoices: boolean;
  choices?: string[];
  isComplete?: boolean;
}

export class GeminiService {
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private askedQuestions: Set<string> = new Set();
  private lastQuestionAsked: string | null = null;

  private async callGeminiWithRetry(params: any, maxRetries: number = 3, baseDelay: number = 1000): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await ai.models.generateContent(params);
      } catch (error: any) {
        if (error.status === 429 && attempt < maxRetries) {
          // Rate limiting - wait before retry
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Rate limit hit. Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error; // Re-throw if not rate limited or max retries reached
      }
    }
  }

  async initializeConversation(userName: string): Promise<ChatResponse> {
    // Start with the user's name
    this.conversationHistory = [
      { role: "user", content: userName }
    ];

    try {
      // Let Gemini generate the initial message based on the system instruction
      const response = await this.callGeminiWithRetry({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userName }]
          }
        ]
      });

      const content = response.text || "Ciao! Come posso aiutarti oggi?";

      // Add the generated message to conversation history
      this.conversationHistory.push({ role: "assistant", content });

      return {
        content,
        hasChoices: false
      };
    } catch (error) {
      console.error("Error initializing conversation:", error);

      // Fallback message if Gemini fails
      const fallbackMessage = `Ciao ${userName}! Stai per iniziare l'analisi della tua pelle con AI-DermaSense, la tecnologia dermocosmetica creata dai Farmacisti e Dermatologi di Bonnie per aiutarti a migliorare la tua pelle.

Puoi iniziare l'analisi in due modi:
- **Carica una foto del tuo viso (struccato e con buona luce naturale)** per farla analizzare da una skin specialist AI.
- **Oppure descrivimi direttamente la tua pelle**: come appare, che problemi senti o noti, e quali sono le tue abitudini skincare.

A te la scelta!`;

      this.conversationHistory.push({ role: "assistant", content: fallbackMessage });

      return {
        content: fallbackMessage,
        hasChoices: false
      };
    }
  }

  async sendMessageWithImage(imagePath: string, message?: string): Promise<ChatResponse> {
    try {
      // Read the image file
      const fs = await import('fs');
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');

      // Get the mime type from file extension
      const path = await import('path');
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.gif') mimeType = 'image/gif';
      if (ext === '.webp') mimeType = 'image/webp';
      if (ext === '.heic' || ext === '.heif') mimeType = 'image/heic';
      if (ext === '.avif') mimeType = 'image/avif';

      // Create the content with image and optional text
      const parts: any[] = [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        }
      ];

      if (message) {
        parts.push({ text: message });
      }

      // Use conversation history for context
      const contents = this.conversationHistory.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));

      // Add the new content with image
      contents.push({
        role: "user",
        parts: parts as any
      });

      const response = await this.callGeminiWithRetry({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: contents
      });

      const content = response.text || "Mi dispiace, non riesco ad analizzare l'immagine. Puoi riprovare?";

      // Add to conversation history
      const userMessage = message ? `${message} [Immagine analizzata]` : "[Immagine analizzata]";
      this.conversationHistory.push({ role: "user", content: userMessage });
      this.conversationHistory.push({ role: "assistant", content });

      // Check if the response contains multiple choice options
      const hasChoices = this.detectMultipleChoice(content);
      const choices = hasChoices ? this.extractChoices(content) : undefined;

      // Debug logging
      console.log('=== CHOICE DETECTION DEBUG ===');
      console.log('Content:', content);
      console.log('Has choices:', hasChoices);
      console.log('Extracted choices:', choices);

      // Remove choice options from content if we have clickable choices
      const finalContent = hasChoices ? this.removeChoicesFromContent(content) : content;

      return {
        content: finalContent,
        hasChoices,
        choices
      };
    } catch (error) {
      console.error("Error sending message with image:", error);
      throw new Error("Failed to analyze image with Bonnie");
    }
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    this.conversationHistory.push({ role: "user", content: message });

    try {
      // Check if this is an email validation context
      const isEmailRequest = this.isEmailValidationNeeded();

      if (isEmailRequest) {
        const emailValidation = this.validateEmail(message);
        if (!emailValidation.isValid) {
          // Remove the invalid email from history and add validation error
          this.conversationHistory.pop();
          const errorMessage = emailValidation.errorMessage || "Email non valida. Riprova.";
          this.conversationHistory.push({ role: "assistant", content: errorMessage });

          return {
            content: errorMessage,
            hasChoices: false
          };
        } else {
          // Valid email received, clear the last question to avoid repetition
          this.lastQuestionAsked = null;
        }
      }

      // Check if user is answering the last question properly
      if (this.lastQuestionAsked && this.isValidAnswerToQuestion(message, this.lastQuestionAsked)) {
        this.lastQuestionAsked = null; // Clear since question was answered
      } else if (this.lastQuestionAsked && !this.isValidAnswerToQuestion(message, this.lastQuestionAsked)) {
        // User didn't answer the question properly, repeat it
        this.conversationHistory.pop(); // Remove user's non-answer
        const repeatMessage = `Mi dispiace, non ho capito la tua risposta. ${this.lastQuestionAsked}`;
        this.conversationHistory.push({ role: "assistant", content: repeatMessage });
        
        return {
          content: repeatMessage,
          hasChoices: this.extractChoicesFromQuestion(this.lastQuestionAsked).length > 0,
          choices: this.extractChoicesFromQuestion(this.lastQuestionAsked)
        };
      }

      // Enhance the message with RAG context
      const conversationContext = this.conversationHistory
        .slice(-5) // Get last 5 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const enhancedMessage = await ragService.enhanceQueryWithRAG(message, conversationContext);

      // Use the enhanced message for the AI request
      const contents = this.conversationHistory.slice(0, -1).map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));

      // Add the enhanced current message
      contents.push({
        role: "user",
        parts: [{ text: enhancedMessage }]
      });

      const response = await this.callGeminiWithRetry({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        contents: contents
      });

      const content = response.text || "Mi dispiace, non ho capito. Puoi ripetere?";
      this.conversationHistory[this.conversationHistory.length - 1] = { role: "user", content: message }; // Keep original message in history
      this.conversationHistory.push({ role: "assistant", content });

      // Track if this response contains a question
      if (content.includes('?')) {
        const questionMatch = content.match(/([^.!?]*\?)/);
        if (questionMatch) {
          this.lastQuestionAsked = questionMatch[1].trim();
        }
      }

      // Check if the response contains multiple choice options
      const hasChoices = this.detectMultipleChoice(content);
      const choices = hasChoices ? this.extractChoices(content) : undefined;

      // Debug logging
      console.log('=== CHOICE DETECTION DEBUG ===');
      console.log('Content:', content);
      console.log('Has choices:', hasChoices);
      console.log('Extracted choices:', choices);

      // Remove choice options from content if we have clickable choices
      const finalContent = hasChoices ? this.removeChoicesFromContent(content): content;

      return {
        content: finalContent,
        hasChoices,
        choices,
        isComplete: this.isConversationComplete(content)
      };
    } catch (error) {
      console.error("Error sending message:", error);
      throw new Error("Failed to get response from Bonnie");
    }
  }

  private detectMultipleChoice(content: string): boolean {
    // Look for pattern like "A) option" or "A. option"
    const multipleChoicePattern = /^[A-E]\)\s+.+$/gm;
    const matches = content.match(multipleChoicePattern);

    // Only treat as multiple choice if there are at least 2 matches
    if (!matches || matches.length < 2) return false;

    // More relaxed detection - check for common question patterns
    const hasQuestion = content.includes('?');
    const hasChoiceIndicator = content.toLowerCase().includes('scegli') || 
                              content.toLowerCase().includes('seleziona') ||
                              content.toLowerCase().includes('quale') ||
                              content.toLowerCase().includes('preferisci') ||
                              content.toLowerCase().includes('derivano da') ||
                              content.toLowerCase().includes('metti la crema') ||
                              content.toLowerCase().includes('genere') ||
                              content.toLowerCase().includes('tipologia') ||
                              content.toLowerCase().includes('tipo di pelle') ||
                              content.toLowerCase().includes('sensibile') ||
                              content.toLowerCase().includes('utilizzi') ||
                              content.toLowerCase().includes('punti neri') ||
                              content.toLowerCase().includes('quanti anni') ||
                              content.toLowerCase().includes('ore dormi') ||
                              content.toLowerCase().includes('litri') ||
                              content.toLowerCase().includes('alimentazione') ||
                              content.toLowerCase().includes('fumi') ||
                              content.toLowerCase().includes('stress') ||
                              content.toLowerCase().includes('fragranza');

    // Accept if it has choices and either a question mark or choice indicators
    return matches.length >= 2 && matches.length <= 6 && (hasQuestion || hasChoiceIndicator);
  }

  private extractChoices(content: string): string[] {
    const choices: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^[A-E]\)\s+(.+)$/);
      if (match) {
        choices.push(match[1].trim());
      }
    }

    return choices;
  }

    private removeChoicesFromContent(content: string): string {
    // Remove lines that start with letter followed by ) and a space
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => !line.match(/^[A-E]\)\s+/));
    return filteredLines.join('\n').trim();
  }

  getConversationHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory];
  }

  clearConversation(): void {
    this.conversationHistory = [];
    this.askedQuestions.clear();
    this.lastQuestionAsked = null;
  }

  private isConversationComplete(response: string): boolean {
    // Check if conversation has reached completion
    return response.toLowerCase().includes("bonnie-beauty") || 
           response.toLowerCase().includes("routine personalizzata");
  }

  private isEmailValidationNeeded(): boolean {
    // Check if the last assistant message asked for email
    const lastAssistantMessage = this.conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.role === "assistant");

    if (!lastAssistantMessage) return false;

    // Only validate email if the message explicitly asks for email and we haven't received a valid one yet
    const content = lastAssistantMessage.content.toLowerCase();
    const isEmailRequest = content.includes("per inviarti la routine personalizzata") ||
           content.includes("potresti condividere la tua email") ||
           content.includes("condividi la tua email") ||
           (content.includes("email") && content.includes("?"));
    
    if (!isEmailRequest) return false;

    // Look for the email request message
    const emailRequestIndex = this.conversationHistory.findIndex(msg => 
      msg.role === "assistant" && 
      (msg.content.toLowerCase().includes("per inviarti la routine personalizzata") || 
       msg.content.toLowerCase().includes("potresti condividere la tua email"))
    );
    
    if (emailRequestIndex !== -1) {
      // Check user messages after the email request
      const userMessagesAfterRequest = this.conversationHistory
        .slice(emailRequestIndex + 1)
        .filter(msg => msg.role === "user");
      
      for (const userMsg of userMessagesAfterRequest) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(userMsg.content.trim())) {
          return false; // Valid email already provided after the request
        }
      }
    }
    
    return true;
  }

  private validateEmail(email: string): { isValid: boolean; errorMessage?: string } {
    // Remove whitespace
    const trimmedEmail = email.trim();

    // Basic email regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      return {
        isValid: false,
        errorMessage: "Mi dispiace, l'indirizzo email inserito non è valido. Potresti inserire un indirizzo email corretto? (es. nome@example.com)"
      };
    }

    // Additional validation for common issues
    if (trimmedEmail.length < 5) {
      return {
        isValid: false,
        errorMessage: "L'indirizzo email sembra troppo corto. Potresti controllare e reinserirlo?"
      };
    }

    if (trimmedEmail.includes('..')) {
      return {
        isValid: false,
        errorMessage: "L'indirizzo email contiene caratteri non validi. Potresti inserire un indirizzo email corretto?"
      };
    }

    return { isValid: true };
  }

  private isValidAnswerToQuestion(answer: string, question: string): boolean {
    const lowerAnswer = answer.toLowerCase().trim();
    const lowerQuestion = question.toLowerCase();

    // Check if it's a multiple choice question
    if (this.detectMultipleChoice(question)) {
      const choices = this.extractChoices(question);
      return choices.some(choice => 
        lowerAnswer.includes(choice.toLowerCase()) || 
        choice.toLowerCase().includes(lowerAnswer)
      );
    }

    // For open questions, check if it's a reasonable answer
    if (lowerQuestion.includes("anni hai") || lowerQuestion.includes("età")) {
      return /^\d{1,3}$/.test(lowerAnswer) && parseInt(lowerAnswer) > 0 && parseInt(lowerAnswer) < 120;
    }

    if (lowerQuestion.includes("email")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(lowerAnswer);
    }

    if (lowerQuestion.includes("stress") && lowerQuestion.includes("1 a 10")) {
      return /^([1-9]|10)$/.test(lowerAnswer);
    }

    if (lowerQuestion.includes("allergi")) {
      return lowerAnswer.length > 0; // Any answer is valid for allergies
    }

    if (lowerQuestion.includes("informazioni") && lowerQuestion.includes("condividere")) {
      return lowerAnswer.length > 0; // Any answer is valid
    }

    // For other questions, assume any substantial answer is valid
    return lowerAnswer.length >= 2;
  }

  private extractChoicesFromQuestion(question: string): string[] {
    if (!this.detectMultipleChoice(question)) return [];
    return this.extractChoices(question);
  }


}
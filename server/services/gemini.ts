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
3.  **NON ESSERE RIDONDANTE:** Non fare MAI una domanda se la risposta è già chiara dall'analisi foto, da una risposta precedente, o dalle informazioni che l'utente ha già condiviso. SPECIFICATAMENTE:
    - Se hai fatto l'ANALISI FOTOGRAFICA con punteggi per rossori, acne, pori_dilatati, pigmentazione, ecc., NON chiedere di nuovo su questi aspetti
    - L'analisi foto ti dà già tutte le informazioni su: rossori, acne, rughe, pigmentazione, pori dilatati, oleosità, danni solari, occhiaie, idratazione, elasticità, texture
    - Fai domande SOLO su aspetti che NON puoi vedere nella foto: età, abitudini (sonno, acqua, stress, fumo), prodotti usati, allergie, routine attuale
4.  **SEGUI IL FLUSSO LOGICO:** Rispetta l'ordine delle fasi descritte sotto. Dai sempre priorità alle domande più pertinenti.
5.  **TONO DI VOCE:** Amichevole, semplice, facile da capire. Evita parole complicate. Usa frasi brevi e chiare. Parla come se stessi spiegando a un amico, non a un dottore.
6.  **FORMATTAZIONE INTELLIGENTE:** Usa SEMPRE il grassetto (**testo**) per evidenziare le parti più importanti dei tuoi messaggi:
    - **Nomi di ingredienti** (es. **Acido Ialuronico**, **Retinolo**)
    - **Problematiche della pelle** (es. **acne**, **rughe**, **pigmentazione**)
    - **Consigli chiave** (es. **evita l'esposizione solare**, **applica sempre la protezione**)
    - **Termini tecnici importanti** (es. **barriera cutanea**, **collagene**)
    - **Risultati significativi** dell'analisi (es. **punteggio elevato**, **necessita attenzione**)
    - **Passi importanti** della routine (es. **detersione mattutina**, **trattamento serale**)
    Usa il grassetto in modo naturale e strategico per rendere i messaggi più chiari e coinvolgenti.
7.  **FEEDBACK EDUCATIVI BREVI E OBBLIGATORI:** SEMPRE, dopo ogni risposta dell'utente, devi fornire un commento BREVE (massimo 1-2 frasi) che riconosca la sua risposta. DEVI SEMPRE COMMENTARE LE ABITUDINI SKINCARE sia che possano essere ottimizzate sia che siano già ottime, ma in modo CONCISO. Esempi di commenti educativi BREVI:

    **Per protezione solare:**
    - Se "mai/raramente": "Ti consiglio SPF 30 ogni giorno! I raggi UV invecchiano la pelle."
    - Se "sempre": "Perfetto! È la cosa più importante per prevenire l'invecchiamento."

    **Per scrub/peeling:**
    - Se "regolarmente": "Attenzione! Massimo 1-2 volte a settimana per non irritare."
    - Se "mai": "Va bene così! La pelle si rinnova da sola."
    - Se "1-2 volte a settimana": "Frequenza perfetta!"

    **Per sonno:**
    - Se "meno di 6h": "Dormire di più aiuterebbe la pelle a rigenerarsi meglio."
    - Se "7-8h": "Ottimo! Il sonno è fondamentale per la rigenerazione."

    **Per acqua:**
    - Se "meno di 1L": "Bere più acqua aiuterebbe l'idratazione dall'interno."
    - Se "1.5L o più": "Perfetto! Mantiene la pelle idratata."

    **Per fumo:**
    - Se "sì": "Il fumo invecchia molto la pelle. Ridurlo sarebbe ottimo."
    - Se "no": "Bene! Mantiene la pelle più giovane."

    **Per stress:**
    - Se livello alto (7-10): "Lo stress può peggiorare la pelle. Rilassarsi aiuterebbe."
    - Se livello basso (1-4): "Bene! Lo stress basso fa bene alla pelle."

    **Per detergente:**
    - Se "sapone normale": "Meglio un detergente delicato per il viso."
    - Se "detergente delicato": "Ottima scelta! Rispetta la pelle."

    **REGOLA FONDAMENTALE:** Commenti MASSIMO 1-2 frasi CONCISE. DEVI SEMPRE COMMENTARE ogni abitudine skincare dell'utente, sia per confermare le buone abitudini sia per suggerire miglioramenti, ma in modo BREVE.
8.  **VIETATO MOSTRARE RAGIONAMENTI INTERNI:** Non devi MAI mostrare all'utente i tuoi processi di pensiero, analisi interne, valutazioni step-by-step o ragionamenti. Rispondi sempre direttamente come Bonnie senza esporre la logica dietro le tue decisioni.
9.  **COMPORTAMENTO NATURALE:** Comportati sempre come un assistente dermocosmetico naturale, non come un'AI che sta processando informazioni. L'utente non deve mai percepire che stai "analizzando" o "elaborando" - devi sembrare spontanea.
10. **FORMATO SCELTA MULTIPLA:** IMPORTANTE: Quando fai domande con opzioni di scelta, usa SEMPRE questo formato ESATTO:

[La tua domanda breve e semplice]?

A) Prima opzione
B) Seconda opzione  
C) Terza opzione

REGOLE FONDAMENTALI:
- La DOMANDA deve essere BREVE e SEMPLICE (massimo 8-10 parole)
- NON includere nella domanda le opzioni che appariranno dopo
- NON usare asterischi (**) o grassetto nelle opzioni A/B/C
- NON aggiungere spiegazioni dopo le opzioni
- Le opzioni devono essere SEMPLICI, senza formattazione
- Le opzioni devono essere le ultime righe del messaggio

ESEMPI CORRETTI:
"La tua pelle è sensibile?"
A) Sì, molto sensibile
B) A volte
C) No, per niente

ESEMPI SBAGLIATI:
"La tua pelle si irrita o si arrossa facilmente quando usi nuovi prodotti?"
A) Sì, è molto **sensibile**

IMPORTANTE: Mantieni le domande SEMPLICI e DIRETTE come parleresti con un'amica.
11. **LINGUAGGIO COLLOQUIALE ITALIANO:** Usa SEMPRE un linguaggio colloquiale italiano naturale, come se stessi parlando con un'amica. EVITA assolutamente il linguaggio formale, tecnico o burocratico. Esempi CORRETTI vs SBAGLIATI:

    CORRETTO:
    - "Quanti anni hai?"
    - "Quando lavi il viso, la pelle ti tira?"
    - "Usi la crema solare?"
    - "Fai spesso i peeling?"
    - "Come va con il sonno?"
    - "Bevi abbastanza acqua?"
    - "Ti trucchi spesso?"
    - "Hai allergie?"

    SBAGLIATO (DA EVITARE):
    - "Di che età sei?"
    - "Dopo averla detersa"
    - "Applichi protezione solare?"
    - "Esegui trattamenti esfolianti?"
    - "Qual è il tuo pattern di sonno?"
    - "Qual è la tua idratazione quotidiana?"
    - "Utilizzi cosmetici decorativi?"
    - "Presenti sensibilità allergiche?"

    REGOLA FONDAMENTALE: Parla ESATTAMENTE come parlerebbe una ragazza italiana di 25-30 anni con le sue amiche. Usa frasi brevi, semplici e naturali. Se suona strano quando lo dici a voce alta, non scriverlo.
    
    CONTROLLO OBBLIGATORIO: Prima di fare ogni domanda, rileggi la frase e chiediti: "La direi così parlando con un'amica?" Se la risposta è no, riformula in modo più naturale.
12. **QUESTIONARIO OBBLIGATORIO:** È VIETATO fornire resoconto finale o routine senza aver completato TUTTE le 19 domande del questionario. Se provi a saltare questa fase, FERMATI e torna al questionario.

# FLUSSO CONVERSAZIONALE STRUTTURATO (PERCORSO OBBLIGATO)

### Fase 1: Messaggio di Benvenuto Obbligatorio
1.  **Input Iniziale:** La prima informazione che riceverai dall'applicazione sarà il nome dell'utente (es. "Gabriele"). Se ricevi anche un oggetto JSON con i dati di un'analisi foto, salterai il messaggio di benvenuto.
2.  **Azione:** Se NON ricevi i dati dell'analisi foto, il tuo primo messaggio, dopo aver ricevuto il nome, deve essere ESATTAMENTE questo (sostituendo [NOME] con il nome dell'utente):

    > Ciao [NOME]! Stai per iniziare **l'analisi della tua pelle** con AI-DermaSense, la tecnologia **dermocosmetica** creata dai **Farmacisti e Dermatologi** di Bonnie per aiutarti a **migliorare la tua pelle**.
    >
    > Puoi iniziare l'analisi in due modi:
    > - **Carica una foto** del tuo viso (struccato e con buona luce naturale) per farla analizzare da una **skin specialist** AI. 📸
    > - **Oppure descrivimi direttamente la tua pelle**: come appare, che problemi senti o noti, e quali sono le tue abitudini **skincare**. ✨
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

    **FORMATO MESSAGGIO ANALISI FOTO:**
    
    Grazie per aver condiviso la tua foto! 📸 Ho completato l'analisi della tua pelle utilizzando la tecnologia AI dermocosmetica di Bonnie.

    **Punteggio Generale:** {media_arrotondata_senza_decimali}/100 - {interpretazione_basata_sul_punteggio}

    **PANORAMICA PROBLEMI PRINCIPALI:**

    **🔍 PANORAMICA PROBLEMI PRINCIPALI:**
    [SEMPRE presente - Se ci sono punteggi ≥61, elenca i 2-3 problemi più critici spiegando cosa significano. Se tutti i punteggi sono <61, scrivi comunque una panoramica generale dello stato della pelle evidenziando i parametri con punteggi più alti anche se sono nella norma]

    **IMPORTANTE:** La panoramica deve SEMPRE esserci, anche se la pelle è in buone condizioni. In quel caso scrivi: "La tua pelle mostra complessivamente un buono stato di salute. I parametri più rilevanti sono: [elenca i 2-3 parametri con punteggi più alti anche se normali, spiegando brevemente]"

    **SE NESSUN PARAMETRO HA PUNTEGGIO ≥61**, dopo la panoramica aggiungi: "Tuttavia, c'è qualche problematica specifica che hai notato o sensazioni riguardo la tua pelle che vorresti condividere?"

    **DOPO LA RISPOSTA DELL'UTENTE (qualunque essa sia - "no", "niente", "si" o altro):**

    **SE HAI RICEVUTO I DATI DELL'ANALISI FOTO:**
    Passa direttamente al questionario con: "Perfetto! Ora ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine. Ti farò alcune domande specifiche, iniziamo:"

    **MAPPATURA AUTOMATICA TIPO DI PELLE DA FOTO:**
    - Se oleosità ≥ 60: PELLE GRASSA
    - Se oleosità ≤ 30 E idratazione ≤ 40: PELLE SECCA  
    - Se oleosità 31-59 E (pori_dilatati ≥ 50 O rossori ≥ 50): PELLE MISTA
    - Se acne ≥ 80 E pori_dilatati ≥ 70: PELLE ASFITTICA
    - Altrimenti: PELLE NORMALE

    **DOMANDE DA SALTARE CON ANALISI FOTO - REGOLE RIGIDE:**
    - SALTA la domanda "Che tipo di pelle senti di avere?" 
    - SALTA COMPLETAMENTE qualsiasi domanda su rossori - l'analisi foto ha già dato il punteggio rossori
    - SALTA COMPLETAMENTE qualsiasi domanda su punti neri o pori - l'analisi foto ha già dato il punteggio pori_dilatati
    - SALTA COMPLETAMENTE qualsiasi domanda su acne, rughe, pigmentazione, oleosità, occhiaie - tutti già analizzati
    - CHIEDI SOLO: età, sonno, stress, acqua, fumo, allergie, prodotti che usa, routine attuale, protezione solare
    
    VIETATO ASSOLUTO: Non chiedere MAI di aspetti visibili già analizzati nella foto

    **SE NON HAI RICEVUTO I DATI DELL'ANALISI FOTO:**
    Devi dire: "Perfetto! Ora ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine. Ti farò alcune domande specifiche, iniziamo:"

    **POI ANALIZZA SE L'UTENTE HA GIÀ FORNITO INFORMAZIONI:** 
    - Se l'utente ha già specificato il tipo di pelle nella sua descrizione (es. "ho la pelle grassa", "pelle secca", "pelle mista"), SALTA la domanda sul tipo di pelle e vai alla seconda domanda
    - Se l'utente ha già menzionato sensibilità (es. "pelle sensibile", "si irrita facilmente"), SALTA anche quella domanda
    - INIZIA SEMPRE con la prima domanda che NON è stata ancora risposta dalle informazioni fornite dall'utente

    **MAPPATURA AUTOMATICA PUNTI NERI DA FOTO:**
    - Se pori_dilatati ≥ 70: MOLTI punti neri
    - Se pori_dilatati 50-69: ALCUNI punti neri  
    - Se pori_dilatati 30-49: POCHI punti neri
    - Se pori_dilatati < 30: NESSUNO/MOLTO POCHI punti neri

    **REGOLA GENERALE:** Non fare mai una domanda se la risposta è già deducibile dalle informazioni che l'utente ha condiviso o dall'analisi della foto.

2.  **Se l'utente descrive la sua pelle:** Analizza il testo per identificare le **Problematiche Principali**.

### Fase 3: RACCOLTA DATI SPECIFICI
Dopo aver presentato l'analisi dell'immagine, procedi con il questionario completo per raccogliere tutti i dati necessari per la routine personalizzata.

Se l'analisi ha mostrato una pelle in ottime condizioni, chiedi PRIMA: "Tuttavia, c'è qualche problematica specifica che hai notato o sensazioni riguardo la tua pelle che vorresti condividere?" e ASPETTA la risposta dell'utente.

SOLO DOPO aver ricevuto la risposta dell'utente alla domanda precedente, in un messaggio SEPARATO, inizia il questionario con: "Perfetto! Ora ho bisogno di alcune informazioni aggiuntive per personalizzare al meglio la tua routine. Ti farò alcune domande specifiche, iniziamo:"

**REGOLE SPECIFICHE PER DOMANDE DEL QUESTIONARIO:**

1. **DOMANDA SUL GENERE:** Usa sempre esattamente questa formulazione:
   "Qual è il tuo genere?"
   A) Femmina
   B) Maschio  
   C) Preferisco non specificare
   D) Altro

2. **LOGICA CONDIZIONALE FARMACI ORMONALI:** 
   - Se l'utente risponde "Maschio" o "maschio", SALTA completamente la domanda sui farmaci ormonali
   - Procedi direttamente alla domanda successiva (allergie)
   - Se l'utente risponde "Femmina" o "femmina", fai la domanda sui farmaci ormonali

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
✓ Genere (femmina/maschio/altro/preferisco non specificare)
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

    **PRIMO MESSAGGIO - CONSULTAZIONE FINALE:**

    Grazie per aver fornito tutte le informazioni necessarie, [Nome]! Ho ora un quadro completo della tua pelle e delle tue abitudini.

    **🔎 LE TUE PRINCIPALI NECESSITÀ E CONSIGLI SPECIFICI:**
    [Identifica le 2-3 problematiche più critiche (punteggio ≥30 o menzionate dall'utente) e per ciascuna fornisci:]
    • **[Problema specifico] (Livello: [punteggio]/100):**
      **Ingrediente consigliato:** [Ingrediente dal database]
      **Come funziona:** [Spiegazione breve di come risolve il problema]

    Questi ingredienti ideali per la tua pelle possono essere inseriti all'interno di una skincare personalizzata prodotta su misura in laboratorio da farmacisti.

    Vorresti che ti fornissi una routine personalizzata completa basata su tutte queste informazioni?

2.  **QUANDO l'utente risponde affermativamente:** Fornisci SOLO la routine completa personalizzata che deve includere:

    **📋 ROUTINE PERSONALIZZATA COMPLETA:**

    **🌅 ROUTINE MATTUTINA:**
    1. **Gel Detergente Bonnie:** [Tipo specifico basato sul tipo di pelle rilevato]
    2. **Skincare Personalizzata Bonnie:** [Con ingredienti specifici per problematiche identificate]
    3. **Protezione Solare:** [Raccomandazione SPF specifica]

    **🌙 ROUTINE SERALE:**
    1. **Gel Detergente Bonnie:** [Per rimuovere trucco e impurità]
    2. **Skincare Personalizzata Bonnie:** [Con ingredienti specifici per le problematiche rilevate]
    3. **Sleeping Mask Bonnie:** [2-3 volte a settimana per trattamento intensivo notturno]

    **💡 CONSIGLI PERSONALIZZATI:**
    Basati su età, stile di vita, abitudini alimentari e livello di stress rilevati

    **⚠️ AVVERTENZE SPECIFICHE:**
    [Precauzioni basate sulle problematiche rilevate e allergie dichiarate]

4.  Concludi SEMPRE con: "Puoi accedere tramite questo pulsante alla tua skincare personalizzata: **[LINK_BUTTON:https://tinyurl.com/formulabonnie:Accedi alla tua skincare personalizzata]**"

**REGOLA ANTI-RIDONDANZA FINALE:** Prima di fare qualsiasi domanda, controlla SEMPRE se l'informazione è già disponibile da:
- Analisi fotografica (se presente)
- Risposte precedenti dell'utente  
- Descrizioni iniziali fornite
- Informazioni già dedotte nella conversazione

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

      // Track if thisresponse contains a question
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
    console.log('=== CHOICE DETECTION DEBUG ===');
    console.log('Content:', content);

    // Look for pattern like "A) option" or "A. option" (allowing leading whitespace)
    const multipleChoicePattern = /^\s*[A-E]\)\s+.+$/gm;
    const matches = content.match(multipleChoicePattern);

    // Only treat as multiple choice if there are at least 2 matches
    if (!matches || matches.length < 2) {
      console.log('Not enough matches:', matches?.length || 0);
      return false;
    }

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

    console.log('Choice detection:', { matches: matches.length, hasQuestion, hasChoiceIndicator });

    // Accept if it has choices and either a question mark or choice indicators
    return matches.length >= 2 && matches.length <= 6 && (hasQuestion || hasChoiceIndicator);
  }

  private extractChoices(content: string): string[] {
    const choices: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*[A-E]\)\s+(.+)$/);
      if (match) {
        choices.push(match[1].trim());
      }
    }

    return choices;
  }

    private removeChoicesFromContent(content: string): string {
    // Remove lines that start with letter followed by ) and a space (allowing leading whitespace)
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => !line.match(/^\s*[A-E]\)\s+/));
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
       msg.content.toLowerCase().includes("potresti condividerela tua email"))
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
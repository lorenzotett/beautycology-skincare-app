# Knowledge Base per Bonnie AI

Questa directory contiene i documenti che verranno caricati nella knowledge base RAG per migliorare le risposte di Bonnie.

## Come usare

1. **Posiziona i tuoi documenti** in questa directory (`knowledge-base/`)
2. **Formati supportati**: PDF, DOCX, TXT
3. **Carica i documenti** usando il comando: `tsx scripts/load-rag.ts`

## Comandi disponibili

```bash
# Carica tutti i documenti da questa directory
tsx scripts/load-rag.ts

# Carica documenti da una directory specifica
tsx scripts/load-rag.ts /percorso/alla/directory

# Carica un singolo file
tsx scripts/load-rag.ts file /percorso/al/file.pdf

# Mostra lo stato della knowledge base
tsx scripts/load-rag.ts status

# Testa la ricerca RAG
tsx scripts/load-rag.ts test "acne giovanile"

# Pulisce la knowledge base
tsx scripts/load-rag.ts clear
```

## Nota importante

I documenti vengono processati e divisi in frammenti (chunks) per migliorare la ricerca. Ogni documento viene analizzato e le informazioni rilevanti vengono utilizzate per arricchire le risposte di Bonnie durante le consultazioni dermocosmetiche.

## Esempio di utilizzo

1. Aggiungi i tuoi file PDF/DOCX/TXT nella directory `knowledge-base/`
2. Esegui: `tsx scripts/load-rag.ts`
3. Verifica che tutto sia caricato: `tsx scripts/load-rag.ts status`
4. Testa la ricerca: `tsx scripts/load-rag.ts test "ingredienti per pelle secca"`
#!/usr/bin/env tsx
// Script per caricare documenti nella knowledge base RAG
import { RAGLoader } from '../server/utils/rag-loader';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🤖 RAG Knowledge Base Loader

Utilizzo:
  npm run load-rag                     # Carica tutti i documenti da ./knowledge-base
  npm run load-rag <directory>         # Carica documenti da una directory specifica
  npm run load-rag file <path>         # Carica un singolo file
  npm run load-rag status              # Mostra lo stato della knowledge base
  npm run load-rag test "<query>"      # Testa la ricerca RAG
  npm run load-rag clear               # Pulisce la knowledge base

Formati supportati: PDF, DOCX, TXT
    `);
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case 'file':
        if (args.length < 2) {
          console.error('❌ Specifica il percorso del file');
          return;
        }
        await RAGLoader.loadSingleDocument(args[1]);
        break;

      case 'status':
        RAGLoader.showKnowledgeBaseStatus();
        break;

      case 'clear':
        RAGLoader.clearKnowledgeBase();
        break;

      case 'test':
        if (args.length < 2) {
          console.error('❌ Specifica una query di test');
          return;
        }
        await RAGLoader.testRAGSearch(args[1]);
        break;

      default:
        // Assume it's a directory path
        await RAGLoader.loadDocumentsFromDirectory(command);
        break;
    }
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main().catch(console.error);
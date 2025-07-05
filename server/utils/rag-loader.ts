import { ragService } from "../services/rag-simple";
import fs from 'fs';
import path from 'path';

export class RAGLoader {
  static async loadDocumentsFromDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        console.log(`Directory ${dirPath} does not exist. Creating it...`);
        fs.mkdirSync(dirPath, { recursive: true });
        return;
      }

      const files = fs.readdirSync(dirPath);
      const supportedExtensions = ['.pdf', '.docx', '.txt'];
      
      const documentFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return supportedExtensions.includes(ext);
      });

      if (documentFiles.length === 0) {
        console.log(`No supported documents found in ${dirPath}`);
        console.log(`Supported formats: ${supportedExtensions.join(', ')}`);
        return;
      }

      console.log(`Found ${documentFiles.length} document(s) to load:`);
      documentFiles.forEach(file => console.log(`- ${file}`));

      for (const file of documentFiles) {
        const filePath = path.join(dirPath, file);
        console.log(`\nLoading ${file}...`);
        
        try {
          const result = await ragService.addDocument(filePath, file);
          console.log(`✅ ${result}`);
        } catch (error) {
          console.error(`❌ Error loading ${file}:`, error);
        }
      }

      // Show final stats
      const stats = ragService.getKnowledgeBaseStats();
      console.log(`\n📊 Knowledge Base Stats:`);
      console.log(`- Total documents: ${stats.totalDocuments}`);
      console.log(`- Total chunks: ${stats.totalChunks}`);
      console.log(`- Sources: ${stats.sources.join(', ')}`);
      
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }

  static async loadSingleDocument(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File ${filePath} does not exist`);
        return;
      }

      const fileName = path.basename(filePath);
      console.log(`Loading ${fileName}...`);
      
      const result = await ragService.addDocument(filePath, fileName);
      console.log(`✅ ${result}`);
      
      // Show updated stats
      const stats = ragService.getKnowledgeBaseStats();
      console.log(`\n📊 Updated Knowledge Base Stats:`);
      console.log(`- Total documents: ${stats.totalDocuments}`);
      console.log(`- Total chunks: ${stats.totalChunks}`);
      
    } catch (error) {
      console.error('Error loading document:', error);
    }
  }

  static showKnowledgeBaseStatus(): void {
    const stats = ragService.getKnowledgeBaseStats();
    console.log(`\n📊 Knowledge Base Status:`);
    console.log(`- Total documents: ${stats.totalDocuments}`);
    console.log(`- Total chunks: ${stats.totalChunks}`);
    
    if (stats.sources.length > 0) {
      console.log(`- Sources:`);
      stats.sources.forEach(source => console.log(`  • ${source}`));
    } else {
      console.log(`- No documents loaded yet`);
    }
  }

  static clearKnowledgeBase(): void {
    ragService.clearKnowledgeBase();
    console.log(`✅ Knowledge base cleared successfully`);
  }

  static async testRAGSearch(query: string): Promise<void> {
    try {
      console.log(`\n🔍 Testing RAG search for: "${query}"`);
      const results = await ragService.searchSimilar(query, 3);
      
      if (results.sources.length === 0) {
        console.log(`No relevant content found`);
        return;
      }
      
      console.log(`Found ${results.sources.length} relevant chunks:`);
      results.sources.forEach((source, index) => {
        console.log(`\n--- Result ${index + 1} (similarity: ${source.similarity.toFixed(3)}) ---`);
        console.log(`Source: ${source.metadata.source}`);
        console.log(`Chunk: ${source.metadata.chunkIndex + 1}/${source.metadata.totalChunks}`);
        console.log(`Content preview: ${source.content.substring(0, 200)}...`);
      });
      
    } catch (error) {
      console.error('Error testing RAG search:', error);
    }
  }
}

// CLI functions for manual loading
export async function loadDocuments(dirPath: string = './knowledge-base') {
  await RAGLoader.loadDocumentsFromDirectory(dirPath);
}

export async function loadDocument(filePath: string) {
  await RAGLoader.loadSingleDocument(filePath);
}

export function ragStatus() {
  RAGLoader.showKnowledgeBaseStatus();
}

export function ragClear() {
  RAGLoader.clearKnowledgeBase();
}

export async function ragTest(query: string) {
  await RAGLoader.testRAGSearch(query);
}
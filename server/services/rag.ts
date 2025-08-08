import { ChromaClient } from 'chromadb';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: string;
    uploadedAt: string;
    chunks?: number;
  };
}

interface RAGResult {
  content: string;
  sources: Array<{
    content: string;
    metadata: any;
    distance: number;
  }>;
}

export class RAGService {
  private chromaClient: ChromaClient;
  private collection: any;
  private ai: GoogleGenAI;
  private isInitialized = false;

  constructor() {
    this.chromaClient = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || ""
    });
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Create or get collection
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'dermocosmetic_knowledge',
        metadata: { description: 'Knowledge base for dermocosmetic consultation' }
      });

      this.isInitialized = true;
      console.log('RAG Service initialized successfully');
    } catch (error) {
      console.error('Error initializing RAG service:', error);
      throw error;
    }
  }

  async addDocument(filePath: string, originalName: string): Promise<string> {
    await this.initialize();

    try {
      const fileContent = await this.extractTextFromFile(filePath, originalName);
      const chunks = this.splitIntoChunks(fileContent);
      
      const embeddings = await this.generateEmbeddings(chunks);
      
      // Generate unique IDs for each chunk
      const ids = chunks.map((_, index) => `${originalName}_chunk_${index}_${Date.now()}`);
      
      // Prepare metadata for each chunk
      const metadatas = chunks.map((chunk, index) => ({
        source: originalName,
        type: this.getFileType(originalName),
        uploadedAt: new Date().toISOString(),
        chunkIndex: index,
        totalChunks: chunks.length,
        chunkSize: chunk.length
      }));

      // Add to ChromaDB
      await this.collection.add({
        ids: ids,
        embeddings: embeddings,
        documents: chunks,
        metadatas: metadatas
      });

      console.log(`Added ${chunks.length} chunks from ${originalName} to knowledge base`);
      return `Successfully added ${chunks.length} chunks from ${originalName}`;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, limit: number = 5): Promise<RAGResult> {
    await this.initialize();

    try {
      const queryEmbedding = await this.generateEmbeddings([query]);
      
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding,
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });

      const sources = results.documents[0]?.map((doc: string, index: number) => ({
        content: doc,
        metadata: results.metadatas[0][index],
        distance: results.distances[0][index]
      })) || [];

      // Combine the relevant content
      const combinedContent = sources
        .filter((source: any) => source.distance < 0.8) // Filter by similarity threshold
        .map((source: any) => source.content)
        .join('\n\n---\n\n');

      return {
        content: combinedContent,
        sources: sources
      };
    } catch (error) {
      console.error('Error searching similar content:', error);
      return { content: '', sources: [] };
    }
  }

  private async extractTextFromFile(filePath: string, fileName: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
      
      case 'docx':
        const docxData = await mammoth.extractRawText({ buffer: fileBuffer });
        return docxData.value;
      
      case 'txt':
        return fileBuffer.toString('utf-8');
      
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private splitIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const sentenceSize = sentence.length;
      
      if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Create overlap by keeping the last part of the current chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate overlap
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
        currentSize = currentChunk.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentSize += sentenceSize;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Use Gemini for embeddings
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      try {
        const response = await this.ai.models.embedContent({
          model: 'text-embedding-004',
          contents: [{
            role: 'user',
            parts: [{ text: text }]
          }]
        });
        
        if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
          embeddings.push(response.embeddings[0].values);
        } else {
          throw new Error('No embedding values received');
        }
      } catch (error) {
        console.error('Error generating embedding:', error);
        // Fallback: create a simple hash-based embedding
        const simpleEmbedding = this.createSimpleEmbedding(text);
        embeddings.push(simpleEmbedding);
      }
    }
    
    return embeddings;
  }

  private createSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding as fallback
    const embedding = new Array(384).fill(0);
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      embedding[i % 384] += char;
    }
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  private getFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'PDF Document';
      case 'docx': return 'Word Document';
      case 'txt': return 'Text Document';
      default: return 'Unknown';
    }
  }

  async getKnowledgeBaseStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    sources: string[];
  }> {
    await this.initialize();

    try {
      const results = await this.collection.get({
        include: ['metadatas']
      });

      const metadatas = results.metadatas || [];
      const sources = Array.from(new Set(metadatas.map((meta: any) => meta.source))) as string[];
      
      return {
        totalDocuments: sources.length,
        totalChunks: metadatas.length,
        sources: sources
      };
    } catch (error) {
      console.error('Error getting knowledge base stats:', error);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        sources: []
      };
    }
  }

  async clearKnowledgeBase(): Promise<void> {
    await this.initialize();
    
    try {
      await this.chromaClient.deleteCollection({ name: 'dermocosmetic_knowledge' });
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'dermocosmetic_knowledge',
        metadata: { description: 'Knowledge base for dermocosmetic consultation' }
      });
      console.log('Knowledge base cleared successfully');
    } catch (error) {
      console.error('Error clearing knowledge base:', error);
      throw error;
    }
  }
}

export const ragService = new RAGService();
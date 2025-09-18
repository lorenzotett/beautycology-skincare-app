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
    chunkIndex: number;
    totalChunks: number;
  };
}

interface RAGResult {
  content: string;
  sources: Array<{
    content: string;
    metadata: any;
    similarity: number;
  }>;
}

export class SimpleRAGService {
  private documents: Document[] = [];
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || ""
    });
  }

  async addDocument(filePath: string, originalName: string): Promise<string> {
    try {
      const fileContent = await this.extractTextFromFile(filePath, originalName);
      const chunks = this.splitIntoChunks(fileContent);
      
      // Generate documents for each chunk
      const documents: Document[] = chunks.map((chunk, index) => ({
        id: `${originalName}_chunk_${index}_${Date.now()}`,
        content: chunk,
        metadata: {
          source: originalName,
          type: this.getFileType(originalName),
          uploadedAt: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length
        }
      }));

      // Add to in-memory storage
      this.documents.push(...documents);

      console.log(`Added ${chunks.length} chunks from ${originalName} to knowledge base`);
      return `Successfully added ${chunks.length} chunks from ${originalName}`;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  

  

  async searchSimilar(query: string, limit: number = 5): Promise<RAGResult> {
    try {
      // Simple text similarity search
      const results = this.documents
        .map(doc => ({
          ...doc,
          similarity: this.calculateSimilarity(query.toLowerCase(), doc.content.toLowerCase())
        }))
        .filter(doc => doc.similarity > 0.05) // Lowered minimum similarity threshold for Italian content
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      const sources = results.map(doc => ({
        content: doc.content,
        metadata: doc.metadata,
        similarity: doc.similarity
      }));

      // Combine the relevant content
      const combinedContent = sources
        .map(source => source.content)
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

  async enhanceQueryWithRAG(query: string, context: string = ''): Promise<string> {
    try {
      const ragResult = await this.searchSimilar(query, 3);
      
      if (ragResult.content.trim()) {
        // Combine the original context with RAG-retrieved information
        const enhancedContext = `
INFORMAZIONI DALLA KNOWLEDGE BASE:
${ragResult.content}

CONTESTO CONVERSAZIONE:
${context}

DOMANDA DELL'UTENTE:
${query}

Rispondi utilizzando sia le informazioni dalla knowledge base che il contesto della conversazione. Se le informazioni della knowledge base sono rilevanti, utilizzale per arricchire la risposta.
        `;
        
        return enhancedContext;
      }
      
      return `${context}\n\nDOMANDA DELL'UTENTE:\n${query}`;
    } catch (error) {
      console.error('Error enhancing query with RAG:', error);
      return `${context}\n\nDOMANDA DELL'UTENTE:\n${query}`;
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

  private calculateSimilarity(str1: string, str2: string): number {
    // Improved similarity for Italian text and product names
    const normalize = (text: string) => text
      .toLowerCase() // Convert to lowercase FIRST
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
      .replace(/[^a-z\s]/g, ' ') // Remove other non-alphabetic characters
      .split(/\s+/)
      .filter(word => word.length > 1); // Allow 2+ character words (for product codes like "M")
    
    const words1 = new Set(normalize(str1));
    const words2 = new Set(normalize(str2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    // Calculate Jaccard similarity
    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Boost similarity if there's an exact substring match (case-insensitive)
    const text1Normalized = str1.toLowerCase().replace(/[-_\s]/g, '');
    const text2Normalized = str2.toLowerCase().replace(/[-_\s]/g, '');
    
    let substringBoost = 0;
    if (text1Normalized.includes(text2Normalized) || text2Normalized.includes(text1Normalized)) {
      substringBoost = 0.3; // Add 30% boost for substring matches
    }
    
    return Math.min(1.0, jaccardSimilarity + substringBoost);
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

  getKnowledgeBaseStats(): {
    totalDocuments: number;
    totalChunks: number;
    sources: string[];
  } {
    const sources = Array.from(new Set(this.documents.map(doc => doc.metadata.source)));
    
    return {
      totalDocuments: sources.length,
      totalChunks: this.documents.length,
      sources: sources
    };
  }

  clearKnowledgeBase(): void {
    this.documents = [];
    console.log('Knowledge base cleared successfully');
  }

  // Get all documents for debugging
  getAllDocuments(): Document[] {
    return this.documents;
  }
}

export const ragService = new SimpleRAGService();
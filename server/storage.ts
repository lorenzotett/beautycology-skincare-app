import { 
  users, 
  chatSessions, 
  chatMessages,
  ragDocuments,
  ragEmbeddings,
  type User, 
  type InsertUser,
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type RagDocument,
  type InsertRagDocument,
  type RagEmbedding,
  type InsertRagEmbedding
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat session methods
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  updateSessionFinalButtonClick(sessionId: string, clicked: boolean): Promise<void>;
  deleteChatSession(sessionId: string): Promise<void>;
  
  // Chat message methods
  addChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  getRecentChatMessages(sessionId: string, limit: number): Promise<ChatMessage[]>;
  updateChatMessage(messageId: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined>;
  deleteChatMessages(sessionId: string): Promise<void>;
  
  // Admin methods
  getAllChatSessions(): Promise<ChatSession[]>;
  getAllChatMessages(): Promise<ChatMessage[]>;
  
  // Brand-filtered methods for admin dashboard
  getChatSessionsByBrand(brand: string): Promise<ChatSession[]>;
  getAdminStatsByBrand(brand: string, dateRange?: { from?: Date; to?: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalMessages: number;
  }>;
  
  // RAG document methods
  addRagDocuments(documents: InsertRagDocument[]): Promise<RagDocument[]>;
  searchRagDocuments(query?: string): Promise<RagDocument[]>;
  getRagDocuments(): Promise<RagDocument[]>;
  clearRagDocuments(): Promise<void>;
  getRagDocumentStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    sources: string[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage[]>;
  private ragDocuments: Map<number, RagDocument>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentMessageId: number;
  private currentRagDocumentId: number;

  constructor() {
    this.users = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.ragDocuments = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentMessageId = 1;
    this.currentRagDocumentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = this.currentSessionId++;
    const session: ChatSession = {
      id,
      ...insertSession,
      userEmail: null,
      brand: insertSession.brand || "dermasense",
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      finalButtonClicked: false,
      finalButtonClickedAt: null,
      whatsappButtonClicked: false,
      whatsappButtonClickedAt: null,
      firstViewedAt: null,
      chatStartedAt: null,
      klaviyoSynced: false,
      googleSheetsSynced: false,
    };
    this.chatSessions.set(insertSession.sessionId, session);
    this.chatMessages.set(insertSession.sessionId, []);
    return session;
  }

  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(sessionId);
  }

  async updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(sessionId);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates, updatedAt: new Date() };
    this.chatSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async updateSessionFinalButtonClick(sessionId: string, clicked: boolean): Promise<void> {
    const session = this.chatSessions.get(sessionId);
    if (session) {
      const updatedSession = { 
        ...session, 
        finalButtonClicked: clicked, 
        finalButtonClickedAt: clicked ? new Date() : null,
        updatedAt: new Date() 
      };
      this.chatSessions.set(sessionId, updatedSession);
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    this.chatSessions.delete(sessionId);
  }

  async deleteChatMessages(sessionId: string): Promise<void> {
    this.chatMessages.delete(sessionId);
  }

  async addChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentMessageId++;
    const message: ChatMessage = {
      id,
      ...insertMessage,
      metadata: insertMessage.metadata || {},
      createdAt: new Date(),
    };
    
    const messages = this.chatMessages.get(insertMessage.sessionId) || [];
    messages.push(message);
    this.chatMessages.set(insertMessage.sessionId, messages);
    
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(sessionId) || [];
  }

  async getRecentChatMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const messages = this.chatMessages.get(sessionId) || [];
    return messages.slice(-limit);
  }

  async updateChatMessage(messageId: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    // Find message across all sessions
    for (const [sessionId, messages] of Array.from(this.chatMessages.entries())) {
      const messageIndex = messages.findIndex((msg: ChatMessage) => msg.id === messageId);
      if (messageIndex !== -1) {
        const updatedMessage = { ...messages[messageIndex], ...updates };
        messages[messageIndex] = updatedMessage;
        this.chatMessages.set(sessionId, messages);
        return updatedMessage;
      }
    }
    return undefined;
  }

  async getAllChatSessions(): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values());
  }

  async getAllChatMessages(): Promise<ChatMessage[]> {
    const allMessages: ChatMessage[] = [];
    for (const messages of Array.from(this.chatMessages.values())) {
      allMessages.push(...messages);
    }
    return allMessages;
  }

  async getChatSessionsByBrand(brand: string): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(session => session.brand === brand);
  }

  async getAdminStatsByBrand(brand: string, dateRange?: { from?: Date; to?: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalMessages: number;
  }> {
    let sessions = Array.from(this.chatSessions.values()).filter(session => session.brand === brand);
    
    // Apply date filter if provided
    if (dateRange?.from) {
      sessions = sessions.filter(session => session.createdAt && session.createdAt >= dateRange.from!);
    }
    if (dateRange?.to) {
      sessions = sessions.filter(session => session.createdAt && session.createdAt <= dateRange.to!);
    }

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(session => session.isActive).length;
    const completedSessions = sessions.filter(session => session.finalButtonClicked).length;
    
    // Count messages for sessions of this brand
    let totalMessages = 0;
    for (const session of sessions) {
      const messages = this.chatMessages.get(session.sessionId) || [];
      totalMessages += messages.length;
    }

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      totalMessages
    };
  }

  async addRagDocuments(documents: InsertRagDocument[]): Promise<RagDocument[]> {
    const added: RagDocument[] = [];
    for (const doc of documents) {
      const id = this.currentRagDocumentId++;
      const ragDoc: RagDocument = {
        id,
        ...doc,
        uploadedAt: new Date(),
      };
      this.ragDocuments.set(id, ragDoc);
      added.push(ragDoc);
    }
    return added;
  }

  async searchRagDocuments(query?: string): Promise<RagDocument[]> {
    const docs = Array.from(this.ragDocuments.values());
    if (!query) return docs;
    
    // Simple text search for memory implementation
    const lowerQuery = query.toLowerCase();
    return docs.filter(doc => 
      doc.content.toLowerCase().includes(lowerQuery) ||
      doc.source.toLowerCase().includes(lowerQuery)
    );
  }

  async getRagDocuments(): Promise<RagDocument[]> {
    return Array.from(this.ragDocuments.values());
  }

  async clearRagDocuments(): Promise<void> {
    this.ragDocuments.clear();
  }

  async getRagDocumentStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    sources: string[];
  }> {
    const docs = Array.from(this.ragDocuments.values());
    const sources = Array.from(new Set(docs.map(doc => doc.source)));
    
    return {
      totalDocuments: sources.length,
      totalChunks: docs.length,
      sources: sources
    };
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const [session] = await db
      .insert(chatSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId));
    return session || undefined;
  }

  async updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const [session] = await db
      .update(chatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chatSessions.sessionId, sessionId))
      .returning();
    return session || undefined;
  }

  async updateSessionFinalButtonClick(sessionId: string, clicked: boolean): Promise<void> {
    await db
      .update(chatSessions)
      .set({ 
        finalButtonClicked: clicked, 
        finalButtonClickedAt: clicked ? new Date() : null,
        updatedAt: new Date() 
      })
      .where(eq(chatSessions.sessionId, sessionId));
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    await db
      .delete(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId));
  }

  async deleteChatMessages(sessionId: string): Promise<void> {
    await db
      .delete(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId));
  }

  async addChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values({
        ...insertMessage,
        metadata: insertMessage.metadata || null
      })
      .returning();
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  async getRecentChatMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async updateChatMessage(messageId: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    const [message] = await db
      .update(chatMessages)
      .set(updates)
      .where(eq(chatMessages.id, messageId))
      .returning();
    return message || undefined;
  }

  async getAllChatSessions(): Promise<(ChatSession & { messageCount: number })[]> {
    const result = await db
      .select({
        ...getTableColumns(chatSessions),
        messageCount: sql<number>`COALESCE((SELECT COUNT(*)::integer FROM chat_messages WHERE chat_messages.session_id = chat_sessions.session_id), 0)`.as('messageCount')
      })
      .from(chatSessions)
      .orderBy(chatSessions.createdAt); // ASC order for historical sync - oldest first
    
    return result as (ChatSession & { messageCount: number })[];
  }

  async getAllChatMessages(): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .orderBy(chatMessages.createdAt);
  }

  async getChatSessionsByBrand(brand: string): Promise<ChatSession[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.brand, brand))
      .orderBy(chatSessions.createdAt);
  }

  async getAdminStatsByBrand(brand: string, dateRange?: { from?: Date; to?: Date }): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalMessages: number;
  }> {
    // Build where conditions for brand and date range
    const predicates = [eq(chatSessions.brand, brand)];
    if (dateRange?.from) {
      predicates.push(gte(chatSessions.createdAt, dateRange.from));
    }
    if (dateRange?.to) {
      predicates.push(lte(chatSessions.createdAt, dateRange.to));
    }

    const whereClause = predicates.length > 1 ? and(...predicates) : predicates[0];

    // Get filtered sessions with message counts
    const result = await db
      .select({
        ...getTableColumns(chatSessions),
        messageCount: sql<number>`COALESCE((SELECT COUNT(*)::integer FROM chat_messages WHERE chat_messages.session_id = chat_sessions.session_id), 0)`.as('messageCount')
      })
      .from(chatSessions)
      .where(whereClause);

    const totalSessions = result.length;
    const activeSessions = result.filter(session => session.isActive).length;
    const completedSessions = result.filter(session => session.finalButtonClicked).length;
    const totalMessages = result.reduce((sum, session) => sum + (session as any).messageCount, 0);

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      totalMessages
    };
  }

  async addRagDocuments(documents: InsertRagDocument[]): Promise<RagDocument[]> {
    const added = await db
      .insert(ragDocuments)
      .values(documents)
      .returning();
    return added;
  }

  async searchRagDocuments(query?: string): Promise<RagDocument[]> {
    if (!query) {
      return await db
        .select()
        .from(ragDocuments)
        .orderBy(ragDocuments.uploadedAt);
    }
    
    // For PostgreSQL text search - using ILIKE for case-insensitive search
    const lowerQuery = `%${query}%`;
    return await db
      .select()
      .from(ragDocuments)
      .where(
        sql`${ragDocuments.content} ILIKE ${lowerQuery} OR ${ragDocuments.source} ILIKE ${lowerQuery}`
      )
      .orderBy(ragDocuments.uploadedAt);
  }

  async getRagDocuments(): Promise<RagDocument[]> {
    return await db
      .select()
      .from(ragDocuments)
      .orderBy(ragDocuments.uploadedAt);
  }

  async clearRagDocuments(): Promise<void> {
    await db.delete(ragDocuments);
  }

  async getRagDocumentStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    sources: string[];
  }> {
    const docs = await db.select().from(ragDocuments);
    const sources = Array.from(new Set(docs.map(doc => doc.source)));
    
    return {
      totalDocuments: sources.length,
      totalChunks: docs.length,
      sources: sources
    };
  }
}

export const storage = new DatabaseStorage();

import { 
  users, 
  chatSessions, 
  chatMessages,
  type User, 
  type InsertUser,
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage[]>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentMessageId = 1;
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
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
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
    for (const [sessionId, messages] of this.chatMessages.entries()) {
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
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
    for (const messages of this.chatMessages.values()) {
      allMessages.push(...messages);
    }
    return allMessages;
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
      .orderBy(desc(chatSessions.updatedAt));
    
    return result as (ChatSession & { messageCount: number })[];
  }

  async getAllChatMessages(): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .orderBy(chatMessages.createdAt);
  }
}

export const storage = new DatabaseStorage();

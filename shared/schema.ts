import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sessionId: text("session_id").notNull().unique(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  brand: text("brand").notNull().default("beautycology"), // 'dermasense' or 'beautycology'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  finalButtonClicked: boolean("final_button_clicked").default(false),
  finalButtonClickedAt: timestamp("final_button_clicked_at"),
  whatsappButtonClicked: boolean("whatsapp_button_clicked").default(false),
  whatsappButtonClickedAt: timestamp("whatsapp_button_clicked_at"),
  firstViewedAt: timestamp("first_viewed_at"), // Quando l'utente vede la prima schermata
  chatStartedAt: timestamp("chat_started_at"), // Quando l'utente avvia effettivamente la chat
  klaviyoSynced: boolean("klaviyo_synced").default(false),
  googleSheetsSynced: boolean("google_sheets_synced").default(false),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  metadata: json("metadata").$type<unknown>().default(null), // For storing additional data like choices, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  userId: true,
  sessionId: true,
  userName: true,
  brand: true,
}).extend({
  brand: z.enum(["dermasense", "beautycology"]).default("beautycology"),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  sessionId: true,
  role: true,
  content: true,
  metadata: true,
}).extend({
  metadata: z.unknown().optional(),
});

// RAG Documents table
export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  metadata: json("metadata").$type<{
    source: string;
    type: string;
    uploadedAt: string;
    chunkIndex: number;
    totalChunks: number;
  }>().notNull(),
  source: text("source").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  totalChunks: integer("total_chunks").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// RAG Embeddings table (for future implementations)
export const ragEmbeddings = pgTable("rag_embeddings", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => ragDocuments.id, { onDelete: "cascade" }),
  embedding: json("embedding").$type<number[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRagDocumentSchema = createInsertSchema(ragDocuments).pick({
  content: true,
  metadata: true,
  source: true,
  chunkIndex: true,
  totalChunks: true,
}).extend({
  metadata: z.object({
    source: z.string(),
    type: z.string(),
    uploadedAt: z.string(),
    chunkIndex: z.number(),
    totalChunks: z.number(),
  }),
});

export const insertRagEmbeddingSchema = createInsertSchema(ragEmbeddings).pick({
  documentId: true,
  embedding: true,
}).extend({
  embedding: z.array(z.number()),
});

export type Brand = "dermasense" | "beautycology";

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertRagDocument = z.infer<typeof insertRagDocumentSchema>;
export type RagEmbedding = typeof ragEmbeddings.$inferSelect;
export type InsertRagEmbedding = z.infer<typeof insertRagEmbeddingSchema>;

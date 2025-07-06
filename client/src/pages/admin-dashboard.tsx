
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage, ChatSession } from "@shared/schema";
import { Search, Users, MessageSquare, Calendar, Clock, Image, Brain } from "lucide-react";

interface AdminStats {
  totalSessions: number;
  totalMessages: number;
  activeSessions: number;
  todaySessions: number;
  averageMessagesPerSession: number;
}

interface SessionWithMessages extends ChatSession {
  messages: ChatMessage[];
  messageCount: number;
  lastActivity: Date;
  hasImages: boolean;
  skinAnalysisCount: number;
}

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats");
      return response.json() as Promise<AdminStats>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/sessions");
      return response.json() as Promise<SessionWithMessages[]>;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: selectedSessionDetails } = useQuery({
    queryKey: ["admin-session-details", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return null;
      const response = await apiRequest("GET", `/api/admin/sessions/${selectedSession}`);
      return response.json() as Promise<SessionWithMessages>;
    },
    enabled: !!selectedSession,
  });

  const filteredSessions = sessions?.filter(session =>
    session.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.sessionId.includes(searchTerm)
  ) || [];

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('it-IT');
  };

  const formatDuration = (createdAt: Date | string, updatedAt: Date | string) => {
    const start = new Date(createdAt);
    const end = new Date(updatedAt);
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    return `${minutes} min`;
  };

  return (
    <div className="min-h-screen bg-dark-primary text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Amministrativa Bonnie AI</h1>
          <p className="text-text-muted">Monitoraggio e analisi delle conversazioni</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-dark-accent border-gray-600 p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm text-text-muted">Sessioni Totali</p>
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                </div>
              </div>
            </Card>
            
            <Card className="bg-dark-accent border-gray-600 p-4">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-sm text-text-muted">Messaggi Totali</p>
                  <p className="text-2xl font-bold">{stats.totalMessages}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-dark-accent border-gray-600 p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-sm text-text-muted">Sessioni Attive</p>
                  <p className="text-2xl font-bold">{stats.activeSessions}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-dark-accent border-gray-600 p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-sm text-text-muted">Oggi</p>
                  <p className="text-2xl font-bold">{stats.todaySessions}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-dark-accent border-gray-600 p-4">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-sm text-text-muted">Media Msg/Sessione</p>
                  <p className="text-2xl font-bold">{stats.averageMessagesPerSession.toFixed(1)}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions List */}
          <Card className="bg-dark-accent border-gray-600">
            <div className="p-4 border-b border-gray-600">
              <h2 className="text-xl font-semibold mb-4">Sessioni di Chat</h2>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Cerca per nome utente o ID sessione..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-dark-primary border-gray-600 text-white"
                />
              </div>
            </div>
            
            <ScrollArea className="h-96">
              <div className="p-4 space-y-2">
                {filteredSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSession === session.sessionId
                        ? 'bg-assistant-msg border-green-500'
                        : 'bg-dark-primary border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedSession(session.sessionId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{session.userName}</h3>
                        <p className="text-xs text-text-muted font-mono">
                          {session.sessionId.slice(-8)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {session.isActive && (
                          <Badge variant="secondary" className="bg-green-600 text-white">
                            Attiva
                          </Badge>
                        )}
                        {session.hasImages && (
                          <Badge variant="outline" className="border-blue-500 text-blue-400">
                            <Image className="h-3 w-3 mr-1" />
                            IMG
                          </Badge>
                        )}
                        {session.skinAnalysisCount > 0 && (
                          <Badge variant="outline" className="border-purple-500 text-purple-400">
                            <Brain className="h-3 w-3 mr-1" />
                            {session.skinAnalysisCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-text-muted space-y-1">
                      <div className="flex justify-between">
                        <span>Messaggi: {session.messageCount}</span>
                        <span>Durata: {formatDuration(session.createdAt, session.updatedAt)}</span>
                      </div>
                      <div>
                        Ultima attività: {formatDate(session.lastActivity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Session Details */}
          <Card className="bg-dark-accent border-gray-600">
            <div className="p-4 border-b border-gray-600">
              <h2 className="text-xl font-semibold">Dettagli Conversazione</h2>
            </div>
            
            {selectedSessionDetails ? (
              <ScrollArea className="h-96">
                <div className="p-4">
                  {/* Session Info */}
                  <div className="mb-4 p-3 bg-dark-primary rounded-lg">
                    <h3 className="font-medium mb-2">{selectedSessionDetails.userName}</h3>
                    <div className="text-sm text-text-muted space-y-1">
                      <p>ID: {selectedSessionDetails.sessionId}</p>
                      <p>Creata: {formatDate(selectedSessionDetails.createdAt)}</p>
                      <p>Aggiornata: {formatDate(selectedSessionDetails.updatedAt)}</p>
                      <p>Messaggi: {selectedSessionDetails.messageCount}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {selectedSessionDetails.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-user-msg ml-4'
                            : 'bg-assistant-msg mr-4'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <Badge
                            variant={message.role === 'user' ? 'default' : 'secondary'}
                            className={message.role === 'user' ? 'bg-blue-600' : 'bg-green-600'}
                          >
                            {message.role === 'user' ? 'Utente' : 'Bonnie'}
                          </Badge>
                          <span className="text-xs text-text-muted">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                        
                        <p className="text-sm mb-2">{message.content}</p>
                        
                        {/* Metadata */}
                        {message.metadata && (
                          <div className="text-xs text-text-muted">
                            {(message.metadata as any)?.hasImage && (
                              <div className="flex items-center gap-1 mb-1">
                                <Image className="h-3 w-3" />
                                <span>Immagine: {(message.metadata as any)?.imageOriginalName}</span>
                              </div>
                            )}
                            {(message.metadata as any)?.skinAnalysis && (
                              <div className="flex items-center gap-1 mb-1">
                                <Brain className="h-3 w-3" />
                                <span>Analisi AI della pelle</span>
                              </div>
                            )}
                            {(message.metadata as any)?.hasChoices && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                <span>Scelte multiple ({(message.metadata as any)?.choices?.length || 0})</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="p-8 text-center text-text-muted">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Seleziona una sessione per vedere i dettagli</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

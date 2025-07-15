
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage, ChatSession } from "@shared/schema";
import { Search, Users, MessageSquare, Calendar, Clock, Image, Brain, User, LogOut, BarChart3, Copy, X, Eye, ChevronDown, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MessageBubble } from "@/components/message-bubble";

interface AdminStats {
  totalSessions: number;
  totalMessages: number;
  activeSessions: number;
  todaySessions: number;
  finalButtonClicks: number;
  averageMessagesPerSession: number;
}

interface SessionWithMessages extends ChatSession {
  messages: ChatMessage[];
  messageCount: number;
  lastActivity: Date;
  hasImages: boolean;
  skinAnalysisCount: number;
}

type PeriodType = "Tutto il tempo" | "Oggi" | "Ultima settimana" | "Ultimo mese" | "Personalizzato";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Tutto il tempo");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionWithMessages | null>(null);
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const { toast } = useToast();

  // Check if user is already authenticated
  useEffect(() => {
    const authStatus = localStorage.getItem('admin-authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPeriod, customDateFrom, customDateTo]);

  // Lock body scroll when modal is open and handle ESC key
  useEffect(() => {
    if (selectedSession || zoomedImage) {
      document.body.style.overflow = 'hidden';
      
      // Add ESC key listener
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (zoomedImage) {
            setZoomedImage(null);
          } else if (selectedSession) {
            setSelectedSession(null);
          }
        }
      };
      
      document.addEventListener('keydown', handleEscKey);
      
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscKey);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedSession, zoomedImage]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "password123") {
      setIsAuthenticated(true);
      localStorage.setItem('admin-authenticated', 'true');
    } else {
      alert("Credenziali non valide");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin-authenticated');
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiato!",
        description: `${label} copiato negli appunti`,
      });
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = async () => {
    if (selectedSessions.size === 0) {
      toast({
        title: "Nessuna chat selezionata",
        description: "Seleziona almeno una chat per esportare",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generazione CSV",
        description: `Preparazione del CSV per ${selectedSessions.size} chat selezionate...`,
      });

      const response = await fetch('/api/admin/export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionIds: Array.from(selectedSessions)
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'ai-dermasense-export.csv';

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download completato!",
        description: `File ${filename} scaricato con ${selectedSessions.size} chat`,
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      toast({
        title: "Errore",
        description: "Impossibile scaricare il file CSV",
        variant: "destructive",
      });
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedSessions(new Set());
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const selectAllSessions = () => {
    if (!paginatedSessions) return;
    const pageSessionIds = paginatedSessions.map(s => s.sessionId);
    setSelectedSessions(new Set([...selectedSessions, ...pageSessionIds]));
  };

  const selectAllFiltered = () => {
    if (!filteredSessions) return;
    const allSessionIds = filteredSessions.map(s => s.sessionId);
    setSelectedSessions(new Set(allSessionIds));
  };

  const deselectAllSessions = () => {
    setSelectedSessions(new Set());
  };

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to delete chat session");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({
        title: "Successo",
        description: "Chat eliminata con successo",
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la chat",
        variant: "destructive",
      });
    },
  });

  const handleDeleteChat = (sessionId: string, userName: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare la chat di ${userName}? Questa azione non può essere annullata.`)) {
      deleteChatMutation.mutate(sessionId);
    }
  };

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats");
      return response.json() as Promise<AdminStats>;
    },
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const { data: sessionsData } = useQuery({
    queryKey: ["admin-sessions", currentPage, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm
      });
      const response = await apiRequest("GET", `/api/admin/sessions?${params}`);
      return response.json() as Promise<{
        sessions: SessionWithMessages[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          itemsPerPage: number;
        };
      }>;
    },
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const sessions = sessionsData?.sessions || [];
  const pagination = sessionsData?.pagination;

  const { data: sessionDetails } = useQuery({
    queryKey: ["admin-session-details", selectedSession?.sessionId],
    queryFn: async () => {
      if (!selectedSession) return null;
      const response = await apiRequest("GET", `/api/admin/sessions/${selectedSession.sessionId}`);
      return response.json() as Promise<SessionWithMessages>;
    },
    enabled: !!selectedSession,
  });

  // Use sessions directly from API (already filtered and paginated)
  const paginatedSessions = sessions;
  const filteredSessions = sessions; // For backwards compatibility
  const totalPages = pagination?.totalPages || 1;

  // Reset to first page when filters change
  const resetToFirstPage = () => {
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Generate pagination buttons
  const getPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    
    if (totalPages <= maxButtons) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      // Show first, last, and pages around current
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          buttons.push(i);
        }
        buttons.push('...');
        buttons.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        buttons.push(1);
        buttons.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          buttons.push(i);
        }
      } else {
        buttons.push(1);
        buttons.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          buttons.push(i);
        }
        buttons.push('...');
        buttons.push(totalPages);
      }
    }
    
    return buttons;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUniqueUsers = () => {
    if (!sessions) return 0;
    
    // Count unique users by fingerprint (userId starting with 'fp_')
    // and fallback to username for old sessions without fingerprint
    const uniqueFingerprints = new Set();
    const uniqueUsernames = new Set();
    
    sessions.forEach(session => {
      if (session.userId.startsWith('fp_')) {
        // Modern fingerprint-based user ID
        uniqueFingerprints.add(session.userId);
      } else {
        // Legacy username-based tracking (fallback)
        uniqueUsernames.add(session.userName);
      }
    });
    
    return uniqueFingerprints.size + uniqueUsernames.size;
  };

  const getAverageDuration = () => {
    if (!sessions || sessions.length === 0) return "0m";
    
    const totalDuration = sessions.reduce((acc, session) => {
      const start = new Date(session.createdAt);
      // Use lastActivity instead of updatedAt for more accurate duration
      const end = new Date(session.lastActivity);
      const duration = end.getTime() - start.getTime();
      
      // Only count sessions with meaningful duration (at least 30 seconds)
      if (duration > 30000) {
        return acc + duration;
      }
      return acc;
    }, 0);
    
    // Count only sessions with meaningful activity
    const activeSessions = sessions.filter(session => {
      const start = new Date(session.createdAt);
      const end = new Date(session.lastActivity);
      return (end.getTime() - start.getTime()) > 30000;
    });
    
    if (activeSessions.length === 0) return "0m";
    
    const avgMinutes = Math.floor(totalDuration / (1000 * 60 * activeSessions.length));
    
    // Format better for display
    if (avgMinutes < 60) {
      return `${avgMinutes}m`;
    } else {
      const hours = Math.floor(avgMinutes / 60);
      const minutes = avgMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h1>
            <p className="text-gray-600">Access the AI DermoSense dashboard</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-gray-900"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-gray-900"
                required
              />
            </div>
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Sign In
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Test Credentials:</p>
            <p className="text-sm text-gray-600">Username: admin</p>
            <p className="text-sm text-gray-600">Password: password123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">AI DermoSense Conversation Management</p>
          </div>
          <div className="flex items-center space-x-4">
            {!isSelectionMode ? (
              <Button 
                onClick={toggleSelectionMode}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="h-4 w-4" />
                <span>Seleziona Chat</span>
              </Button>
            ) : (
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={selectAllSessions}
                  size="sm"
                  variant="outline"
                  className="text-gray-700"
                >
                  Seleziona Pagina
                </Button>
                <Button 
                  onClick={selectAllFiltered}
                  size="sm"
                  variant="outline"
                  className="text-gray-700"
                >
                  Seleziona Tutte ({filteredSessions.length})
                </Button>
                <Button 
                  onClick={deselectAllSessions}
                  size="sm"
                  variant="outline"
                  className="text-gray-700"
                >
                  Deseleziona Tutte
                </Button>
                <Button 
                  onClick={handleDownloadCSV}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                  disabled={selectedSessions.size === 0}
                >
                  <Download className="h-4 w-4" />
                  <span>Download CSV ({selectedSessions.size})</span>
                </Button>
                <Button 
                  onClick={toggleSelectionMode}
                  variant="outline"
                  className="text-gray-700"
                >
                  Annulla
                </Button>
              </div>
            )}
            <div className="flex items-center space-x-2 text-gray-700">
              <User className="h-4 w-4" />
              <span className="text-sm">Admin</span>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 border-gray-300"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="bg-white p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Conversations</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalSessions || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Today</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.todaySessions || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cream Access</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.finalButtonClicks || 0}</p>
                <p className="text-xs text-gray-500">Final button clicks</p>
              </div>
              <div className="p-3 bg-pink-100 rounded-lg">
                <Eye className="h-6 w-6 text-pink-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Unique Users</p>
                <p className="text-3xl font-bold text-gray-900">{getUniqueUsers()}</p>
                <p className="text-xs text-gray-500">Browser fingerprint tracking</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-white p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Duration</p>
                <p className="text-3xl font-bold text-gray-900">{getAverageDuration()}</p>
                <p className="text-xs text-gray-500">per conversation</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">Periodo:</span>
                <div className="relative">
                  <select 
                    value={selectedPeriod}
                    onChange={(e) => {
                      const value = e.target.value as PeriodType;
                      setSelectedPeriod(value);
                      setShowCustomPeriod(value === "Personalizzato");
                    }}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full px-3 py-2 appearance-none pr-8"
                  >
                    <option value="Tutto il tempo">Tutto il tempo</option>
                    <option value="Oggi">Oggi</option>
                    <option value="Ultima settimana">Ultima settimana</option>
                    <option value="Ultimo mese">Ultimo mese</option>
                    <option value="Personalizzato">Personalizzato</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cerca per nome utente, email, thread ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Custom Date Range */}
            {showCustomPeriod && (
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700">Da:</label>
                  <Input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="border-gray-300"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700">A:</label>
                  <Input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="border-gray-300"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <strong>{filteredSessions.length}</strong> conversazioni trovate
                </div>
              </div>
            )}

            {selectedPeriod !== "Personalizzato" && (
              <div className="text-sm text-gray-600">
                <strong>{filteredSessions.length}</strong> conversazioni trovate nel periodo selezionato
              </div>
            )}
          </div>
        </div>

        {/* Chat Detail Modal */}
        {selectedSession && sessionDetails && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedSession(null);
              }
            }}
          >
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Chat Details</h2>
                  <p className="text-gray-600">User: {sessionDetails.userName}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                  className="hover:bg-gray-100 border-gray-300 text-gray-600 hover:text-gray-900"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4 max-w-4xl mx-auto">
                  {sessionDetails.messages.map((message) => (
                    <div key={message.id} className="w-full">
                      <MessageBubble 
                        message={message}
                        userInitial={sessionDetails.userName?.charAt(0)?.toUpperCase() || 'U'}
                        onImageClick={setZoomedImage}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Zoom Modal */}
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-8"
            style={{ zIndex: 9999 }}
            onClick={() => setZoomedImage(null)}
          >
            <div className="relative">
              <img 
                src={zoomedImage} 
                alt="Immagine ingrandita" 
                style={{ 
                  maxWidth: '90vw', 
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  console.error('Errore caricamento immagine zoom:', e);
                }}
              />
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute -top-4 -right-4 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {/* Conversations Table */}
        <Card className="bg-white border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <p className="text-sm text-gray-600">All user conversations with AI DermoSense</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {isSelectionMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={paginatedSessions.length > 0 && paginatedSessions.every(s => selectedSessions.has(s.sessionId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllSessions();
                          } else {
                            // Deselect only current page sessions
                            const newSelected = new Set(selectedSessions);
                            paginatedSessions.forEach(s => newSelected.delete(s.sessionId));
                            setSelectedSessions(newSelected);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thread ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Fingerprint</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSessions.map((session) => (
                  <tr key={session.sessionId} className={`hover:bg-gray-50 ${selectedSessions.has(session.sessionId) ? 'bg-blue-50' : ''}`}>
                    {isSelectionMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.sessionId)}
                          onChange={() => toggleSessionSelection(session.sessionId)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{session.userName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div 
                        className="text-sm text-blue-600 font-mono cursor-pointer hover:text-blue-800 flex items-center group"
                        title={session.sessionId}
                        onClick={() => copyToClipboard(session.sessionId, "Thread ID")}
                      >
                        <span>{session.sessionId.substring(0, 12)}...</span>
                        <Copy className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div 
                        className="text-sm text-blue-600 font-mono cursor-pointer hover:text-blue-800 flex items-center group"
                        title={session.userId}
                        onClick={() => copyToClipboard(session.userId, "User Fingerprint")}
                      >
                        <span>{session.userId.substring(0, 12)}...</span>
                        <Copy className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(session.createdAt)} {formatTime(session.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(session.updatedAt)} {formatTime(session.updatedAt)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {session.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Updated</Badge>
                        ) : (
                          <Badge variant="secondary">Updated</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-blue-600 border-blue-600 hover:bg-blue-50 flex items-center space-x-1"
                          onClick={() => {
                            console.log('View clicked for session:', session.sessionId);
                            setSelectedSession(session);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 border-red-600 hover:bg-red-50 flex items-center space-x-1"
                          onClick={() => handleDeleteChat(session.sessionId, session.userName)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </Button>
                        {session.finalButtonClicked && (
                          <Badge className="bg-pink-100 text-pink-800 text-xs">
                            Cream Access
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredSessions.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna conversazione trovata</p>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredSessions.length > 0 && totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, pagination?.totalItems || 0)}</span> di{' '}
                    <span className="font-medium">{pagination?.totalItems || 0}</span> conversazioni
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="text-gray-500 border-gray-300 hover:bg-gray-100"
                  >
                    Precedente
                  </Button>
                  
                  {getPaginationButtons().map((page, index) => (
                    <Button
                      key={index}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => typeof page === 'number' && handlePageChange(page)}
                      disabled={page === '...'}
                      className={`min-w-[2.5rem] ${
                        currentPage === page 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'text-gray-500 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </Button>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="text-gray-500 border-gray-300 hover:bg-gray-100"
                  >
                    Successivo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}

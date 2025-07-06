
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage, ChatSession } from "@shared/schema";
import { Search, Users, MessageSquare, Calendar, Clock, Image, Brain, User, LogOut, BarChart3 } from "lucide-react";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("Tutto il tempo");

  // Check if user is already authenticated (simple localStorage check)
  useEffect(() => {
    const authStatus = localStorage.getItem('admin-authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple hardcoded login - in production use proper authentication
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

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats");
      return response.json() as Promise<AdminStats>;
    },
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/sessions");
      return response.json() as Promise<SessionWithMessages[]>;
    },
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const filteredSessions = sessions?.filter(session =>
    session.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.sessionId.includes(searchTerm)
  ) || [];

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
    const uniqueUsers = new Set(sessions.map(session => session.userName));
    return uniqueUsers.size;
  };

  const getAverageDuration = () => {
    if (!sessions || sessions.length === 0) return "0m";
    const totalDuration = sessions.reduce((acc, session) => {
      const start = new Date(session.createdAt);
      const end = new Date(session.updatedAt);
      return acc + (end.getTime() - start.getTime());
    }, 0);
    const avgMinutes = Math.floor(totalDuration / (1000 * 60 * sessions.length));
    return `${avgMinutes}m`;
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">AI DermoSense Conversation Management</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-700">
              <User className="h-4 w-4" />
              <span className="text-sm">Admin</span>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <p className="text-sm text-gray-600 mb-1">Unique Users</p>
                <p className="text-3xl font-bold text-gray-900">{getUniqueUsers()}</p>
                <p className="text-xs text-gray-500">Distinct direct Responses</p>
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">Periodo:</span>
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option>Tutto il tempo</option>
                <option>Oggi</option>
                <option>Ultima settimana</option>
                <option>Ultimo mese</option>
              </select>
            </div>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca per nome utente, email, thread ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thread ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Fingerprint</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSessions.map((session) => (
                  <tr key={session.sessionId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{session.userName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">
                        {session.sessionId.substring(0, 12)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">
                        {session.sessionId.substring(0, 12)}...
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
                      <Button variant="outline" size="sm" className="text-blue-600 border-blue-600 hover:bg-blue-50">
                        View Chat
                      </Button>
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
        </Card>
      </div>
    </div>
  );
}

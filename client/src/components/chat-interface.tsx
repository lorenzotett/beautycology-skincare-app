import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip } from "lucide-react";
import { ChatMessage } from "@shared/schema";

interface ChatResponse {
  content: string;
  hasChoices: boolean;
  choices?: string[];
}

interface ChatStartResponse {
  sessionId: string;
  message: ChatResponse;
}

interface ChatMessageResponse {
  message: ChatResponse;
}

export function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const startChatMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/chat/start", { userName: name });
      return response.json() as Promise<ChatStartResponse>;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setHasStarted(true);
      
      // Add the initial message
      const initialMessage: ChatMessage = {
        id: Date.now(),
        sessionId: data.sessionId,
        role: "assistant",
        content: data.message.content,
        metadata: {
          hasChoices: data.message.hasChoices,
          choices: data.message.choices,
        },
        createdAt: new Date(),
      };
      
      setMessages([initialMessage]);
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Impossibile avviare la chat. Riprova.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!sessionId) throw new Error("No session");
      
      const response = await apiRequest("POST", "/api/chat/message", {
        sessionId,
        message,
      });
      return response.json() as Promise<ChatMessageResponse>;
    },
    onSuccess: (data, variables) => {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now(),
        sessionId: sessionId!,
        role: "user",
        content: variables,
        metadata: null,
        createdAt: new Date(),
      };
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        sessionId: sessionId!,
        role: "assistant",
        content: data.message.content,
        metadata: {
          hasChoices: data.message.hasChoices,
          choices: data.message.choices,
        },
        createdAt: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      setIsTyping(false);
      toast({
        title: "Errore",
        description: "Impossibile inviare il messaggio. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleStartChat = () => {
    if (!userName.trim()) {
      toast({
        title: "Nome richiesto",
        description: "Inserisci il tuo nome per iniziare.",
        variant: "destructive",
      });
      return;
    }
    
    startChatMutation.mutate(userName.trim());
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !sessionId) return;
    
    setIsTyping(true);
    sendMessageMutation.mutate(currentMessage.trim());
    setCurrentMessage("");
  };

  const handleChoiceSelect = (choice: string) => {
    if (!sessionId) return;
    
    setIsTyping(true);
    sendMessageMutation.mutate(choice);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasStarted) {
        handleSendMessage();
      } else {
        handleStartChat();
      }
    }
  };

  if (!hasStarted) {
    return (
      <div className="chat-container flex flex-col">
        {/* Header */}
        <div className="bg-dark-secondary border-b border-dark-accent px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-assistant-msg rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">B</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Bonnie AI</h1>
              <p className="text-text-muted text-sm">Assistente Dermocosmetico</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-text-muted text-sm">Online</span>
          </div>
        </div>

        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="w-20 h-20 bg-assistant-msg rounded-full flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Benvenuto in Bonnie AI
              </h2>
              <p className="text-text-muted">
                Il tuo assistente dermocosmetico personale
              </p>
            </div>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Inserisci il tuo nome..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-dark-accent border-gray-600 text-white placeholder-text-muted"
              />
              <Button
                onClick={handleStartChat}
                disabled={startChatMutation.isPending || !userName.trim()}
                className="w-full bg-assistant-msg hover:bg-green-600 text-white"
              >
                {startChatMutation.isPending ? "Avvio..." : "Inizia Chat"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container flex flex-col">
      {/* Header */}
      <div className="bg-dark-secondary border-b border-dark-accent px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-assistant-msg rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">B</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Bonnie AI</h1>
            <p className="text-text-muted text-sm">Assistente Dermocosmetico</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-text-muted text-sm">Online</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-area flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onChoiceSelect={handleChoiceSelect}
          />
        ))}
        
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-dark-secondary border-t border-dark-accent p-4">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Scrivi un messaggio..."
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sendMessageMutation.isPending}
              className="bg-dark-accent border-gray-600 text-white placeholder-text-muted pr-12"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-white transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim() || sendMessageMutation.isPending}
            className="bg-assistant-msg hover:bg-green-600 text-white px-6"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-text-muted">
          Premi Invio per inviare • Shift + Invio per andare a capo
        </div>
      </div>
    </div>
  );
}

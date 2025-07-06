import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { useToast } from "../hooks/use-toast";
import { Camera, Upload, X } from "lucide-react";
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat/message", {
        sessionId,
        message,
      });
      return response.json() as Promise<ChatMessageResponse>;
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: Date.now(),
        sessionId: sessionId!,
        role: "assistant",
        content: data.message.content,
        metadata: {
          hasChoices: data.message.hasChoices,
          choices: data.message.choices,
        },
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
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
    if (!userName.trim()) return;
    startChatMutation.mutate(userName);
  };

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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File troppo grande",
          description: "L'immagine deve essere inferiore a 10MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Formato non valido",
          description: "Carica solo immagini (JPG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSendMessage = async () => {
    if ((!currentMessage.trim() && !selectedImage) || !sessionId || isTyping) return;

    const messageToSend = currentMessage.trim();
    const imageToSend = selectedImage;

    setCurrentMessage("");
    setSelectedImage(null);
    setImagePreview(null);
    setIsTyping(true);

    try {
      let response;

      if (imageToSend) {
        // Send image with FormData
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('image', imageToSend);
        if (messageToSend) {
          formData.append('message', messageToSend);
        }

        response = await fetch("/api/chat/message-with-image", {
          method: "POST",
          body: formData,
        });
      } else {
        // Send text message
        response = await fetch("/api/chat/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            message: messageToSend,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json() as ChatMessageResponse;

      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now(),
        sessionId: sessionId!,
        role: "user",
        content: messageToSend || (imageToSend ? "Immagine" : ""), // Show "Immagine" if only image sent
        metadata: imageToSend ? { image: imagePreview } : null, // Store image preview for display
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
    } catch (error) {
      setIsTyping(false);
      toast({
        title: "Errore",
        description: "Impossibile inviare il messaggio. Riprova.",
        variant: "destructive",
      });
    }
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
        <div className="bg-gradient-subtle border-b border-dark-accent px-6 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-skincare rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Bonnie AI</h1>
              <p className="text-skincare-primary text-sm font-medium">Assistente Dermocosmetico</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-skincare-primary rounded-full animate-pulse shadow-sm"></div>
            <span className="text-text-muted text-sm font-medium">Online</span>
          </div>
        </div>

        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-dark-primary via-dark-secondary to-dark-accent">
          <div className="max-w-lg w-full space-y-8 text-center">
            {/* Logo/Avatar */}
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-skincare rounded-full flex items-center justify-center mx-auto shadow-2xl">
                <span className="text-white font-bold text-3xl">B</span>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-skincare-primary rounded-full flex items-center justify-center shadow-lg">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
            
            {/* Welcome Text */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-text-muted bg-clip-text text-transparent">
                Benvenuto in Bonnie AI
              </h2>
              <p className="text-text-muted text-lg leading-relaxed">
                Il tuo assistente dermocosmetico personale.<br />
                <span className="text-skincare-primary font-medium">Analisi AI della pelle e consigli personalizzati</span>
              </p>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-3 gap-4 my-8">
              <div className="bg-dark-accent/50 backdrop-blur-sm rounded-lg p-4 border border-dark-accent">
                <div className="w-8 h-8 bg-skincare-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Camera className="w-4 h-4 text-skincare-primary" />
                </div>
                <p className="text-xs text-text-muted">Analisi Foto</p>
              </div>
              <div className="bg-dark-accent/50 backdrop-blur-sm rounded-lg p-4 border border-dark-accent">
                <div className="w-8 h-8 bg-skincare-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-skincare-primary text-sm">🧴</span>
                </div>
                <p className="text-xs text-text-muted">Consigli Prodotti</p>
              </div>
              <div className="bg-dark-accent/50 backdrop-blur-sm rounded-lg p-4 border border-dark-accent">
                <div className="w-8 h-8 bg-skincare-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-skincare-primary text-sm">✨</span>
                </div>
                <p className="text-xs text-text-muted">Routine Personale</p>
              </div>
            </div>
            
            {/* Input Form */}
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Inserisci il tuo nome per iniziare..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-dark-accent/50 backdrop-blur-sm border-dark-accent text-white placeholder-text-muted h-12 text-center text-lg font-medium rounded-xl"
              />
              <Button
                onClick={handleStartChat}
                disabled={startChatMutation.isPending || !userName.trim()}
                className="w-full bg-gradient-skincare hover:shadow-lg hover:scale-[1.02] text-white h-12 text-lg font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:transform-none"
              >
                {startChatMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Avvio...</span>
                  </div>
                ) : (
                  "Inizia Consulenza"
                )}
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
      <div className="bg-gradient-subtle border-b border-dark-accent px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-skincare rounded-full flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Bonnie AI</h1>
            <p className="text-skincare-primary text-sm font-medium">Assistente Dermocosmetico</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-skincare-primary rounded-full animate-pulse shadow-sm"></div>
          <span className="text-text-muted text-sm font-medium">Online</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-area flex-1 p-6 space-y-6 overflow-y-auto bg-gradient-to-b from-dark-primary/50 to-dark-secondary/30">
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
      <div className="bg-gradient-subtle border-t border-dark-accent p-6 shadow-2xl">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-6 p-4 bg-dark-accent/50 backdrop-blur-sm rounded-xl border border-dark-accent">
            <div className="relative inline-block">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-36 h-36 object-cover rounded-xl border-2 border-skincare-primary/30 shadow-lg"
              />
              <button
                onClick={removeImage}
                className="absolute -top-3 -right-3 bg-skincare-secondary hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <div className="w-2 h-2 bg-skincare-primary rounded-full animate-pulse"></div>
              <p className="text-sm text-skincare-primary font-medium">
                Foto pronta per l'analisi AI
              </p>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-3 items-end bg-dark-accent/30 backdrop-blur-sm rounded-2xl p-4 border border-dark-accent/50">
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              disabled={isTyping}
            />
            <label
              htmlFor="image-upload"
              className={`p-3 rounded-xl border-2 border-skincare-primary/30 text-skincare-primary hover:text-white hover:bg-skincare-primary hover:border-skincare-primary transition-all duration-300 cursor-pointer shadow-lg ${isTyping ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            >
              <Camera size={20} />
            </label>
          </div>

          <Input
            type="text"
            placeholder={selectedImage ? "Aggiungi un messaggio (opzionale)..." : "Descrivi il tuo problema o carica una foto..."}
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 bg-dark-secondary/50 backdrop-blur-sm border-dark-accent/50 text-white placeholder:text-text-muted rounded-xl h-12 px-4 focus:border-skincare-primary focus:ring-2 focus:ring-skincare-primary/20 transition-all duration-300"
            disabled={isTyping}
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!currentMessage.trim() && !selectedImage) || isTyping}
            className="bg-gradient-skincare hover:shadow-lg hover:scale-105 text-white px-6 h-12 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:transform-none"
          >
            {isTyping ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Invia"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
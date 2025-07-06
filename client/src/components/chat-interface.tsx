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
import { Paperclip, Upload, X } from "lucide-react";
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
  const [typingMessage, setTypingMessage] = useState("Bonnie sta scrivendo");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [answeredMessageIds, setAnsweredMessageIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Email validation function
  const validateEmail = (email: string): { isValid: boolean; errorMessage?: string } => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) return { isValid: true }; // Allow empty while typing
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmedEmail)) {
      return {
        isValid: false,
        errorMessage: "Formato email non valido (es. nome@example.com)"
      };
    }
    
    if (trimmedEmail.length < 5) {
      return {
        isValid: false,
        errorMessage: "Email troppo corta"
      };
    }
    
    if (trimmedEmail.includes('..')) {
      return {
        isValid: false,
        errorMessage: "Email contiene caratteri non validi"
      };
    }
    
    return { isValid: true };
  };

  // Check if we're expecting an email (more specific check)
  const isEmailContext = (): boolean => {
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === "assistant");
    
    if (!lastAssistantMessage) return false;
    
    // Only consider it email context if the message explicitly asks for email
    const emailRequest = lastAssistantMessage.content.toLowerCase();
    return emailRequest.includes("per inviarti la routine personalizzata") ||
           emailRequest.includes("potresti condividere la tua email") ||
           emailRequest.includes("condividi la tua email") ||
           (emailRequest.includes("email") && emailRequest.includes("?"));
  };

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

    // Check for email validation error before sending
    if (isEmailContext() && currentMessage.trim()) {
      const validation = validateEmail(currentMessage.trim());
      if (!validation.isValid) {
        // Don't send the message if email is invalid
        return;
      }
    }

    const messageToSend = currentMessage.trim();
    const imageToSend = selectedImage;

    setCurrentMessage("");
    setSelectedImage(null);
    setImagePreview(null);
    setEmailError(null); // Clear any email errors when sending
    setIsTyping(true);

    // Set up appropriate typing message based on whether there's an image
    let messageRotation: NodeJS.Timeout | null = null;
    
    if (imageToSend) {
      const analysisMessages = [
        "Sto analizzando la tua immagine...",
        "Analizzo i dettagli della tua pelle...",
        "Ancora un momento...",
        "Sto elaborando l'analisi AI...",
        "Quasi fatto, analizzo gli ultimi dettagli..."
      ];
      
      let messageIndex = 0;
      setTypingMessage(analysisMessages[0]);
      
      messageRotation = setInterval(() => {
        messageIndex = (messageIndex + 1) % analysisMessages.length;
        setTypingMessage(analysisMessages[messageIndex]);
      }, 3000); // Change message every 3 seconds
    } else {
      setTypingMessage("AI-DermaSense sta scrivendo");
    }

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
      setTypingMessage("AI-DermaSense sta scrivendo"); // Reset to default message
      
      // Clear rotation interval if it exists
      if (messageRotation) {
        clearInterval(messageRotation);
      }
    } catch (error) {
      setIsTyping(false);
      setTypingMessage("AI-DermaSense sta scrivendo"); // Reset to default message
      
      // Clear rotation interval if it exists
      if (messageRotation) {
        clearInterval(messageRotation);
      }
      toast({
        title: "Errore",
        description: "Impossibile inviare il messaggio. Riprova.",
        variant: "destructive",
      });
    }
  };


  const handleChoiceSelect = (choice: string, messageId: number) => {
    if (!sessionId) return;

    // Mark this message as answered
    setAnsweredMessageIds(prev => new Set(prev).add(messageId));

    // Add the user's choice to the chat immediately
    const userMessage: ChatMessage = {
      id: Date.now(),
      sessionId: sessionId!,
      role: "user",
      content: choice,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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
              <h1 className="text-lg font-semibold text-white text-left">AI-DermaSense</h1>
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
              <h2 className="text-2xl text-white mb-2 font-black">Benvenuto in AI-DermaSense</h2>
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
            onChoiceSelect={(choice) => handleChoiceSelect(choice, message.id!)}
            isAnswered={answeredMessageIds.has(message.id!)}
          />
        ))}

        {isTyping && <TypingIndicator message={typingMessage} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-dark-secondary border-t border-dark-accent p-4">
        <div className="border-t border-dark-accent">
            {/* Image Preview */}
            {imagePreview && (
              <div className="p-4 border-b border-dark-accent">
                <div className="relative inline-block">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-32 h-32 object-cover rounded-lg border border-dark-accent"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-text-muted mt-2">
                  Foto pronta per l'analisi AI
                </p>
              </div>
            )}

            {/* Message Input */}
            <div className="flex gap-2 p-4">
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
                  className={`p-2 rounded-lg border border-dark-accent text-text-muted hover:text-white hover:bg-dark-accent transition-colors cursor-pointer ${isTyping ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Paperclip size={20} />
                </label>
              </div>

              <div className="flex-1">
                <Input
                  type="text"
                  placeholder={selectedImage ? "Aggiungi un messaggio (opzionale)..." : "Scrivi un messaggio o carica una foto..."}
                  value={currentMessage}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setCurrentMessage(newValue);
                    
                    // Validate email in real-time if we're in email context
                    if (isEmailContext() && newValue.trim()) {
                      const validation = validateEmail(newValue);
                      setEmailError(validation.isValid ? null : validation.errorMessage || null);
                    } else {
                      setEmailError(null);
                    }
                  }}
                  onKeyPress={(e) => e.key === "Enter" && !(emailError && isEmailContext()) && handleSendMessage()}
                  className={`bg-dark-secondary border-dark-accent text-white placeholder:text-text-muted ${emailError ? 'border-red-500' : ''}`}
                  disabled={isTyping}
                />
                {emailError && (
                  <p className="text-red-400 text-xs mt-1 px-1">
                    {emailError}
                  </p>
                )}
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={(!currentMessage.trim() && !selectedImage) || isTyping || (emailError !== null && isEmailContext())}
                className="bg-assistant-msg hover:bg-assistant-msg/80 text-white"
              >
                Invia
              </Button>
            </div>
          </div>
        <div className="mt-2 text-xs text-text-muted">
          Premi Invio per inviare • Shift + Invio per andare a capo
        </div>
      </div>
    </div>
  );
}
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
    const isEmailRequest = emailRequest.includes("per inviarti la routine personalizzata") ||
           emailRequest.includes("potresti condividere la tua email") ||
           emailRequest.includes("condividi la tua email") ||
           (emailRequest.includes("email") && emailRequest.includes("?"));

    // Check if we already have sent a valid email by looking at user messages after the email request
    if (isEmailRequest) {
      const lastAssistantIndex = messages.lastIndexOf(lastAssistantMessage);
      const userMessagesAfterEmail = messages.slice(lastAssistantIndex + 1).filter(msg => msg.role === "user");

      // If there's a user message after the email request, check if it's a valid email
      if (userMessagesAfterEmail.length > 0) {
        const lastUserMessage = userMessagesAfterEmail[userMessagesAfterEmail.length - 1];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(lastUserMessage.content.trim())) {
          return false; // Valid email already sent, no longer in email context
        }
      }
    }

    return isEmailRequest;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

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
          hasChoices: data.message.hasChoices || false,
          choices: data.message.choices || [],
        },
        createdAt: new Date(),
      };

      // Debug log to verify choices are being set
      console.log('Assistant message choices:', data.message.choices);
      console.log('Assistant message hasChoices:', data.message.hasChoices);
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
          hasChoices: data.message.hasChoices || false,
          choices: data.message.choices || [],
        },
        createdAt: new Date(),
      };

      // Debug log for initial message
      console.log('Initial message choices:', data.message.choices);
      console.log('Initial message hasChoices:', data.message.hasChoices);

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

      const allowedTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/heic',
        'image/heif',
        'image/avif'
      ];

      const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.avif'];

      if (!file.type.startsWith('image/') && !allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        toast({
          title: "Formato non valido",
          description: "Carica solo immagini (JPG, PNG, GIF, WebP, HEIC, HEIF, AVIF)",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);

      // Check if it's a HEIC/HEIF file and convert for preview
      const isHEIC = fileExtension === '.heic' || fileExtension === '.heif' || 
                     file.type === 'image/heic' || file.type === 'image/heif';

      if (isHEIC) {
        // Per i file HEIC, mostra sempre un placeholder con icona camera
        const placeholderSvg = `data:image/svg+xml;base64,${btoa(`
          <svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="128" fill="#374151" rx="8"/>
            <circle cx="64" cy="64" r="30" fill="#6B7280"/>
            <circle cx="64" cy="64" r="20" fill="#9CA3AF"/>
            <circle cx="64" cy="64" r="6" fill="#374151"/>
            <rect x="45" y="45" width="8" height="6" fill="#9CA3AF" rx="2"/>
            <text x="64" y="100" font-family="Arial" font-size="10" fill="#D1D5DB" text-anchor="middle">HEIC</text>
          </svg>
        `)}`;
        setImagePreview(placeholderSvg);
      } else {
        // For other formats, use regular FileReader
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = () => {
    // Cleanup object URL if it exists
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
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
        content: messageToSend || (imageToSend ? "📷 Immagine caricata" : ""),
        metadata: imageToSend ? { 
          image: imagePreview,
          hasImage: true,
          imageName: imageToSend.name 
        } : null,
        createdAt: new Date(),
      };

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        sessionId: sessionId!,
        role: "assistant",
        content: data.message.content,
        metadata: {
          hasChoices: data.message.hasChoices || false,
          choices: data.message.choices || [],
        },
        createdAt: new Date(),
      };

      // Debug log for message with image
      console.log('Send message response choices:', data.message.choices);
      console.log('Send message response hasChoices:', data.message.hasChoices);

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
      metadata: null,
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
      <div className="chat-container flex flex-col h-screen">
        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          <div className="max-w-lg w-full space-y-8 text-center bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
            {/* Logo Bonnie */}
            <div className="space-y-2">
              <img 
                src="/attached_assets/Copia di 2022_Bonnie_Logo_Tavola disegno 1 (1)_1751893472367.png" 
                alt="Bonnie Logo" 
                className="w-16 h-16 mx-auto object-contain"
              />
              <div className="text-xl font-medium text-gray-700 tracking-wide">AI-DermaSense</div>
            </div>

            {/* Hero Image */}
            <div className="relative mx-auto w-80 h-80 rounded-2xl overflow-hidden shadow-lg">
              <img 
                src="/attached_assets/Mockup image_1751894588863.png" 
                alt="Analizza la tua pelle" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient background if image doesn't load
                  e.currentTarget.style.background = 'linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)';
                }}
              />
            </div>

            {/* Welcome Text */}
            <div className="space-y-4 text-gray-700">
              <p className="text-lg leading-relaxed">
                Ciao! Sono <strong>Bonnie</strong>, la tua <strong>Skin Expert</strong> di fiducia. 
                Possiamo analizzare insieme la tua pelle per trovare la formula 
                skincare perfetta per migliorarla!
              </p>
              <p className="text-base font-medium">
                Per iniziare, scrivi qui sotto il tuo nome.
              </p>
            </div>

            {/* Input Section */}
            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-full">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  
                  <input
                    type="text"
                    placeholder="Il tuo nome"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 bg-transparent border-none text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  />
                  
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
                    <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h4v1h-7v2h6c1.66 0 3-1.34 3-3V10c0-4.97-4.03-9-9-9z"/>
                  </svg>
                  
                  <button
                    onClick={handleStartChat}
                    disabled={startChatMutation.isPending || !userName.trim()}
                    className="text-white p-2 rounded-full disabled:opacity-50"
                    style={{backgroundColor: '#007381'}}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container flex flex-col h-screen">
      {/* Chat Area Container - Same size as welcome screen */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col" style={{minHeight: "calc(100vh - 8rem)"}}>
          {/* Messages Area */}
          <div className="messages-area flex-1 p-4 space-y-4 overflow-y-auto" style={{backgroundColor: '#DEEDE9'}}>
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
          <div className="p-4 rounded-b-3xl">
        {/* Image Preview */}
        {(imagePreview || selectedImage) && (
          <div className="p-4 border-b border-gray-200">
                <div className="relative inline-block">
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-32 h-32 object-cover rounded-lg border border-dark-accent"
                      onError={(e) => {
                        // Se l'immagine non carica, mostra un placeholder
                        e.currentTarget.style.display = 'none';
                        const placeholder = e.currentTarget.nextSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                    />
                  ) : null}

                  {/* Fallback placeholder sempre presente ma nascosto */}
                  <div 
                    className="w-32 h-32 bg-dark-accent rounded-lg border border-dark-accent flex flex-col items-center justify-center"
                    style={{ display: imagePreview ? 'none' : 'flex' }}
                  >
                    <Upload size={24} className="text-text-muted mb-1" />
                    <span className="text-xs text-text-muted text-center px-2">
                      {selectedImage?.name || "File caricato"}
                    </span>
                  </div>

                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 z-10"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-text-muted mt-2">
                  {selectedImage?.name && (selectedImage.name.toLowerCase().includes('.heic') || selectedImage.name.toLowerCase().includes('.heif'))
                    ? `📷 File iPhone: ${selectedImage.name}` 
                    : "📷 Foto pronta per l'analisi AI"
                  }
                </p>
              </div>
            )}

        {/* Message Input */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-full mx-4 mb-4">
          <input
            type="file"
            accept="image/*,.heic,.heif,.avif"
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload"
            disabled={isTyping}
          />
          <label
            htmlFor="image-upload"
            className={`text-gray-500 hover:text-gray-700 cursor-pointer ${isTyping ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Paperclip size={20} />
          </label>

          <div className="flex-1">
            <Input
              type="text"
              placeholder={selectedImage ? "Aggiungi un messaggio (opzionale)..." : "Il tuo nome"}
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
              className={`bg-transparent border-none text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0 ${emailError ? 'border-red-500' : ''}`}
              disabled={isTyping}
            />
            {emailError && (
              <p className="text-red-400 text-xs mt-1 px-1">
                {emailError}
              </p>
            )}
          </div>

          <button className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h4v1h-7v2h6c1.66 0 3-1.34 3-3V10c0-4.97-4.03-9-9-9z"/>
            </svg>
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={(!currentMessage.trim() && !selectedImage) || isTyping || (emailError !== null && isEmailContext())}
            className="text-white p-2 rounded-full disabled:opacity-50"
            style={{backgroundColor: '#007381'}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
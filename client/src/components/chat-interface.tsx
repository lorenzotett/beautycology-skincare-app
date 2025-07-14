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
import { Paperclip, Upload, X, Mic, MicOff } from "lucide-react";
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
  imageUrl?: string; // Add the imageUrl property
}

export function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState("AI-DermaSense sta scrivendo");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [answeredMessageIds, setAnsweredMessageIds] = useState<Set<number>>(new Set());
  const [userInitial, setUserInitial] = useState<string>("U");
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognition = useRef<SpeechRecognition | null>(null);

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
    // If email was already sent, never show as email context
    if (emailSent) return false;

    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === "assistant");

    if (!lastAssistantMessage) return false;

    // Only consider it email context if the message explicitly asks for email
    const emailRequest = lastAssistantMessage.content.toLowerCase();
    const isEmailRequest = emailRequest.includes("per inviarti la routine personalizzata") ||
           emailRequest.includes("potresti condividere la tua email") ||
           emailRequest.includes("potresti condividere la tua mail") ||
           emailRequest.includes("condividi la tua email") ||
           emailRequest.includes("condividi la tua mail") ||
           (emailRequest.includes("email") && emailRequest.includes("?")) ||
           (emailRequest.includes("mail") && emailRequest.includes("?"));

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

    // Show chat interface immediately
    setHasStarted(true);
    setIsTyping(true);
    setTypingMessage("AI-DermaSense sta scrivendo");
    setUserInitial(userName.charAt(0).toUpperCase());

    // Add user's name as first message immediately
    const userNameMessage: ChatMessage = {
      id: Date.now(),
      sessionId: "temp", // Will be updated when session is created
      role: "user",
      content: userName.trim(),
      metadata: null,
      createdAt: new Date(),
    };

    setMessages([userNameMessage]);

    startChatMutation.mutate(userName);
  };

  const startChatMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/chat/start", { userName: name });
      return response.json() as Promise<ChatStartResponse>;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setIsTyping(false);

      // Extract user initial from Gemini's corrected name
      const content = data.message.content;
      const nameMatch = content.match(/Ciao,?\s+([A-Za-zÀ-ÿ]+)/i);
      if (nameMatch && nameMatch[1]) {
        const correctedName = nameMatch[1];
        setUserInitial(correctedName.charAt(0).toUpperCase());
      }

      // Add the bot's response after the user's name
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

      // Update the existing user message with correct sessionId and add bot response
      setMessages(prev => {
        const updatedUserMessage = { ...prev[0], sessionId: data.sessionId };
        return [updatedUserMessage, initialMessage];
      });
    },
    onError: (error) => {
      setIsTyping(false);
      setHasStarted(false); // Go back to name input if error
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

      setCurrentMessage(''); // Clear message when image is selected

      // Check if it's a HEIC/HEIF file and convert for preview AND upload
      const isHEIC = fileExtension === '.heic' || fileExtension === '.heif' || 
                     file.type === 'image/heic' || file.type === 'image/heif';

      if (isHEIC) {
        try {
          // Convert HEIC to JPEG for both preview and upload
          const heic2any = await import('heic2any');
          const convertedBlob = await heic2any.default({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8
          });

          const blobArray = Array.isArray(convertedBlob) ? convertedBlob : [convertedBlob];
          const jpegBlob = blobArray[0] as Blob;
          
          // Create a new File object from the converted blob with .jpg extension
          const convertedFile = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg',
            lastModified: file.lastModified
          });
          
          // Set the converted file as selected image
          setSelectedImage(convertedFile);
          
          // Set preview
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(jpegBlob);
          
          console.log('✅ HEIC converted successfully to:', convertedFile.name);
        } catch (error) {
          console.error('Error converting HEIC:', error);
          // Fallback: use original HEIC file and let server handle it
          console.log('⚠️ HEIC conversion failed, using original file');
          setSelectedImage(file);
          
          // Create a placeholder preview for HEIC files
          const placeholderSvg = `data:image/svg+xml,${encodeURIComponent(`
            <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
              <rect width="200" height="150" fill="#f3f4f6"/>
              <text x="100" y="75" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">
                📸 Immagine HEIC
              </text>
              <text x="100" y="95" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="12">
                ${file.name}
              </text>
            </svg>
          `)}`;
          setImagePreview(placeholderSvg);
        }
      } else {
        // For other formats, set the original file and create preview
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
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
      // Mark email as sent if we're in email context and email is valid
      setEmailSent(true);
    }

    const messageToSend = currentMessage.trim();
    const imageToSend = selectedImage;

    // Add user message immediately to chat (with temporary blob URL for immediate preview)
    const userMessageId = Date.now();
    const userMessage: ChatMessage = {
      id: userMessageId,
      sessionId: sessionId!,
      role: "user",
      content: messageToSend || (imageToSend ? "📷 Immagine caricata" : ""),
      metadata: imageToSend ? { 
        image: imagePreview, // Temporary blob URL for immediate preview
        hasImage: true,
        imageName: imageToSend.name 
      } : null,
      createdAt: new Date(),
    };



    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage("");
    setSelectedImage(null);
    setImagePreview(null);
    setEmailError(null); // Clear any email errors when sending
    setIsTyping(true);

    // Set up appropriate typing message based on whether there's an image
    let messageRotation: NodeJS.Timeout | null = null;

    if (imageToSend) {
      const analysisMessages = [
        "Sto analizzando la tua foto...",
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

      // If we sent an image, update the user message with the correct image URL
      if (imageToSend && data.imageUrl) {
        console.log('🔄 Updating user message with server image URL:', data.imageUrl);
        
        // Update the message immediately with the server URL
        setMessages(prev => {
          const updatedMessages = prev.map(msg => {
            if (msg.id === userMessageId && msg.role === "user") {
              const updatedMsg = {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  image: data.imageUrl, // Use the URL returned from the server
                  hasImage: true,
                  imageOriginalName: imageToSend.name
                }
              };
              console.log('✅ Updated user message:', { id: msg.id, newUrl: data.imageUrl });
              return updatedMsg;
            }
            return msg;
          });
          return updatedMessages;
        });
        
        // Force a complete re-render by updating the state
        setTimeout(() => {
          setMessages(prev => [...prev]);
        }, 200);
      }

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

      setMessages(prev => [...prev, assistantMessage]);
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

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      console.log("Speech Recognition Not Available");
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechRecog = new SpeechRecognition();
    
    speechRecog.continuous = false;
    speechRecog.interimResults = true;
    speechRecog.lang = "it-IT";
    speechRecog.maxAlternatives = 1;
    
    let finalTranscript = "";
    let isRecognitionActive = false;
    
    speechRecog.onresult = (event) => {
      let interimTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      setCurrentMessage(finalTranscript + interimTranscript);
    };
    
    speechRecog.onstart = () => {
      console.log("Voice recognition started");
      isRecognitionActive = true;
      setIsListening(true);
    };
    
    speechRecog.onend = () => {
      console.log("Voice recognition ended");
      isRecognitionActive = false;
      setIsListening(false);
      
      if (finalTranscript.trim()) {
        setCurrentMessage(finalTranscript.trim());
      }
      
      finalTranscript = "";
    };
    
    speechRecog.onerror = (event) => {
      console.log("Speech recognition error:", event.error);
      isRecognitionActive = false;
      setIsListening(false);
      
      // Previeni loop: non fermare di nuovo se già fermato
      if (event.error !== 'aborted') {
        try {
          speechRecog.stop();
        } catch (e) {
          // Ignora errori di stop multipli
        }
      }
      
      // Non mostrare toast per errori di abort (causati da stop manuale)
      if (event.error === 'aborted') {
        console.log("Recognition aborted by user");
        return;
      }
      
      switch (event.error) {
        case 'no-speech':
          toast({
            title: "Nessun audio rilevato",
            description: "Prova a parlare più chiaramente vicino al microfono.",
            variant: "destructive",
          });
          break;
        case 'network':
          toast({
            title: "Errore di connessione",
            description: "Il riconoscimento vocale richiede una connessione internet. Verifica la connessione e riprova.",
            variant: "destructive",
          });
          break;
        case 'not-allowed':
          toast({
            title: "Permessi microfono",
            description: "Abilita i permessi del microfono nelle impostazioni del browser.",
            variant: "destructive",
          });
          break;
        case 'service-not-allowed':
          toast({
            title: "Servizio non disponibile",
            description: "Il riconoscimento vocale non è disponibile. Riprova più tardi.",
            variant: "destructive",
          });
          break;
        default:
          toast({
            title: "Errore riconoscimento vocale",
            description: `Si è verificato un errore (${event.error}). Riprova.`,
            variant: "destructive",
          });
      }
    };
    
    recognition.current = speechRecog;
    
    // Cleanup function per assicurarsi che il riconoscimento sia fermato al unmount
    return () => {
      if (speechRecog) {
        try {
          speechRecog.stop();
        } catch (e) {
          // Ignora errori di cleanup
        }
      }
    };
  }, [toast]);

  const toggleVoiceRecognition = () => {
    if (!recognition.current) {
      toast({
        title: "Riconoscimento vocale non disponibile",
        description: "Il tuo browser non supporta il riconoscimento vocale.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      try {
        recognition.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      setIsListening(false);
    } else {
      try {
        // Verifica la connessione internet prima di iniziare
        if (!navigator.onLine) {
          toast({
            title: "Nessuna connessione",
            description: "Il riconoscimento vocale richiede una connessione internet.",
            variant: "destructive",
          });
          return;
        }
        
        recognition.current.start();
      } catch (error: any) {
        console.error('Error starting recognition:', error);
        setIsListening(false);
        
        if (error.name === 'InvalidStateError') {
          toast({
            title: "Servizio occupato",
            description: "Il riconoscimento vocale è già in uso. Attendi un momento e riprova.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore",
            description: "Impossibile avviare il riconoscimento vocale. Riprova.",
            variant: "destructive",
          });
        }
      }
    }
  };

  if (!hasStarted) {
    return (
      <div className="chat-container flex flex-col h-screen" style={{backgroundColor: '#E5F1F2'}}>
        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center" style={{backgroundColor: '#E5F1F2', height: '100vh', minHeight: '100vh', width: '100vw', minWidth: '100vw', padding: '0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
          <div className="desktop-wide w-full flex flex-col justify-center text-center p-4 sm:p-6 md:p-8" style={{backgroundColor: '#E5F1F2', height: '100vh', minHeight: '100vh', width: '100vw', minWidth: '100vw'}}>
            {/* Logo Bonnie */}
            <div className="space-y-2 mb-6">
              <img 
                src="/attached_assets/Copia di 2022_Bonnie_Logo_Tavola disegno 1 (1)_1751893472367.png" 
                alt="Bonnie Logo" 
                className="w-12 h-12 mx-auto object-contain"
              />
              <div className="dermaSense-title text-lg sm:text-xl md:text-2xl text-black tracking-wide font-bold">AI-DermaSense</div>
            </div>

            {/* Hero Image */}
            <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-2xl overflow-hidden shadow-lg mb-6">
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
            <div className="space-y-3 text-gray-700 px-2 mb-6">
              <p className="text-sm sm:text-base md:text-lg leading-relaxed">
                Ciao! Sono la tua <strong>Skin Expert</strong> di <strong>Bonnie</strong>. 
                Possiamo analizzare insieme la tua pelle per trovare la formula 
                skincare perfetta per <strong>migliorarla</strong>!
              </p>
              <p className="text-sm sm:text-base md:text-lg font-medium">
                Per iniziare, scrivi qui sotto il tuo nome.
              </p>
            </div>

            {/* Input Section - Centered and properly styled */}
            <div className="flex items-center gap-2 px-3 py-3 bg-white rounded-lg shadow-md border border-gray-200">
              <input
                type="text"
                placeholder="Il tuo nome"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-transparent border-none text-gray-700 placeholder:text-gray-400 focus:outline-none text-base"
              />
              <button
                onClick={toggleVoiceRecognition}
                disabled={isTyping || selectedImage}
                className={`p-2 rounded-md transition-all duration-200 transform ${
                  isListening 
                    ? 'text-white shadow-lg scale-105 animate-pulse' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-95'
                } ${isTyping || selectedImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={isListening ? {backgroundColor: '#007381'} : {}}
                title={isListening ? "Ferma registrazione" : "Inizia registrazione vocale"}
              >
                {isListening ? (
                  <MicOff size={16} />
                ) : (
                  <Mic size={16} />
                )}
              </button>

              <button
                onClick={handleStartChat}
                disabled={startChatMutation.isPending || !userName.trim()}
                className="text-white p-1.5 rounded-md disabled:opacity-50"
                style={{backgroundColor: '#007381'}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container chat-mode flex flex-col h-screen">
      {/* Chat Area Container - Responsive design */}
      <div className="flex-1 flex items-center justify-center" style={{backgroundColor: '#E5F1F2', padding: '0', minHeight: '100vh'}}>
        <div className="desktop-wide w-full flex flex-col" style={{height: "100vh", minHeight: "100vh", maxHeight: "100vh", backgroundColor: '#E5F1F2'}}>
          {/* Header with Logo */}
          <div className="p-4 flex items-center justify-between">
            <img 
              src="/attached_assets/Copia di 2022_Bonnie_Logo_Tavola disegno 1 (1)_1751893472367.png" 
              alt="Bonnie Logo" 
              className="w-8 h-8 object-cover"
            />
            <h1 className="dermaSense-title font-bold" style={{color: '#007381', fontSize: '14px'}}>
              AI-DermaSense
            </h1>
          </div>
          {/* Messages Area */}
          <div className="messages-area flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden" style={{WebkitOverflowScrolling: "touch", paddingBottom: "75px"}}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onChoiceSelect={(choice) => handleChoiceSelect(choice, message.id!)}
                isAnswered={answeredMessageIds.has(message.id!)}
                userInitial={userInitial}
              />
            ))}

            {isTyping && <TypingIndicator message={typingMessage} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 rounded-b-3xl flex-shrink-0">


            {/* Image Preview in Input Area */}
            {selectedImage && imagePreview && (
              <div className="mb-2 relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Anteprima immagine" 
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => {
                    // Cleanup object URL if it exists
                    if (imagePreview && imagePreview.startsWith('blob:')) {
                      URL.revokeObjectURL(imagePreview);
                    }
                    setSelectedImage(null);
                    setImagePreview(null);
                    setCurrentMessage(''); // Clear message when image is removed
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 z-10"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {/* Message Input - Match screenshot style */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100">
              <input
                type="file"
                accept="image/*,.heic,.heif,.avif"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isTyping}
              />

              <div className="flex-1">
                <input
                  type="text"
                  placeholder={selectedImage ? "Invia l'immagine" : "Scrivi il tuo messaggio..."}
                  value={selectedImage ? "" : currentMessage}
                  onChange={(e) => {
                    if (selectedImage) return; // Disable input when image is selected

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
                  className={`w-full bg-transparent border-none text-gray-700 placeholder:text-gray-400 focus:outline-none text-base ${emailError ? 'border-red-500' : ''} ${selectedImage ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={isTyping || selectedImage}
                />
                {emailError && (
                  <p className="text-red-400 text-xs mt-1 px-1">
                    {emailError}
                  </p>
                )}
              </div>

              <label
                htmlFor="image-upload"
                className={`text-gray-400 hover:text-gray-600 cursor-pointer p-2 rounded-md transition-all duration-200 ${isTyping ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Paperclip size={16} />
              </label>

              <button
                onClick={toggleVoiceRecognition}
                disabled={isTyping || selectedImage}
                className={`p-2 rounded-md transition-all duration-200 transform ${
                  isListening 
                    ? 'text-white shadow-lg scale-105 animate-pulse' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-95'
                } ${isTyping || selectedImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={isListening ? {backgroundColor: '#007381'} : {}}
                title={isListening ? "Ferma registrazione" : "Inizia registrazione vocale"}
              >
                {isListening ? (
                  <MicOff size={16} />
                ) : (
                  <Mic size={16} />
                )}
              </button>

              <button
                onClick={handleSendMessage}
                disabled={(!currentMessage.trim() && !selectedImage) || isTyping || (emailError !== null && isEmailContext())}
                className="text-white p-1.5 rounded-md disabled:opacity-50"
                style={{backgroundColor: '#007381'}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
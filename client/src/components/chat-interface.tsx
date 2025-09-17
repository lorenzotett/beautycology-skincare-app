import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { BeforeAfterImages } from "./before-after-images";
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
}

export function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState("Sta scrivendo");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [answeredMessageIds, setAnsweredMessageIds] = useState<Set<number>>(new Set());
  const [userInitial, setUserInitial] = useState<string>("U");
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognition = useRef<any>(null);
  const [isFromIframe, setIsFromIframe] = useState(false);
  const [beforeAfterImages, setBeforeAfterImages] = useState<{beforeImage: string; afterImage: string; ingredients: string[]} | null>(null);
  const [pendingIngredients, setPendingIngredients] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Check for session parameters on load (iframe or new tab)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionUserName = urlParams.get('userName');
    const source = urlParams.get('source');
    const fingerprint = urlParams.get('fingerprint');
    
    if (sessionUserName && (source === 'shopify_iframe' || source === 'homepage_new_tab')) {
      console.log('🔗 Auto-starting session from:', { source, userName: sessionUserName, fingerprint });
      setUserName(sessionUserName);
      setUserInitial(sessionUserName.charAt(0).toUpperCase());
      
      if (source === 'shopify_iframe') {
        setIsFromIframe(true);
      }
      
      // Auto-start the session
      startChatSession(sessionUserName, fingerprint);
      
      // Clean URL to remove parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Track "view chat" when user sees the welcome screen
      trackViewChat();
    }
  }, []);

  // Track chat view - will be called when user sees welcome screen
  const trackViewChat = async () => {
    try {
      // Generate a unique session ID for tracking the view
      const viewSessionId = 'view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      
      // Create a browser fingerprint for better tracking
      const fingerprint = navigator.userAgent + screen.width + screen.height + navigator.language;
      const fingerprintHash = fingerprint.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      
      await apiRequest("POST", "/api/tracking/view", {
        sessionId: viewSessionId,
        fingerprint: fingerprintHash
      });
      
      console.log("Chat view tracked - welcome screen displayed");
    } catch (error) {
      console.error("Failed to track chat view:", error);
    }
  };

  // Track chat start (when user submits name and actually starts chat)
  const trackChatStart = async (sessionId: string) => {
    try {
      await apiRequest("POST", "/api/tracking/start", {
        sessionId
      });
    } catch (error) {
      console.error("Failed to track chat start:", error);
    }
  };

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
      
      // Extract ingredients from metadata for tracking
      const ingredientsMatch = data.message.content.match(/\[METADATA:INGREDIENTS_PROVIDED:([^\]]+)\]/);
      if (ingredientsMatch && ingredientsMatch[1].trim()) {
        const ingredients = ingredientsMatch[1].split(',').map(i => i.trim());
        setPendingIngredients(ingredients);
        console.log('Extracted ingredients from metadata:', ingredients);
      }
      
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

  // Helper function for starting chat (can be called from iframe params or manual)
  const startChatSession = (name: string, fingerprint?: string | null) => {
    // Show chat interface immediately
    setHasStarted(true);
    setIsTyping(true);
    setTypingMessage("Sta scrivendo");
    setUserInitial(name.charAt(0).toUpperCase());

    // Add user's name as first message immediately
    const userNameMessage: ChatMessage = {
      id: Date.now(),
      sessionId: "temp", // Will be updated when session is created
      role: "user",
      content: name.trim(),
      metadata: null,
      createdAt: new Date(),
    };

    setMessages([userNameMessage]);

    startChatMutation.mutate({ userName: name, fingerprint });
  };

  const handleStartChat = () => {
    if (!userName.trim()) return;
    
    // Instead of starting chat in current window, open new tab
    const sessionParams: any = {
      userName: userName.trim(),
      source: 'homepage_new_tab',
      timestamp: Date.now(),
      fingerprint: generateFingerprint()
    };
    
    // Preserve brand parameter if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const currentBrand = urlParams.get('brand') || localStorage.getItem('brand-theme');
    if (currentBrand) {
      sessionParams.brand = currentBrand;
    }
    
    // Create URL for new tab with session parameters
    const chatUrl = `${window.location.origin}/?${new URLSearchParams(sessionParams).toString()}`;
    
    // Open chat in new tab
    const newWindow = window.open(chatUrl, '_blank');
    
    if (newWindow) {
      // Success - show confirmation in current window
      toast({
        title: "Chat avviata",
        description: "La chat è stata aperta in una nuova scheda",
      });
    } else {
      // Fallback - popup blocked, redirect current window
      window.location.href = chatUrl;
    }
  };
  
  // Generate simple fingerprint for session tracking
  const generateFingerprint = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 2, 2);
    return canvas.toDataURL().slice(-50);
  };

  const startChatMutation = useMutation({
    mutationFn: async (params: { userName: string; fingerprint?: string | null }) => {
      const response = await apiRequest("POST", "/api/chat/start", params);
      return response.json() as Promise<ChatStartResponse>;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setIsTyping(false);
      
      // Track "Inizio Chat" when session is successfully created
      trackChatStart(data.sessionId);

      // Track chat start event - user submitted name and started chat
      trackChatStart(data.sessionId);

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

      setSelectedImage(file);
      setCurrentMessage(''); // Clear message when image is selected

      // Check if it's a HEIC/HEIF file and convert for preview
      const isHEIC = fileExtension === '.heic' || fileExtension === '.heif' || 
                     file.type === 'image/heic' || file.type === 'image/heif';

      if (isHEIC) {
        try {
          // Convert HEIC to JPEG for preview
          const heic2any = await import('heic2any');
          const convertedBlob = await heic2any.default({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8
          });

          const blobArray = Array.isArray(convertedBlob) ? convertedBlob : [convertedBlob];
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(blobArray[0]);
        } catch (error) {
          console.error('Error converting HEIC:', error);
          // Use the original file as a blob URL for preview
          const originalBlobUrl = URL.createObjectURL(file);
          setImagePreview(originalBlobUrl);
        }
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

    // Add user message immediately to chat
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
      setTypingMessage("Sta scrivendo");
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

        // Add timeout for image upload (60 seconds to match server)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        response = await fetch("/api/chat/message-with-image", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
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
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      let data;
      try {
        data = await response.json() as ChatMessageResponse;
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        throw new Error('Invalid response format from server');
      }

      // Check if we have a before/after message to add first
      const messagesToAdd: ChatMessage[] = [];
      
      if ((data as any).beforeAfterMessage) {
        const beforeAfterMessage: ChatMessage = {
          id: Date.now(),
          sessionId: sessionId!,
          role: "assistant",
          content: (data as any).beforeAfterMessage.content,
          metadata: (data as any).beforeAfterMessage.metadata,
          createdAt: new Date(),
        };
        messagesToAdd.push(beforeAfterMessage);
        console.log('🎨 Adding before/after message first');
      }

      // Add main assistant response
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
      messagesToAdd.push(assistantMessage);

      // Debug log for message with image
      console.log('Send message response choices:', data.message.choices);
      console.log('Send message response hasChoices:', data.message.hasChoices);

      setMessages(prev => [...prev, ...messagesToAdd]);
      setIsTyping(false);
      setTypingMessage("Sta scrivendo"); // Reset to default message

      // Clear rotation interval if it exists
      if (messageRotation) {
        clearInterval(messageRotation);
      }
    } catch (error) {
      setIsTyping(false);
      setTypingMessage("Sta scrivendo"); // Reset to default message

      // Clear rotation interval if it exists
      if (messageRotation) {
        clearInterval(messageRotation);
      }

      // Provide more specific error messages
      let errorMessage = "Impossibile inviare il messaggio. Riprova.";
      
      if (imageToSend) {
        errorMessage = "Errore durante l'invio dell'immagine. Riprova o prova con un'altra foto.";
        console.error("Image upload error:", error);
      }
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorMessage = "L'analisi dell'immagine sta richiedendo troppo tempo. Per favore riprova con un'altra foto o riduci la dimensione dell'immagine.";
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = "Errore di connessione. Controlla la tua connessione internet e riprova.";
        } else if (error.message.includes('500')) {
          errorMessage = "Errore del server durante l'analisi. Per favore riprova tra qualche secondo.";
        } else if (error.message.includes('504')) {
          errorMessage = "L'analisi dell'immagine sta richiedendo troppo tempo. Riprova con un'altra foto.";
        } else if (error.message.includes('404')) {
          errorMessage = "Sessione scaduta o immagine non trovata. Ricarica la pagina e riprova.";
        }
      }
      
      // If the response contains a specific error message from the server, use it
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parse errors
      }
      
      toast({
        title: "Errore",
        description: errorMessage,
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

  // Function to extract ingredients from message content
  const extractIngredientsFromMessage = (content: string): string[] => {
    const knownIngredients = [
      'Centella Asiatica',
      'Bardana',
      'Mirto', 
      'Elicriso',
      'Liquirizia',
      'Ginkgo Biloba',
      'Amamelide',
      'Kigelia Africana',
      'Malva'
    ];
    
    const foundIngredients: string[] = [];
    
    knownIngredients.forEach(ingredient => {
      if (content.includes(ingredient)) {
        foundIngredients.push(ingredient);
      }
    });
    
    console.log('Searched for ingredients in:', content.substring(0, 200));
    console.log('Found ingredients:', foundIngredients);
    
    return foundIngredients;
  };

  const generateBeforeAfterImages = async () => {
    if (!sessionId || !pendingIngredients.length) {
      console.error("Cannot generate images: no session or ingredients");
      return;
    }

    try {
      // Show loading message
      setIsTyping(true);
      setTypingMessage("Sto generando le immagini personalizzate... 🎨");

      const response = await apiRequest("POST", "/api/chat/generate-before-after", {
        sessionId,
        ingredients: pendingIngredients,
        timeframe: "4 settimane"
      });

      const data = await response.json();
      
      if (data.success) {
        // Store the generated images
        setBeforeAfterImages({
          beforeImage: data.beforeImage,
          afterImage: data.afterImage,
          ingredients: pendingIngredients
        });

        // Add a system message to show the images
        const imageMessage: ChatMessage = {
          id: Date.now(),
          sessionId: sessionId,
          role: "assistant",
          content: "Ecco come apparirà la tua pelle dopo 4 settimane di trattamento con gli ingredienti consigliati:",
          metadata: {
            hasBeforeAfterImages: true,
            beforeImage: data.beforeImage,
            afterImage: data.afterImage,
            ingredients: pendingIngredients
          },
          createdAt: new Date(),
        };

        setMessages(prev => [...prev, imageMessage]);
        
        // Clear pending ingredients
        setPendingIngredients([]);
      } else {
        toast({
          title: "Errore",
          description: "Non è stato possibile generare le immagini. Riprova più tardi.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error generating before/after images:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la generazione delle immagini.",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

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
      <div className="chat-container flex flex-col h-screen" style={{backgroundColor: '#F2F3F6'}}>
        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center" style={{backgroundColor: '#F2F3F6', height: '100vh', minHeight: '100vh', width: '100vw', minWidth: '100vw', padding: '0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
          <div className="desktop-wide w-full flex flex-col justify-center text-center p-4 sm:p-6 md:p-8" style={{backgroundColor: '#F2F3F6', height: '100vh', minHeight: '100vh', width: '100vw', minWidth: '100vw'}}>
            {/* Logo Bonnie */}
            <div className="space-y-2 mb-6">
              <img 
                src="/attached_assets/imgi_8_logo-beauticology-128d474a_1758034902550.png" 
                alt="Beautycology Logo" 
                className="w-32 h-12 mx-auto object-contain"
              />
            </div>

            {/* Hero Image */}
            <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-2xl overflow-hidden shadow-lg mb-6">
              <img 
                src="/attached_assets/imgi_11_marilisa-franchini-beautycology-39a807c0_1758035903593.jpg" 
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
                Ciao! Sono la tua <strong>Skin Expert</strong> di <strong>Beautycology</strong>. 
                Possiamo analizzare insieme la tua pelle per trovare la skincare 
                routine perfetta per <strong>migliorarla</strong>!
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
                style={isListening ? {backgroundColor: '#7791DA'} : {}}
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
                style={{backgroundColor: '#7791DA'}}
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
      <div className="flex-1 flex items-center justify-center" style={{backgroundColor: '#F2F3F6', padding: '0', minHeight: '100vh'}}>
        <div className="desktop-wide w-full flex flex-col" style={{height: "100vh", minHeight: "100vh", maxHeight: "100vh", backgroundColor: '#F2F3F6'}}>
          {/* Header with Logo */}
          <div className="p-4 flex items-center justify-between">
            <img 
              src="/attached_assets/Beautycology Logo definitivo_1758128066560.jpg" 
              alt="Beautycology Logo" 
              className="h-10 w-auto object-contain"
            />
            <div className="flex items-center gap-2">
              {isFromIframe && (
                <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full border border-green-200">
                  🔗 Shopify
                </div>
              )}
            </div>
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
                style={isListening ? {backgroundColor: '#7791DA'} : {}}
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
                style={{backgroundColor: '#7791DA'}}
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
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Upload, FileText, Brain } from "lucide-react";
import { ChatInterface } from "@/components/chat-interface";
// import { RagUpload } from "@/components/rag-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BrowserFingerprint } from "@/utils/fingerprint";

// Helper function to get brand from URL or localStorage
function getBrand(): "dermasense" | "beautycology" {
  // Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const brandParam = urlParams.get('brand');
  if (brandParam === 'beautycology' || brandParam === 'dermasense') {
    return brandParam;
  }
  
  // Check localStorage as fallback
  const storedBrand = localStorage.getItem('brand-theme');
  if (storedBrand === 'beautycology' || storedBrand === 'dermasense') {
    return storedBrand;
  }
  
  // Default to dermasense
  return 'dermasense';
}

export default function Chat() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const startChatMutation = useMutation({
    mutationFn: async (userName: string) => {
      // Generate or get existing fingerprint
      const fingerprint = await BrowserFingerprint.getOrCreateFingerprint();
      
      // Get current brand
      const brand = getBrand();

      const response = await apiRequest("POST", "/api/chat/start", {
        userName,
        fingerprint,
        brand,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages([
        {
          id: "initial",
          role: "assistant",
          content: data.message.content,
          timestamp: new Date().toLocaleTimeString(),
          hasChoices: data.message.hasChoices,
          choices: data.message.choices,
        },
      ]);
      setIsTyping(false);
    },
    onError: (error: any) => {
      console.error("Error starting chat:", error);
      toast({
        title: "Errore",
        description: "Impossibile avviare la chat. Riprova.",
        variant: "destructive",
      });
      setIsTyping(false);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <ChatInterface />
    </div>
  );
}
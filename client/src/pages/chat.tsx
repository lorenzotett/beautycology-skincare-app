import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Upload, FileText, Brain } from "lucide-react";
import { ChatInterface } from "@/components/chat-interface";
import { RagUpload } from "@/components/rag-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BrowserFingerprint } from "@/utils/fingerprint";

export default function Chat() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [autoStartUserName, setAutoStartUserName] = useState<string | null>(null);

  // Check for URL parameters to auto-start chat
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userName = urlParams.get('userName');
    const source = urlParams.get('source');
    
    if (userName && source === 'homepage') {
      setAutoStartUserName(userName);
      setIsTyping(true);
    }
  }, []);

  const startChatMutation = useMutation({
    mutationFn: async (userName: string) => {
      // Generate or get existing fingerprint
      const fingerprint = await BrowserFingerprint.getOrCreateFingerprint();

      const response = await apiRequest("POST", "/api/chat/start", {
        userName,
        fingerprint,
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

  // Auto-start chat when user name is available from URL
  useEffect(() => {
    if (autoStartUserName && !sessionId) {
      startChatMutation.mutate(autoStartUserName);
    }
  }, [autoStartUserName, sessionId]);

  return (
    <div className="min-h-screen bg-dark-primary">
      <ChatInterface startChatMutation={startChatMutation} sessionId={sessionId} messages={messages} setMessages={setMessages} isTyping={isTyping} setIsTyping={setIsTyping}/>
    </div>
  );
}
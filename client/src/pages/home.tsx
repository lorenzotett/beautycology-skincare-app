import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userName.trim()) {
      alert('Per favore inserisci il tuo nome');
      return;
    }
    
    setIsLoading(true);
    
    // Generate session parameters
    const sessionParams = {
      userName: userName.trim(),
      source: 'homepage',
      timestamp: Date.now(),
      fingerprint: generateFingerprint()
    };
    
    // Create URL for chat with session parameters
    const chatUrl = `${window.location.origin}/chat?${new URLSearchParams(sessionParams).toString()}`;
    
    // Open chat in new tab
    const newWindow = window.open(chatUrl, '_blank');
    
    if (newWindow) {
      // Success - new tab opened
      setShowSuccess(true);
      setIsLoading(false);
    } else {
      // New tab was blocked - show fallback
      setIsLoading(false);
      showFallbackOptions(chatUrl);
    }
  };
  
  const showFallbackOptions = (chatUrl: string) => {
    const fallbackHtml = `
      <div style="text-align: center; padding: 40px; font-family: 'Playfair Display', serif;">
        <div style="font-size: 3rem; margin-bottom: 20px;">🚫</div>
        <h2 style="margin-bottom: 15px; color: #ff9800;">Nuova scheda bloccata</h2>
        <p style="margin-bottom: 25px; line-height: 1.6;">
          Il browser ha bloccato l'apertura della nuova scheda. 
          Clicca il link qui sotto per aprire la chat:
        </p>
        <a href="${chatUrl}" target="_blank" 
           style="display: inline-block; background: linear-gradient(45deg, #007381, #005963); 
                  color: white; padding: 15px 30px; border-radius: 10px; 
                  text-decoration: none; font-weight: 600; font-size: 1.1rem;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
          🚀 Apri Chat AI-DermaSense
        </a>
      </div>
    `;
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(fallbackHtml);
    } else {
      // Last resort - redirect current page
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
  
  if (showSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
        <Card className="w-full max-w-md mx-4 shadow-lg">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="text-6xl mb-6">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4 dermaSense-title">
              Chat Avviata!
            </h1>
            <p className="text-gray-600 mb-6 leading-relaxed">
              La tua chat con AI-DermaSense è ora aperta nella nuova scheda.
              <br /><br />
              Puoi continuare la consulenza lì e chiudere questa pagina.
            </p>
            <Button 
              onClick={() => window.close()} 
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
            >
              Chiudi questa scheda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardContent className="pt-8 pb-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dermaSense-title">
                  AI-DermaSense
                </h1>
                <p className="text-sm text-gray-600">Analisi della pelle con AI</p>
              </div>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Inizia la tua consulenza dermatologica personalizzata con 
              l'intelligenza artificiale più avanzata per la cura della pelle.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
                Come ti chiami?
              </label>
              <Input
                id="userName"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Inserisci il tuo nome"
                required
                className="w-full"
                disabled={isLoading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold py-3"
              disabled={isLoading}
            >
              {isLoading ? 'Apertura nuova scheda...' : 'Avvia Consulenza'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 leading-relaxed">
              Cliccando su "Avvia Consulenza" si aprirà una nuova scheda sicura 
              per la tua analisi completa della pelle.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
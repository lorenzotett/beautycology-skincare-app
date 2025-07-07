import { Button } from "./ui/button";
import { Upload } from "lucide-react";
import { ChatMessage } from "@shared/schema";

interface MessageBubbleProps {
  message: ChatMessage;
  onChoiceSelect?: (choice: string) => void;
  isAnswered?: boolean;
  userInitial?: string;
}

// Function to format markdown and make links clickable
const formatMarkdown = (text: string): string => {
  // Replace *bold text* with <strong>bold text</strong>
  let formattedText = text.replace(/\*(.*?)\*/g, "<strong>$1</strong>");

  // Make URLs clickable - matches http/https URLs and www URLs
  formattedText = formattedText.replace(
    /(https?:\/\/[^\s]+|www\.[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline cursor-pointer">$1</a>'
  );

  // Handle URLs that start with www (add https://)
  formattedText = formattedText.replace(
    /href="www\./g,
    'href="https://www.'
  );

  return formattedText;
};

export function MessageBubble({ message, onChoiceSelect, isAnswered = false, userInitial = "U" }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const timestamp = new Date(message.createdAt!).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const metadata = message.metadata as any;
  const hasChoices = metadata?.hasChoices || false;
  const choices = metadata?.choices || [];

  // Debug log to check if choices are properly passed
  console.log('Message metadata:', metadata);
  console.log('Has choices:', hasChoices);
  console.log('Choices:', choices);

  if (isUser) {
    return (
      <div className="flex items-start space-x-3 justify-end">
        <div className="message-bubble bg-user-msg rounded-lg p-3 max-w-xs lg:max-w-md">
          {/* Show image preview if available */}
          {metadata?.image && (
            <div className="mb-2">
              <img 
                src={metadata.image} 
                alt="Immagine caricata" 
                className="w-full max-w-48 h-auto rounded-lg border border-blue-300/30"
              />
            </div>
          )}
          {/* Show message content if present */}
          {message.content && (
            <p className="text-sm leading-relaxed text-white">{message.content}</p>
          )}
          {/* Show "Immagine" as fallback if no content but has image */}
          {!message.content && metadata?.image && (
            <p className="text-sm leading-relaxed text-white italic">Immagine</p>
          )}
          <div className="text-xs text-blue-200 mt-2 text-right">
            <span>{timestamp}</span>
          </div>
        </div>
        <div className="w-8 h-8 bg-user-msg rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-medium text-xs">{userInitial}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img 
          src="/attached_assets/Copia di 2022_Bonnie_Logo_Tavola disegno 1 (1)_1751893472367.png" 
          alt="Bonnie Logo" 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="message-bubble bg-dark-secondary rounded-lg p-3 flex-1">
        <div
          className="text-sm leading-relaxed text-white whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
        />
        {/* Image display */}
        {message.metadata?.hasImage && (
        <div className="mt-2">
          {message.metadata?.image ? (
            <img 
              src={message.metadata.image} 
              alt="Immagine caricata" 
              className="max-w-48 rounded-lg border border-dark-accent cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.open(message.metadata.image, '_blank')}
              onError={(e) => {
                // Se l'immagine non carica, mostra un placeholder
                const target = e.currentTarget;
                target.style.display = 'none';
                const placeholder = target.nextSibling as HTMLElement;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
          ) : null}

          {/* Placeholder per file che non possono essere visualizzati */}
          <div 
            className="max-w-48 h-32 bg-dark-accent rounded-lg border border-dark-accent flex flex-col items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors"
            style={{ display: message.metadata?.image ? 'none' : 'flex' }}
          >
            <Upload size={24} className="text-text-muted mb-2" />
            <span className="text-xs text-text-muted text-center px-2">
              {message.metadata?.imageName || "File caricato"}
            </span>
            <span className="text-xs text-text-muted/60 mt-1">
              (Anteprima non disponibile)
            </span>
          </div>
        </div>
      )}
        {hasChoices && choices.length > 0 && (
          <div className="space-y-2 mt-3">
            {choices.map((choice: string, index: number) => (
              <button
                key={index}
                onClick={() => !isAnswered && onChoiceSelect?.(choice)}
                disabled={isAnswered}
                className={`choice-button w-full text-left p-3 rounded-lg text-sm transition-all duration-200 ${
                  isAnswered 
                    ? 'bg-gray-600 cursor-not-allowed opacity-60 text-gray-400' 
                    : 'bg-dark-accent hover:bg-assistant-msg text-white cursor-pointer'
                }`}
              >
                <span className={`font-medium ${isAnswered ? 'text-gray-500' : 'text-assistant-msg'}`}>
                  {String.fromCharCode(65 + index)})
                </span>{" "}
                {choice}
              </button>
            ))}
            {isAnswered && (
              <div className="text-xs text-gray-500 mt-2 italic">
                ✓ Risposta già fornita
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-text-muted mt-2">
          <span>{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
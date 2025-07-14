import { Button } from "./ui/button";
import { Upload } from "lucide-react";
import { ChatMessage } from "@shared/schema";
import { SkinAnalysisTable } from "./skin-analysis-table";

interface MessageBubbleProps {
  message: ChatMessage;
  onChoiceSelect?: (choice: string) => void;
  isAnswered?: boolean;
  userInitial?: string;
  onImageClick?: (imageUrl: string) => void;
}

// Function to format markdown and make links clickable
const formatMarkdown = (text: string): string => {
  // Replace **bold text** with <strong>bold text</strong>
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // Replace *bold text* with <strong>bold text</strong>  
  formattedText = formattedText.replace(/\*(.*?)\*/g, "<strong>$1</strong>");

  // Format sections with emoji headers
  formattedText = formattedText.replace(
    /^(📋|🌅|🌙|💡|⚠️)\s*\*\*([^*]+)\*\*/gm,
    '<div class="mb-3 mt-4"><strong class="text-base font-semibold">$1 $2</strong></div>'
  );

  // Format numbered list items
  formattedText = formattedText.replace(
    /^\s*(\d+)\.\s*\*\*([^*]+)\*\*:\s*(.*?)$/gm,
    '<div class="mb-2 ml-4"><strong class="font-medium">$1. $2:</strong> <span class="text-sm">$3</span></div>'
  );

  // Format bullet points
  formattedText = formattedText.replace(
    /^\s*[•-]\s*\*\*([^*]+)\*\*:\s*(.*?)$/gm,
    '<div class="mb-2 ml-4"><strong class="font-medium">• $1:</strong> <span class="text-sm">$2</span></div>'
  );

  // Format standalone bullet points
  formattedText = formattedText.replace(
    /^\s*[•-]\s*(.*?)$/gm,
    '<div class="mb-1 ml-4 text-sm">• $1</div>'
  );

  // Format main problems section header
  formattedText = formattedText.replace(
    /🔎\s*\*\*LE TUE PRINCIPALI NECESSITÀ E CONSIGLI SPECIFICI:\*\*/g,
    '<div class="mb-4 mt-4"><strong class="text-base font-semibold">🔎 LE TUE PRINCIPALI NECESSITÀ E CONSIGLI SPECIFICI:</strong></div>'
  );

  // Format problem items with levels
  formattedText = formattedText.replace(
    /^\s*\*\s*\*\*([^*]+)\s*\(Livello:\s*(\d+)\/100\):\*\*\s*$/gm,
    '<div class="mb-3 mt-3"><strong class="font-semibold text-sm">• $1 (Livello: $2/100):</strong></div>'
  );

  // Format problem items without levels
  formattedText = formattedText.replace(
    /^\s*\*\s*\*\*([^*]+):\*\*\s*$/gm,
    '<div class="mb-3 mt-3"><strong class="font-semibold text-sm">• $1:</strong></div>'
  );

  // Format ingredient recommendations
  formattedText = formattedText.replace(
    /\*\*Ingrediente consigliato:\*\*\s*([^\n]+)/g,
    '<div class="mb-1 ml-6"><strong class="text-sm font-medium text-green-700">Ingrediente consigliato:</strong> <span class="text-sm">$1</span></div>'
  );
  
  formattedText = formattedText.replace(
    /\*\*Come funziona:\*\*\s*([^\n]+)/g,
    '<div class="mb-3 ml-6"><strong class="text-sm font-medium text-blue-700">Come funziona:</strong> <span class="text-sm">$1</span></div>'
  );

  // Format specific advice
  formattedText = formattedText.replace(
    /\*\*Consiglio specifico:\*\*\s*([^\n]+)/g,
    '<div class="mb-3 ml-6"><strong class="text-sm font-medium text-purple-700">Consiglio specifico:</strong> <span class="text-sm">$1</span></div>'
  );

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

// Function to parse and extract link buttons from content
const parseContentWithLinkButtons = (content: string) => {
  // Look for the LINK_BUTTON pattern first
  const linkButtonRegex = /\*\*\[LINK_BUTTON:(https?:\/\/[^:]+):([^\]]+)\]\*\*/g;
  const linkButtons: Array<{ url: string; text: string }> = [];
  let cleanContent = content;

  let match;
  while ((match = linkButtonRegex.exec(content)) !== null) {
    linkButtons.push({
      url: match[1],
      text: 'Accedi alla tua crema personalizzata'
    });
    cleanContent = cleanContent.replace(match[0], '');
  }

  // Also look for the fallback pattern [Accedi ai Prodotti Bonnie]
  if (linkButtons.length === 0 && content.includes('[Accedi ai Prodotti Bonnie]')) {
    linkButtons.push({
      url: 'https://tinyurl.com/formulabonnie',
      text: 'Accedi alla tua crema personalizzata'
    });
    // Replace the entire sentence with the new format
    cleanContent = cleanContent.replace(/Per ricevere la routine via email e accedere ai prodotti consigliati: \[Accedi ai Prodotti Bonnie\]/g, 'Puoi accedere tramite questo pulsante alla tua crema personalizzata:');
  }

  return {
    content: cleanContent.trim(),
    linkButtons
  };
};

// Function to parse skin analysis data from message content
const parseSkinAnalysis = (content: string) => {
  // Check if this is a skin analysis message
  if (!content.includes('📊 **ANALISI COMPLETA DELLA PELLE:**')) {
    return null;
  }

  // Extract overall score and description
  const overallMatch = content.match(/\*\*Punteggio Generale:\*\* (\d+)\/100 - ([^-\n]+)/);
  const overallScore = overallMatch ? parseInt(overallMatch[1]) : 0;
  const overallDescription = overallMatch ? overallMatch[2].trim() : '';

  // Extract individual metrics
  const metrics = {
    rossori: extractMetric(content, 'Rossori'),
    acne: extractMetric(content, 'Acne'),
    rughe: extractMetric(content, 'Rughe'),
    pigmentazione: extractMetric(content, 'Pigmentazione'),
    pori_dilatati: extractMetric(content, 'Pori Dilatati'),
    oleosita: extractMetric(content, 'Oleosità'),
    danni_solari: extractMetric(content, 'Danni Solari'),
    occhiaie: extractMetric(content, 'Occhiaie'),
    idratazione: extractMetric(content, 'Idratazione'),
    elasticita: extractMetric(content, 'Elasticità'),
    texture_uniforme: extractMetric(content, 'Texture Uniforme'),
  };

  // Extract remaining content (everything after the metrics)
  // Try different patterns for the section header
  let splitContent = content.split('🔍 **PANORAMICA PROBLEMI PRINCIPALI:**');
  if (splitContent.length === 1) {
    splitContent = content.split('**🔍 PANORAMICA PROBLEMI PRINCIPALI:**');
  }
  const remainingContent = splitContent.length > 1 ? splitContent[1] : '';
  

  
  return {
    overallScore,
    overallDescription,
    metrics,
    remainingContent: remainingContent.trim()
  };
};

// Helper function to extract metric value
const extractMetric = (content: string, metricName: string): number => {
  const regex = new RegExp(`\\*\\*${metricName}:\\*\\* (\\d+)\\/100`, 'i');
  const match = content.match(regex);
  return match ? parseInt(match[1]) : 0;
};

export function MessageBubble({ message, onChoiceSelect, isAnswered = false, userInitial = "U", onImageClick }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const timestamp = new Date(message.createdAt!).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const metadata = message.metadata as any;
  const hasChoices = metadata?.hasChoices || false;
  const choices = metadata?.choices || [];

  // Parse skin analysis data if present
  const skinAnalysis = !isUser ? parseSkinAnalysis(message.content) : null;
  
  // Parse link buttons from content
  const contentWithButtons = !isUser ? parseContentWithLinkButtons(message.content) : { content: message.content, linkButtons: [] };
  

  


  // Debug log to check if choices are properly passed
  console.log('Message metadata:', metadata);
  console.log('Has choices:', hasChoices);
  console.log('Choices:', choices);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="message-bubble bg-user-msg rounded-lg p-3 max-w-fit">
          {/* Show image preview if available */}
          {metadata?.hasImage && (
            <div className="mb-2">
              {(metadata?.image || metadata?.imageBase64) ? (
                <img 
                  src={metadata?.imageBase64 || metadata?.image} 
                  alt="Immagine caricata" 
                  className="w-full max-w-48 h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ 
                    maxHeight: '200px', 
                    minHeight: '120px',
                    width: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onClick={() => onImageClick?.(metadata?.imageBase64 || metadata?.image)}
                  onError={(e) => {
                    console.warn('Errore nel caricamento dell\'immagine:', e);
                  }}
                />
              ) : (
                <div className="w-full max-w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div>Immagine non disponibile</div>
                    {metadata?.imageOriginalName && (
                      <div className="text-xs mt-1 opacity-70">{metadata.imageOriginalName}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Show message content if present */}
          {message.content && (
            <p className="text-sm leading-relaxed" style={{color: '#E5F1F2'}}>{message.content}</p>
          )}
          {/* Show "Immagine" as fallback if no content but has image */}
          {!message.content && (metadata?.image || metadata?.imageBase64) && (
            <p className="text-sm leading-relaxed italic" style={{color: '#E5F1F2'}}>Immagine</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="message-bubble bg-assistant-msg rounded-lg p-3">
      {skinAnalysis ? (
        <>
          {/* Show intro text if present */}
          {contentWithButtons.content.split('📊 **ANALISI COMPLETA DELLA PELLE:**')[0].trim() && (
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap mb-3"
              style={{color: '#007381'}}
              dangerouslySetInnerHTML={{ 
                __html: formatMarkdown(contentWithButtons.content.split('📊 **ANALISI COMPLETA DELLA PELLE:**')[0].trim()) 
              }}
            />
          )}
          
          {/* Skin Analysis Table */}
          <SkinAnalysisTable 
            data={skinAnalysis.metrics}
            overallScore={skinAnalysis.overallScore}
            overallDescription={skinAnalysis.overallDescription}
          />
          
          {/* Show remaining content after analysis */}
          {skinAnalysis.remainingContent && (
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap mt-3"
              style={{color: '#007381'}}
              dangerouslySetInnerHTML={{ 
                __html: formatMarkdown('🔍 **PANORAMICA PROBLEMI PRINCIPALI:**' + skinAnalysis.remainingContent) 
              }}
            />
          )}
        </>
      ) : (
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{color: '#007381'}}
          dangerouslySetInnerHTML={{ __html: formatMarkdown(contentWithButtons.content) }}
        />
      )}
      
      {/* Link Buttons */}
      {contentWithButtons.linkButtons.length > 0 && (
        <div className="mt-4 space-y-2">
          {contentWithButtons.linkButtons.map((linkButton, index) => (
            <button
              key={index}
              onClick={() => window.open(linkButton.url, '_blank')}
              className="w-full p-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: '#007381',
                color: '#E5F1F2',
                border: '2px solid #007381'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#005a62';
                e.currentTarget.style.borderColor = '#005a62';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#007381';
                e.currentTarget.style.borderColor = '#007381';
              }}
            >
              🌟 {linkButton.text}
            </button>
          ))}
        </div>
      )}
      {/* Image display */}
      {message.metadata?.hasImage && (
      <div className="mt-2">
        {(message.metadata?.image || message.metadata?.imageBase64) ? (
          <img 
            src={message.metadata?.imageBase64 || message.metadata?.image} 
            alt="Immagine caricata" 
            className="max-w-48 rounded-lg border border-dark-accent cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.open(message.metadata?.imageBase64 || message.metadata?.image, '_blank')}
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
          style={{ display: (message.metadata?.image || message.metadata?.imageBase64) ? 'none' : 'flex' }}
        >
          <Upload size={24} className="text-text-muted mb-2" />
          <span className="text-xs text-text-muted text-center px-2">
            {message.metadata?.imageName || message.metadata?.imageOriginalName || "File caricato"}
          </span>
          <span className="text-xs text-text-muted/60 mt-1">
            {message.metadata?.isPlaceholder ? "(Immagine ripristinata)" : "(Anteprima non disponibile)"}
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
                  : 'cursor-pointer'
              }`}
              style={{
                backgroundColor: isAnswered ? undefined : '#007381',
                color: isAnswered ? undefined : '#E5F1F2'
              }}
              onMouseEnter={(e) => {
                if (!isAnswered) {
                  e.currentTarget.style.backgroundColor = '#005a62';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnswered) {
                  e.currentTarget.style.backgroundColor = '#007381';
                }
              }}
            >
              <span className={`font-medium ${isAnswered ? 'text-gray-500' : ''}`} style={{color: isAnswered ? undefined : '#E5F1F2'}}>
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
    </div>
  );
}
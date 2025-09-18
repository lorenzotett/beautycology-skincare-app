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
    /^(📋|🌅|🌙|💡|⚠️|🧪)\s*\*\*([^*]+)\*\*/gm,
    '<div class="mb-3 mt-4"><strong class="text-base font-semibold">$1 $2</strong></div>'
  );

  // Format ingredient section title
  formattedText = formattedText.replace(
    /##\s*🧪\s*\*\*INGREDIENTI PERSONALIZZATI PER LA TUA PELLE\*\*/g,
    '<div class="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 rounded-lg p-4 mb-6 text-center"><h2 class="text-xl font-bold text-green-800">🧪 INGREDIENTI PERSONALIZZATI PER LA TUA PELLE</h2></div>'
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

  // Format ingredient sections with enhanced styling
  formattedText = formattedText.replace(
    /###\s*🌿\s*\*\*([^*]+)\*\*/g,
    '<div class="ingredient-card bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-4 mb-4 rounded-r-lg"><div class="text-lg font-bold text-green-800 mb-2">🌿 $1</div>'
  );

  // Format problem target
  formattedText = formattedText.replace(
    /\*\*🎯 Problema target:\*\*\s*([^\n]+)/g,
    '<div class="mb-2"><span class="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">🎯 $1</span></div>'
  );

  // Format action description
  formattedText = formattedText.replace(
    /\*\*⚡ Come agisce:\*\*\s*([^\n]+)/g,
    '<div class="text-gray-700 text-sm leading-relaxed">⚡ $1</div></div>'
  );

  // Format ingredient recommendations (legacy support)
  formattedText = formattedText.replace(
    /\*\*Ingrediente consigliato:\*\*\s*([^\n]+)/g,
    '<div class="mb-1 ml-6"><strong class="text-sm font-medium text-green-700">Ingrediente consigliato:</strong> <span class="text-sm font-bold text-green-900">$1</span></div>'
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
      text: match[2] // Use the text from the LINK_BUTTON pattern
    });
    cleanContent = cleanContent.replace(match[0], '');
  }

  // Also look for the fallback pattern [Accedi ai Prodotti Bonnie]
  if (linkButtons.length === 0 && content.includes('[Accedi ai Prodotti Bonnie]')) {
    linkButtons.push({
      url: 'https://tinyurl.com/formulabonnie',
      text: 'Accedi alla tua skincare personalizzata'
    });
    // Replace the entire sentence with the new format
    cleanContent = cleanContent.replace(/Per ricevere la routine via email e accedere ai prodotti consigliati: \[Accedi ai Prodotti Bonnie\]/g, 'Puoi accedere tramite questo pulsante alla tua skincare personalizzata:');
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

// Validate and limit ingredients to max 4
const validateIngredients = (content: string): string => {
  // Check if content contains ingredient section
  const ingredientSectionRegex = /🧪\s*\*\*INGREDIENTI PER LA TUA CREMA PERSONALIZZATA BONNIE\*\*[\s\S]*?(?=---|\n\n##|$)/i;
  const match = content.match(ingredientSectionRegex);

  if (match) {
    const ingredientSection = match[0];
    // Extract ingredient list items
    const ingredientItems = ingredientSection.match(/[-•]\s*\*\*[^:]+:/g) || [];

    if (ingredientItems.length > 4) {
      console.warn(`⚠️ Troppi ingredienti rilevati (${ingredientItems.length}). Limitando a 4.`);
      // Keep only first 4 ingredients
      const limitedSection = ingredientSection.replace(
        /([-•]\s*\*\*[^:]+:[\s\S]*?(?=[-•]\s*\*\*|---|\n\n|$))/g,
        (match, ingredient, offset, string) => {
          const ingredientIndex = (string.substring(0, offset).match(/[-•]\s*\*\*[^:]+:/g) || []).length;
          return ingredientIndex < 4 ? match : '';
        }
      );
      return content.replace(ingredientSection, limitedSection);
    }
  }

  return content;
};

// Format the message content for display
const formatContent = (content: string) => {
  const validatedContent = validateIngredients(content);

  return validatedContent
    // Format ingredient section
    .replace(
      /(🧪\s*\*\*INGREDIENTI PER LA TUA CREMA PERSONALIZZATA BONNIE\*\*[\s\S]*?)(?=---|\n\n##|$)/gi,
      '<div class="ingredient-section">$1</div>'
    )
    // Format routine section
    .replace(
      /(📋\s*\*\*LA TUA ROUTINE SKINCARE COMPLETA CONSIGLIATA\*\*[\s\S]*?)(?=\n\n##|$)/gi,
      '<div class="routine-section">$1</div>'
    )
    // Format warning messages
    .replace(
      /⚠️\s*\*\*IMPORTANTE\*\*:([^⚠️💡]*?)(?=⚠️|💡|\n\n|$)/gi,
      '<div class="warning-box">⚠️ <strong>IMPORTANTE</strong>:$1</div>'
    )
    // Format info messages
    .replace(
      /💡\s*\*\*RICORDA\*\*:([^⚠️💡]*?)(?=⚠️|💡|\n\n|$)/gi,
      '<div class="info-box">💡 <strong>RICORDA</strong>:$1</div>'
    )
    // Standard formatting
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
};

export function MessageBubble({ message, onChoiceSelect, isAnswered = false, userInitial = "U", onImageClick }: MessageBubbleProps) {
  // Remove trigger and metadata markers from content
  const cleanedContent = message.content
    .replace(/\[TRIGGER:GENERATE_BEFORE_AFTER_IMAGES\]/g, '')
    .replace(/\[METADATA:INGREDIENTS_PROVIDED:[^\]]+\]/g, '')
    .trim();
  
  // Function to track final button click
  const trackFinalButtonClick = async (sessionId: string) => {
    try {
      console.log('Tracking final button click for session:', sessionId);

      const response = await fetch(`/api/chat/${sessionId}/final-button-clicked`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Final button click tracked successfully:', result);
    } catch (error) {
      console.error('Error tracking final button click:', error);
      // Optional: Show user feedback about tracking failure
      // alert('Tracking error - please contact support if this persists');
    }
  };

  // Function to track WhatsApp button click
  const trackWhatsAppButtonClick = async (sessionId: string) => {
    try {
      console.log('Tracking WhatsApp button click for session:', sessionId);

      const response = await fetch(`/api/chat/${sessionId}/whatsapp-button-clicked`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('WhatsApp button click tracked successfully:', result);
    } catch (error) {
      console.error('Error tracking WhatsApp button click:', error);
    }
  };

  const isUser = message.role === "user";
  const timestamp = new Date(message.createdAt!).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const metadata = message.metadata as any;
  const hasChoices = metadata?.hasChoices || false;
  const choices = metadata?.choices || [];

  // Parse skin analysis data if present
  const skinAnalysis = !isUser ? parseSkinAnalysis(cleanedContent) : null;

  // Parse link buttons from content
  const contentWithButtons = !isUser ? parseContentWithLinkButtons(cleanedContent) : { content: cleanedContent, linkButtons: [] };





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
            <p className="text-sm leading-relaxed" style={{color: 'black'}}>{message.content}</p>
          )}
          {/* Show "Immagine" as fallback if no content but has image */}
          {!message.content && (metadata?.image || metadata?.imageBase64) && (
            <p className="text-sm leading-relaxed italic" style={{color: 'black'}}>Immagine</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="message-bubble bg-card text-foreground border border-border rounded-lg p-3">
      {skinAnalysis ? (
        <>
          {/* Show intro text if present */}
          {contentWithButtons.content.split('📊 **ANALISI COMPLETA DELLA PELLE:**')[0].trim() && (
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap mb-3"
              style={{color: 'black'}}
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
              style={{color: 'black'}}
              dangerouslySetInnerHTML={{ 
                __html: formatMarkdown('🔍 **PANORAMICA PROBLEMI PRINCIPALI:**' + skinAnalysis.remainingContent) 
              }}
            />
          )}
        </>
      ) : (
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{color: 'black'}}
          dangerouslySetInnerHTML={{ __html: formatMarkdown(contentWithButtons.content) }}
        />
      )}

      {/* Link Buttons */}
      {contentWithButtons.linkButtons.length > 0 && (
        <div className="mt-4 space-y-2">
          {contentWithButtons.linkButtons.map((linkButton, index) => (
            <div key={index} className="relative">
              {/* Hidden fallback link for maximum compatibility */}
              <a
                href={linkButton.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10 opacity-0"
                tabIndex={-1}
                onClick={async (e) => {
                  // Track button clicks based on type
                  const isSkincareButton = linkButton.text.toLowerCase().includes('skincare') || 
                                         linkButton.text.toLowerCase().includes('accedi alla tua');
                  const isWhatsAppButton = linkButton.text.toLowerCase().includes('whatsapp') ||
                                          linkButton.url.includes('whatsapp');

                  if (isSkincareButton) {
                    console.log('Fallback skincare link clicked for session:', message.sessionId);
                    try {
                      await trackFinalButtonClick(message.sessionId);
                    } catch (error) {
                      console.warn('Failed to track button click via fallback:', error);
                    }
                  } else if (isWhatsAppButton) {
                    console.log('Fallback WhatsApp link clicked for session:', message.sessionId);
                    try {
                      await trackWhatsAppButtonClick(message.sessionId);
                    } catch (error) {
                      console.warn('Failed to track WhatsApp button click via fallback:', error);
                    }
                  }
                }}
              >
                {linkButton.text}
              </a>

              {/* Main button */}
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  // Track button clicks based on type
                  const isSkincareButton = linkButton.text.toLowerCase().includes('skincare') || 
                                         linkButton.text.toLowerCase().includes('accedi alla tua');
                  const isWhatsAppButton = linkButton.text.toLowerCase().includes('whatsapp') ||
                                          linkButton.url.includes('whatsapp');

                  if (isSkincareButton) {
                    console.log('Final skincare button clicked for session:', message.sessionId);
                    try {
                      await trackFinalButtonClick(message.sessionId);
                    } catch (error) {
                      console.warn('Failed to track final button click:', error);
                    }
                  } else if (isWhatsAppButton) {
                    console.log('WhatsApp button clicked for session:', message.sessionId);
                    try {
                      await trackWhatsAppButtonClick(message.sessionId);
                    } catch (error) {
                      console.warn('Failed to track WhatsApp button click:', error);
                    }
                  } else {
                    console.log('Non-tracking button clicked:', linkButton.text);
                  }

                  // Mobile-friendly link opening with multiple fallback methods
                  const openLink = () => {
                    // Method 1: Try window.open (works on most devices)
                    try {
                      const newWindow = window.open(linkButton.url, '_blank', 'noopener,noreferrer');
                      if (newWindow) {
                        newWindow.focus();
                        return true;
                      }
                    } catch (error) {
                      console.warn('window.open failed:', error);
                    }

                    // Method 2: Create temporary link and click it (mobile Safari fallback)
                    try {
                      const tempLink = document.createElement('a');
                      tempLink.href = linkButton.url;
                      tempLink.target = '_blank';
                      tempLink.rel = 'noopener noreferrer';
                      tempLink.style.display = 'none';
                      document.body.appendChild(tempLink);
                      tempLink.click();
                      document.body.removeChild(tempLink);
                      return true;
                    } catch (error) {
                      console.warn('Temporary link failed:', error);
                    }

                    // Method 3: Trigger the hidden link click (iOS compatibility)
                    try {
                      const hiddenLink = e.currentTarget?.parentElement?.querySelector('a');
                      if (hiddenLink) {
                        hiddenLink.click();
                        return true;
                      }
                    } catch (error) {
                      console.warn('Hidden link trigger failed:', error);
                    }

                    // Method 4: Direct location assignment (last resort)
                    try {
                      window.location.href = linkButton.url;
                      return true;
                    } catch (error) {
                      console.error('All link opening methods failed:', error);
                    }

                    return false;
                  };

                  // Add slight delay to ensure tracking completes
                  setTimeout(openLink, 100);
                }}
                className="w-full p-4 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer touch-manipulation relative z-20"
                style={{
                  backgroundColor: linkButton.text.toLowerCase().includes('whatsapp') ? '#25d366' : '#7791DA',
                  color: '#E5F1F2',
                  border: `2px solid ${linkButton.text.toLowerCase().includes('whatsapp') ? '#25d366' : '#7791DA'}`,
                  minHeight: '48px', // Ensure minimum touch target size for mobile
                  touchAction: 'manipulation', // Prevent zoom on double-tap
                  WebkitTapHighlightColor: 'transparent', // Remove iOS tap highlight
                  userSelect: 'none' // Prevent text selection
                }}
                onMouseEnter={(e) => {
                  const hoverColor = linkButton.text.toLowerCase().includes('whatsapp') ? '#1da851' : '#005a62';
                  e.currentTarget.style.backgroundColor = hoverColor;
                  e.currentTarget.style.borderColor = hoverColor;
                }}
                onMouseLeave={(e) => {
                  const normalColor = linkButton.text.toLowerCase().includes('whatsapp') ? '#25d366' : '#7791DA';
                  e.currentTarget.style.backgroundColor = normalColor;
                  e.currentTarget.style.borderColor = normalColor;
                }}
                // Additional mobile touch events
                onTouchStart={(e) => {
                  const hoverColor = linkButton.text.toLowerCase().includes('whatsapp') ? '#1da851' : '#005a62';
                  e.currentTarget.style.backgroundColor = hoverColor;
                  e.currentTarget.style.borderColor = hoverColor;
                }}
                onTouchEnd={(e) => {
                  const normalColor = linkButton.text.toLowerCase().includes('whatsapp') ? '#25d366' : '#7791DA';
                  e.currentTarget.style.backgroundColor = normalColor;
                  e.currentTarget.style.borderColor = normalColor;
                }}
              >
                {linkButton.text.toLowerCase().includes('whatsapp') ? '💬' : '🌟'} {linkButton.text}
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Image display */}
      {(metadata as any)?.hasImage && (
      <div className="mt-2">
        {((metadata as any)?.image || (metadata as any)?.imageBase64) ? (
          <img 
            src={(metadata as any)?.imageBase64 || (metadata as any)?.image} 
            alt="Immagine caricata" 
            className="max-w-48 rounded-lg border border-dark-accent cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.open((metadata as any)?.imageBase64 || (metadata as any)?.image, '_blank')}
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
          className="max-w-48 h-32 bg-card border border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
          style={{ display: ((metadata as any)?.image || (metadata as any)?.imageBase64) ? 'none' : 'flex' }}
        >
          <Upload size={24} className="text-text-muted mb-2" />
          <span className="text-xs text-text-muted text-center px-2">
            {(metadata as any)?.imageName || (metadata as any)?.imageOriginalName || "File caricato"}
          </span>
          <span className="text-xs text-text-muted/60 mt-1">
            {(metadata as any)?.isPlaceholder ? "(Immagine ripristinata)" : "(Anteprima non disponibile)"}
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
                backgroundColor: isAnswered ? undefined : '#7791DA',
                color: isAnswered ? undefined : '#E5F1F2'
              }}
              onMouseEnter={(e) => {
                if (!isAnswered) {
                  e.currentTarget.style.backgroundColor = '#005a62';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnswered) {
                  e.currentTarget.style.backgroundColor = '#7791DA';
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
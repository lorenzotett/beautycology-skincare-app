import { ChatMessage } from "@shared/schema";

interface MessageBubbleProps {
  message: ChatMessage;
  onChoiceSelect?: (choice: string) => void;
}

// Function to format markdown (specifically, bold text)
const formatMarkdown = (text: string): string => {
  // Replace *bold text* with <strong>bold text</strong>
  let formattedText = text.replace(/\*(.*?)\*/g, "<strong>$1</strong>");

  // Use dangerouslySetInnerHTML to render the HTML
  return formattedText;
};

export function MessageBubble({ message, onChoiceSelect }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const timestamp = new Date(message.createdAt!).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const metadata = message.metadata as any;
  const hasChoices = metadata?.hasChoices || false;
  const choices = metadata?.choices || [];

  if (isUser) {
    return (
      <div className="flex items-start space-x-3 justify-end">
        <div className="message-bubble bg-user-msg rounded-lg p-3 max-w-xs lg:max-w-md">
          <p className="text-sm leading-relaxed text-white">{message.content}</p>
          <div className="text-xs text-blue-200 mt-2 text-right">
            <span>{timestamp}</span>
          </div>
        </div>
        <div className="w-8 h-8 bg-user-msg rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-medium text-xs">U</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-3">
      <div className="w-8 h-8 bg-assistant-msg rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-white font-medium text-xs">B</span>
      </div>
      <div className="message-bubble bg-dark-secondary rounded-lg p-3 flex-1">
        <div
          className="text-sm leading-relaxed text-white whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
        />
        {hasChoices && choices.length > 0 && (
          <div className="space-y-2 mt-3">
            {choices.map((choice: string, index: number) => (
              <button
                key={index}
                onClick={() => onChoiceSelect?.(choice)}
                className="choice-button w-full text-left p-3 bg-dark-accent hover:bg-assistant-msg rounded-lg text-sm transition-all duration-200 text-white"
              >
                <span className="font-medium text-assistant-msg">
                  {String.fromCharCode(65 + index)})
                </span>{" "}
                {choice}
              </button>
            ))}
          </div>
        )}
        <div className="text-xs text-text-muted mt-2">
          <span>{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
```
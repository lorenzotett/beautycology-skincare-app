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
      <div className="flex items-start space-x-4 justify-end">
        <div className="message-bubble bg-gradient-to-br from-user-msg to-blue-600 rounded-2xl rounded-tr-md p-4 max-w-sm lg:max-w-md shadow-lg">
          <p className="text-sm leading-relaxed text-white font-medium">{message.content}</p>
          <div className="text-xs text-blue-100 mt-3 text-right opacity-75">
            <span>{timestamp}</span>
          </div>
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-user-msg to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-white font-bold text-sm">U</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-gradient-to-br from-assistant-msg to-green-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
        <span className="text-white font-bold text-sm">B</span>
      </div>
      <div className="message-bubble bg-gradient-to-br from-dark-secondary to-dark-accent rounded-2xl rounded-tl-md p-4 flex-1 shadow-lg border border-dark-accent/50">
        <div
          className="text-sm leading-relaxed text-white whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
        />
        {hasChoices && choices.length > 0 && (
          <div className="space-y-3 mt-4">
            {choices.map((choice: string, index: number) => (
              <button
                key={index}
                onClick={() => onChoiceSelect?.(choice)}
                className="choice-button w-full text-left p-4 bg-dark-accent/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-assistant-msg/20 hover:to-assistant-msg/10 border border-dark-accent/30 hover:border-assistant-msg/40 rounded-xl text-sm transition-all duration-300 text-white hover:shadow-md hover:scale-[1.02]"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 bg-assistant-msg/20 rounded-full text-xs font-bold text-assistant-msg mr-3">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="font-medium">{choice}</span>
              </button>
            ))}
          </div>
        )}
        <div className="text-xs text-text-muted mt-3 opacity-75">
          <span>{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
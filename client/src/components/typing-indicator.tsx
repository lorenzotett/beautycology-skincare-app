interface TypingIndicatorProps {
  message?: string;
}

export function TypingIndicator({ message = "AI-DermaSense sta scrivendo" }: TypingIndicatorProps) {
  return (
    <div className="flex items-start space-x-3">
      <div className="w-8 h-8 bg-assistant-msg rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-white font-medium text-xs">B</span>
      </div>
      <div className="bg-dark-secondary rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-sm">{message}</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-assistant-msg rounded-full animate-pulse-dot"></div>
            <div className="w-2 h-2 bg-assistant-msg rounded-full animate-pulse-dot" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-assistant-msg rounded-full animate-pulse-dot" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

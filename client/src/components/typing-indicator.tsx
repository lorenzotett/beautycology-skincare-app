interface TypingIndicatorProps {
  message?: string;
}

export function TypingIndicator({ message = "AI-DermaSense sta scrivendo" }: TypingIndicatorProps) {
  return (
    <div className="bg-assistant-msg rounded-lg p-3 inline-block w-fit max-w-[80%]">
      <div className="flex items-center gap-2">
        <span className="text-sm whitespace-nowrap" style={{color: '#007381'}}>{message}</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{backgroundColor: '#007381'}}></div>
          <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{backgroundColor: '#007381', animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{backgroundColor: '#007381', animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
}

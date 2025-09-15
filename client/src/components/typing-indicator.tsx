interface TypingIndicatorProps {
  message?: string;
}

export function TypingIndicator({ message = "Sta scrivendo" }: TypingIndicatorProps) {
  return (
    <div className="bg-card text-foreground border border-border rounded-lg p-3 inline-block w-fit max-w-[80%]">
      <div className="flex items-center gap-2">
        <span className="text-sm whitespace-nowrap text-foreground">{message}</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-gradient-to-br from-assistant-msg to-green-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
        <span className="text-white font-bold text-sm">B</span>
      </div>
      <div className="bg-gradient-to-br from-dark-secondary to-dark-accent rounded-2xl rounded-tl-md p-4 shadow-lg border border-dark-accent/50">
        <div className="flex items-center gap-3">
          <span className="text-skincare-primary text-sm font-medium">Bonnie sta analizzando</span>
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 bg-skincare-primary rounded-full animate-pulse-dot shadow-sm"></div>
            <div className="w-2.5 h-2.5 bg-skincare-primary rounded-full animate-pulse-dot shadow-sm" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2.5 h-2.5 bg-skincare-primary rounded-full animate-pulse-dot shadow-sm" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

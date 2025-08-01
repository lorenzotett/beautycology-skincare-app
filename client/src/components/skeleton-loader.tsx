import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

export function SessionListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg shadow-sm animate-pulse">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex items-center space-x-6">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
          <div className={cn("max-w-[70%] space-y-2", i % 2 === 0 ? "items-start" : "items-end")}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className={cn("h-16 w-64", i % 2 === 0 ? "rounded-r-lg" : "rounded-l-lg")} />
          </div>
        </div>
      ))}
    </div>
  );
}

import { Card } from "@/components/ui/card";

interface SkeletonLoaderProps {
  type?: 'sessions' | 'stats' | 'chat' | 'analysis';
  message?: string;
}

export function SkeletonLoader({ type = 'sessions', message }: SkeletonLoaderProps) {
  const getLoadingMessage = () => {
    switch (type) {
      case 'sessions':
        return message || '📋 Caricamento sessioni...';
      case 'stats':
        return message || '📊 Aggiornamento statistiche...';
      case 'chat':
        return message || '💬 Caricamento conversazione...';
      case 'analysis':
        return message || '🔬 Analisi della pelle in corso...';
      default:
        return message || 'Caricamento...';
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        {getLoadingMessage()}
      </div>
      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
    </div>
  );
}
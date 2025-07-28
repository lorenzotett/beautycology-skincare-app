import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retries = 2
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(90000) // 90 second timeout for admin dashboard
      });

      await throwIfResNotOk(res);
      return res;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 400-499 client errors (except timeouts)
      if (error instanceof Error && error.message.includes('4') && 
          !error.message.includes('408') && !error.message.includes('timeout')) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError || new Error('Network request failed after retries');
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      // Add timeout to queries too
      signal: AbortSignal.timeout(90000) // 90 second timeout for admin queries
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Retry network errors and server errors, but not client errors
        const errorMessage = error?.message || '';
        if (errorMessage.includes('500') || errorMessage.includes('502') || 
            errorMessage.includes('503') || errorMessage.includes('504') ||
            errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
          return failureCount < 3;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Only retry mutations on server errors or network issues
        const errorMessage = error?.message || '';
        if (errorMessage.includes('500') || errorMessage.includes('502') || 
            errorMessage.includes('503') || errorMessage.includes('timeout')) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

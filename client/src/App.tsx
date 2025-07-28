import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Chat from "@/pages/chat";
import AdminDashboard from "./pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/error-boundary";
import { useEffect } from "react";

function Router() {
  const [location] = useLocation();
  
  useEffect(() => {
    // Check for admin parameter in URL and redirect if needed
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin');
    
    if (adminParam === 'true' && location !== '/admin-dashboard') {
      // Clean redirect to admin dashboard
      window.history.replaceState({}, '', '/admin-dashboard');
    }
  }, [location]);
  
  return (
    <Switch>
      <Route path="/" component={Chat} />
      <Route path="/admin-dashboard" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
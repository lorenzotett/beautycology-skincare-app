import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Chat from "@/pages/chat";
import AdminDashboard from "./pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/error-boundary";
import { useEffect, useState } from "react";

function Router() {
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  
  useEffect(() => {
    // Check for admin parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin');
    const pathIsAdmin = window.location.pathname === '/admin-dashboard';
    
    if (adminParam === 'true' || pathIsAdmin) {
      setIsAdminRoute(true);
    }
  }, []);
  
  // If admin parameter is present, show admin dashboard
  if (isAdminRoute) {
    return <AdminDashboard />;
  }
  
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
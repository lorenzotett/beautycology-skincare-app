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

// Brand-aware AdminDashboard wrapper components
function DermaSenseAdminDashboard() {
  useEffect(() => {
    // Set brand parameter for DermaSense admin
    const url = new URL(window.location.href);
    url.searchParams.set('brand', 'dermasense');
    if (url.href !== window.location.href) {
      window.history.replaceState({}, '', url.pathname + url.search);
    }
    // Also set localStorage for immediate theme application
    localStorage.setItem('brand-theme', 'dermasense');
  }, []);
  
  return <AdminDashboard brand="dermasense" />;
}

function BeautycologyAdminDashboard() {
  useEffect(() => {
    // Set brand parameter for Beautycology admin
    const url = new URL(window.location.href);
    url.searchParams.set('brand', 'beautycology');
    if (url.href !== window.location.href) {
      window.history.replaceState({}, '', url.pathname + url.search);
    }
    // Also set localStorage for immediate theme application
    localStorage.setItem('brand-theme', 'beautycology');
  }, []);
  
  return <AdminDashboard brand="beautycology" />;
}

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
      <Route path="/admin" component={DermaSenseAdminDashboard} />
      <Route path="/admin/beautycology" component={BeautycologyAdminDashboard} />
      <Route path="/admin-dashboard" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Brand theming logic
function useBrandTheming() {
  useEffect(() => {
    const applyBrandTheme = () => {
      // Check URL parameter for brand
      const urlParams = new URLSearchParams(window.location.search);
      const brandParam = urlParams.get('brand');
      
      // Check localStorage for persisted brand
      const storedBrand = localStorage.getItem('brand-theme');
      
      // Use URL param if available, otherwise use stored brand
      const activeBrand = brandParam || storedBrand;
      
      // Remove any existing brand classes
      const existingBrandClasses = Array.from(document.documentElement.classList).filter(className => 
        className.startsWith('brand-')
      );
      document.documentElement.classList.remove(...existingBrandClasses);
      
      // Apply new brand theme if specified
      if (activeBrand) {
        const brandClass = `brand-${activeBrand}`;
        document.documentElement.classList.add(brandClass);
        
        // Persist to localStorage if it came from URL
        if (brandParam) {
          localStorage.setItem('brand-theme', activeBrand);
        }
        
        console.log(`🎨 Applied brand theme: ${brandClass}`);
      }
    };
    
    // Apply theme on mount
    applyBrandTheme();
    
    // Listen for URL changes (for SPAs)
    const handlePopState = () => {
      applyBrandTheme();
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}

function App() {
  // Apply brand theming
  useBrandTheming();
  
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
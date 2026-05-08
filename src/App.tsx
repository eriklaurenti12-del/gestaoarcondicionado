import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BetaModeProvider } from "@/contexts/BetaModeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import ResetPassword from "./pages/ResetPassword";
import Members from "./pages/Members";
import PublicBooking from "./pages/PublicBooking";
import NotFound from "./pages/NotFound";
import AwaitingActivation from "./pages/AwaitingActivation";
import TeamPortalLogin from "./pages/TeamPortalLogin";
import BetaDashboard from "./pages/BetaDashboard";
import { toast } from "sonner";
import { ForceUpdateListener } from "@/components/ForceUpdateListener";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30000,
      gcTime: 5 * 60 * 1000, // Cache data for 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchInterval: false,
    },
    mutations: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const GlobalErrorHandler = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };

    const errorHandler = (event: ErrorEvent) => {
      console.error("Unhandled error:", event.error);
    };

    window.addEventListener("unhandledrejection", handler);
    window.addEventListener("error", errorHandler);
    return () => {
      window.removeEventListener("unhandledrejection", handler);
      window.removeEventListener("error", errorHandler);
    };
  }, []);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BetaModeProvider>
          <TooltipProvider>
            <ForceUpdateListener />
            <GlobalErrorHandler />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/vendas" element={<Landing />} />
                <Route path="/dashboard" element={<Index />} />
                <Route path="/beta" element={<BetaDashboard />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/members" element={<Members />} />
                <Route path="/agendar" element={<PublicBooking />} />
                <Route path="/agendar/:userId" element={<PublicBooking />} />
                <Route path="/awaiting-activation" element={<AwaitingActivation />} />
                <Route path="/portal" element={<TeamPortalLogin />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </BetaModeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

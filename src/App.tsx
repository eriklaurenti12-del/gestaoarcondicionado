import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import ResetPassword from "./pages/ResetPassword";
import Members from "./pages/Members";
import PublicBooking from "./pages/PublicBooking";
import NotFound from "./pages/NotFound";
import AwaitingActivation from "./pages/AwaitingActivation";
import TeamPortalLogin from "./pages/TeamPortalLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/vendas" element={<Landing />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/members" element={<Members />} />
            <Route path="/agendar" element={<PublicBooking />} />
            <Route path="/awaiting-activation" element={<AwaitingActivation />} />
            <Route path="/portal" element={<TeamPortalLogin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

/**
 * Breeze CRM - Main App Component
 *
 * Routing Structure:
 * - Public routes: Landing, Auth, Demo
 * - Protected routes: All others (require auth + profile + workspace)
 * - Onboarding: Special route for new users
 */

import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard, PublicRoute } from "@/components/AuthGuard";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { startKeepAlive } from "@/lib/supabaseKeepAlive";

// Pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Demo from "./pages/Demo";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import NextActions from "./pages/NextActions";
import Inbox from "./pages/Inbox";
import Leads from "./pages/Leads";
import LeadProfile from "./pages/LeadProfile";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Deals from "./pages/Deals";
import DealDetail from "./pages/DealDetail";
import Forecast from "./pages/Forecast";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import Workflows from "./pages/Workflows";
import WorkflowEditor from "./pages/WorkflowEditor";
import Analytics from "./pages/Analytics";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import Import from "./pages/Import";
import CommandCenter from "./pages/CommandCenter";
import Subscribe from "./pages/Subscribe";
import BishopSettings from "./pages/BishopSettings";
import Pawn from "./pages/Pawn";
import Rook from "./pages/Rook";
import Knight from "./pages/Knight";
import KnightDashboard from "./pages/KnightDashboard";
import MetaIntegration from "./pages/MetaIntegration";
import MetaCallback from "./pages/MetaCallback";
import Waitlist from "./pages/Waitlist";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC ROUTES - No auth required */}
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/demo" element={<PublicRoute><Demo /></PublicRoute>} />
      <Route path="/subscribe" element={<PublicRoute><Subscribe /></PublicRoute>} />
      <Route path="/waitlist" element={<PublicRoute><Waitlist /></PublicRoute>} />

      {/* ONBOARDING - Requires auth but not profile/workspace */}
      <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />

      {/* PROTECTED ROUTES - Requires auth + profile + workspace */}
      <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/next-actions" element={<AuthGuard><NextActions /></AuthGuard>} />
      <Route path="/inbox" element={<AuthGuard><Inbox /></AuthGuard>} />
      <Route path="/leads" element={<AuthGuard><Leads /></AuthGuard>} />
      <Route path="/leads/:id" element={<AuthGuard><LeadProfile /></AuthGuard>} />
      <Route path="/contacts" element={<AuthGuard><Contacts /></AuthGuard>} />
      <Route path="/contacts/:id" element={<AuthGuard><ContactDetail /></AuthGuard>} />
      <Route path="/deals" element={<AuthGuard><Deals /></AuthGuard>} />
      <Route path="/deal/:id" element={<AuthGuard><DealDetail /></AuthGuard>} />
      <Route path="/forecast" element={<AuthGuard><Forecast /></AuthGuard>} />
      <Route path="/agents" element={<AuthGuard><Agents /></AuthGuard>} />
      <Route path="/agents/:id" element={<AuthGuard><AgentDetail /></AuthGuard>} />
      <Route path="/bishop" element={<AuthGuard><BishopSettings /></AuthGuard>} />
      <Route path="/pawn" element={<AuthGuard><Pawn /></AuthGuard>} />
      <Route path="/rook" element={<AuthGuard><Rook /></AuthGuard>} />
      <Route path="/knight" element={<AuthGuard><KnightDashboard /></AuthGuard>} />
      <Route path="/knight/settings" element={<AuthGuard><Knight /></AuthGuard>} />
      <Route path="/workflows" element={<AuthGuard><Workflows /></AuthGuard>} />
      <Route path="/workflows/:id" element={<AuthGuard><WorkflowEditor /></AuthGuard>} />
      <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
      <Route path="/reports" element={<AuthGuard><Reports /></AuthGuard>} />
      <Route path="/analytics" element={<AuthGuard><Analytics /></AuthGuard>} />
      <Route path="/companies" element={<AuthGuard><Companies /></AuthGuard>} />
      <Route path="/companies/:id" element={<AuthGuard><CompanyDetail /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
      <Route path="/settings/import" element={<AuthGuard><Import /></AuthGuard>} />
      <Route path="/command-center" element={<AuthGuard><CommandCenter /></AuthGuard>} />

      {/* INTEGRATIONS */}
      <Route path="/integrations/meta" element={<AuthGuard><MetaIntegration /></AuthGuard>} />
      <Route path="/meta/callback" element={<MetaCallback />} />

      {/* REDIRECTS */}
      <Route path="/approvals" element={<AuthGuard><CommandCenter /></AuthGuard>} />
      <Route path="/select-crm" element={<AuthGuard><Deals /></AuthGuard>} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  // Start keep-alive to prevent Supabase cold starts
  useEffect(() => {
    startKeepAlive();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

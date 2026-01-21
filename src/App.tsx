/**
 * V1 MODE: Single Sales CRM, conversation-first.
 * Other CRM types intentionally disabled until V2.
 * User flow: Landing → Auth → Pipeline → Deal → Conversation
 */

import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { WorkspaceProvider, useWorkspace } from "@/hooks/useWorkspace";
import { ThemeProvider } from "@/hooks/useTheme";
import Landing from "./pages/Landing";
import Demo from "./pages/Demo";
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
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import { FeedbackWidget } from "./components/feedback/FeedbackWidget";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Protected route that requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: workspaceLoading } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC ROUTES - No auth required */}
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/demo" element={<Demo />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* PROTECTED ROUTES - Auth required */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/next-actions"
        element={
          <ProtectedRoute>
            <NextActions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <Inbox />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <Leads />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <LeadProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <Contacts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/:id"
        element={
          <ProtectedRoute>
            <ContactDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deals"
        element={
          <ProtectedRoute>
            <Deals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deal/:id"
        element={
          <ProtectedRoute>
            <DealDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forecast"
        element={
          <ProtectedRoute>
            <Forecast />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agents"
        element={
          <ProtectedRoute>
            <Agents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agents/:id"
        element={
          <ProtectedRoute>
            <AgentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows"
        element={
          <ProtectedRoute>
            <Workflows />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows/:id"
        element={
          <ProtectedRoute>
            <WorkflowEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <ProtectedRoute>
            <Companies />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/:id"
        element={
          <ProtectedRoute>
            <CompanyDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/import"
        element={
          <ProtectedRoute>
            <Import />
          </ProtectedRoute>
        }
      />
      <Route
        path="/command-center"
        element={
          <ProtectedRoute>
            <CommandCenter />
          </ProtectedRoute>
        }
      />
      {/* Redirect old /approvals route to new /command-center */}
      <Route path="/approvals" element={<Navigate to="/command-center" replace />} />
      {/* V1: SelectCRM route disabled - redirect to deals */}
      <Route path="/select-crm" element={<Navigate to="/deals" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Lazy import to avoid circular deps
import Auth from "./pages/Auth";
const AuthPage = Auth;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
              <FeedbackWidget />
            </BrowserRouter>
          </TooltipProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

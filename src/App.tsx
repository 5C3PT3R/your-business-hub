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
import Landing from "./pages/Landing";
import Demo from "./pages/Demo";
import Actions from "./pages/Actions";
import Leads from "./pages/Leads";
import LeadProfile from "./pages/LeadProfile";
import Contacts from "./pages/Contacts";
import Deals from "./pages/Deals";
import DealDetail from "./pages/DealDetail";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
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

      {/* PROTECTED ROUTES - Auth required */}
      <Route
        path="/actions"
        element={
          <ProtectedRoute>
            <Actions />
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
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
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
  </QueryClientProvider>
);

export default App;

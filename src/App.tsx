import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Rounds from "./pages/Rounds";
import NewRound from "./pages/NewRound";
import RoundDetail from "./pages/RoundDetail";
import HoleCapture from "./pages/HoleCapture";
import Courses from "./pages/Courses";
import CourseEditor from "./pages/CourseEditor";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex app-shell items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex app-shell items-center justify-center text-muted-foreground">Cargando...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/rondas" element={<ProtectedRoute><Rounds /></ProtectedRoute>} />
    <Route path="/rondas/nueva" element={<ProtectedRoute><NewRound /></ProtectedRoute>} />
    <Route path="/rondas/:roundId" element={<ProtectedRoute><RoundDetail /></ProtectedRoute>} />
    <Route path="/rondas/:roundId/hoyo/:holeNum" element={<ProtectedRoute><HoleCapture /></ProtectedRoute>} />
    <Route path="/campos" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
    <Route path="/campos/:courseId" element={<ProtectedRoute><CourseEditor /></ProtectedRoute>} />
    <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

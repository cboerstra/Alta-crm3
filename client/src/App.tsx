import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Leads from "./pages/Leads";
import LeadProfile from "./pages/LeadProfile";
import Pipeline from "./pages/Pipeline";
import Webinars from "./pages/Webinars";
import WebinarDetail from "./pages/WebinarDetail";
import LandingPages from "./pages/LandingPages";
import Scheduling from "./pages/Scheduling";
import Deals from "./pages/Deals";
import Revenue from "./pages/Revenue";
import SettingsPage from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import PublicLandingPage from "./pages/PublicLandingPage";
import PublicBooking from "./pages/PublicBooking";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import { useAuth } from "./_core/hooks/useAuth";
import { ShieldAlert } from "lucide-react";

/** Wrapper that only renders children if the current user is an admin */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          You do not have permission to access this page. Contact your administrator to request admin access.
        </p>
      </div>
    );
  }

  return <Component />;
}

function CRMRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        {/* All users can access these */}
        <Route path="/" component={Home} />
        <Route path="/leads" component={Leads} />
        <Route path="/leads/:id" component={LeadProfile} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/webinars" component={Webinars} />
        <Route path="/webinars/:id" component={WebinarDetail} />
        <Route path="/landing-pages" component={LandingPages} />
        <Route path="/scheduling" component={Scheduling} />
        <Route path="/deals" component={Deals} />
        <Route path="/revenue" component={Revenue} />
        {/* Admin-only routes */}
        <Route path="/users">
          {() => <AdminRoute component={UserManagement} />}
        </Route>
        <Route path="/settings">
          {() => <AdminRoute component={SettingsPage} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Auth routes */}
      <Route path="/login" component={Login} />
      <Route path="/setup" component={Setup} />
      {/* Public routes */}
      <Route path="/lp/:slug" component={PublicLandingPage} />
      <Route path="/schedule/:slug" component={PublicBooking} />
      {/* CRM routes (protected via DashboardLayout) */}
      <Route component={CRMRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

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
import PublicLandingPage from "./pages/PublicLandingPage";
import PublicBooking from "./pages/PublicBooking";

function CRMRoutes() {
  return (
    <DashboardLayout>
      <Switch>
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
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
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

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import DashboardLayout from "@/pages/dashboard-layout";
import Dashboard from "@/pages/dashboard";
import Representatives from "@/pages/representatives";
import Statistics from "@/pages/statistics";
import Cards from "@/pages/cards";
import MiniApp from "@/pages/mini-app";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/mini-app" component={MiniApp} />
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/representatives">
        <DashboardLayout>
          <Representatives />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/statistics">
        <DashboardLayout>
          <Statistics />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/cards">
        <DashboardLayout>
          <Cards />
        </DashboardLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

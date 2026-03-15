import { Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './store/appStore';
import Layout from './components/Layout';
import SEOHead from './components/SEOHead';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import GlobalPulse from './pages/GlobalPulse';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Milestones from './pages/Milestones';
import Proposals from './pages/Proposals';
import Verification from './pages/Verification';
import Reputation from './pages/Reputation';
import Assets from './pages/Assets';
import AgentEconomy from './pages/AgentEconomy';
import AgentsLanding from './pages/AgentsLanding';
import BuildersLanding from './pages/BuildersLanding';
import NgoLanding from './pages/NgoLanding';
import EnterpriseLanding from './pages/EnterpriseLanding';
import CitiesLanding from './pages/CitiesLanding';
import NexusAI from './pages/NexusAI';
import FeatureKits from './pages/FeatureKits';
import AgentReadiness from './pages/AgentReadiness';
import OwnerDashboard from './pages/OwnerDashboard';
import { PUBLIC_ROUTES } from './config/routes';

function AppShell({ children }) {
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.includes(location.pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <Layout>
      {children}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SEOHead />
      <AppShell>
        <Routes>
          {/* Public landing pages — no shell */}
          <Route path="/" element={<Landing />} />
          <Route path="/pulse" element={<GlobalPulse />} />
          <Route path="/agents" element={<AgentsLanding />} />
          <Route path="/builders" element={<BuildersLanding />} />
          <Route path="/ngo" element={<NgoLanding />} />
          <Route path="/enterprise" element={<EnterpriseLanding />} />
          <Route path="/cities" element={<CitiesLanding />} />

          {/* App shell routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/reputation" element={<Reputation />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/agent-economy" element={<AgentEconomy />} />
          <Route path="/nexus-ai" element={<NexusAI />} />
          <Route path="/feature-kits" element={<FeatureKits />} />
          <Route path="/agent-readiness" element={<AgentReadiness />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        </Routes>
      </AppShell>
    </AppProvider>
  );
}

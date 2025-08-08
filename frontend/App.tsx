import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LinkGenerator from './pages/LinkGenerator';
import BulkLinkGenerator from './pages/BulkLinkGenerator';
import LinkManager from './pages/LinkManager';
import CampaignManager from './pages/CampaignManager';
import Analytics from './pages/Analytics';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import TemplateEditor from './pages/TemplateEditor';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="links" element={<LinkGenerator />} />
                  <Route path="bulk-links" element={<BulkLinkGenerator />} />
                  <Route path="link-manager" element={<LinkManager />} />
                  <Route path="campaign-manager" element={<CampaignManager />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="advanced-analytics" element={<AdvancedAnalytics />} />
                  <Route path="templates" element={<TemplateEditor />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
              <Toaster />
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

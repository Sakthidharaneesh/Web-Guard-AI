import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomeTab from './components/HomeTab';
import LiveTab from './components/LiveTab';
import TrafficTab from './components/TrafficTab';
import AttackTab from './components/AttackTab';
import ClientTab from './components/ClientTab';
import GroqReportModal from './components/GroqReportModal';
import { checkHealth, getStats } from './api';
import { exportDashboardPDF } from './utils/exporter';
import { 
  Shield, 
  Activity, 
  Bug, 
  Users, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [backendStatus, setBackendStatus] = useState({ online: false, latency: null });
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [groqModalOpen, setGroqModalOpen] = useState(false);

  // Poll backend health
  const verifyBackend = async () => {
    const t0 = performance.now();
    try {
      const res = await checkHealth();
      const latency = Math.round(performance.now() - t0);
      setBackendStatus({ online: res.status === 'ok', latency });
      
      const statsRes = await getStats();
      setStats(statsRes);
    } catch (err) {
      setBackendStatus({ online: false, latency: null });
    }
  };

  useEffect(() => {
    verifyBackend();
    const timer = setInterval(verifyBackend, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDashboardPDF('dashboard-container', `WebGuard_${activeTab}_Report.pdf`);
    } catch (err) {
      alert('Failed to export dashboard report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-gray-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* Dynamic Ambient Background Glows */}
      <div className="fixed inset-0 cyber-grid-bg opacity-20 pointer-events-none z-0" />
      <div className="fixed -top-40 -left-40 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0 animate-pulse-glow" />
      <div className="fixed top-1/3 -right-40 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed -bottom-40 left-1/3 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        onExport={handleExport}
        exporting={exporting}
        onOpenGroqReport={() => setGroqModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 space-y-6">
        
        {/* Simple & Clean System Status Ribbon */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            
            {/* Overall Protection Status */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400">Protection Status:</span>
              <span className="text-emerald-400 font-semibold">Active & Safe</span>
            </div>

            <div className="hidden sm:block text-gray-700">•</div>

            {/* Traffic Engine */}
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-gray-400">Traffic Engine:</span>
              <span className="text-blue-300 font-semibold">Monitoring Normal</span>
            </div>

            <div className="hidden sm:block text-gray-700">•</div>

            {/* Attack Shield */}
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-gray-400">Attack Shield:</span>
              <span className="text-emerald-300 font-semibold">Ready to Block</span>
            </div>

            <div className="hidden md:block text-gray-700">•</div>

            {/* Visitor Health */}
            <div className="hidden md:flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-gray-400">Visitor Health:</span>
              <span className="text-purple-300 font-semibold">Clean (Bots Filtered)</span>
            </div>

          </div>

          {/* AI Decision Support Model (Clickable) */}
          <button
            onClick={() => setGroqModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 px-3.5 py-1.5 rounded-xl border border-purple-500/30 hover:border-purple-400 text-purple-300 hover:text-white transition-all cursor-pointer shadow-sm group"
            title="Click to generate report with Groq LLM"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
            <span className="text-[11px] font-semibold">Groq AI Assistant: Generate Report</span>
          </button>

        </div>

        {/* Status Callout if backend offline */}
        {!backendStatus.online && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Backend server at <code className="bg-amber-950/60 px-2 py-0.5 rounded text-amber-200">http://localhost:5000</code> is starting or offline.
              </span>
            </div>
            <button
              onClick={verifyBackend}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Dashboard Content Container */}
        <div id="dashboard-container" className="space-y-6">
          {activeTab === 'home' && (
            <HomeTab
              setActiveTab={setActiveTab}
              stats={stats}
              backendStatus={backendStatus}
              onOpenGroqReport={() => setGroqModalOpen(true)}
            />
          )}
          {activeTab === 'live' && <LiveTab />}
          {activeTab === 'traffic' && <TrafficTab baselineStats={stats} />}
          {activeTab === 'attack' && <AttackTab onOpenGroqReport={() => setGroqModalOpen(true)} />}
          {activeTab === 'client' && <ClientTab clientStats={stats} />}
        </div>
      </main>

      {/* Groq AI Security Incident Report Modal */}
      <GroqReportModal
        isOpen={groqModalOpen}
        onClose={() => setGroqModalOpen(false)}
      />

      {/* Simple Clean Footer */}
      <footer className="border-t border-white/[0.06] bg-[#05070D] py-6 text-xs text-gray-500 font-sans relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
              <Shield className="w-3 h-3 text-cyan-400" />
            </div>
            <span className="text-gray-300 font-semibold">WebGuard AI — Simple & Smart Website Protection</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Real-Time Traffic Prediction</span>
            <span>•</span>
            <span>Automated Hacker Blocking</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">All Systems Operational</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

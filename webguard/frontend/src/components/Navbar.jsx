import React from 'react';
import { 
  Shield, 
  Activity, 
  Bug, 
  Users, 
  Download, 
  Radio, 
  LayoutDashboard, 
  Sparkles, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, backendStatus, onExport, exporting, onOpenGroqReport }) {
  const tabs = [
    { id: 'home', label: 'Overview', icon: LayoutDashboard },
    { id: 'live', label: 'Live Monitor', icon: Radio, isLive: true },
    { id: 'traffic', label: 'Traffic Forecast', icon: Activity },
    { id: 'attack', label: 'Attack Scanner', icon: Bug },
    { id: 'client', label: 'Bot Sentinel', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#070A12]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Branding */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3.5 cursor-pointer group select-none"
            title="Return to Overview"
          >
            <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-all duration-300">
              <Shield className="w-6 h-6 text-white" />
              <div className="absolute inset-0 rounded-2xl border border-white/30 animate-pulse pointer-events-none" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white font-sans">
                  Web<span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Guard</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  AI PROTECTION
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                Smart Website Traffic & Security System
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${
                    isActive 
                      ? 'text-white' 
                      : tab.isLive 
                      ? 'text-rose-400' 
                      : 'text-gray-400'
                  }`} />
                  
                  <span>{tab.label}</span>

                  {tab.isLive && (
                    <span className="relative flex h-2 w-2 ml-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Deck */}
          <div className="flex items-center gap-3">
            
            {/* System Status Pill */}
            <div
              id="backend-status-pill"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                backendStatus.online
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {backendStatus.online ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span>System Online</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                  <span>System Offline</span>
                </>
              )}
            </div>

            {/* Groq AI Report Button */}
            <button
              id="open-groq-report-btn"
              onClick={onOpenGroqReport}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 hover:from-blue-600/50 hover:to-purple-600/50 text-cyan-300 text-xs font-semibold border border-blue-500/30 hover:border-cyan-400 shadow-sm transition-all duration-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Groq AI Report</span>
            </button>

            {/* Export PDF Button */}
            <button
              id="export-dashboard-btn"
              onClick={onExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 text-xs font-semibold border border-white/[0.09] hover:border-blue-500/40 shadow-sm transition-all duration-200 disabled:opacity-50"
            >
              {exporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Download Report'}</span>
            </button>

          </div>

        </div>

        {/* Mobile Navigation Sub-Bar */}
        <div className="flex lg:hidden overflow-x-auto py-2.5 gap-1.5 border-t border-white/[0.05] scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white bg-white/[0.02]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
                {tab.isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}

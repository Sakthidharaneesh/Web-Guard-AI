import React, { useState } from 'react';
import {
  Users, ShieldAlert, ShieldCheck, Activity,
  Sliders, UserX, UserCheck, Zap, Sparkles, BarChart2
} from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { analyzeClient } from '../api';

export default function ClientTab({ clientStats }) {
  const [profile, setProfile] = useState({
    requests_per_min: 2.5,
    error_rate: 0.01,
    unique_urls: 8
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Client presets
  const presets = [
    {
      name: 'Normal Client',
      badge: 'Legitimate',
      color: 'emerald',
      desc: 'Typical interactive user session (2.5 req/min, 1% errors, 8 URLs)',
      values: { requests_per_min: 2.5, error_rate: 0.01, unique_urls: 8 }
    },
    {
      name: 'Bot Client (Fuzzer / Scanner)',
      badge: 'Bot Anomaly',
      color: 'rose',
      desc: 'High velocity probing & errors (620 req/min, 78% error rate)',
      values: { requests_per_min: 620, error_rate: 0.78, unique_urls: 5 }
    },
    {
      name: 'HTTP-Flood Client',
      badge: 'Flood DDoS',
      color: 'purple',
      desc: 'Massive volumetric barrage on single endpoint (4,800 req/min, 2 URLs)',
      values: { requests_per_min: 4800, error_rate: 0.05, unique_urls: 2 }
    },
    {
      name: 'Web Scraper Bot',
      badge: 'Scraper',
      color: 'amber',
      desc: 'Crawling site directory structure (180 req/min, 150 unique URLs)',
      values: { requests_per_min: 180, error_rate: 0.15, unique_urls: 150 }
    }
  ];

  const handleAnalyze = async (profToUse = profile) => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeClient(profToUse);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Client analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    setProfile(preset.values);
    handleAnalyze(preset.values);
  };

  const isAnomaly = result ? result.anomaly === -1 : false;
  const behaviorScore = result?.behavior_score ?? 0.385;

  // Scatter chart data comparing baseline distribution with current client
  const scatterBackgroundData = [
    { rpm: 1.2, err: 0.01, type: 'normal' },
    { rpm: 3.5, err: 0.02, type: 'normal' },
    { rpm: 5.0, err: 0.03, type: 'normal' },
    { rpm: 8.2, err: 0.01, type: 'normal' },
    { rpm: 12.0, err: 0.04, type: 'normal' },
    { rpm: 18.5, err: 0.02, type: 'normal' },
    { rpm: 350.0, err: 0.92, type: 'anomaly' },
    { rpm: 620.0, err: 0.78, type: 'anomaly' },
    { rpm: 750.0, err: 0.85, type: 'anomaly' },
    { rpm: 4800.0, err: 0.05, type: 'anomaly' },
  ];

  const currentPoint = [
    {
      rpm: Number(profile.requests_per_min),
      err: Number(profile.error_rate),
      type: 'current'
    }
  ];

  return (
    <div id="client-behavior-tab" className="space-y-6">
      
      {/* Top Anomaly Summary Card */}
      {result && (
        <div
          id="client-anomaly-banner"
          className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isAnomaly
              ? 'bg-rose-950/40 border-rose-500/60 shadow-glow-red'
              : 'bg-emerald-950/30 border-emerald-500/40 shadow-glow-green'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl ${
                isAnomaly
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {isAnomaly ? <UserX className="w-8 h-8" /> : <UserCheck className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-bold tracking-tight ${
                    isAnomaly ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isAnomaly ? 'SUSPICIOUS BOT ACTIVITY DETECTED' : 'VERIFIED LEGITIMATE USER'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isAnomaly
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isAnomaly ? 'Anomaly Flagged' : 'Human Profile'}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">
                {isAnomaly
                  ? 'Client behavioral velocity deviates significantly from typical users (rapid burst requests or excessive 4xx/5xx errors).'
                  : 'Client velocity, error frequency, and page navigation pattern conform to typical human browsing behavior.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-gray-900/80 px-4 py-2 rounded-xl border border-gray-800 text-center">
              <span className="text-gray-400 block text-[10px] uppercase font-medium">Visitor Status</span>
              <span className={`text-base font-bold ${isAnomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isAnomaly ? 'Bot Threat' : 'Safe Visitor'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Controls + Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input Form & Presets */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Preset Buttons */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" />
              Client Profile Presets
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  id={`client-preset-${idx}`}
                  onClick={() => applyPreset(preset)}
                  className="w-full text-left p-3 rounded-xl bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/40 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-200 group-hover:text-blue-400">
                        {preset.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          preset.color === 'rose'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : preset.color === 'purple'
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : preset.color === 'amber'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {preset.desc}
                    </p>
                  </div>
                  <Zap className="w-4 h-4 text-gray-600 group-hover:text-amber-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Input Controls */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-400" />
              Visitor Session Simulation
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-gray-300 font-medium">Requests Per Minute</label>
                  <span className="text-blue-400 font-bold">{profile.requests_per_min} req/min</span>
                </div>
                <input
                  type="number"
                  id="client-input-rpm"
                  value={profile.requests_per_min}
                  onChange={(e) => setProfile({ ...profile, requests_per_min: Number(e.target.value) })}
                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-gray-300 font-medium">Error Frequency (4xx / 5xx)</label>
                  <span className="text-amber-400 font-bold">{(profile.error_rate * 100).toFixed(1)}%</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  id="client-input-err"
                  value={profile.error_rate}
                  onChange={(e) => setProfile({ ...profile, error_rate: Number(e.target.value) })}
                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-gray-300 font-medium">Distinct Pages Visited</label>
                  <span className="text-purple-400 font-bold">{profile.unique_urls} pages</span>
                </div>
                <input
                  type="number"
                  id="client-input-urls"
                  value={profile.unique_urls}
                  onChange={(e) => setProfile({ ...profile, unique_urls: Number(e.target.value) })}
                  className="w-full bg-[#070A0F] border border-gray-800 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              id="analyze-client-btn"
              onClick={() => handleAnalyze(profile)}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Activity className="w-4 h-4" />
              {loading ? 'Evaluating...' : 'Check Visitor Authenticity'}
            </button>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Scatter Plot & Evaluation Metrics */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Scatter Chart: RPM vs Error Rate */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Client Behavioral Cluster Map
                </h4>
                <p className="text-[11px] text-gray-400">
                  Requests/Min (X-axis) vs Error Rate (Y-axis)
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  <span className="text-gray-300">Normal</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  <span className="text-gray-300">Anomalous</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block ring-2 ring-white/50" />
                  <span className="text-amber-300 font-bold">Current</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                  <XAxis
                    type="number"
                    dataKey="rpm"
                    name="Requests/Min"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="err"
                    name="Error Rate"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#374151',
                      borderRadius: '0.75rem',
                      color: '#F9FAFB',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Scatter name="Baseline Clients" data={scatterBackgroundData} fill="#3B82F6">
                    {scatterBackgroundData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.type === 'normal' ? '#3B82F6' : '#EF4444'}
                      />
                    ))}
                  </Scatter>
                  <Scatter name="Active Client" data={currentPoint} fill="#F59E0B" shape="star" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Behavioral Model Training Statistics */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              Visitor Profiling Database (1,000 Verified Sessions)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase font-medium">Verified Normal</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {clientStats?.metrics?.client?.normal_count ?? 970} (97%)
                </span>
                <span className="text-[10px] text-gray-500 block">Typical human browsing</span>
              </div>
              <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase font-medium">Flagged Anomalies</span>
                <span className="text-rose-400 font-bold text-sm">
                  {clientStats?.metrics?.client?.anomalous_count ?? 30} (3%)
                </span>
                <span className="text-[10px] text-gray-500 block">High-speed scrapers/bots</span>
              </div>
              <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase font-medium">Sentinel Engine</span>
                <span className="text-blue-400 font-bold text-sm">
                  Isolation Forest
                </span>
                <span className="text-[10px] text-gray-500 block">Real-time anomaly scoring</span>
              </div>
            </div>

            {/* Collapsed Statistical Details */}
            <details className="text-xs text-gray-400 bg-gray-950/60 border border-gray-800/80 rounded-xl p-2.5 mt-2">
              <summary className="cursor-pointer font-medium text-gray-400 hover:text-white flex items-center justify-between text-[11px]">
                <span>Technical Distribution Scores</span>
                <span className="text-blue-400 font-mono">Expand ▾</span>
              </summary>
              <div className="mt-2 pt-2 border-t border-gray-800/80 grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
                <div>Min: {clientStats?.metrics?.client?.min_score ?? 0.3366}</div>
                <div>Mean: {clientStats?.metrics?.client?.mean_score ?? 0.3856}</div>
                <div>Max: {clientStats?.metrics?.client?.max_score ?? 0.8157}</div>
              </div>
            </details>
          </div>

        </div>

      </div>

    </div>
  );
}

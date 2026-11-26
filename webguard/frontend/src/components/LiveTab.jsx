import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Upload, Activity, ShieldAlert, ShieldCheck,
  AlertTriangle, Globe, Terminal, Copy, Check, Zap, Sliders, Eye, X,
  Server, Filter, Database, ArrowUpRight, Flame
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid, Cell
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import {
  getLiveDatasets, getLiveState, controlLive, uploadLiveDataset, ingestLiveRequest
} from '../api';

export default function LiveTab() {
  const [liveState, setLiveState] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('unified_master');
  const [speed, setSpeed] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState('all'); // all | threats | anomalies
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState('python');
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);

  const fileInputRef = useRef(null);

  // Poll live telemetry state continuously
  const fetchState = async () => {
    try {
      const data = await getLiveState();
      setLiveState(data);
      setIsRunning(data.is_running);
      if (data.active_dataset_id) {
        setSelectedDataset(data.active_dataset_id);
      }
      if (data.speed) {
        setSpeed(data.speed);
      }
    } catch (err) {
      console.error('Failed to poll live state', err);
    }
  };

  const fetchDatasets = async () => {
    try {
      const data = await getLiveDatasets();
      setDatasets(data.datasets || []);
      if (data.active_dataset_id) {
        setSelectedDataset(data.active_dataset_id);
      }
    } catch (err) {
      console.error('Failed to load datasets', err);
    }
  };

  useEffect(() => {
    fetchDatasets();
    fetchState();
    const interval = setInterval(fetchState, 1000); // 1-second polling interval
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    try {
      await controlLive({ action: 'start', dataset_id: selectedDataset, speed });
      setIsRunning(true);
      fetchState();
    } catch (err) {
      alert('Failed to start live stream');
    }
  };

  const handlePause = async () => {
    try {
      await controlLive({ action: 'pause' });
      setIsRunning(false);
      fetchState();
    } catch (err) {
      alert('Failed to pause live stream');
    }
  };

  const handleReset = async () => {
    try {
      await controlLive({ action: 'reset' });
      setIsRunning(false);
      fetchState();
    } catch (err) {
      alert('Failed to reset live stream');
    }
  };

  const handleDatasetChange = async (newId) => {
    setSelectedDataset(newId);
    try {
      await controlLive({ action: 'select_dataset', dataset_id: newId });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    try {
      await controlLive({ action: 'set_speed', speed: newSpeed });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);
    try {
      const res = await uploadLiveDataset(file);
      setUploadMessage({ type: 'success', text: `Loaded dataset "${file.name}"` });
      await fetchDatasets();
      if (res.dataset_id) {
        setSelectedDataset(res.dataset_id);
      }
      fetchState();
    } catch (err) {
      setUploadMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upload dataset' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInjectAttack = async () => {
    const attackSamples = [
      "GET /admin?user=admin' OR '1'='1'-- HTTP/1.1\nHost: mywebsite.com\nUser-Agent: sqlmap/1.7#dev",
      "GET /search?q=<script>alert('Stealing Cookies!')</script> HTTP/1.1\nHost: mywebsite.com",
      "GET /download?file=../../../../etc/shadow HTTP/1.1\nHost: mywebsite.com",
      "POST /api/exec HTTP/1.1\nHost: mywebsite.com\n\ncmd=whoami; cat /etc/passwd"
    ];
    const picked = attackSamples[Math.floor(Math.random() * attackSamples.length)];
    try {
      await ingestLiveRequest({
        request_string: picked,
        client_ip: `198.51.100.${Math.floor(Math.random() * 200 + 10)}`,
        requests_per_min: 65.0,
        error_rate: 0.35,
        unique_urls: 2
      });
      fetchState();
    } catch (err) {
      alert('Failed to inject request');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter events
  const events = liveState?.recent_events || [];
  const filteredEvents = events.filter((ev) => {
    if (filter === 'threats') return ev.is_threat;
    if (filter === 'anomalies') return ev.is_client_anomaly;
    return true;
  });

  const kpis = liveState?.kpis || {
    total_processed: 0,
    threats_detected: 0,
    anomalies_flagged: 0,
    normal_count: 0,
    threat_rate_percent: 0,
    current_rps: 0,
    current_tsi: 0
  };

  // Prepare threat breakdown for bar chart
  const threatBreakdownData = Object.entries(liveState?.threat_breakdown || {})
    .filter(([name]) => name !== 'Normal / Safe Traffic')
    .map(([name, count]) => ({
      name: name.replace(' (SQLi)', '').replace(' (XSS)', '').replace(' / LFI', ''),
      count
    }));

  const timelineData = liveState?.timeline || [];

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Deck */}
      <div className="cyber-panel rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="relative flex h-3.5 w-3.5">
                {isRunning ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 shadow-md shadow-rose-500/50"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-gray-500"></span>
                )}
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Live SOC Radar & Stream Telemetry
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
                isRunning
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-white/[0.04] text-gray-400 border-white/[0.08]'
              }`}>
                {isRunning ? 'RADAR ACTIVE' : 'STREAM IDLE'}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Replay website traffic datasets or ingest live production requests with real-time multi-class threat classification and anomaly scoring.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Connect Production Website</span>
            </button>

            <button
              onClick={handleInjectAttack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all"
              title="Immediately inject a synthetic web attack to verify detection"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Inject Attack</span>
            </button>
          </div>

        </div>

        {/* Controls Ribbon */}
        <div className="mt-6 pt-5 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
          
          {/* Dataset Selector & Upload */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-300 font-medium">Dataset:</span>
              <select
                value={selectedDataset}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.type === 'uploaded' ? '📁' : ''}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.log,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-all disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-gray-400" />
              <span>{uploading ? 'Uploading...' : 'Upload Website CSV / Log'}</span>
            </button>

            {uploadMessage && (
              <span className={`text-xs px-2.5 py-1 rounded-md ${
                uploadMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {uploadMessage.text}
              </span>
            )}
          </div>

          {/* Playback Controls & Speed */}
          <div className="flex items-center gap-3">
            
            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-lg border border-gray-800 text-xs">
              <span className="text-[10px] text-gray-500 px-1 font-mono">SPEED:</span>
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                    speed === s
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Play/Pause/Reset Buttons */}
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Stream</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 transition-all"
                >
                  <Pause className="w-3.5 h-3.5 fill-white" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs transition-all"
                title="Reset counters and event stream"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                <span>Reset</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Real-time KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Processed */}
        <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Processed Requests</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-cyan-400 border border-cyan-500/20">
              <Server className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">{kpis.total_processed.toLocaleString()}</div>
            <div className="text-[11px] text-gray-400 mt-1">Live through ML pipeline</div>
          </div>
        </div>

        {/* Live Throughput (RPS) */}
        <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Throughput (RPS)</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-cyan-300 flex items-center gap-2">
              <span>{kpis.current_rps} req/s</span>
              {isRunning && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Replay ingestion rate</div>
          </div>
        </div>

        {/* Dynamic Traffic Surge Level */}
        <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Traffic Condition</span>
            <div className={`p-1.5 rounded-lg border ${
              kpis.current_tsi >= 0.75 
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                : kpis.current_tsi >= 0.50 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-bold font-sans ${
              kpis.current_tsi >= 0.75 ? 'text-rose-400' : kpis.current_tsi >= 0.50 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {kpis.current_tsi >= 0.75 ? 'Critical Surge' : kpis.current_tsi >= 0.50 ? 'Elevated Rush' : 'Normal Flow'}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  kpis.current_tsi >= 0.75 ? 'bg-rose-500 shadow-sm shadow-rose-500/50' : kpis.current_tsi >= 0.50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(8, kpis.current_tsi * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Load index: {Math.round(kpis.current_tsi * 100)}%</div>
          </div>
        </div>

        {/* Threats Blocked */}
        <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Threats Intercepted</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-rose-400">{kpis.threats_detected.toLocaleString()}</div>
            <div className="text-[11px] text-rose-300/80 mt-1">{kpis.threat_rate_percent}% threat ratio</div>
          </div>
        </div>

        {/* Bot Anomalies Flagged */}
        <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Client Anomalies</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-purple-300">{kpis.anomalies_flagged.toLocaleString()}</div>
            <div className="text-[11px] text-gray-400 mt-1">Isolation Forest (3% contam.)</div>
          </div>
        </div>

      </div>

      {/* Live Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Rolling Area Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-[#0D1322] border border-white/[0.08] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Live Traffic & Intercepted Threats Timeline</h3>
              <p className="text-xs text-gray-400">Rolling real-time request volume vs malicious payloads</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Normal Traffic
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Blocked Threats
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="normal" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#normalGrad)" />
                  <Area type="monotone" dataKey="threats" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#threatGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono">
                Click "Start Stream" above or inject requests to populate real-time chart.
              </div>
            )}
          </div>
        </div>

        {/* Threat Distribution Chart */}
        <div className="p-6 rounded-3xl bg-[#0D1322] border border-white/[0.08] shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Threat Signature Distribution</h3>
            <p className="text-xs text-gray-400">Classified multi-class attack categories</p>
          </div>

          <div className="h-60 w-full mt-4">
            {threatBreakdownData.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatBreakdownData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" stroke="#4b5563" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090D18', borderColor: '#1F293D', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                  />
                  <Bar dataKey="count" fill="#f43f5e" radius={[0, 6, 6, 0]}>
                    {threatBreakdownData.map((entry, index) => {
                      const colors = ['#f43f5e', '#fbbf24', '#a855f7', '#ec4899', '#3b82f6'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono text-center">
                No security threats detected in current window.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Live Request Stream Table */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0D1322] border border-white/[0.08] shadow-2xl space-y-5">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Real-Time Request Telemetry Stream</span>
            </h3>
            <p className="text-xs text-gray-400">Continuous feed of requests analyzed by WebGuard's composite risk core</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/[0.07] text-xs font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setFilter('threats')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'threats' ? 'bg-rose-600 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Threats ({events.filter(e => e.is_threat).length})
            </button>
            <button
              onClick={() => setFilter('anomalies')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === 'anomalies' ? 'bg-purple-600 text-white font-semibold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Anomalies ({events.filter(e => e.is_client_anomaly).length})
            </button>
          </div>
        </div>

        {/* Telemetry Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-800/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3">Time</th>
                <th className="py-3 px-3">Client IP</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Endpoint Path</th>
                <th className="py-3 px-3">Classification</th>
                <th className="py-3 px-3">Composite Risk</th>
                <th className="py-3 px-3">Latency</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 font-mono">
              {filteredEvents.length > 0 ? (
                filteredEvents.slice(0, 20).map((ev) => {
                  const isThreat = ev.is_threat;
                  const riskPercent = Math.round(ev.risk_score * 100);

                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`hover:bg-gray-800/40 cursor-pointer transition-colors ${
                        isThreat ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-gray-400">{ev.timestamp}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-200">{ev.client_ip}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.method === 'POST' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {ev.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300 max-w-[220px] truncate" title={ev.path}>
                        {ev.path}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isThreat
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : ev.is_client_anomaly
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {isThreat ? <ShieldAlert className="w-3 h-3 text-rose-400" /> : <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                          <span>{ev.attack_type}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${
                            isThreat ? 'text-rose-400' : ev.risk_score > 0.35 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {ev.risk_score.toFixed(2)}
                          </span>
                          <div className="w-14 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${
                                isThreat ? 'bg-rose-500' : ev.risk_score > 0.35 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, riskPercent)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-[11px]">{ev.latency_ms}ms</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                          className="px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-[11px] font-sans transition-all"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 font-mono">
                    {isRunning ? 'Listening for incoming telemetry...' : 'No telemetry in current filter. Click "Start Stream" above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Inspect Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0E131F] border border-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase border ${
                    selectedEvent.is_threat ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {selectedEvent.attack_type}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{selectedEvent.timestamp}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">Telemetry Forensic Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simple Security Analysis Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className="text-[11px] text-gray-400">Security Verdict</div>
                <div className={`text-sm font-bold mt-1 ${selectedEvent.is_threat ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedEvent.is_threat ? 'Blocked Threat' : 'Safe Request'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className="text-[11px] text-gray-400">Payload Scan</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedEvent.attack_probability > 0.5 ? 'Malicious Code' : 'Clean Request'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className="text-[11px] text-gray-400">Client Origin</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedEvent.behavior_score > 0.5 ? 'Bot / Scanner' : 'Normal Visitor'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className="text-[11px] text-gray-400">Traffic Load</div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedEvent.traffic_surge_index >= 0.7 ? 'Heavy Surge' : 'Normal Flow'}
                </div>
              </div>
            </div>

            {/* Optional Math Scoring (Collapsed) */}
            <details className="text-xs text-gray-400 bg-gray-950/60 border border-gray-800/80 rounded-xl p-3">
              <summary className="cursor-pointer font-medium text-gray-300 hover:text-white flex items-center justify-between">
                <span>View Mathematical Scoring & Formula Weights</span>
                <span className="text-[11px] text-blue-400 font-mono">Expand ▾</span>
              </summary>
              <div className="mt-3 pt-3 border-t border-gray-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
                <div className="p-2 rounded bg-gray-900">
                  <div className="text-[10px] text-gray-500">Attack Prob (40%)</div>
                  <div className="text-xs font-bold text-white mt-0.5">{(selectedEvent.attack_probability * 100).toFixed(1)}%</div>
                </div>
                <div className="p-2 rounded bg-gray-900">
                  <div className="text-[10px] text-gray-500">Behavior Score (30%)</div>
                  <div className="text-xs font-bold text-white mt-0.5">{selectedEvent.behavior_score.toFixed(3)}</div>
                </div>
                <div className="p-2 rounded bg-gray-900">
                  <div className="text-[10px] text-gray-500">Surge TSI (30%)</div>
                  <div className="text-xs font-bold text-white mt-0.5">{selectedEvent.traffic_surge_index.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded bg-gray-900">
                  <div className="text-[10px] text-gray-500">Composite Score</div>
                  <div className={`text-xs font-bold mt-0.5 ${selectedEvent.is_threat ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedEvent.risk_score.toFixed(4)}
                  </div>
                </div>
              </div>
            </details>

            {/* Raw HTTP Request String */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5 font-medium">
                <span>Raw HTTP Request Payload:</span>
                <button
                  onClick={() => copyToClipboard(selectedEvent.request_string)}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                {selectedEvent.request_string}
              </pre>
            </div>

            {/* Automated Mitigation Rule (iptables & Nginx) */}
            {selectedEvent.is_threat && (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Instant Mitigation Rule</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`iptables -A INPUT -s ${selectedEvent.client_ip} -j DROP`)}
                    className="flex items-center gap-1 text-xs text-rose-300 hover:text-white bg-rose-900/40 px-2.5 py-1 rounded"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy iptables</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-gray-950/80 text-rose-200 text-xs font-mono">
                  iptables -A INPUT -s {selectedEvent.client_ip} -j DROP
                </pre>
              </div>
            )}

            {/* LLM Report if exists */}
            {selectedEvent.llm_report && (
              <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 text-xs text-gray-300 prose prose-invert max-w-none">
                <ReactMarkdown>{selectedEvent.llm_report}</ReactMarkdown>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold"
              >
                Close Inspection
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Connect Real Website Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0E131F] border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  <span>Connect Your Production Website to WebGuard</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Send live HTTP requests from your website to WebGuard in real-time.
                </p>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Endpoint Callout */}
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs font-mono flex items-center justify-between text-indigo-300">
              <span>POST http://localhost:5000/api/v1/live/ingest</span>
              <button
                onClick={() => copyToClipboard('http://localhost:5000/api/v1/live/ingest')}
                className="p-1 hover:text-white"
                title="Copy API Endpoint"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Code Tabs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 text-xs">
                {['python', 'node', 'nginx', 'curl'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveCodeTab(tab)}
                    className={`px-3 py-1 rounded-lg capitalize font-mono transition-all ${
                      activeCodeTab === tab
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {tab === 'python' ? 'Python Flask' : tab === 'node' ? 'Node Express' : tab === 'nginx' ? 'Nginx Config' : 'cURL'}
                  </button>
                ))}
              </div>

              {activeCodeTab === 'python' && (
                <pre className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-300 font-mono text-xs overflow-x-auto whitespace-pre">
{`# In your Flask application:
import requests
from flask import request

@app.before_request
def forward_to_webguard():
    try:
        raw_req = f"{request.method} {request.full_path} HTTP/1.1\\nHost: {request.host}\\nX-Forwarded-For: {request.remote_addr}"
        requests.post("http://localhost:5000/api/v1/live/ingest", json={
            "request_string": raw_req,
            "client_ip": request.remote_addr,
            "requests_per_min": 12.0
        }, timeout=0.1)
    except Exception:
        pass  # Non-blocking async fire-and-forget`}
                </pre>
              )}

              {activeCodeTab === 'node' && (
                <pre className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-300 font-mono text-xs overflow-x-auto whitespace-pre">
{`// In your Express.js app:
const axios = require('axios');

app.use((req, res, next) => {
  const reqStr = \`\${req.method} \${req.originalUrl} HTTP/1.1\\nHost: \${req.headers.host}\\nX-Forwarded-For: \${req.ip}\`;
  axios.post('http://localhost:5000/api/v1/live/ingest', {
    request_string: reqStr,
    client_ip: req.ip,
    requests_per_min: 10
  }).catch(() => {});
  next();
});`}
                </pre>
              )}

              {activeCodeTab === 'nginx' && (
                <pre className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-300 font-mono text-xs overflow-x-auto whitespace-pre">
{`# Mirror live traffic in Nginx:
location / {
    mirror /mirror_webguard;
    proxy_pass http://my_upstream_app;
}

location = /mirror_webguard {
    internal;
    proxy_pass http://127.0.0.1:5000/api/v1/live/ingest;
    proxy_pass_request_body on;
}`}
                </pre>
              )}

              {activeCodeTab === 'curl' && (
                <pre className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-300 font-mono text-xs overflow-x-auto whitespace-pre">
{`curl -X POST http://localhost:5000/api/v1/live/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "request_string": "GET /products?id=1 HTTP/1.1\\nHost: mystore.com",
    "client_ip": "203.0.113.195",
    "requests_per_min": 8.5
  }'`}
                </pre>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

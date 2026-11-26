import React, { useState } from 'react';
import {
  ShieldAlert, ShieldCheck, Bug, Terminal, FileCode2,
  AlertTriangle, Flame, Cpu, ArrowRight, Zap, Copy, Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeAttack } from '../api';

export default function AttackTab({ onOpenGroqReport }) {
  const [requestString, setRequestString] = useState(
    "GET /login?user=' OR 1=1 -- HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\nAccept: */*"
  );

  const [clientFields, setClientFields] = useState({
    requests_per_min: 15.0,
    error_rate: 0.25,
    unique_urls: 4.0,
    traffic_surge_index: 0.35
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Attack samples
  const attackPresets = [
    {
      name: 'SQL Injection',
      badge: 'SQLi',
      color: 'rose',
      text: "GET /login?user=' OR 1=1 -- HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0",
      client: { requests_per_min: 15.0, error_rate: 0.25, unique_urls: 4.0, traffic_surge_index: 0.35 }
    },
    {
      name: 'Cross-Site Scripting',
      badge: 'XSS',
      color: 'amber',
      text: "GET /search?q=<script>alert('XSS')</script> HTTP/1.1\nHost: store.webguard.local\nAccept: text/html",
      client: { requests_per_min: 8.0, error_rate: 0.05, unique_urls: 6.0, traffic_surge_index: 0.20 }
    },
    {
      name: 'Path Traversal / LFI',
      badge: 'Traversal',
      color: 'purple',
      text: "GET /view?file=../../../../etc/passwd HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Scanner/2.1",
      client: { requests_per_min: 35.0, error_rate: 0.60, unique_urls: 12.0, traffic_surge_index: 0.30 }
    },
    {
      name: 'Normal Browsing Request',
      badge: 'Clean',
      color: 'emerald',
      text: "GET /catalog/categories HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0\nAccept: */*",
      client: { requests_per_min: 2.5, error_rate: 0.01, unique_urls: 8.0, traffic_surge_index: 0.0 }
    }
  ];

  const handleAnalyze = async (textToAnalyze = requestString, clientToUse = clientFields) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        request_string: textToAnalyze,
        requests_per_min: Number(clientToUse.requests_per_min),
        error_rate: Number(clientToUse.error_rate),
        unique_urls: Number(clientToUse.unique_urls),
        traffic_surge_index: Number(clientToUse.traffic_surge_index)
      };
      const data = await analyzeAttack(payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Attack analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    setRequestString(preset.text);
    setClientFields(preset.client);
    handleAnalyze(preset.text, preset.client);
  };

  const handleCopyReport = () => {
    if (!result?.llm_report) return;
    navigator.clipboard.writeText(result.llm_report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isThreat = result?.is_threat;
  const riskScore = result?.risk_score ?? 0;
  const attackProb = result?.attack_probability ?? 0;
  const behaviorScore = result?.behavior_score ?? 0;
  const tsi = result?.traffic_surge_index ?? 0;

  return (
    <div id="attack-detection-tab" className="space-y-6">
      
      {/* Top Threat / Clean Banner */}
      {result && (
        <div
          id="threat-status-banner"
          className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isThreat
              ? 'bg-rose-950/40 border-rose-500/60 shadow-glow-red'
              : 'bg-emerald-950/30 border-emerald-500/40 shadow-glow-green'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl ${
                isThreat
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {isThreat ? (
                <ShieldAlert className="w-8 h-8" />
              ) : (
                <ShieldCheck className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-bold tracking-tight ${
                    isThreat ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isThreat ? 'SECURITY THREAT BLOCKED' : 'VERIFIED SAFE REQUEST'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isThreat
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isThreat ? 'Critical Threat Action Triggered' : 'Clean Request Allowed'}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">
                {isThreat
                  ? 'High probability payload exploit correlated with anomalous behavior metrics. Automated mitigation triggered.'
                  : 'Normal user payload signature and legitimate client velocity. No defensive countermeasure required.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-gray-900/80 px-3 py-2 rounded-xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-medium">Payload Check</span>
              <span className={`text-sm font-bold ${attackProb > 0.5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {attackProb > 0.5 ? 'Malicious' : 'Clean'}
              </span>
            </div>
            <div className="bg-gray-900/80 px-3 py-2 rounded-xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-medium">Client Origin</span>
              <span className={`text-sm font-bold ${behaviorScore > 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {behaviorScore > 0.5 ? 'Bot / Scanner' : 'Human Visitor'}
              </span>
            </div>
            <div className="bg-gray-900/80 px-3 py-2 rounded-xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-medium">Server Traffic</span>
              <span className={`text-sm font-bold ${tsi > 0.7 ? 'text-rose-400' : 'text-blue-400'}`}>
                {tsi > 0.7 ? 'Surge Flood' : 'Normal Load'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Request Inspector + Risk Engine Decomp */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: HTTP Request Editor & Presets */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                Raw HTTP Request Payload
              </h3>
              <span className="text-xs font-mono text-gray-400">
                {requestString.length} chars
              </span>
            </div>

            {/* Attack Preset Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {attackPresets.map((preset, idx) => (
                <button
                  key={idx}
                  id={`attack-preset-${idx}`}
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    preset.color === 'rose'
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : preset.color === 'amber'
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : preset.color === 'purple'
                      ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <span className="font-bold mr-1.5">[{preset.badge}]</span>
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Request Textarea */}
            <textarea
              id="http-request-textarea"
              rows={6}
              value={requestString}
              onChange={(e) => setRequestString(e.target.value)}
              className="w-full bg-[#070A0F] border border-gray-800 rounded-xl p-3 text-xs font-mono text-blue-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
              placeholder="Paste raw HTTP request string here..."
            />

            {/* Optional Client Context Parameters */}
            <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80 space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Client Simulation Parameters
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="text-gray-400 text-[11px] block">Reqs / min</label>
                  <input
                    type="number"
                    id="attack-rpm"
                    value={clientFields.requests_per_min}
                    onChange={(e) => setClientFields({ ...clientFields, requests_per_min: Number(e.target.value) })}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-[11px] block">Error Rate</label>
                  <input
                    type="number"
                    step="0.05"
                    id="attack-err"
                    value={clientFields.error_rate}
                    onChange={(e) => setClientFields({ ...clientFields, error_rate: Number(e.target.value) })}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-[11px] block">Pages Visited</label>
                  <input
                    type="number"
                    id="attack-urls"
                    value={clientFields.unique_urls}
                    onChange={(e) => setClientFields({ ...clientFields, unique_urls: Number(e.target.value) })}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-[11px] block">Traffic Surge</label>
                  <input
                    type="number"
                    step="0.05"
                    id="attack-tsi"
                    value={clientFields.traffic_surge_index}
                    onChange={(e) => setClientFields({ ...clientFields, traffic_surge_index: Number(e.target.value) })}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-gray-200"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                id="analyze-attack-btn"
                onClick={() => handleAnalyze(requestString, clientFields)}
                disabled={loading}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                {loading ? 'Evaluating...' : 'Run Security Scan'}
              </button>

              <button
                type="button"
                onClick={onOpenGroqReport}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-blue-600/30 hover:from-purple-600/50 hover:to-blue-600/50 text-cyan-300 border border-purple-500/30 hover:border-cyan-400 font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Generate Groq Report</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Structural Features Inspector */}
          {result?.features && (
            <div className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-2">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
                Extracted Structural Features
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                  <span className="text-gray-500 block text-[10px]">Method</span>
                  <span className="text-gray-200 font-bold">{result.features.method}</span>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                  <span className="text-gray-500 block text-[10px]">URL Length</span>
                  <span className="text-gray-200">{result.features.url_length}</span>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                  <span className="text-gray-500 block text-[10px]">Param Count</span>
                  <span className="text-gray-200">{result.features.param_count}</span>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                  <span className="text-gray-500 block text-[10px]">Special Chars</span>
                  <span className="text-gray-200">{result.features.special_char_count}</span>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                  <span className="text-gray-500 block text-[10px]">Entropy</span>
                  <span className="text-gray-200">{result.features.entropy}</span>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                  <span className="text-gray-500 block text-[10px]">Digit Ratio</span>
                  <span className="text-gray-200">{result.features.digit_ratio}</span>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800 col-span-2">
                  <span className="text-gray-500 block text-[10px]">SQL / Exploit Match</span>
                  <span className={result.features.has_sql_keyword ? "text-rose-400 font-bold" : "text-emerald-400"}>
                    {result.features.has_sql_keyword ? "FLAGGED PATTERN MATCH (1)" : "None Detected (0)"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Threat Evaluation & Defense Action */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                Security Risk Analysis
              </h3>
              <span className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                isThreat 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isThreat ? 'Action: Blocked' : 'Action: Allowed'}
              </span>
            </div>

            {/* Simple assessment status cards */}
            <div className="space-y-3 text-xs">
              
              {/* Component 1: Attack Payload */}
              <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-medium">1. HTTP Payload Inspection</span>
                  <span className={`font-semibold ${attackProb > 0.5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {attackProb > 0.5 ? 'Attack Pattern Flagged' : 'Clean & Safe'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(attackProb * 100)}%` }}
                  />
                </div>
              </div>

              {/* Component 2: Client Origin Behavior */}
              <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-medium">2. Client Behavior Profile</span>
                  <span className={`font-semibold ${behaviorScore > 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {behaviorScore > 0.5 ? 'Automated Bot Profile' : 'Normal Human User'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(Math.min(100, behaviorScore * 100))}%` }}
                  />
                </div>
              </div>

              {/* Component 3: Server Load */}
              <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-medium">3. Network Surge Condition</span>
                  <span className={`font-semibold ${tsi >= 0.7 ? 'text-rose-400' : 'text-blue-400'}`}>
                    {tsi >= 0.7 ? 'High Traffic Surge' : 'Normal Traffic'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(Math.min(100, tsi * 100))}%` }}
                  />
                </div>
              </div>

              {/* Total Threat Bar */}
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-300 font-bold">Overall Threat Level:</span>
                  <span className={`font-bold ${isThreat ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isThreat ? 'High Risk (Mitigation Triggered)' : 'Low Risk (Safe)'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-gray-700">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isThreat ? 'bg-rose-500 shadow-glow-red' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, Math.round(riskScore * 100)))}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Collapsible Math Details for Auditors */}
            <details className="text-xs text-gray-400 bg-gray-950/60 border border-gray-800/80 rounded-xl p-3">
              <summary className="cursor-pointer font-medium text-gray-300 hover:text-white flex items-center justify-between">
                <span>View Mathematical Formulas & Weights</span>
                <span className="text-[11px] text-blue-400 font-mono">Expand ▾</span>
              </summary>
              <div className="mt-2.5 pt-2.5 border-t border-gray-800/80 font-mono text-[11px] space-y-1.5">
                <div className="text-purple-300">risk = 0.40 × attack_prob + 0.30 × behavior + 0.30 × TSI</div>
                <div className="text-gray-400">Calculated Score: <span className="text-white font-bold">{riskScore.toFixed(4)}</span> (Cutoff: 0.6500)</div>
              </div>
            </details>
          </div>
        </div>

      </div>

      {/* LLM Decision Support Report Section (when is_threat is true) */}
      {result && result.is_threat && result.llm_report && (
        <div id="llm-threat-report" className="glass-panel p-6 rounded-2xl border border-rose-500/50 shadow-glow-red space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Groq LLM Incident Response & Automated Mitigation Report
                </h3>
                <p className="text-xs text-rose-300/80">
                  Structured Root-Cause Analysis, MITRE ATT&CK Mapping, and Hardened Perimeter Rules
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-mono border border-gray-700 transition-all self-start sm:self-auto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Report'}</span>
            </button>
          </div>

          {/* Rendered Markdown with custom styles */}
          <div className="prose prose-invert max-w-none text-gray-200 text-sm leading-relaxed space-y-4 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-rose-400 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-gray-100 [&_h2]:border-b [&_h2]:border-gray-800 [&_h2]:pb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-blue-400 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-gray-700 [&_th]:py-2 [&_th]:px-3 [&_th]:text-left [&_td]:border-b [&_td]:border-gray-800/80 [&_td]:py-2 [&_td]:px-3 [&_pre]:bg-[#070A0F] [&_pre]:border [&_pre]:border-gray-800 [&_pre]:rounded-xl [&_pre]:p-4 [&_code]:text-xs [&_code]:font-mono">
            <ReactMarkdown>{result.llm_report}</ReactMarkdown>
          </div>
        </div>
      )}

    </div>
  );
}

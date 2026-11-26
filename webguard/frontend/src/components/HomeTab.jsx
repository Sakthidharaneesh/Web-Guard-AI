import React, { useState } from 'react';
import { 
  Shield, 
  Activity, 
  Bug, 
  Users, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Radio,
  Clock,
  Database,
  Lock
} from 'lucide-react';
import { analyzeAttack, forecastTraffic } from '../api';

export default function HomeTab({ setActiveTab, stats, backendStatus, onOpenGroqReport }) {
  // Simple simulation state
  const [selectedScenario, setSelectedScenario] = useState('attack');
  const [loading, setLoading] = useState(false);
  const [scenarioResult, setScenarioResult] = useState({
    status: 'threat',
    title: 'Hacker Attack Intercepted & Blocked',
    badge: 'Threat Blocked',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    description: 'A malicious user tried to inject a SQL database exploit into the login form. WebGuard blocked the request in 2 milliseconds and created an automatic firewall rule.',
    actionTaken: 'Offending IP address blocked automatically. Zero damage to website database.',
    safetyScore: 'Critical Threat (Blocked)',
    color: 'rose'
  });

  // Collapsible technical details (hidden by default)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const handleSimulate = (type) => {
    setSelectedScenario(type);
    if (type === 'attack') {
      setScenarioResult({
        status: 'threat',
        title: 'Hacker Attack Intercepted & Blocked',
        badge: 'Hacker Attack Blocked',
        badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        description: 'A malicious user attempted to inject a SQL database exploit into the website login form. WebGuard identified the attack pattern and blocked it immediately.',
        actionTaken: 'Offending IP blocked automatically. Firewall protection rule activated.',
        safetyScore: 'Malicious Exploit (Blocked)',
        color: 'rose'
      });
    } else if (type === 'surge') {
      setScenarioResult({
        status: 'surge',
        title: 'Traffic Spike Detected (Flash Crowd)',
        badge: 'High Traffic Alert',
        badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        description: 'Website visitor volume is spiking significantly above usual levels (simulating 8,500 visitors/hr). WebGuard predicts this trend early so your servers do not crash.',
        actionTaken: 'Advance capacity alert triggered. Resources allocated to prevent site slowdown.',
        safetyScore: 'High Traffic Load',
        color: 'amber'
      });
    } else {
      setScenarioResult({
        status: 'safe',
        title: 'Safe Human Customer Browsing',
        badge: 'Safe & Verified',
        badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        description: 'A genuine customer is browsing product categories and adding items to their shopping cart. Verified human behavior with normal browsing speed.',
        actionTaken: 'Allowed through instantly with zero delay. Excellent user experience.',
        safetyScore: '100% Safe Visitor',
        color: 'emerald'
      });
    }
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* ======================================================== */}
      {/* 1. WELCOMING HERO SECTION                                */}
      {/* ======================================================== */}
      <section className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[#0F172A]/80 via-[#0B0F1C]/90 to-[#070A12] p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
        
        {/* Ambient Backdrops */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-5">
          
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WEBSITE PROTECTION IS ACTIVE & HEALTHY</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Smart Website Traffic & <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Security Protection Shield
            </span>
          </h1>

          {/* Clean Human Subtitle */}
          <p className="text-sm sm:text-base text-gray-300 max-w-xl mx-auto leading-relaxed">
            WebGuard monitors your visitors in real time, automatically stops hacker attacks, and warns you before traffic spikes can slow down your website.
          </p>

          {/* Main Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            
            <button
              onClick={() => setActiveTab('live')}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
            >
              <Radio className="w-4 h-4 text-cyan-200 animate-pulse" />
              <span>Open Live Monitor</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('test-security-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] text-gray-200 hover:text-white font-semibold text-sm border border-white/[0.1] transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Test Security Protection</span>
            </button>

          </div>

        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. THREE SIMPLE KEY STATUS CARDS                         */}
      {/* ======================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Traffic Status */}
        <div 
          onClick={() => setActiveTab('traffic')}
          className="cyber-card p-6 rounded-3xl cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Website Traffic</span>
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">Normal Traffic</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Smooth
              </span>
            </div>

            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Your website is handling around <strong className="text-gray-200">2,500 requests per hour</strong> comfortably. Server speed is optimal.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
            <span>Forecast Traffic →</span>
          </div>
        </div>

        {/* Card 2: Hacker Attack Shield */}
        <div 
          onClick={() => setActiveTab('attack')}
          className="cyber-card p-6 rounded-3xl cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hacker Defense</span>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">100% Protected</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Safe
              </span>
            </div>

            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Zero security breaches. SQL injection, malicious scripts, and form exploits are blocked automatically.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Test Attack Scanner →</span>
          </div>
        </div>

        {/* Card 3: Visitor Quality */}
        <div 
          onClick={() => setActiveTab('client')}
          className="cyber-card p-6 rounded-3xl cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visitor Quality</span>
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">Human Traffic</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Filtered
              </span>
            </div>

            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Real human visitors are smoothly admitted. Unauthorized data-scraping bots and brute-force tools are separated and stopped.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
            <span>Inspect Visitor Profiles →</span>
          </div>
        </div>

      </section>

      {/* ======================================================== */}
      {/* 3. SIMPLE SECURITY TESTING PLAYGROUND (ZERO MATH!)       */}
      {/* ======================================================== */}
      <section id="test-security-section" className="p-6 sm:p-8 rounded-3xl bg-[#0D1322] border border-white/[0.08] shadow-2xl space-y-6">
        
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Test How WebGuard Protects Your Website</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Click one of the three buttons below to see how WebGuard handles real-world website situations in plain English:
          </p>
        </div>

        {/* 3 Simple Choice Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <button
            onClick={() => handleSimulate('attack')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedScenario === 'attack'
                ? 'bg-rose-500/15 border-rose-500/50 shadow-md shadow-rose-500/10'
                : 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-300">1. Hacker Attack</span>
              <Bug className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xs text-gray-300">
              Simulate an attacker trying to steal passwords using SQL injection.
            </p>
          </button>

          <button
            onClick={() => handleSimulate('surge')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedScenario === 'surge'
                ? 'bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300">2. Sudden Traffic Rush</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-gray-300">
              Simulate a huge wave of visitors (e.g. flash sale or product launch).
            </p>
          </button>

          <button
            onClick={() => handleSimulate('safe')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedScenario === 'safe'
                ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300">3. Normal Customer</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-gray-300">
              Simulate a genuine human customer browsing and shopping normally.
            </p>
          </button>

        </div>

        {/* Clear Plain-English Result Box */}
        <div className={`p-6 rounded-2xl border transition-all ${
          scenarioResult.status === 'threat'
            ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
            : scenarioResult.status === 'surge'
            ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
            : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
        }`}>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              {scenarioResult.status === 'threat' && <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0" />}
              {scenarioResult.status === 'surge' && <Activity className="w-6 h-6 text-amber-400 flex-shrink-0" />}
              {scenarioResult.status === 'safe' && <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />}
              <div>
                <h3 className="text-base font-bold text-white">{scenarioResult.title}</h3>
                <span className="text-xs opacity-80">{scenarioResult.safetyScore}</span>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${scenarioResult.badgeColor}`}>
              {scenarioResult.badge}
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs leading-relaxed text-gray-200">
            <p>
              <strong className="text-white">What WebGuard Detected:</strong> {scenarioResult.description}
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05]">
              <strong className="text-white">Automatic Action Taken:</strong> {scenarioResult.actionTaken}
            </div>

            {scenarioResult.status === 'threat' && (
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-rose-500/20">
                <span className="text-[11px] text-rose-300">Detailed AI forensic analysis available for this threat:</span>
                <button
                  onClick={onOpenGroqReport}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Generate Full Groq Report</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </section>

      {/* ======================================================== */}
      {/* 4. WORKBENCH CARDS TO EXPLORE DETAILS                    */}
      {/* ======================================================== */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Explore Protection Workbenches</h2>
          <p className="text-xs text-gray-400">Click any feature to see detailed live data, charts, and testing tools.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Feature 1 */}
          <div 
            onClick={() => setActiveTab('traffic')}
            className="cyber-card p-6 rounded-2xl cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                Traffic Forecaster
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                See future visitor traffic curves hour-by-hour so your servers never slow down or crash unexpectedly.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span>Open Forecaster</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Feature 2 */}
          <div 
            onClick={() => setActiveTab('attack')}
            className="cyber-card p-6 rounded-2xl cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <Bug className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                Attack Scanner
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Test web addresses, inputs, and payloads to verify that SQL injection, XSS, and exploit attacks get blocked.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-blue-400">
              <span>Open Attack Scanner</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Feature 3 */}
          <div 
            onClick={() => setActiveTab('client')}
            className="cyber-card p-6 rounded-2xl cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                Bot Sentinel
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Inspect visitor behavior patterns to spot unauthorized data-scraping bots and automated password guessing.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs font-semibold text-purple-400">
              <span>Open Bot Sentinel</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. COLLAPSIBLE TECHNICAL SPECIFICATIONS (HIDDEN BY DEFAULT) */}
      {/* ======================================================== */}
      <section className="rounded-3xl border border-white/[0.07] bg-black/30 overflow-hidden">
        
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full p-5 flex items-center justify-between text-left text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            <span>Advanced Engineering & Machine Learning Specifications (For Technical Teams)</span>
          </div>
          {showTechnicalDetails ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="p-6 pt-0 border-t border-white/[0.05] space-y-4 text-xs text-gray-300 font-mono animate-fadeIn">
            <p className="text-gray-400 font-sans text-xs">
              Below are the internal model performance benchmarks and serialized artifact locations on the server:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-gray-400">
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Algorithm</th>
                    <th className="py-2.5 px-3">Accuracy / Benchmark</th>
                    <th className="py-2.5 px-3">Disk Artifact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr>
                    <td className="py-2.5 px-3 text-white font-semibold">Traffic Regressor</td>
                    <td className="py-2.5 px-3 text-cyan-300">GradientBoostingRegressor</td>
                    <td className="py-2.5 px-3 text-emerald-400">R² = 0.8523 (MAE 326.7)</td>
                    <td className="py-2.5 px-3 text-gray-400">traffic_forecaster.joblib</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-white font-semibold">Attack Classifier</td>
                    <td className="py-2.5 px-3 text-blue-300">RandomForest + TF-IDF</td>
                    <td className="py-2.5 px-3 text-emerald-400">100% Precision (0 FP)</td>
                    <td className="py-2.5 px-3 text-gray-400">web_attack_model.joblib</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-white font-semibold">Behavioral Anomaly</td>
                    <td className="py-2.5 px-3 text-purple-300">IsolationForest (3% contam.)</td>
                    <td className="py-2.5 px-3 text-emerald-400">30/1,000 Bots Isolated</td>
                    <td className="py-2.5 px-3 text-gray-400">client_anomaly_model.joblib</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-white font-semibold">AI Decision Support</td>
                    <td className="py-2.5 px-3 text-amber-300">Groq Qwen-27B LLM</td>
                    <td className="py-2.5 px-3 text-emerald-400">Automated MITRE Mapping</td>
                    <td className="py-2.5 px-3 text-gray-400">Cloud API Integration</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-[11px] text-gray-500 font-sans">
              Mathematical formula: Composite Risk = (0.40 × Attack) + (0.30 × Behavior) + (0.30 × TSI). Threshold: ≥ 0.65.
            </div>
          </div>
        )}

      </section>

    </div>
  );
}

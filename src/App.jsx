import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts'

const API_BASE_URL = 'https://sentinelnet-backend.onrender.com';

function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [monthlyBudget, setMonthlyBudget] = useState(5000);
  const [newBudgetInput, setNewBudgetInput] = useState('');

  const [mode, setMode] = useState('stream'); 
  const [status, setStatus] = useState('idle');
  const [prediction, setPrediction] = useState(null);
  const [transactionAmount, setTransactionAmount] = useState(''); 
  const [currentAmount, setCurrentAmount] = useState(null);       
  const [history, setHistory] = useState([]); 
  const [currentMetadata, setCurrentMetadata] = useState([]); 

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true); // START THE BUFFER
    
    const endpoint = isSignUp ? `${API_BASE_URL}/api/v1/register/` : `${API_BASE_URL}/api/token/`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (isSignUp && data.username) {
          throw new Error(`Username Error: ${data.username[0]}`);
        } else if (data.detail) {
          throw new Error(data.detail);
        } else {
          throw new Error(isSignUp ? 'Registration failed.' : 'Invalid credentials');
        }
      }
      
      if (isSignUp) {
        setIsSignUp(false);
        setAuthError('Registration successful! Please log in.');
        setPassword('');
      } else {
        setToken(data.access);
        setIsLoggedIn(true);
        fetchProfile(data.access); 
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false); // STOP THE BUFFER REGARDLESS OF SUCCESS/FAIL
    }
  };

  const fetchProfile = async (currentToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/profile/`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await response.json();
      setMonthlyBudget(data.monthly_budget_limit);
    } catch (error) {
      console.error("Failed to fetch profile");
    }
  };

  const handleResetSpend = async () => {
    try {
      // Use the React state 'token', not localStorage
      const response = await fetch(`${API_BASE_URL}/api/v1/profile/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Force the UI to instantly display 0 and clear the live audit log
        setPrediction(prev => prev ? { ...prev, total_spent: 0, advisory: "Secure: Spend metrics have been reset." } : null);
        setHistory([]); 
      } else {
        console.error("Failed to reset spend metrics");
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
    }
  };

  const updateBudget = async (e) => {
    e.preventDefault();
    if (!newBudgetInput) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/profile/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ monthly_budget_limit: parseFloat(newBudgetInput) })
      });
      if (response.ok) {
        setMonthlyBudget(parseFloat(newBudgetInput));
        setNewBudgetInput('');
      }
    } catch (error) {
      console.error("Failed to update budget");
    }
  };

  const runFraudCheck = async (featuresArray) => {
    setStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/predict/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ features: featuresArray })
      });

      if (!response.ok) {
        if (response.status === 401) {
           setIsLoggedIn(false);
           setToken(null);
        }
        throw new Error('Network response error');
      }
      
      const data = await response.json();
      setPrediction(data);
      setStatus('success');

      setHistory(prev => {
        const newRecord = {
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
          amount: featuresArray[0], 
          risk: parseFloat((data.fraud_probability * 100).toFixed(2)),
          isFraud: data.fraud_prediction === 1
        };
        return [...prev.slice(-19), newRecord]; 
      });

    } catch (error) {
      console.error("Error:", error);
      setStatus('error');
    }
  };

  useEffect(() => {
    let intervalId;
    if (mode === 'stream' && isLoggedIn && token) {
      intervalId = setInterval(() => {
        const randomAmount = parseFloat((Math.random() * 500).toFixed(2)); // Lowered random amounts slightly for realistic budget tracking
        const metadata = Array.from({ length: 29 }, () => Math.random());
        runFraudCheck([randomAmount, ...metadata]);
        setCurrentAmount(randomAmount);
        setCurrentMetadata(metadata); 
      }, 3000); 
    }
    return () => clearInterval(intervalId);
  }, [mode, isLoggedIn, token]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(transactionAmount) || 0;
    setCurrentAmount(amount);
    const isSuspicious = amount > 5000;
    const syntheticMetadata = Array.from({ length: 29 }, () => isSuspicious ? (Math.random() * 10) - 5 : Math.random() * 0.1);
    setCurrentMetadata(syntheticMetadata); 
    runFraudCheck([amount, ...syntheticMetadata]);
  };

  if (showLanding && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center relative overflow-hidden font-sans">
        
        {/* Ambient Background Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px] pointer-events-none"></div>

        <div className="relative z-10 text-center max-w-4xl px-6 flex flex-col items-center">
          
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-blue-400 mb-8 uppercase tracking-widest shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            SentinelNet Engine Online
          </div>

          {/* Hero Typography */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
            Secure Networks at the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Speed of Thought.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-12 leading-relaxed max-w-2xl">
            Enterprise-grade artificial intelligence for real-time financial fraud interception. Deploy predictive modeling and automated budget advisory directly to your data stream.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto">
            <button
              onClick={() => { setShowLanding(false); setIsSignUp(true); }}
              className="px-8 py-4 w-full sm:w-auto rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active: scale-95"
            >
              INITIALIZE OPERATOR
            </button>
            <button
              onClick={() => { setShowLanding(false); setIsSignUp(false); }}
              className="px-8 py-4 w-full sm:w-auto rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-white font-bold tracking-wide transition-all active: scale-95"
            >
              SYSTEM LOGIN
            </button>
          </div>
          
        </div>
      </div>
    );
  }

  if (!isLoggedIn && !showLanding) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-200">
        
        {/* NEW: The Alignment Wrapper */}
        <div className="max-w-md w-full flex flex-col">
          
          <button 
            onClick={() => setShowLanding(true)}
            className="mb-4 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 w-fit active:scale-95"
          >
            ← Return to SentinelNet Home
          </button>
          
          {/* Notice max-w-md was removed from here, as the parent wrapper now handles the width */}
          <div className="w-full bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white">System Locked</h1>
              <p className="text-slate-400 mt-2">{isSignUp ? 'Register a new Operator ID' : 'Enter credentials to access the Engine'}</p>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Operator ID (Username)</label>
                <input 
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Passcode</label>
                <input 
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              
              {authError && (
                <p className={`text-sm p-3 rounded border text-center ${authError.includes('successful') ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-red-900/20 border-red-500/50 text-red-400'}`}>
                  {authError}
                </p>
              )}
              
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex justify-center items-center gap-2"
              >
                {isAuthLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    AUTHENTICATING...
                  </>
                ) : (
                  isSignUp ? 'REGISTER OPERATOR' : 'INITIALIZE CONNECTION'
                )}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setPassword(''); }}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {isSignUp ? "Already have an ID? Authenticate here." : "Need an account? Register new Operator."}
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col font-sans">
      
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fraud Intelligence Engine</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Authenticated Operator: {username.toUpperCase()} | Secure JWT Connection Active</p>
        </div>
        <button 
            onClick={() => { setIsLoggedIn(false); setToken(null); setHistory([]); setPrediction(null); setShowLanding(true); }}
            className="text-sm font-medium text-slate-400 hover:text-red-400 transition-colors px-4 py-2 rounded border border-transparent hover:border-red-900/50 hover:bg-red-950/30"
          >
          End Session
        </button>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* COLUMN 1: CONTROLS & PROFILE */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-full">
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex-shrink-0 animate-fade-in border-t-4 border-t-blue-500">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Financial Profile</h2>
              
              <div className="mb-4">
                <span className="text-xs text-slate-500 block mb-1">Target Monthly Budget</span>
                <span className="text-2xl font-mono text-white">${parseFloat(monthlyBudget).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>

              {/* NEW: Dynamic Total Spent Tracker */}
              {prediction && prediction.total_spent !== undefined && (
                <div className="mb-5 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-500 block mb-2">Total Accumulated Spend</span>
                  
                  <div className="flex justify-between items-center">
                    <span className={`text-2xl font-mono tracking-tight ${prediction.total_spent > monthlyBudget ? 'text-amber-500' : 'text-emerald-500'}`}>
                      ${parseFloat(prediction.total_spent).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                    
                    <button 
                      onClick={handleResetSpend} 
                      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-950/40 text-red-500 border border-red-900/50 rounded hover:bg-red-900 hover:text-white transition-all active:scale-90"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={updateBudget} className="flex gap-2 mt-4">
                <input 
                  type="number" step="1" placeholder="New Budget" 
                  value={newBudgetInput} onChange={(e) => setNewBudgetInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded text-sm px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 text-sm rounded border border-slate-700 transition-colors">
                  Update
                </button>
              </form>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Engine Mode</h2>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 mb-4">
                <button onClick={() => setMode('stream')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'stream' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>Live Stream</button>
                <button onClick={() => setMode('manual')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}>Manual</button>
              </div>
            </div>

            {mode === 'manual' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex-shrink-0 animate-fade-in">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Manual Input</h2>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <input 
                    type="number" step="0.01" placeholder="Amount ($)" 
                    value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                  <button type="submit" disabled={status === 'loading'} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50">
                    {status === 'loading' ? 'Analyzing...' : 'Execute Scan'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* COLUMN 2: AI ANALYSIS RESULTS */}
          <div className="lg:col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg flex flex-col h-full overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 shrink-0">Live AI Analysis</h2>
            
            <div className="flex-1 flex flex-col justify-center min-h-[400px]">
              {status === 'idle' && (
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="h-12 w-12 rounded-lg border border-slate-700 bg-slate-800 rotate-45 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-pulse"></div>
                  </div>
                  <p className="text-slate-500 text-xs font-mono uppercase">System on Standby</p>
                </div>
              )}

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center space-y-4">
                   <div className="relative flex justify-center items-center h-16 w-16">
                    <div className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-20 animate-ping"></div>
                    <div className="relative inline-flex h-10 w-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
                  </div>
                  <p className="text-blue-400 text-xs font-mono animate-pulse uppercase">Processing Matrix</p>
                </div>
              )}

              {status === 'success' && prediction && currentAmount !== null && (
                <div className="w-full space-y-5 animate-fade-in">
                  
                  <div className="text-center p-6 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
                    <span className="block text-xs font-mono tracking-wider text-slate-500 uppercase mb-2">Intercepted Amount</span>
                    <span className="text-4xl font-bold text-white tracking-tight">
                      ${currentAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono text-slate-400 uppercase">Risk Probability</span>
                      <span className="text-xl font-mono font-bold text-white">{(prediction.fraud_probability * 100).toFixed(2)}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div className={`h-full rounded-full transition-all duration-700 ease-out ${
                        (prediction.fraud_probability * 100) >= 60 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' 
                        : (prediction.fraud_probability * 100) >= 30 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
                        : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                      }`} style={{ width: `${Math.max(prediction.fraud_probability * 100, 2)}%` }}></div>
                    </div>
                  </div>
                  
                  <div className={`p-4 rounded-lg border text-center font-bold tracking-widest uppercase transition-colors duration-300 ${
                    prediction.fraud_prediction === 1 ? 'bg-red-950/50 border-red-900 text-red-500' : 'bg-emerald-950/50 border-emerald-900 text-emerald-500'
                  }`}>
                    {prediction.fraud_prediction === 1 ? '⚠️ FRAUD DETECTED' : '✅ APPROVED'}
                  </div>

                  {/* NEW: DYNAMIC ADVISORY MESSAGE */}
                  {prediction.advisory && (
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-sm shadow-inner">
                      <h4 className="text-[10px] font-mono tracking-wider text-slate-400 uppercase mb-2">AI Advisory Insight</h4>
                      <p className={`font-medium ${prediction.advisory.includes('Warning') ? 'text-amber-400' : prediction.advisory.includes('Blocked') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {prediction.advisory}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 mt-4">
                    <h4 className="text-[10px] font-mono tracking-wider text-slate-500 uppercase mb-3 text-center">Node Analysis (29 Features)</h4>
                    <div className="grid grid-cols-10 gap-1.5">
                      {currentMetadata.map((val, idx) => {
                        const isAnomaly = prediction.fraud_prediction === 1 && (val > 1 || val < -1 || val > 0.8);
                        return (
                          <div key={idx} className={`h-3 rounded-[2px] transition-all duration-300 ${
                            isAnomaly ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' 
                            : prediction.fraud_prediction === 1 ? 'bg-slate-800' 
                            : 'bg-emerald-500/20'
                          }`}></div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: AUDIT LOG */}
          <div className="lg:col-span-5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800 shrink-0 bg-slate-900/50">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Live Audit Log</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-0">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-sm">No transaction history.</div>
              ) : (
                <table className="w-full text-left text-xs text-slate-400 relative">
                  <thead className="text-slate-500 uppercase bg-slate-950 sticky top-0 z-10 shadow-md">
                    <tr>
                      <th className="px-4 py-3 font-medium tracking-wider">Time</th>
                      <th className="px-4 py-3 font-medium tracking-wider">Amount</th>
                      <th className="px-4 py-3 font-medium tracking-wider">Risk</th>
                      <th className="px-4 py-3 font-medium tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {[...history].reverse().map((log, index) => (
                      <tr key={index} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">{log.time}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">
                          ${log.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span className={log.isFraud ? 'text-red-400' : 'text-emerald-400'}>{log.risk.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded ${
                            log.isFraud ? 'bg-red-950/50 text-red-500 border border-red-900/50' : 'bg-emerald-950/50 text-emerald-500 border border-emerald-900/50'
                          }`}>
                            {log.isFraud ? 'Blocked' : 'Pass'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default App
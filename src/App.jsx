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

  // --- NEW AI STATES ---
  const [aiInsightQuery, setAiInsightQuery] = useState('');
  const [aiInsightResponse, setAiInsightResponse] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'SentinelNet AI Assistant online. How can I assist you today?' }]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true); 
    
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
      setIsAuthLoading(false); 
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
      const response = await fetch(`${API_BASE_URL}/api/v1/profile/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
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
        const randomAmount = parseFloat((Math.random() * 500).toFixed(2)); 
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

  // --- NEW AI INSIGHT LOGIC ---
  const handleAiInsightRequest = async () => {
    if (!aiInsightQuery) return;
    setIsAiThinking(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          type: 'insight',
          query: aiInsightQuery,
          history: history,
          budget: monthlyBudget
        })
      });

      // NEW: Catch expired tokens
      if (response.status === 401) {
        setIsLoggedIn(false);
        setToken(null);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAiInsightResponse(data.response);
      } else {
        setAiInsightResponse("Error: Unable to connect to SentinelNet AI Core.");
      }
    } catch (error) {
      setAiInsightResponse("System offline.");
    } finally {
      setIsAiThinking(false);
    }
  };

  // --- NEW AI CHATBOT LOGIC ---
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!currentChatMessage) return;

    const userMsg = currentChatMessage;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setCurrentChatMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          type: 'chat',
          message: userMsg
        })
      });

      // NEW: Catch expired tokens
      if (response.status === 401) {
        setIsLoggedIn(false);
        setToken(null);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'system', content: data.response }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'system', content: "Error connecting to AI." }]);
    }
  };

  // --- VIEW 1: LANDING PAGE ---
  if (showLanding && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-50 flex flex-col justify-center items-center selection:bg-zinc-800" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
        
        <div className="text-center max-w-4xl px-6 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-[11px] font-medium text-zinc-400 mb-10 uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            SentinelNet Engine Online
          </div>

          <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-white mb-6 leading-tight">
            Secure Networks at the <br />
            <span className="text-zinc-500">Speed of Thought.</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 mb-12 leading-relaxed max-w-2xl font-light">
            Enterprise-grade artificial intelligence for real-time financial fraud interception. Deploy predictive modeling and automated budget advisory directly to your data stream.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => { setShowLanding(false); setIsSignUp(true); }}
              className="px-8 py-3 w-full sm:w-auto rounded-md bg-white text-black text-sm font-medium transition-colors hover:bg-zinc-200 active:scale-95 flex items-center justify-center"
            >
              Initialize Operator
            </button>
            <button
              onClick={() => { setShowLanding(false); setIsSignUp(false); }}
              className="px-8 py-3 w-full sm:w-auto rounded-md bg-[#09090b] border border-zinc-800 text-white text-sm font-medium transition-colors hover:bg-zinc-900 active:scale-95 flex items-center justify-center"
            >
              System Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 2: AUTH GATE ---
  if (!isLoggedIn && !showLanding) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 text-zinc-100 selection:bg-zinc-800" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>

        <div className="max-w-[400px] w-full flex flex-col">
          <button 
            onClick={() => setShowLanding(true)}
            className="mb-8 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-2 w-fit"
          >
            ← Return to SentinelNet Home
          </button>
          
          <div className="w-full bg-[#09090b] p-8 rounded-xl border border-zinc-800">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-white tracking-tight">System Locked</h1>
              <p className="text-sm text-zinc-400 mt-2 font-light">{isSignUp ? 'Register a new Operator ID' : 'Enter credentials to access the Engine'}</p>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Operator ID</label>
                <input 
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all placeholder-zinc-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Passcode</label>
                <input 
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                  required
                />
              </div>
              
              {authError && (
                <p className={`text-xs p-3 rounded-md border ${authError.includes('successful') ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
                  {authError}
                </p>
              )}
              
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full bg-white text-black text-sm font-medium py-2.5 rounded-md transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2"
              >
                {isAuthLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                    Authenticating
                  </>
                ) : (
                  isSignUp ? 'Register Operator' : 'Initialize Connection'
                )}
              </button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setPassword(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {isSignUp ? "Already have an ID? Authenticate here." : "Need an account? Register new Operator."}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3: DASHBOARD ---
  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 overflow-hidden flex flex-col selection:bg-zinc-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
      
      {/* Header */}
      <header className="bg-[#09090b] border-b border-zinc-800 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Fraud Intelligence Engine</h1>
          <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">Operator: {username} <span className="mx-2 text-zinc-700">|</span> Secured Connection</p>
        </div>
        <button 
            onClick={() => { setIsLoggedIn(false); setToken(null); setHistory([]); setPrediction(null); setShowLanding(true); }}
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-md border border-zinc-800 hover:bg-zinc-900 active:scale-95"
          >
          End Session
        </button>
      </header>

      <main className="flex-1 overflow-hidden p-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full max-w-[1600px] mx-auto">
          
          {/* COLUMN 1: CONTROLS & PROFILE */}
          <div className="lg:col-span-3 flex flex-col h-full overflow-y-auto pr-2 pb-4 space-y-6 custom-scrollbar">
            
            <div className="bg-[#121212] rounded-xl border border-zinc-800 p-5 shrink-0">
              <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-6">Financial Profile</h2>
              
              <div className="mb-5">
                <span className="text-xs text-zinc-500 block mb-1">Target Monthly Budget</span>
                <span className="text-2xl font-semibold text-white tracking-tight">${parseFloat(monthlyBudget).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>

              {prediction && prediction.total_spent !== undefined && (
                <div className="mb-5 pt-5 border-t border-zinc-800/50">
                  <span className="text-xs text-zinc-500 block mb-2">Accumulated Spend</span>
                  
                  <div className="flex justify-between items-center">
                    <span className={`text-xl font-semibold tracking-tight ${prediction.total_spent > monthlyBudget ? 'text-amber-500' : 'text-zinc-300'}`}>
                      ${parseFloat(prediction.total_spent).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                    
                    <button 
                      onClick={handleResetSpend} 
                      className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 rounded hover:text-white hover:border-zinc-600 transition-colors active:scale-95"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={updateBudget} className="flex gap-2 mt-6">
                <input 
                  type="number" step="1" placeholder="New Budget" 
                  value={newBudgetInput} onChange={(e) => setNewBudgetInput(e.target.value)}
                  className="flex-1 bg-[#09090b] border border-zinc-800 rounded-md text-sm px-3 py-1.5 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all placeholder-zinc-700"
                />
                <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 text-xs font-medium rounded-md transition-colors active:scale-95">
                  Update
                </button>
              </form>
            </div>

            <div className="bg-[#121212] rounded-xl border border-zinc-800 p-5 shrink-0">
              <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-4">Engine Mode</h2>
              <div className="flex bg-[#09090b] p-1 rounded-md border border-zinc-800">
                <button onClick={() => setMode('stream')} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${mode === 'stream' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Live Stream</button>
                <button onClick={() => setMode('manual')} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${mode === 'manual' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Manual</button>
              </div>
            </div>

            {mode === 'manual' && (
              <div className="bg-[#121212] rounded-xl border border-zinc-800 p-5 shrink-0 animate-fade-in">
                <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-4">Manual Scan</h2>
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <input 
                    type="number" step="0.01" placeholder="Amount ($)" 
                    value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)}
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                    required
                  />
                  <button type="submit" disabled={status === 'loading'} className="w-full bg-white text-black py-2 rounded-md text-xs font-medium transition-colors hover:bg-zinc-200 active:scale-95 disabled:opacity-50">
                    {status === 'loading' ? 'Processing...' : 'Execute Request'}
                  </button>
                </form>
              </div>
            )}

            {/* NEW AI ADVISORY INPUT PANEL */}
            <div className="bg-[#121212] rounded-xl border border-zinc-800 p-5 shrink-0">
              <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-4">AI Advisory Query</h2>
              <textarea 
                value={aiInsightQuery}
                onChange={(e) => setAiInsightQuery(e.target.value)}
                placeholder="Ask the engine to analyze current risk vectors..."
                className="w-full bg-[#09090b] border border-zinc-800 rounded-md p-3 text-xs text-white focus:outline-none focus:border-zinc-500 transition-all resize-none h-20 placeholder-zinc-700"
              />
              <button 
                onClick={handleAiInsightRequest} 
                disabled={isAiThinking || !aiInsightQuery}
                className="w-full mt-3 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 active:scale-95"
              >
                {isAiThinking ? 'Processing Context...' : 'Generate Insight'}
              </button>
              
              {aiInsightResponse && (
                <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-md animate-fade-in">
                  <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{aiInsightResponse}</p>
                </div>
              )}
            </div>

          </div>

          {/* COLUMN 2: AI ANALYSIS RESULTS */}
          <div className="lg:col-span-4 bg-[#121212] rounded-xl border border-zinc-800 p-6 flex flex-col h-full overflow-y-auto">
            <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-6 shrink-0">Analysis Pipeline</h2>
            
            <div className="flex-1 flex flex-col justify-center min-h-[400px]">
              {status === 'idle' && (
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="h-8 w-8 rounded-full border border-zinc-800 bg-[#09090b] flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-600"></div>
                  </div>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Awaiting Data</p>
                </div>
              )}

              {/* SKELETON LOADER */}
              {status === 'loading' && (
                <div className="w-full space-y-6 animate-pulse">
                  <div className="pb-6 border-b border-zinc-800/50">
                    <div className="h-2.5 w-24 bg-zinc-800 rounded mb-4"></div>
                    <div className="h-10 w-48 bg-zinc-800 rounded"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="h-2.5 w-28 bg-zinc-800 rounded"></div>
                      <div className="h-4 w-12 bg-zinc-800 rounded"></div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full"></div>
                  </div>
                  <div className="h-10 w-full bg-zinc-800/50 border border-zinc-800 rounded-md mt-6"></div>
                  <div className="pt-4 mt-6 border-t border-zinc-800/50">
                    <div className="h-2.5 w-32 bg-zinc-800 rounded mb-4"></div>
                    <div className="grid grid-cols-10 gap-1">
                      {[...Array(29)].map((_, i) => <div key={i} className="h-1.5 bg-zinc-800 rounded-[1px]"></div>)}
                    </div>
                  </div>
                </div>
              )}

              {status === 'success' && prediction && currentAmount !== null && (
                <div className="w-full space-y-6 animate-fade-in">
                  
                  <div className="pb-6 border-b border-zinc-800">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Payload Amount</span>
                    <span className="text-4xl font-semibold tracking-tight text-white">
                      ${currentAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Risk Confidence</span>
                      <span className="text-sm font-mono text-zinc-300">{(prediction.fraud_probability * 100).toFixed(2)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#09090b] rounded-full overflow-hidden border border-zinc-800">
                      <div className={`h-full rounded-full transition-all duration-500 ease-out ${
                        (prediction.fraud_probability * 100) >= 60 ? 'bg-red-500' 
                        : (prediction.fraud_probability * 100) >= 30 ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      }`} style={{ width: `${Math.max(prediction.fraud_probability * 100, 2)}%` }}></div>
                    </div>
                  </div>
                  
                  <div className={`py-3 rounded-md border text-center text-xs font-semibold tracking-widest uppercase transition-colors duration-300 ${
                    prediction.fraud_prediction === 1 ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  }`}>
                    {prediction.fraud_prediction === 1 ? 'Risk Flagged' : 'Cleared'}
                  </div>

                  {prediction.advisory && (
                    <div className="bg-[#09090b] border border-zinc-800 rounded-md p-4 text-xs">
                      <h4 className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1">System Advisory</h4>
                      <p className={`font-medium ${prediction.advisory.includes('Warning') ? 'text-amber-500' : prediction.advisory.includes('Blocked') ? 'text-red-500' : 'text-zinc-300'}`}>
                        {prediction.advisory}
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <h4 className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-3">Feature Nodes (29)</h4>
                    <div className="grid grid-cols-10 gap-1">
                      {currentMetadata.map((val, idx) => {
                        const isAnomaly = prediction.fraud_prediction === 1 && (val > 1 || val < -1 || val > 0.8);
                        return (
                          <div key={idx} className={`h-1.5 rounded-[1px] transition-all duration-300 ${
                            isAnomaly ? 'bg-red-500' 
                            : prediction.fraud_prediction === 1 ? 'bg-zinc-700' 
                            : 'bg-zinc-800'
                          }`}></div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: LIVE CHART & AUDIT LOG */}
          <div className="lg:col-span-5 bg-[#121212] rounded-xl border border-zinc-800 flex flex-col h-full overflow-hidden">
            
            <div className="h-48 w-full border-b border-zinc-800 p-5 shrink-0 flex flex-col bg-[#09090b]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Risk Velocity Chart</h2>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">Live Sync</span>
                </div>
              </div>

              <div className="flex-1 w-full relative">
                {history.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-[10px] uppercase tracking-widest font-medium">Awaiting Data Points</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <Line 
                        type="monotone" 
                        dataKey="risk" 
                        stroke="#10b981" 
                        strokeWidth={1.5} 
                        dot={false} 
                        activeDot={{ r: 4, fill: "#09090b", stroke: "#10b981", strokeWidth: 2 }} 
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '11px', color: '#e4e4e7' }}
                        itemStyle={{ color: '#e4e4e7' }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value) => [`${value}%`, 'Risk Score']}
                      />
                      <YAxis hide domain={[0, 100]} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="p-4 border-b border-zinc-800 shrink-0 bg-[#121212] flex justify-between items-center">
               <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Network Audit Log</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-0">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-[10px] uppercase tracking-widest font-medium">No Request History</div>
              ) : (
                <table className="w-full text-left text-xs text-zinc-400 relative">
                  <thead className="bg-[#121212] text-[10px] font-medium text-zinc-600 uppercase tracking-widest sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3 border-b border-zinc-800/50">Timestamp</th>
                      <th className="px-5 py-3 border-b border-zinc-800/50">Amount</th>
                      <th className="px-5 py-3 border-b border-zinc-800/50">Score</th>
                      <th className="px-5 py-3 border-b border-zinc-800/50 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {[...history].reverse().map((log, index) => (
                      <tr key={index} className="hover:bg-[#18181b] transition-colors">
                        <td className="px-5 py-3 font-mono text-[10px] text-zinc-500 whitespace-nowrap">{log.time}</td>
                        <td className="px-5 py-3 font-medium text-zinc-200">
                          ${log.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </td>
                        <td className="px-5 py-3 font-mono text-[10px]">
                          <span className={log.isFraud ? 'text-red-500' : 'text-zinc-500'}>{log.risk.toFixed(1)}%</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`px-1.5 py-0.5 text-[9px] uppercase font-semibold tracking-widest rounded-sm ${
                            log.isFraud ? 'bg-red-500/10 text-red-500' : 'bg-zinc-800/50 text-zinc-500'
                          }`}>
                            {log.isFraud ? 'Deny' : 'Allow'}
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

        {/* NEW FLOATING AI ASSISTANT */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {isChatOpen && (
            <div className="bg-[#121212] border border-zinc-800 rounded-xl w-80 h-96 mb-4 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
              <div className="bg-[#09090b] border-b border-zinc-800 p-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-white tracking-wide">Operator Support</span>
                <button onClick={() => setIsChatOpen(false)} className="text-zinc-500 hover:text-white text-xs transition-colors">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-md p-2.5 text-[11px] ${msg.role === 'user' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-200'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-3 bg-[#09090b] border-t border-zinc-800">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input 
                    type="text" value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)}
                    placeholder="Type a command..." 
                    className="flex-1 bg-[#121212] border border-zinc-800 rounded-md text-xs px-3 py-2 text-white focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                  <button type="submit" className="bg-white text-black px-3 py-2 rounded-md text-xs font-medium hover:bg-zinc-200 transition-colors">→</button>
                </form>
              </div>
            </div>
          )}

          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="h-12 w-12 bg-white text-black rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        </div>

      </main>
    </div>
  )
}

export default App
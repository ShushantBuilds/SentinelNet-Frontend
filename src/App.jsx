import { useState, useEffect } from 'react'

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

  const [status, setStatus] = useState('idle');
  const [prediction, setPrediction] = useState(null);
  const [transactionAmount, setTransactionAmount] = useState(''); 
  const [currentAmount, setCurrentAmount] = useState(null);       
  const [history, setHistory] = useState([]); 

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'SentinelNet Merchant Assistant online. Do you need help verifying an order?' }]);
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
      if (!response.ok) throw new Error(isSignUp ? 'Registration failed.' : 'Invalid credentials');
      
      if (isSignUp) {
        setIsSignUp(false);
        setAuthError('Account created! Please log in.');
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

  const updateBudget = async (e) => {
    e.preventDefault();
    if (!newBudgetInput) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ monthly_budget_limit: parseFloat(newBudgetInput) })
      });
      if (response.ok) {
        setMonthlyBudget(parseFloat(newBudgetInput));
        setNewBudgetInput('');
      }
    } catch (error) {}
  };

  const runFraudCheck = async (featuresArray) => {
    setStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/predict/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ features: featuresArray })
      });

      if (response.status === 401) {
        setIsLoggedIn(false); setToken(null); return;
      }
      
      const data = await response.json();
      setPrediction(data);
      setStatus('success');

      setHistory(prev => {
        const newRecord = {
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          amount: featuresArray[0], 
          color: data.traffic_light || (data.fraud_prediction === 1 ? 'red' : 'green')
        };
        return [newRecord, ...prev.slice(0, 9)]; 
      });
    } catch (error) {
      setStatus('error');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(transactionAmount) || 0;
    setCurrentAmount(amount);
    // Simulating risk based on amount for demonstration purposes
    const isSuspicious = amount > 5000;
    const syntheticMetadata = Array.from({ length: 29 }, () => isSuspicious ? (Math.random() * 10) - 5 : Math.random() * 0.1);
    runFraudCheck([amount, ...syntheticMetadata]);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!currentChatMessage) return;
    const userMsg = currentChatMessage;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setCurrentChatMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'chat', message: userMsg })
      });
      if (response.status === 401) { setIsLoggedIn(false); setToken(null); return; }
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'system', content: data.response }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'system', content: "Network error." }]);
    }
  };

  // --- LANDING PAGE ---
  if (showLanding && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-50 flex flex-col justify-center items-center font-sans">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
        <div className="text-center max-w-xl px-6 flex flex-col items-center">
          <div className="h-16 w-16 bg-white text-black rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4 leading-tight">SentinelNet <span className="text-zinc-500">Merchant</span></h1>
          <p className="text-lg text-zinc-400 mb-10 font-light">Verify incoming orders in seconds. Protect your business from fake receipts and chargeback fraud.</p>
          <div className="flex w-full gap-3">
            <button onClick={() => { setShowLanding(false); setIsSignUp(true); }} className="flex-1 py-3.5 rounded-xl bg-white text-black font-medium transition-transform hover:scale-[1.02] active:scale-95">Create Account</button>
            <button onClick={() => { setShowLanding(false); setIsSignUp(false); }} className="flex-1 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 font-medium transition-transform hover:scale-[1.02] active:scale-95">Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTH GATE ---
  if (!isLoggedIn && !showLanding) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 text-zinc-100 font-sans">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
        <div className="max-w-[360px] w-full">
          <button onClick={() => setShowLanding(true)} className="mb-6 text-sm text-zinc-500 hover:text-white">← Back</button>
          <div className="bg-[#121212] p-6 rounded-2xl border border-zinc-800">
            <h2 className="text-xl font-semibold mb-6">{isSignUp ? 'New Merchant Account' : 'Merchant Sign In'}</h2>
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder="Store ID / Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-zinc-500 outline-none" required />
              <input type="password" placeholder="Passcode" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-zinc-500 outline-none" required />
              {authError && <p className="text-xs text-red-400 p-2 bg-red-950/30 rounded">{authError}</p>}
              <button type="submit" disabled={isAuthLoading} className="w-full bg-white text-black py-3 rounded-xl font-medium mt-2">{isAuthLoading ? 'Connecting...' : (isSignUp ? 'Create Account' : 'Sign In')}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD (MOBILE FIRST) ---
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 pb-20">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
      
      {/* Header */}
      <header className="bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-sm font-semibold text-white">SentinelNet Protection</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Store: {username}</p>
        </div>
        <button onClick={() => { setIsLoggedIn(false); setToken(null); setShowLanding(true); }} className="text-[11px] font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg active:scale-95">Logout</button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        
        {/* 1. ORDER SCANNER */}
        <div className="bg-[#121212] rounded-2xl border border-zinc-800 p-5 shadow-lg">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Verify New Order</h2>
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
              <input 
                type="number" step="0.01" placeholder="Enter transaction amount..." 
                value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)}
                className="w-full bg-[#09090b] border border-zinc-800 rounded-xl pl-8 pr-4 py-4 text-lg text-white focus:outline-none focus:border-zinc-500 transition-all"
                required
              />
            </div>
            <button type="submit" disabled={status === 'loading'} className="w-full bg-white text-black py-4 rounded-xl font-semibold transition-transform active:scale-[0.98] disabled:opacity-50">
              {status === 'loading' ? 'Analyzing Risk Patterns...' : 'Run Security Check'}
            </button>
          </form>
        </div>

        {/* 2. THE TRAFFIC LIGHT RESULT */}
        {status === 'success' && prediction && (
          <div className="bg-[#121212] rounded-2xl border border-zinc-800 p-6 flex flex-col items-center text-center animate-fade-in shadow-xl">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-6">Security Assessment</h3>
            
            {/* Traffic Light Visual */}
            <div className="flex gap-4 mb-8 bg-[#09090b] p-3 rounded-full border border-zinc-800">
              <div className={`w-12 h-12 rounded-full transition-all duration-500 ${prediction.traffic_light === 'green' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-emerald-950/30'}`}></div>
              <div className={`w-12 h-12 rounded-full transition-all duration-500 ${prediction.traffic_light === 'yellow' ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-amber-950/30'}`}></div>
              <div className={`w-12 h-12 rounded-full transition-all duration-500 ${prediction.traffic_light === 'red' ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-red-950/30'}`}></div>
            </div>

            <h2 className="text-3xl font-semibold text-white mb-2">${currentAmount.toFixed(2)}</h2>
            
            <div className={`mt-2 px-4 py-3 rounded-xl border w-full ${
              prediction.traffic_light === 'red' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
              prediction.traffic_light === 'yellow' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 
              'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <p className="text-sm font-medium leading-relaxed">{prediction.advisory || "Cleared for fulfillment."}</p>
            </div>
          </div>
        )}

        {/* 3. SALES TRACKER (Repurposed Budget) */}
        <div className="bg-[#121212] rounded-2xl border border-zinc-800 p-5">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Total Verified Sales</h2>
              <span className="text-2xl font-semibold text-white">${prediction?.total_spent ? parseFloat(prediction.total_spent).toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-1">Revenue Target</span>
              <span className="text-sm text-zinc-300">${parseFloat(monthlyBudget).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
          
          <form onSubmit={updateBudget} className="flex gap-2 border-t border-zinc-800/50 pt-4 mt-2">
            <input 
              type="number" placeholder="Update Target" value={newBudgetInput} onChange={(e) => setNewBudgetInput(e.target.value)}
              className="flex-1 bg-[#09090b] border border-zinc-800 rounded-lg text-xs px-3 py-2 text-white outline-none"
            />
            <button type="submit" className="bg-zinc-800 text-white px-4 py-2 text-xs rounded-lg font-medium">Set</button>
          </form>
        </div>

        {/* 4. RECENT SCANS LOG */}
        <div className="bg-[#121212] rounded-2xl border border-zinc-800 p-5">
          <h2 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-4">Recent Scans</h2>
          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No recent activity.</p>
            ) : (
              history.map((log, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-[#09090b] rounded-xl border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-white">${log.amount.toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-500">{log.time}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    log.color === 'red' ? 'bg-red-500/20 text-red-400' : 
                    log.color === 'yellow' ? 'bg-amber-500/20 text-amber-400' : 
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {log.color}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* FLOATING SUPPORT BOT */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        {isChatOpen && (
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl w-[calc(100vw-2rem)] max-w-sm h-[400px] mb-4 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
            <div className="bg-[#09090b] border-b border-zinc-800 p-4 flex justify-between items-center">
              <span className="text-sm font-semibold text-white">Merchant Assistant</span>
              <button onClick={() => setIsChatOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-white text-black rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-[#09090b] border-t border-zinc-800">
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input type="text" value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} placeholder="Ask for advice..." className="flex-1 bg-[#121212] border border-zinc-800 rounded-xl text-sm px-4 py-2.5 text-white outline-none focus:border-zinc-500" />
                <button type="submit" className="bg-white text-black p-2.5 rounded-xl hover:bg-zinc-200">→</button>
              </form>
            </div>
          </div>
        )}
        <button onClick={() => setIsChatOpen(!isChatOpen)} className="h-14 w-14 bg-white text-black rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        </button>
      </div>
    </div>
  )
}

export default App
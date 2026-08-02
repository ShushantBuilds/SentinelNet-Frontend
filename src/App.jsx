import { useState } from 'react'

const API_BASE_URL = 'https://sentinelnet-backend.onrender.com';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 

  const [status, setStatus] = useState('idle');
  const [prediction, setPrediction] = useState(null);
  
  // Simulating the URL the browser is currently on
  const [currentUrl, setCurrentUrl] = useState('checkout.sketchy-deals.com/pay'); 
  const [checkoutAmount, setCheckoutAmount] = useState('');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'SentinelNet Shield active. Paste a URL or ask me about a store.' }]);
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
        setAuthError('Account created! Sign in to activate Shield.');
        setPassword('');
      } else {
        setToken(data.access);
        setIsLoggedIn(true);
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false); 
    }
  };

  const runPageScan = async (e) => {
    e.preventDefault();
    setStatus('loading');
    const amount = parseFloat(checkoutAmount) || 0;
    
    // Simulating risk based on amount for the demo
    const isSuspicious = amount > 5000 || currentUrl.includes('sketchy');
    const syntheticMetadata = Array.from({ length: 29 }, () => isSuspicious ? (Math.random() * 10) - 5 : Math.random() * 0.1);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/predict/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ features: [amount, ...syntheticMetadata] })
      });

      if (response.status === 401) { setIsLoggedIn(false); setToken(null); return; }
      
      const data = await response.json();
      setPrediction(data);
      setStatus('success');
    } catch (error) {
      setStatus('error');
    }
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

  // --- EXTENSION CONTAINER ---
  // Note: For demo purposes, this centers a 380x600 box on the screen to simulate the extension popup.
  return (
    <div className="w-[380px] h-[600px] bg-[#09090b] text-zinc-100 font-sans overflow-hidden flex flex-col relative selection:bg-zinc-800">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      
      <div className="bg-[#121212] border-b border-zinc-800 p-4 flex justify-between items-center shrink-0">
        
        {/* HEADER */}
        <div className="bg-[#121212] border-b border-zinc-800 p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <h1 className="text-sm font-semibold text-white tracking-tight">SentinelNet Shield</h1>
          </div>
          {isLoggedIn && (
            <button onClick={() => {setIsLoggedIn(false); setToken(null); setPrediction(null); setStatus('idle');}} className="text-[10px] text-zinc-500 hover:text-zinc-300">
              Disable
            </button>
          )}
        </div>

        {/* AUTH GATE */}
        {!isLoggedIn ? (
          <div className="flex-1 p-6 flex flex-col justify-center">
            <h2 className="text-lg font-semibold text-white mb-2">{isSignUp ? 'Create Shield Account' : 'Activate Shield'}</h2>
            <p className="text-xs text-zinc-400 mb-6">Sign in to protect your browsing sessions.</p>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#121212] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" required />
              <input type="password" placeholder="Passcode" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#121212] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" required />
              {authError && <p className="text-[11px] text-red-400 p-2 bg-red-950/30 rounded">{authError}</p>}
              <button type="submit" disabled={isAuthLoading} className="w-full bg-white text-black py-2.5 rounded-lg text-sm font-semibold mt-2 active:scale-[0.98]">
                {isAuthLoading ? 'Authenticating...' : (isSignUp ? 'Register' : 'Connect')}
              </button>
            </form>
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="mt-4 text-xs text-zinc-500 w-full text-center hover:text-white">
              {isSignUp ? "Already have an account?" : "Need an account?"}
            </button>
          </div>
        ) : (
          /* MAIN EXTENSION UI */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {!isChatOpen ? (
              <div className="flex-1 p-5 overflow-y-auto">
                <div className="mb-6">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Detected Checkout Page</label>
                  <input 
                    type="text" value={currentUrl} onChange={(e) => setCurrentUrl(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-300 font-mono outline-none focus:border-blue-500"
                  />
                </div>

                <form onSubmit={runPageScan} className="mb-6">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Cart Total</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" step="0.01" placeholder="$0.00" value={checkoutAmount} onChange={(e) => setCheckoutAmount(e.target.value)}
                      className="flex-1 bg-[#121212] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" required
                    />
                    <button type="submit" disabled={status === 'loading'} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                      Scan
                    </button>
                  </div>
                </form>

                {status === 'loading' && (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <div className="w-5 h-5 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Analyzing Metadata...</p>
                  </div>
                )}

                {status === 'success' && prediction && (
                  <div className={`p-4 rounded-xl border animate-fade-in ${
                    prediction.shield_status === 'danger' ? 'bg-red-950/20 border-red-900/50' :
                    prediction.shield_status === 'warning' ? 'bg-amber-950/20 border-amber-900/50' :
                    'bg-emerald-950/20 border-emerald-900/50'
                  }`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        prediction.shield_status === 'danger' ? 'text-red-500' :
                        prediction.shield_status === 'warning' ? 'text-amber-500' :
                        'text-emerald-500'
                      }`}>
                        {prediction.shield_status === 'danger' ? 'Critical Scam Risk' :
                         prediction.shield_status === 'warning' ? 'Suspicious Store' : 'Verified Merchant'}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">{(prediction.fraud_probability * 100).toFixed(1)}%</span>
                    </div>
                    
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full mb-4 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${
                        prediction.shield_status === 'danger' ? 'bg-red-500' :
                        prediction.shield_status === 'warning' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`} style={{ width: `${Math.max(prediction.fraud_probability * 100, 2)}%` }}></div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {prediction.advisory}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* CHATBOT UI */
              <div className="flex-1 flex flex-col bg-[#09090b] animate-fade-in">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[#121212] border border-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleChatSubmit} className="p-3 bg-[#121212] border-t border-zinc-800 flex gap-2">
                  <input 
                    type="text" value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} 
                    placeholder="Ask about this site..." 
                    className="flex-1 bg-[#09090b] border border-zinc-800 rounded-md text-xs px-3 py-2 text-white outline-none focus:border-blue-500" 
                  />
                  <button type="submit" className="bg-white text-black p-2 rounded-md hover:bg-zinc-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </form>
              </div>
            )}

            {/* BOTTOM NAV BAR */}
            <div className="flex border-t border-zinc-800 bg-[#121212] shrink-0">
              <button 
                onClick={() => setIsChatOpen(false)} 
                className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors ${!isChatOpen ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Scan Engine
              </button>
              <button 
                onClick={() => setIsChatOpen(true)} 
                className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors border-l border-zinc-800 ${isChatOpen ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Safety AI Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
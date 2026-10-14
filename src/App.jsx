import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const API_BASE_URL = 'https://sentinelnet-backend.onrender.com';

function App() {
  const [theme, setTheme] = useState('light'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 
  
  const [currentUrl, setCurrentUrl] = useState(''); 
  const [pageContext, setPageContext] = useState('');
  const [pastedLink, setPastedLink] = useState('');
  const [status, setStatus] = useState('idle');
  const [prediction, setPrediction] = useState(null);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'SentinelNet Shield active. Ask me about a store or checkout risk.' }]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');

  const t = (darkClass, lightClass) => theme === 'dark' ? darkClass : lightClass;

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          setPastedLink(tabs[0].url || '');
          
          try {
            const domain = new URL(tabs[0].url).hostname.replace('www.', '');
            setCurrentUrl(domain);
          } catch (e) {
            setCurrentUrl('Unknown Domain');
          }

          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              const url = window.location.href.toLowerCase();
              const isPaymentUrl = ['checkout', 'pay', 'cart', 'billing', 'buy', 'order'].some(kw => url.includes(kw));
              const hasCardInputs = !!document.querySelector('input[autocomplete*="cc-"], input[name*="card"], input[name*="cvv"], input[id*="card"]');
              const hasPayButton = Array.from(document.querySelectorAll('button, a, input[type="submit"]')).some(btn => {
                const text = (btn.innerText || btn.value || '').toLowerCase();
                return text.includes('place order') || text.includes('pay now') || text.includes('complete purchase');
              });

              const title = document.title || '';
              const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
              const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000);

              return {
                isPaymentPage: isPaymentUrl || hasCardInputs || hasPayButton,
                pageContext: `Page Title: ${title}\nMeta Description: ${metaDesc}\nPage Text Sample:\n${bodyText}`
              };
            }
          }, (results) => {
            if (results && results[0]?.result) {
              const { isPaymentPage, pageContext } = results[0].result;
              setPageContext(pageContext);
              if (isPaymentPage) setIsChatOpen(false);
            }
          });
        }
      });
    } else {
      setCurrentUrl('demo-store.com'); // Fallback for local testing
    }
  }, []);

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
        setAuthError('Account created! Sign in to activate.');
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

  const handleForgotPassword = () => {
    alert('Please contact SentinelNet support to reset your passcode.');
  };

const runPageScan = async (e) => {
    e.preventDefault();
    if (!pastedLink) return;
    setStatus('loading');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analyze/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          amount: 0.0,
          url: pastedLink,
          page_context: pageContext
        })
      });

      if (response.status === 401) { 
        setIsLoggedIn(false); 
        setToken(null); 
        return; 
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Server encountered an error.');
      }
      
      setPrediction({
        fraud_probability: data.final_risk_score / 100,
        shield_status: data.shield_status,
        advisory: data.seller_analysis,
        mlContribution: data.ml_contribution,
        llmContribution: data.llm_contribution
      });
      setStatus('success');
    } catch (error) {
      console.error("Scan Error:", error);
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
        body: JSON.stringify({ type: 'chat', message: userMsg, page_context: pageContext, url: pastedLink })
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

  return (
    <div className={`w-100 h-150 font-sans flex flex-col relative overflow-hidden transition-colors duration-300 ${t('bg-[#09090b] text-zinc-100', 'bg-slate-50 text-slate-900')}`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      
      <div className={`p-4 flex justify-between items-center shrink-0 z-10 transition-colors duration-300 ${t('bg-[#121212] border-b border-zinc-800', 'bg-white border-b border-slate-200 shadow-sm')}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t('bg-blue-600 shadow-lg shadow-blue-900/50', 'bg-blue-600 shadow-md shadow-blue-600/20')}`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className={`text-[15px] font-semibold tracking-tight leading-none mb-1.5 ${t('text-white', 'text-slate-900')}`}>SentinelNet</h1>
            {isLoggedIn && (
              <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${t('text-blue-400', 'text-blue-600')}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${t('bg-blue-500', 'bg-blue-500')}`}></span> Safe Browsing
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-1.5 rounded-md transition-colors ${t('text-zinc-400 hover:bg-zinc-800 hover:text-white', 'text-slate-400 hover:bg-slate-100 hover:text-slate-900')}`}>
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
          {isLoggedIn && (
            <button onClick={() => {setIsLoggedIn(false); setToken(null); setPrediction(null); setStatus('idle');}} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-md transition-colors ${t('text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white', 'text-slate-500 bg-slate-100 border border-slate-200 hover:text-slate-800')}`}>
              Sign Out
            </button>
          )}
        </div>
      </div>

      {!isLoggedIn ? (
        <div className={`flex-1 p-6 flex flex-col justify-center transition-colors duration-300 ${t('bg-gradient-to-b from-[#121212] to-[#09090b]', 'bg-slate-50')}`}>
          <h2 className={`text-xl font-semibold mb-2 ${t('text-white', 'text-slate-900')}`}>{isSignUp ? 'Create Account' : 'Activate Shield'}</h2>
          <p className={`text-xs mb-8 leading-relaxed ${t('text-zinc-400', 'text-slate-500')}`}>Secure your checkout sessions and prevent e-commerce fraud in real-time.</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} 
              className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-all ${t('bg-[#09090b] border border-zinc-800 text-white focus:border-blue-500', 'bg-white border border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm')}`} required />
            
            <div className="relative">
              <input type={showPassword ? "text" : "password"} placeholder="Passcode" value={password} onChange={(e) => setPassword(e.target.value)} 
                className={`w-full rounded-lg pl-4 pr-10 py-3 text-sm outline-none transition-all ${t('bg-[#09090b] border border-zinc-800 text-white focus:border-blue-500', 'bg-white border border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm')}`} required />
              
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${t('text-zinc-500 hover:text-zinc-300', 'text-slate-400 hover:text-slate-600')}`}
              >
                {showPassword ? (
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" /></svg>
                ) : (
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>

            {!isSignUp && (
              <div className="flex justify-end -mt-2">
                <button type="button" onClick={handleForgotPassword} className={`text-[11.5px] font-medium hover:underline transition-colors ${t('text-blue-400', 'text-blue-600')}`}>
                  Forgot passcode?
                </button>
              </div>
            )}

            {authError && <p className={`text-[11px] p-2.5 rounded-lg ${t('text-red-400 bg-red-950/30 border border-red-900/50', 'text-red-700 bg-red-50 border border-red-200')}`}>{authError}</p>}
            
            <button type="submit" disabled={isAuthLoading} 
              className={`w-full py-3 rounded-lg text-sm font-semibold mt-2 transition-all active:scale-[0.98] ${t('bg-white text-black hover:bg-zinc-200', 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20')}`}>
              {isAuthLoading ? 'Authenticating...' : (isSignUp ? 'Register' : 'Connect Shield')}
            </button>
          </form>
          <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className={`mt-6 text-xs w-full text-center transition-colors ${t('text-zinc-500 hover:text-white', 'text-slate-500 hover:text-blue-600')}`}>
            {isSignUp ? "Already have an account? Sign in." : "Need an account? Register here."}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {!isChatOpen ? (
            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">

              <div className="mb-6">
                <label className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${t('text-zinc-500', 'text-slate-500')}`}>Active Web Page</label>
                <div className={`w-full rounded-lg px-3 py-3 flex items-center gap-2 ${t('bg-[#121212] border border-zinc-800', 'bg-white border border-slate-200 shadow-sm')}`}>
                  <svg className={`w-4 h-4 ${t('text-zinc-500', 'text-slate-400')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  <span className={`text-xs font-mono truncate ${t('text-zinc-300', 'text-slate-700')}`}>{currentUrl}</span>
                </div>
              </div>
              
              <form onSubmit={runPageScan} className="mb-6">
                <label className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${t('text-zinc-500', 'text-slate-500')}`}>
                  Target URL
                </label>
                <div className="flex flex-col gap-3">
                  <input 
                    type="url" placeholder="Paste store or checkout link here..." 
                    value={pastedLink} onChange={(e) => setPastedLink(e.target.value)}
                    className={`w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors ${t('bg-[#121212] border border-zinc-800 text-white focus:border-blue-500', 'bg-white border border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm')}`} required
                  />
                  <button type="submit" disabled={status === 'loading' || !pastedLink} className={`w-full px-5 py-3 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${t('bg-blue-600 text-white hover:bg-blue-500', 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20')}`}>
                    Run Deep Scan
                  </button>
                </div>
              </form>

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative flex h-8 w-8">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-30 ${t('bg-blue-500', 'bg-blue-600')}`}></span>
                    <span className={`relative inline-flex rounded-full h-8 w-8 border-2 border-t-transparent animate-spin ${t('border-blue-500', 'border-blue-600')}`}></span>
                  </div>
                  <p className={`text-[10px] uppercase tracking-widest font-bold ${t('text-zinc-500', 'text-slate-500')}`}>Intercepting Network...</p>
                </div>
              )}

              {status === 'error' && (
                <div className={`p-5 rounded-xl text-center border animate-fade-in ${t('bg-red-950/20 border-red-900/50', 'bg-red-50 border-red-200')}`}>
                  <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${t('text-red-400', 'text-red-600')}`}>Scan Failed</h3>
                  <p className={`text-[11px] ${t('text-zinc-400', 'text-slate-600')}`}>
                    The server encountered an error processing this URL. Please try again or check your backend logs.
                  </p>
                </div>
              )}

              {status === 'success' && prediction && (
                <div className="space-y-4 animate-fade-in">
                  
                  <div className={`p-5 rounded-xl ${t('bg-[#121212] border border-zinc-800', 'bg-white border border-slate-200 shadow-sm')}`}>
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${t('text-blue-400', 'text-blue-600')}`}>Intelligence Report</h3>
                    <div className={`text-[11.5px] leading-relaxed wrap-break-words space-y-2 ${t('text-zinc-300', 'text-slate-700')}`}>
                      <ReactMarkdown 
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => <strong className={`font-semibold ${t('text-white', 'text-slate-900')}`} {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />
                        }}
                      >
                        {prediction.advisory}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className={`p-5 rounded-xl ${
                    prediction.shield_status === 'danger' ? t('bg-red-950/20 border border-red-900/50', 'bg-white border border-red-200 shadow-lg shadow-red-500/10') :
                    prediction.shield_status === 'warning' ? t('bg-amber-950/20 border border-amber-900/50', 'bg-white border border-amber-200 shadow-lg shadow-amber-500/10') :
                    t('bg-emerald-950/20 border border-emerald-900/50', 'bg-white border border-emerald-200 shadow-lg shadow-emerald-500/10')
                  }`}>
                    <div className="flex justify-between items-end mb-4">
                      <div>
                         <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${
                          prediction.shield_status === 'danger' ? t('text-red-500', 'text-red-600') :
                          prediction.shield_status === 'warning' ? t('text-amber-500', 'text-amber-600') :
                          t('text-emerald-500', 'text-emerald-600')
                        }`}>
                          {prediction.shield_status === 'danger' ? 'Scam Alert' :
                           prediction.shield_status === 'warning' ? 'Suspicious' : 'Verified Safe'}
                        </span>
                        <span className={`text-lg font-bold tracking-tight ${t('text-white', 'text-slate-900')}`}>
                          Blended Risk Score
                        </span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md ${t('text-zinc-400 bg-[#09090b] border border-zinc-800', 'text-slate-600 bg-slate-50 border border-slate-200')}`}>
                        {(prediction.fraud_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className={`w-full h-1.5 rounded-full overflow-hidden mb-3 ${t('bg-[#09090b] border border-zinc-800/50', 'bg-slate-100')}`}>
                      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        prediction.shield_status === 'danger' ? 'bg-red-500' :
                        prediction.shield_status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} style={{ width: `${Math.max(prediction.fraud_probability * 100, 2)}%` }}></div>
                    </div>
                    <div className={`pt-3 border-t text-[10.5px] leading-relaxed space-y-1 ${t('border-zinc-800/80 text-zinc-400', 'border-slate-100 text-slate-500')}`}>
                      <p className="font-semibold uppercase tracking-wider text-[9.5px] opacity-80 mb-1">Calculation Breakdown:</p>
                      <div className="flex justify-between">
                        <span>🌐 Live Web Intelligence (70%):</span>
                        <span className="font-mono font-medium">{prediction.llmContribution ?? 50}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🤖 Local Pattern Matcher (30%):</span>
                        <span className="font-mono font-medium">{prediction.mlContribution ?? 0}%</span>
                      </div>
                    </div>

                  </div>

                </div>
              )}
              <p className={`text-center text-[9.5px] mt-6 mb-2 px-4 leading-relaxed ${t('text-zinc-600', 'text-slate-400')}`}>
                <span className="font-semibold opacity-80">Disclaimer:</span> SentinelNet provides an AI-driven risk estimate based on available web data. The final purchasing decision is always yours.
              </p>
            </div>
          ) : (
            <div className={`flex-1 flex flex-col animate-fade-in overflow-hidden ${t('bg-[#09090b]', 'bg-slate-50')}`}>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 text-[11.5px] leading-relaxed wrap-break-word ${
                      msg.role === 'user' 
                        ? t('bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-sm', 'bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-md shadow-blue-600/10') 
                        : t('bg-[#121212] border border-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm', 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm shadow-sm')
                    }`}>
                      <ReactMarkdown 
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => <strong className={`font-bold ${msg.role === 'user' ? 'text-white' : t('text-white', 'text-slate-900')}`} {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleChatSubmit} className={`p-3 flex gap-2 shrink-0 ${t('bg-[#121212] border-t border-zinc-800', 'bg-white border-t border-slate-200')}`}>
                <input 
                  type="text" value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} 
                  placeholder="Ask for safety advice..." 
                  className={`flex-1 rounded-full text-xs px-4 py-2.5 outline-none transition-colors ${t('bg-[#09090b] border border-zinc-800 text-white focus:border-blue-500', 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-500 shadow-inner')}`} 
                />
                <button type="submit" disabled={!currentChatMessage} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${t('bg-white text-black hover:bg-zinc-200', 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20')}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </form>
            </div>
          )}
          <div className={`flex shrink-0 ${t('border-t border-zinc-800 bg-[#121212]', 'bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]')}`}>
            <button 
              onClick={() => setIsChatOpen(false)} 
              className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${!isChatOpen ? t('text-blue-400 bg-blue-500/10', 'text-blue-700 bg-blue-50') : t('text-zinc-500 hover:text-zinc-300', 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}`}
            >
              Scan Engine
            </button>
            <button 
              onClick={() => setIsChatOpen(true)} 
              className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${t('border-l border-zinc-800', 'border-l border-slate-200')} ${isChatOpen ? t('text-blue-400 bg-blue-500/10', 'text-blue-700 bg-blue-50') : t('text-zinc-500 hover:text-zinc-300', 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}`}
            >
              Safety AI Chat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
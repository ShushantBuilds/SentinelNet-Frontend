/*global chrome*/
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const API_BASE_URL = 'https://sentinelnet-backend.onrender.com';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 
  const [pageContext, setPageContext] = useState('');
  const [pastedLink, setPastedLink] = useState('');
  const [dealAnalytics, setDealAnalytics] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [status, setStatus] = useState('idle');
  const [prediction, setPrediction] = useState(null);
  
  const [currentUrl, setCurrentUrl] = useState(''); 
  const [checkoutAmount, setCheckoutAmount] = useState('');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'SentinelNet Shield active. Ask me about a store or checkout risk.' }]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [pageType, setPageType] = useState('general');

  // --- NEW: AUTO-CURRENCY STATE ---
  const [localeData, setLocaleData] = useState({ locale: 'en-US', currency: 'USD', symbol: '$' });

  useEffect(() => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        // 1. Get Domain URL
        const domain = new URL(tabs[0].url).hostname.replace('www.', '');
        setCurrentUrl(domain);

        // 2. Inject a scraper to read the active webpage content
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // Extract title, meta description, and first 3,000 characters of page text
            const title = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim();
            
            return {
              title,
              metaDesc,
              // Truncate text so we don't overwhelm the token limit unnecessarily
              sampleText: bodyText.slice(0, 3000) 
            };
          }
        }, (results) => {
          if (results && results[0]?.result) {
            const data = results[0].result;
            const fullContext = `Page Title: ${data.title}\nMeta Description: ${data.metaDesc}\nPage Text Sample:\n${data.sampleText}`;
            setPageContext(fullContext);
          }
        });
      }
    });
  }
}, []);

useEffect(() => {
  // 1. EXTENSION AUTO-DETECTION & SMART ROUTING
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        // Extract domain name
        const domain = new URL(tabs[0].url).hostname.replace('www.', '');
        setCurrentUrl(domain);

        // Run the Smart Payment Detector on the active tab
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const url = window.location.href.toLowerCase();
            
            // Check 1: URL Keywords
            const isPaymentUrl = ['checkout', 'pay', 'cart', 'billing', 'buy', 'order'].some(kw => url.includes(kw));

            // Check 2: Credit Card / Payment Inputs
            const hasCardInputs = !!document.querySelector(
              'input[autocomplete*="cc-"], input[name*="card"], input[name*="cvv"], input[id*="card"], input[placeholder*="card"]'
            );

            // Check 3: Payment iFrames (Stripe, PayPal, Razorpay, etc.)
            const hasPaymentIframe = !!document.querySelector(
              'iframe[src*="stripe"], iframe[src*="paypal"], iframe[src*="razorpay"], iframe[src*="checkout"]'
            );

            // Check 4: Payment / Checkout Buttons
            const hasPayButton = Array.from(document.querySelectorAll('button, a, input[type="submit"]')).some(btn => {
              const text = (btn.innerText || btn.value || '').toLowerCase();
              return text.includes('place order') || 
                     text.includes('pay now') || 
                     text.includes('proceed to checkout') || 
                     text.includes('complete purchase');
            });

            // Also scrape page text for Gemini context
            const title = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000);

            return {
              isPaymentPage: isPaymentUrl || hasCardInputs || hasPaymentIframe || hasPayButton,
              pageContext: `Page Title: ${title}\nMeta Description: ${metaDesc}\nPage Text Sample:\n${bodyText}`
            };
          }
        }, (results) => {
          if (results && results[0]?.result) {
            const { isPaymentPage, pageContext } = results[0].result;
            
            // Set extracted page text for Gemini AI
            setPageContext(pageContext);

            // SMART ROUTING LOGIC:
            if (isPaymentPage) {
              setIsChatOpen(false);
              setPageType('checkout'); // Open Checkout Shield (Scan Engine)
            } else {
              setIsChatOpen(true);
              setPageType('general');  // Open Safety AI Chatbot
            }
          }
        });
      }
    });
  } else {
    // Fallback for local browser testing (non-extension)
    setCurrentUrl('demo-store.com');
  }

  // 2. DYNAMIC CURRENCY DETECTION
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userLocale = navigator.language || 'en-US';
  
  let detectedCurrency = 'USD';
  let detectedSymbol = '$';

  if (timezone.includes('Calcutta') || timezone.includes('Kolkata') || userLocale.includes('IN')) {
    detectedCurrency = 'INR'; detectedSymbol = '₹';
  } else if (timezone.includes('Europe/London') || userLocale.includes('GB')) {
    detectedCurrency = 'GBP'; detectedSymbol = '£';
  } else if (timezone.includes('Europe')) {
    detectedCurrency = 'EUR'; detectedSymbol = '€';
  } else if (timezone.includes('Australia')) {
    detectedCurrency = 'AUD'; detectedSymbol = 'A$';
  }

  setLocaleData({ locale: userLocale, currency: detectedCurrency, symbol: detectedSymbol });
}, []);

  useEffect(() => {
    // 1. EXTENSION AUTO-URL DETECTION
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          // Extract just the domain for a cleaner UI (e.g., amazon.in)
          const domain = new URL(tabs[0].url).hostname.replace('www.', '');
          setCurrentUrl(domain);
        }
      });
    } else {
      setCurrentUrl('demo-store.com'); // Fallback for local testing
    }

    // 2. DYNAMIC CURRENCY DETECTION
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userLocale = navigator.language || 'en-US';
    
    let detectedCurrency = 'USD';
    let detectedSymbol = '$';

    if (timezone.includes('Calcutta') || timezone.includes('Kolkata') || userLocale.includes('IN')) {
      detectedCurrency = 'INR'; detectedSymbol = '₹';
    } else if (timezone.includes('Europe/London') || userLocale.includes('GB')) {
      detectedCurrency = 'GBP'; detectedSymbol = '£';
    } else if (timezone.includes('Europe')) {
      detectedCurrency = 'EUR'; detectedSymbol = '€';
    } else if (timezone.includes('Australia')) {
      detectedCurrency = 'AUD'; detectedSymbol = 'A$';
    }

    setLocaleData({ locale: userLocale, currency: detectedCurrency, symbol: detectedSymbol });
  }, []);

  // Helper to format currency correctly based on detected country
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(localeData.locale, {
      style: 'currency',
      currency: localeData.currency
    }).format(amount);
  };

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

  const runPageScan = async (e) => {
    e.preventDefault();
    setStatus('loading');
    const amount = parseFloat(checkoutAmount) || 0;
    
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

  const analyzeDeal = async (e) => {
    e.preventDefault();
    if (!pastedLink) return;
    setIsAnalyzing(true);
    setDealAnalytics(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          type: 'analyze_deal', 
          product_url: pastedLink,
          page_context: pageContext 
        })
      });
      
      if (response.status === 401) { setIsLoggedIn(false); setToken(null); return; }
      
      if (response.ok) {
        const data = await response.json();
        setDealAnalytics(data.response);
      }
    } catch (error) {
      setDealAnalytics("Failed to analyze the deal. Check network connection.");
    } finally {
      setIsAnalyzing(false);
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
        body: JSON.stringify({ type: 'chat', message: userMsg, page_context: pageContext, url: currentUrl })
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

  // --- FIXED EXTENSION CONTAINER ---
  // The wrapper is removed. The root div is exactly 400x600.
  return (
    <div className="w-[400px] h-[600px] bg-[#09090b] text-zinc-100 font-sans flex flex-col relative overflow-hidden">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      
      {/* HEADER */}
      <div className="bg-[#121212] border-b border-zinc-800 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50 shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-[15px] font-semibold text-white tracking-tight leading-none mb-1.5">SentinelNet Shield</h1>
            {isLoggedIn && (
              pageType === 'checkout' ? (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Checkout Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-blue-400 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  General Browsing
                </span>
              )
            )}
          </div>
        </div>
        {isLoggedIn && (
          <button onClick={() => {setIsLoggedIn(false); setToken(null); setPrediction(null); setStatus('idle');}} className="text-[11px] font-medium text-zinc-500 hover:text-white transition-colors border border-zinc-800 px-2.5 py-1 rounded-md bg-zinc-900">
            Disable
          </button>
        )}
      </div>

      {/* AUTH GATE */}
      {!isLoggedIn ? (
        <div className="flex-1 p-6 flex flex-col justify-center bg-gradient-to-b from-[#121212] to-[#09090b]">
          <h2 className="text-xl font-semibold text-white mb-2">{isSignUp ? 'Create Account' : 'Activate Shield'}</h2>
          <p className="text-xs text-zinc-400 mb-8 leading-relaxed">Secure your checkout sessions and prevent e-commerce fraud in real-time.</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors" required />
            <input type="password" placeholder="Passcode" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors" required />
            {authError && <p className="text-[11px] text-red-400 p-2.5 bg-red-950/30 border border-red-900/50 rounded-lg">{authError}</p>}
            <button type="submit" disabled={isAuthLoading} className="w-full bg-white text-black py-3 rounded-lg text-sm font-semibold mt-4 hover:bg-zinc-200 transition-colors active:scale-[0.98]">
              {isAuthLoading ? 'Authenticating...' : (isSignUp ? 'Register' : 'Connect Shield')}
            </button>
          </form>
          <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="mt-6 text-xs text-zinc-500 w-full text-center hover:text-white transition-colors">
            {isSignUp ? "Already have an account? Sign in." : "Need an account? Register here."}
          </button>
        </div>
      ) : (
        /* MAIN EXTENSION UI */
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {!isChatOpen ? (
            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
              
              <div className="mb-6">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Active Web Page</label>
                <div className="w-full bg-[#121212] border border-zinc-800 rounded-lg px-3 py-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  <span className="text-xs text-zinc-300 font-mono truncate">{currentUrl}</span>
                </div>
              </div>

              <form onSubmit={runPageScan} className="mb-6">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Detected Cart Total</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-semibold">{localeData.symbol}</span>
                    <input 
                      type="number" step="0.01" placeholder="0.00" value={checkoutAmount} onChange={(e) => setCheckoutAmount(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 rounded-lg pl-8 pr-3 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors" required
                    />
                  </div>
                  <button type="submit" disabled={status === 'loading'} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-50">
                    Scan
                  </button>
                </div>
              </form>

              {/* NEW: PRODUCT LINK ANALYZER */}
              <form onSubmit={analyzeDeal} className="mb-6 pt-6 border-t border-zinc-800/50">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Analyze Product Value</label>
                <div className="flex flex-col gap-3">
                  <input 
                    type="url" placeholder="Paste product or checkout link here..." value={pastedLink} onChange={(e) => setPastedLink(e.target.value)}
                    className="w-full bg-[#121212] border border-zinc-800 rounded-lg px-3 py-3 text-xs text-white outline-none focus:border-blue-500 transition-colors" required
                  />
                  <button type="submit" disabled={isAnalyzing || !pastedLink} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50">
                    {isAnalyzing ? 'Analyzing Deal...' : 'Get Purchase Advice'}
                  </button>
                </div>
              </form>

              {/* DEAL ANALYTICS RESULT CARD */}
              {dealAnalytics && (
                <div className="mb-6 p-4 bg-indigo-950/20 border border-indigo-900/50 rounded-xl animate-fade-in shadow-xl shadow-indigo-900/10">
                  <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">SentinelNet Verdict</h3>
                  <div className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-indigo-300" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-3 space-y-1.5" {...props} />,
                        li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                      }}
                    >
                      {dealAnalytics}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative flex h-8 w-8">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-30"></span>
                    <span className="relative inline-flex rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent animate-spin"></span>
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Intercepting Network...</p>
                </div>
              )}

              {status === 'success' && prediction && (
                <div className={`p-5 rounded-xl border animate-fade-in shadow-2xl ${
                  prediction.shield_status === 'danger' ? 'bg-red-950/20 border-red-900/50 shadow-red-900/20' :
                  prediction.shield_status === 'warning' ? 'bg-amber-950/20 border-amber-900/50 shadow-amber-900/20' :
                  'bg-emerald-950/20 border-emerald-900/50 shadow-emerald-900/20'
                }`}>
                  <div className="flex justify-between items-end mb-4">
                    <div>
                       <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${
                        prediction.shield_status === 'danger' ? 'text-red-500' :
                        prediction.shield_status === 'warning' ? 'text-amber-500' :
                        'text-emerald-500'
                      }`}>
                        {prediction.shield_status === 'danger' ? 'Scam Alert' :
                         prediction.shield_status === 'warning' ? 'Suspicious' : 'Verified'}
                      </span>
                      {/* Format the amount correctly based on country */}
                      <span className="text-xl font-semibold text-white tracking-tight">
                        {formatCurrency(checkoutAmount || 0)}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-400 bg-[#09090b] px-2 py-1 rounded border border-zinc-800">
                      Risk: {(prediction.fraud_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="w-full h-1.5 bg-[#09090b] rounded-full mb-4 overflow-hidden border border-zinc-800/50">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      prediction.shield_status === 'danger' ? 'bg-red-500' :
                      prediction.shield_status === 'warning' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} style={{ width: `${Math.max(prediction.fraud_probability * 100, 2)}%` }}></div>
                  </div>

                  {/* Added break-words to ensure text never overflows the box */}
                  <p className="text-[11px] text-zinc-300 leading-relaxed break-words">
                    {prediction.advisory}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* CHATBOT UI */
            <div className="flex-1 flex flex-col bg-[#09090b] animate-fade-in overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {/* Ensure long chat messages break properly and don't stretch the screen */}
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed break-words shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[#121212] border border-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                      <ReactMarkdown 
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                          em: ({node, ...props}) => <em className="italic text-zinc-300" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                          h1: ({node, ...props}) => <h1 className="font-bold text-[13px] text-white mt-3 mb-1" {...props} />,
                          h2: ({node, ...props}) => <h2 className="font-bold text-[12px] text-white mt-3 mb-1" {...props} />,
                          h3: ({node, ...props}) => <h3 className="font-bold text-[11px] text-white mt-3 mb-1 uppercase tracking-wider" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleChatSubmit} className="p-3 bg-[#121212] border-t border-zinc-800 flex gap-2 shrink-0">
                <input 
                  type="text" value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} 
                  placeholder="Ask for safety advice..." 
                  className="flex-1 bg-[#09090b] border border-zinc-800 rounded-lg text-xs px-3 py-2.5 text-white outline-none focus:border-blue-500 transition-colors" 
                />
                <button type="submit" disabled={!currentChatMessage} className="bg-white text-black px-3.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </form>
            </div>
          )}

          {/* BOTTOM NAV BAR */}
          <div className="flex border-t border-zinc-800 bg-[#121212] shrink-0">
            <button 
              onClick={() => setIsChatOpen(false)} 
              className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${!isChatOpen ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Scan Engine
            </button>
            <button 
              onClick={() => setIsChatOpen(true)} 
              className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-l border-zinc-800 ${isChatOpen ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
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
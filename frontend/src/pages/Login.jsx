import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, ShieldAlert, CheckCircle2, ArrowRight, 
  X, Sparkles, BookOpen
} from 'lucide-react';

const Login = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Helper to route authenticated user by role
  const handleAuthSuccess = (userData) => {
    if (userData?.role === 'faculty') {
      navigate('/faculty');
    } else if (userData?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/student');
    }
  };

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId || googleClientId === 'your_google_oauth_client_id_here') return;

    const setupGIS = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            auto_select: false,
            cancel_on_tap_outside: true,
            callback: async (response) => {
              if (response.credential) {
                setSubmitting(true);
                setError('');
                try {
                  const userData = await loginWithGoogle(response.credential);
                  handleAuthSuccess(userData);
                } catch (err) {
                  setError(typeof err === 'string' ? err : 'Google authentication failed.');
                } finally {
                  setSubmitting(false);
                }
              }
            },
          });
        } catch (e) {
          console.warn('Google Identity initialization error:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      setupGIS();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          setupGIS();
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [loginWithGoogle, navigate]);

  const handleGoogleSignIn = async () => {
    setError('');
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // Check if live Google Client ID is configured
    if (!googleClientId || googleClientId === 'your_google_oauth_client_id_here' || googleClientId.trim() === '') {
      setError('Google Sign-In is ready. Please configure VITE_GOOGLE_CLIENT_ID in your frontend .env file with your Google Cloud OAuth Client ID.');
      return;
    }

    if (!window.google?.accounts) {
      setError('Google Identity Services script is loading. Please try again in a moment or use email login.');
      return;
    }

    // Always ensure initialize has run with client_id
    if (window.google.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              setSubmitting(true);
              setError('');
              try {
                const userData = await loginWithGoogle(response.credential);
                handleAuthSuccess(userData);
              } catch (err) {
                setError(typeof err === 'string' ? err : 'Google authentication failed.');
              } finally {
                setSubmitting(false);
              }
            }
          },
        });
      } catch (e) {
        console.warn('Google accounts.id initialize error:', e);
      }
    }

    // Standard button click: launch OAuth2 token client popup directly
    if (window.google.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError(`Google sign-in error: ${tokenResponse.error}`);
              }
              return;
            }
            if (tokenResponse.access_token) {
              setSubmitting(true);
              setError('');
              try {
                const userData = await loginWithGoogle(null, tokenResponse.access_token);
                handleAuthSuccess(userData);
              } catch (err) {
                setError(typeof err === 'string' ? err : 'Google authentication failed.');
              } finally {
                setSubmitting(false);
              }
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        console.error('OAuth2 popup error:', err);
        setError('Could not open Google authentication popup. Please check your browser popup blocker or use email login.');
      }
    } else if (window.google.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(name, email, password, role);
        setSuccess('Account created successfully! Please sign in with your credentials.');
        setIsRegister(false);
        setPassword('');
        setName('');
      } else {
        const userData = await login(email, password);
        if (userData?.role === 'faculty') {
          navigate('/faculty');
        } else if (userData?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/student');
        }
      }
    } catch (err) {
      if (typeof err === 'string') {
        setError(err);
      } else if (err?.message?.includes('Network Error') || err?.code === 'ERR_NETWORK') {
        setError('Cannot connect to the server. Make sure the backend is running on port 8000.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#FFF9F6] text-[#1E1B18] relative overflow-x-hidden">
      
      {/* ── Top Header Navigation Bar ── */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group" 
          onClick={() => setShowAuthModal(false)}
        >
          <div className="p-2.5 rounded-2xl bg-[#FF5A36] text-white shadow-md group-hover:scale-105 transition-transform">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-[#1E1B18]">
            Tutor
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setShowAuthModal(true);
              setIsRegister(true);
              setError('');
              setSuccess('');
            }}
            className="px-5 sm:px-6 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider border-2 border-[#FF5A36] text-[#FF5A36] hover:bg-[#FFF0EB] transition-all shadow-sm active:scale-95"
          >
            SIGN UP
          </button>
          <button 
            onClick={() => {
              setShowAuthModal(true);
              setIsRegister(false);
              setError('');
              setSuccess('');
            }}
            className="px-6 sm:px-7 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-[#FF5A36] text-white hover:bg-[#E04826] transition-all shadow-md active:scale-95"
          >
            LOGIN
          </button>
        </div>
      </header>

      {/* ── Main Landing Hero Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-12 pb-20 max-w-4xl mx-auto space-y-9">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF0EB] border border-[#FFE4D9] text-xs font-extrabold text-[#FF5A36]">
          <Sparkles className="h-4 w-4" />
          <span>Next-Generation Virtual Learning Platform</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#1E1B18] leading-tight max-w-3xl">
          Next Level AI Tutoring<br />for Life-Long Learners
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-lg text-[#4A443F] font-medium max-w-2xl leading-relaxed">
          Create a personalized, adaptive learning pathway powered by intelligent AI tutors, interactive quizzes, automated homework verification, and academic support.
        </p>

        {/* Call to Action Button */}
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={() => {
              setShowAuthModal(true);
              setIsRegister(false);
              setError('');
              setSuccess('');
            }}
            className="px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-[#FF5A36] text-white hover:bg-[#E04826] shadow-xl shadow-[#FF5A36]/25 transition-all flex items-center justify-center gap-2.5 hover:scale-105 active:scale-95"
          >
            Get Started <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Curated Syllabus Feature Preview Card */}
        <div className="w-full max-w-3xl mt-6 rounded-3xl bg-white border border-[#E8D8CF] p-6 sm:p-8 shadow-xl text-left space-y-4">
          <div className="flex items-center justify-between border-b border-[#F3E8E2] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#FFF0EB] text-[#FF5A36]">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#1E1B18]">Curated Syllabus & Intelligent Modules</h3>
            </div>
            <span className="text-xs font-black text-[#FF5A36] bg-[#FFF0EB] px-3.5 py-1.5 rounded-full border border-[#FFE4D9]">
              Live 24/7
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#4A443F] leading-relaxed font-medium">
            Personalized syllabus modules for Computer Science, Algorithms, Data Structures, Software Engineering, Mathematics, and Sciences with real-time AI explanations and interactive quizzes.
          </p>
        </div>
      </main>

      {/* ── Overlay Auth Modal ── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
          
          {/* Modal Container */}
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-10 border border-[#E8D8CF] shadow-2xl relative space-y-6 animate-in zoom-in-95">
            
            {/* Close Button */}
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-[#786F68] hover:text-[#1E1B18] hover:bg-[#FFF2EB] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-[#FFF0EB] text-[#FF5A36] mb-1">
                <GraduationCap className="h-8 w-8 text-[#FF5A36]" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#1E1B18]">
                {isRegister ? 'Create your Tutor account' : 'Sign into Tutor'}
              </h2>
              <p className="text-xs text-[#786F68] font-mono">
                Please sign in to your account to get started.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            {/* Google Sign In Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl border border-[#E8D8CF] bg-white text-[#1E1B18] font-mono text-xs font-bold flex items-center justify-center gap-3 hover:bg-[#FFF9F6] transition-all shadow-sm active:scale-98 disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign in with Google
              </button>
            </div>

            {/* OR Separator */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#E8D8CF] w-full"></div>
              <span className="bg-white px-3 font-mono text-[10px] text-[#786F68] font-bold uppercase tracking-wider absolute">OR</span>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {isRegister && (
                <>
                  <input
                    type="text"
                    required
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl font-mono text-xs text-[#1E1B18] outline-none focus:border-[#FF5A36] transition-colors"
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3 bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl font-mono text-xs text-[#1E1B18] outline-none focus:border-[#FF5A36] transition-colors"
                  >
                    <option value="student">Student Account</option>
                    <option value="faculty">Faculty Account</option>
                    <option value="admin">Administrator Account</option>
                  </select>
                </>
              )}

              <input
                type="email"
                required
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl font-mono text-xs text-[#1E1B18] outline-none focus:border-[#FF5A36] transition-colors"
              />

              <input
                type="password"
                required
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#FFF9F6] border border-[#E8D8CF] rounded-2xl font-mono text-xs text-[#1E1B18] outline-none focus:border-[#FF5A36] transition-colors"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-[#FF5A36] text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#E04826] transition-all shadow-md disabled:opacity-50 mt-2 active:scale-98"
              >
                {submitting ? 'Authenticating...' : (isRegister ? 'Create Account' : 'Sign in with email')}
              </button>
            </form>

            {/* Switch Mode */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                  setSuccess('');
                }}
                className="text-xs font-bold text-[#FF5A36] hover:underline"
              >
                {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

import { useAuth } from '../contexts/AuthContext';
import { Sprout, ShieldCheck, Zap, BarChart3, Bot } from 'lucide-react';
import { motion } from 'framer-motion';

export const LoginPage = () => {
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Failed to sign in:', error);
    }
  };

  const features = [
    { icon: <Zap className="w-5 h-5 text-lime-400" />, text: "Real-time AI Guidance" },
    { icon: <BarChart3 className="w-5 h-5 text-emerald-400" />, text: "Market Analytics" },
    { icon: <ShieldCheck className="w-5 h-5 text-teal-400" />, text: "Pest Protection" },
    { icon: <Bot className="w-5 h-5 text-green-400" />, text: "24/7 Farming Assistant" }
  ];

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-lime-500/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
      >
        {/* Hero Section */}
        <div className="hidden lg:block space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 text-sm font-semibold backdrop-blur-md mb-6">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              The Future of Agriculture
            </div>
            <h1 className="text-6xl font-bold text-slate-900 leading-tight">
              Cultivate <span className="text-emerald-600">Smarts</span>,<br />
              Harvest <span className="text-emerald-500">Success</span>.
            </h1>
            <p className="text-slate-600 text-xl font-medium mt-6 max-w-lg leading-relaxed">
              Empower your farm with AgriVision's AI-driven intelligence. Predictive analytics, pest control, and market trends at your fingertips.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + (i * 0.1) }}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm"
              >
                {feature.icon}
                <p className="text-slate-800 font-bold mt-2">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="glass-card rounded-[2.5rem] p-10 lg:p-14 relative z-10"
        >
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="bg-emerald-600 p-4 rounded-2xl shadow-xl shadow-emerald-900/40"
              >
                <Sprout className="w-10 h-10 text-white" />
              </motion.div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 mt-2">Sign in to your farm command center</p>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-center space-x-4 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all duration-300 group shadow-sm hover:shadow-emerald-100"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors text-lg">
                Continue with Google
              </span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/70 backdrop-blur-xl text-slate-400">Secure Access</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-xs text-emerald-800 leading-relaxed text-center">
                AgriVision uses military-grade encryption to protect your farm data and personal intelligence.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-10">
            By signing in, you agree to our <a href="#" className="underline hover:text-emerald-600 transition-colors">Terms of Service</a> and <a href="#" className="underline hover:text-emerald-600 transition-colors">Privacy Policy</a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};


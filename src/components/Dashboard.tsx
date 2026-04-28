import { useState, Suspense, lazy } from 'react';
import { LogOut, Sprout, Bug, Store, MessageCircle, Cloud, Thermometer, Droplets } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const CropFertilizerModule = lazy(() => import('./CropFertilizerModule').then(m => ({ default: m.CropFertilizerModule })));
const PestManagementModule = lazy(() => import('./PestManagementModule').then(m => ({ default: m.PestManagementModule })));
const MarketManagementModule = lazy(() => import('./MarketManagementModule').then(m => ({ default: m.MarketManagementModule })));
const ChatbotModule = lazy(() => import('./ChatbotModule').then(m => ({ default: m.ChatbotModule })));


type TabType = 'chat' | 'crops' | 'pests' | 'markets';

export const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const tabs = [
    { id: 'chat' as TabType, label: 'AI Intelligence', icon: MessageCircle, color: 'text-purple-400' },
    { id: 'crops' as TabType, label: 'Crops & Health', icon: Sprout, color: 'text-emerald-400' },
    { id: 'pests' as TabType, label: 'Pest Control', icon: Bug, color: 'text-orange-400' },
    { id: 'markets' as TabType, label: 'Market Engine', icon: Store, color: 'text-blue-400' },
  ];

  const stats = [
    { icon: <Thermometer className="w-4 h-4" />, value: "24°C", label: "Temp" },
    { icon: <Droplets className="w-4 h-4" />, value: "68%", label: "Humidity" },
    { icon: <Cloud className="w-4 h-4" />, value: "Partly Cloudy", label: "Sky" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-lime-500/5 rounded-full blur-[120px]" />
      </div>

      <header className="glass-header sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-900/20">
              <Sprout className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agri<span className="text-emerald-600">Vision</span></h1>
              <div className="flex items-center gap-3 mt-1">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">
                    {stat.icon}
                    <span>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="flex items-center gap-4 bg-slate-100 border border-slate-200 p-1.5 rounded-2xl">
            <nav className="hidden md:flex gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className={`relative z-10 w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="h-8 w-px bg-white/10 mx-2 hidden md:block" />

            <div className="flex items-center gap-3 px-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none">{user?.displayName?.split(' ')[0]}</p>
                <p className="text-[10px] text-emerald-600/60 font-medium">Farm Admin</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSignOut}
                  className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 relative">
        <Suspense fallback={
          <div className="flex h-[70vh] items-center justify-center glass-card rounded-[2rem]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
          </div>
        }>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              {activeTab === 'chat' && <ChatbotModule />}
              {activeTab === 'crops' && <CropFertilizerModule />}
              {activeTab === 'pests' && <PestManagementModule />}
              {activeTab === 'markets' && <MarketManagementModule />}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      <footer className="py-8 pb-32 md:pb-8 text-center border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">
          Powered by AgriVision Intelligence • © 2026
        </p>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900 border border-slate-800 rounded-3xl p-2 z-50 shadow-2xl shadow-slate-900/50">
        <div className="flex justify-between items-center gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-0 bg-slate-800 rounded-2xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`relative z-10 w-5 h-5 mb-1 ${isActive ? tab.color : ''}`} />
                <span className="relative z-10 text-[10px] font-bold tracking-tight">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};


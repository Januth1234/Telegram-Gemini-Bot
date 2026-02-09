
import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, SignupRequest, SiteMetrics } from '../types';
import { firebaseService } from '../services/firebaseService';

interface AdminPortalProps {
  user: UserAccount | null;
  onClose: () => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState<'vitals' | 'training' | 'devops' | 'api' | 'users' | 'settings'>('vitals');
  const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupForm, setSignupForm] = useState({ email: '', reason: '' });

  const role = user?.role || 'visitor';
  const isOwner = role === 'owner';
  const isDevOps = role === 'devops' || isOwner;
  const isTraining = role === 'training' || isDevOps;

  useEffect(() => {
    if (user?.approved) {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([
        firebaseService.getSiteMetrics(),
        isOwner ? firebaseService.getPendingRequests() : Promise.resolve([])
      ]);
      setMetrics(m);
      setRequests(r);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await firebaseService.submitSignupRequest(signupForm.email, signupForm.reason);
    alert("Signup request submitted for approval.");
    setSignupForm({ email: '', reason: '' });
    setLoading(false);
  };

  if (!user) {
     return (
        <div className="h-full w-full flex items-center justify-center bg-slate-950 p-6">
           <div className="text-center space-y-6">
              <i className="fa-solid fa-lock text-slate-800 text-6xl"></i>
              <h2 className="text-2xl font-black text-white uppercase">Access Denied</h2>
              <p className="text-slate-500 text-sm max-w-xs mx-auto">Please sign in to access the administrative workspace.</p>
              <button onClick={onClose} className="px-8 py-3 bg-white text-black rounded-xl font-bold uppercase text-xs">Return Home</button>
           </div>
        </div>
     );
  }

  if (!user.approved) {
    return (
      <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center p-6 space-y-12">
         <div className="space-y-4 text-center">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Restricted Area</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Administrative Clearance Required</p>
         </div>
         
         <form onSubmit={handleSignupSubmit} className="w-full max-w-md glass-panel p-8 rounded-[40px] border border-white/5 space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase">Registered Email</label>
               <input 
                  type="email" 
                  value={signupForm.email} 
                  onChange={e => setSignupForm({...signupForm, email: e.target.value})}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-cyan-500"
                  required 
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase">Reason for Access (Include Secret Code if applicable)</label>
               <textarea 
                  value={signupForm.reason} 
                  onChange={e => setSignupForm({...signupForm, reason: e.target.value})}
                  className="w-full p-4 h-32 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-cyan-500 resize-none"
                  placeholder="Explain why you need DevOps or Training access..."
                  required 
               />
            </div>
            <button 
               type="submit" 
               disabled={loading}
               className="w-full py-5 bg-cyan-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-cyan-500 transition-all"
            >
               {loading ? "Submitting Request..." : "Request Approval"}
            </button>
         </form>
         <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">Back to Orin AI</button>
      </div>
    );
  }

  const TabButton = ({ id, icon, label, roles }: { id: typeof activeTab, icon: string, label: string, roles: UserRole[] }) => {
    if (!roles.includes(role) && role !== 'owner') return null;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === id ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
      >
        <i className={`fa-solid ${icon} w-6 text-center`}></i>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <div className="h-full w-full bg-[#020617] text-white flex overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-white/5 flex flex-col p-6 space-y-12">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center shadow-lg"><i className="fa-solid fa-shield-halved"></i></div>
            <div className="space-y-0.5">
               <h2 className="text-sm font-black uppercase tracking-tighter">Admin Portal</h2>
               <p className="text-[8px] font-black text-cyan-500 uppercase tracking-widest">Verified {role}</p>
            </div>
         </div>

         <nav className="flex-1 space-y-2">
            <TabButton id="vitals" icon="fa-chart-line" label="Vitals" roles={['visitor', 'training', 'devops', 'owner']} />
            <TabButton id="training" icon="fa-brain" label="Training Tools" roles={['training', 'devops', 'owner']} />
            <TabButton id="devops" icon="fa-server" label="DevOps / Preview" roles={['devops', 'owner']} />
            <TabButton id="api" icon="fa-key" label="API Controls" roles={['devops', 'owner']} />
            <TabButton id="users" icon="fa-users-gear" label="User Management" roles={['owner']} />
            <TabButton id="settings" icon="fa-gears" label="Settings" roles={['owner']} />
         </nav>

         <button onClick={onClose} className="w-full py-4 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">Exit Portal</button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10">
         
         {/* Dynamic Body */}
         {activeTab === 'vitals' && (
            <div className="space-y-10 animate-reveal">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <MetricCard label="Total Users" value={metrics?.totalUsers || 0} icon="fa-users" color="cyan" />
                  <MetricCard label="Active Today" value={metrics?.activeToday || 0} icon="fa-bolt" color="emerald" />
                  <MetricCard label="AI Requests" value={metrics?.aiRequests || 0} icon="fa-brain" color="violet" />
                  <MetricCard label="Server Status" value={metrics?.serverStatus || 'Online'} icon="fa-signal" color="amber" />
               </div>
               
               <div className="glass-panel p-10 rounded-[48px] border border-white/5 space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter">System Pulse</h3>
                  <div className="h-48 flex items-end gap-2 px-2">
                     {Array.from({length: 24}).map((_, i) => (
                        <div key={i} className="flex-1 bg-cyan-600/20 rounded-t-lg relative group" style={{ height: `${20 + Math.random() * 80}%` }}>
                           <div className="absolute inset-0 bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
                        </div>
                     ))}
                  </div>
                  <div className="flex justify-between px-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                     <span>24 Hours Ago</span>
                     <span>Current Time</span>
                  </div>
               </div>
            </div>
         )}

         {activeTab === 'users' && isOwner && (
            <div className="space-y-8 animate-reveal">
               <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Pending Signups</h3>
                  <button onClick={loadAdminData} className="px-4 py-2 bg-white/5 rounded-lg text-[9px] font-black uppercase"><i className="fa-solid fa-rotate mr-2"></i> Refresh</button>
               </div>
               
               <div className="space-y-4">
                  {requests.length === 0 ? (
                     <div className="py-20 text-center opacity-30 uppercase text-[10px] font-black tracking-widest">No pending requests found</div>
                  ) : (
                     requests.map(req => (
                        <div key={req.id} className={`glass-panel p-6 rounded-3xl border ${req.codeDetected ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/5'} flex flex-col md:flex-row items-center justify-between gap-6`}>
                           <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                 <span className="text-sm font-black">{req.email}</span>
                                 {req.codeDetected && <span className="px-2 py-0.5 bg-cyan-600 text-[8px] font-black uppercase rounded">Code Verified</span>}
                              </div>
                              <p className="text-xs text-slate-400 italic">"{req.reason}"</p>
                              <p className="text-[9px] font-black text-slate-600 uppercase">Requested: {new Date(req.createdAt).toLocaleString()}</p>
                           </div>
                           <div className="flex gap-2">
                              <button className="px-4 py-2 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">Approve Training</button>
                              <button className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">Approve DevOps</button>
                              <button className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Reject</button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         )}

         {activeTab === 'api' && isDevOps && (
            <div className="space-y-10 animate-reveal">
               <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">API Infrastructure</h3>
                  <button className="px-6 py-3 bg-cyan-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl">+ Generate Key</button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ApiCard label="Public Web SDK" status="active" calls="12.4k" />
                  <ApiCard label="Mobile Bridge v2" status="active" calls="85.1k" />
                  <ApiCard label="Staging Environment" status="inactive" calls="0" />
                  <ApiCard label="Internal Tools Relay" status="active" calls="4.2k" />
               </div>
            </div>
         )}

         {/* Fallback for empty tabs */}
         {['training', 'devops', 'settings'].includes(activeTab) && (
            <div className="py-40 text-center space-y-4 opacity-30 animate-reveal">
               <i className="fa-solid fa-screwdriver-wrench text-6xl"></i>
               <h4 className="text-sm font-black uppercase tracking-widest">Protocol Staging</h4>
               <p className="text-[10px] font-bold">This administrative module is currently being calibrated.</p>
            </div>
         )}

      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color }: any) => {
   const colors: any = {
      cyan: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
      emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      violet: "text-violet-500 bg-violet-500/10 border-violet-500/20",
      amber: "text-amber-500 bg-amber-500/10 border-amber-500/20"
   };
   return (
      <div className={`p-6 rounded-3xl border ${colors[color]} space-y-4 shadow-sm`}>
         <div className="flex justify-between items-start">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
            <i className={`fa-solid ${icon}`}></i>
         </div>
         <div className="text-2xl font-black tracking-tighter uppercase">{value}</div>
      </div>
   );
};

const ApiCard = ({ label, status, calls }: any) => (
   <div className="p-8 rounded-[32px] glass-panel border border-white/5 flex items-center justify-between">
      <div className="space-y-2">
         <h4 className="text-sm font-black uppercase tracking-tight">{label}</h4>
         <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{status === 'active' ? 'Online' : 'Disabled'}</span>
         </div>
      </div>
      <div className="text-right">
         <div className="text-lg font-black tracking-tighter">{calls}</div>
         <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Requests / 24h</div>
      </div>
   </div>
);

export default AdminPortal;

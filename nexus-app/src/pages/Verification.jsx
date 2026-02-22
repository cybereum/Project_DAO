import { useState } from 'react';
import { useApp } from '../store/appStore';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Building2, BadgeCheck, AlertCircle, Globe, Mail,
  FileCheck, Star, ChevronDown, Plus, Search
} from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const STATUS_COLORS = {
  'Verified': 'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  'Pending': 'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20',
  'Revoked': 'bg-nexus-red/10 text-nexus-red border-nexus-red/20',
};

export default function Verification() {
  const { companies, addCompany } = useApp();
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [newCompany, setNewCompany] = useState({ name: '', regNumber: '', email: '', website: '', office: '', wallet: '' });

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const verified = companies.filter(c => c.status === 'Verified').length;
  const totalCredentials = companies.reduce((sum, c) => sum + c.credentials, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow-purple">Verification Center</h1>
          <p className="text-nexus-text-dim text-sm mt-1">VCDAO - Decentralized company verification and credential management</p>
        </div>
        <button onClick={() => setShowRegister(!showRegister)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-nexus-purple to-nexus-pink text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Register Company
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: 'Total Companies', value: companies.length, color: 'cyan' },
          { icon: ShieldCheck, label: 'Verified', value: verified, color: 'green' },
          { icon: FileCheck, label: 'Credentials Issued', value: totalCredentials, color: 'purple' },
          { icon: Star, label: 'Avg Reliability', value: Math.round(companies.filter(c => c.reliability > 0).reduce((s, c) => s + c.reliability, 0) / verified) || 0, color: 'amber' },
        ].map((s, i) => (
          <motion.div key={s.label} {...anim(i)} className="rounded-xl border border-nexus-border bg-nexus-card p-4">
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {showRegister && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl border border-nexus-purple/20 bg-nexus-card p-6 glow-purple">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck size={20} className="text-nexus-purple" /> Company Registration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Company Name</label>
              <input value={newCompany.name} onChange={e => setNewCompany(c => ({ ...c, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-purple focus:outline-none" placeholder="Legal entity name..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Registration Number</label>
              <input value={newCompany.regNumber} onChange={e => setNewCompany(c => ({ ...c, regNumber: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-purple focus:outline-none" placeholder="Company reg. number..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Email</label>
              <input type="email" value={newCompany.email} onChange={e => setNewCompany(c => ({ ...c, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-purple focus:outline-none" placeholder="contact@company.com" />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Website</label>
              <input value={newCompany.website} onChange={e => setNewCompany(c => ({ ...c, website: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-purple focus:outline-none" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Registered Office</label>
              <input value={newCompany.office} onChange={e => setNewCompany(c => ({ ...c, office: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-purple focus:outline-none" placeholder="Office address..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Wallet Address</label>
              <input value={newCompany.wallet} onChange={e => setNewCompany(c => ({ ...c, wallet: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm font-mono focus:border-nexus-purple focus:outline-none" placeholder="0x..." />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { if (newCompany.name.trim()) { addCompany({ name: newCompany.name, address: newCompany.wallet || `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}` }); setNewCompany({ name: '', regNumber: '', email: '', website: '', office: '', wallet: '' }); setShowRegister(false); } }}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-nexus-purple to-nexus-pink text-white text-sm font-medium">Submit for Verification</button>
            <button onClick={() => setShowRegister(false)} className="px-5 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-text-dim" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-nexus-card border border-nexus-border text-sm focus:border-nexus-purple focus:outline-none"
          placeholder="Search companies..." />
      </div>

      <div className="space-y-3">
        {filtered.map((company, i) => {
          const isExpanded = expandedCompany === company.address;
          return (
            <motion.div key={company.address} {...anim(i)}
              className="rounded-xl border border-nexus-border bg-nexus-card overflow-hidden hover:border-nexus-purple/20 transition-colors">
              <div className="p-5 cursor-pointer" onClick={() => setExpandedCompany(isExpanded ? null : company.address)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      company.status === 'Verified' ? 'bg-nexus-green/10' : 'bg-nexus-amber/10'
                    }`}>
                      {company.status === 'Verified'
                        ? <BadgeCheck size={24} className="text-nexus-green" />
                        : <AlertCircle size={24} className="text-nexus-amber" />}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{company.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[company.status]}`}>{company.status}</span>
                        <span className="text-xs text-nexus-text-dim font-mono">{company.address}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {company.reliability > 0 && (
                      <div className="text-right hidden sm:block">
                        <div className="text-lg font-bold text-nexus-amber">{company.reliability}</div>
                        <div className="text-xs text-nexus-text-dim">Reliability</div>
                      </div>
                    )}
                    <ChevronDown size={16} className={`text-nexus-text-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  className="border-t border-nexus-border p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-nexus-bg/50">
                      <div className="flex items-center gap-1.5 text-xs text-nexus-text-dim mb-1"><Globe size={12} /> Website</div>
                      <div className="text-sm">{company.status === 'Verified' ? 'Verified' : 'Pending'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-nexus-bg/50">
                      <div className="flex items-center gap-1.5 text-xs text-nexus-text-dim mb-1"><Mail size={12} /> Email</div>
                      <div className="text-sm">{company.status === 'Verified' ? 'Verified' : 'Pending'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-nexus-bg/50">
                      <div className="flex items-center gap-1.5 text-xs text-nexus-text-dim mb-1"><ShieldCheck size={12} /> Audit</div>
                      <div className="text-sm">{company.audited ? 'Passed' : 'Not Audited'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-nexus-bg/50">
                      <div className="flex items-center gap-1.5 text-xs text-nexus-text-dim mb-1"><FileCheck size={12} /> Credentials</div>
                      <div className="text-sm">{company.credentials} issued</div>
                    </div>
                  </div>
                  {company.status === 'Verified' && (
                    <div className="flex gap-2">
                      <button className="px-4 py-2 rounded-lg bg-nexus-green/10 border border-nexus-green/20 text-nexus-green text-xs font-medium hover:bg-nexus-green/20">Cast Vote</button>
                      <button className="px-4 py-2 rounded-lg bg-nexus-purple/10 border border-nexus-purple/20 text-nexus-purple text-xs font-medium hover:bg-nexus-purple/20">Add Credential</button>
                      <button className="px-4 py-2 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-nexus-cyan text-xs font-medium hover:bg-nexus-cyan/20">Provide Feedback</button>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

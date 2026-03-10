import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import { Building, ArrowRight, CheckCircle, Globe, FileCheck, ShieldAlert } from 'lucide-react';
import LeadCapture from '../components/LeadCapture';
import { captureUTM, markFunnelStep } from '../lib/utm.js';

const LOGO_URL = 'https://cdn.prod.website-files.com/6632a548562bd3696c947be1/66c8e5fdf48bbde6bc9ebe09_Blue_Logo_256.png';

const CITY_USE_CASES = [
  'Public works milestones visible to citizens in real time.',
  'Vendor verification and reliability history tied to delivery outcomes.',
  'Procurement approvals and disputes recorded with immutable timestamps.',
  'Budget disbursement traceability from allocation to execution.',
];

export default function CitiesLanding() {
  useEffect(() => { captureUTM(); markFunnelStep('cities_landing_view'); }, []);

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text grid-bg">
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src={LOGO_URL} alt="Cybereum logo" className="w-12 h-12 rounded-full glow-cyan" />
            <span className="font-display tracking-[0.25em] text-nexus-cyan text-sm">CYBEREUM</span>
          </div>

          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan text-xs font-mono mb-6">
            <Building size={12} /> CITIES / MUNICIPALITIES / PUBLIC PROGRAMS
          </Motion.div>
          <h1 className="text-4xl sm:text-5xl font-black mb-6">
            Public infrastructure delivery with
            <span className="bg-gradient-to-r from-nexus-pink to-nexus-cyan bg-clip-text text-transparent"> structural transparency.</span>
          </h1>
          <p className="text-lg text-nexus-text-dim max-w-3xl mx-auto mb-8">
            Cybereum helps civic teams publish trusted progress, reduce procurement opacity, and interoperate with enterprise and community partners through on-chain accountability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/pulse" className="flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-cyan-dim text-white font-semibold hover:opacity-90">
              View global pulse <ArrowRight size={16} />
            </Link>
            <Link to="/" className="flex items-center justify-center gap-2 px-7 py-3 rounded-xl border border-nexus-border hover:border-nexus-cyan/40">
              <Globe size={16} /> NEXUS Home
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
          {CITY_USE_CASES.map((item) => (
            <div key={item} className="p-5 rounded-xl border border-nexus-border bg-nexus-surface/50 flex items-start gap-3">
              <CheckCircle size={16} className="text-nexus-cyan mt-0.5" />
              <p className="text-sm text-nexus-text-dim">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 border-t border-nexus-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {[{ icon: FileCheck, title: 'Citizen-readable records', text: 'Communicate progress and approvals with verifiable evidence.' }, { icon: ShieldAlert, title: 'Corruption-resistant process', text: 'Reduce hidden approvals and undocumented changes in high-value projects.' }, { icon: Building, title: 'Procurement integrity', text: 'Track vendor performance and payment release conditions transparently.' }].map(({ icon: Icon, title, text }) => (
            <div key={title} className="p-5 rounded-xl border border-nexus-border bg-nexus-surface/40">
              <Icon size={18} className="text-nexus-cyan mb-2" />
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-nexus-text-dim">{text}</p>
            </div>
          ))}
        </div>
        <div className="max-w-3xl mx-auto">
          <LeadCapture persona="government" />
        </div>
      </section>
    </div>
  );
}

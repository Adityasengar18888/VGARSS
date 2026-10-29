import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Terminal,
  Cpu,
  Download,
  Menu,
  X,
} from 'lucide-react';
import { TextFlippingBoard } from '../components/effects/TextFlippingBoard';
import { AsciiNetworkArt } from '../components/effects/AsciiNetworkArt';
import { DitherShader } from '../components/effects/DitherShader';
import { InteractiveNetworkDemo } from '../components/landing/InteractiveNetworkDemo';
import { api } from '../services/api';

interface LandingViewProps {
  onEnterApp: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  installPrompt?: any;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterApp,
  onOpenLogin,
  onOpenRegister,
  installPrompt,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState<{ status: string; engine?: string; rtt?: number }>({
    status: 'connecting',
    engine: 'PostgreSQL',
    rtt: 14,
  });

  // Query live backend health telemetry
  useEffect(() => {
    let mounted = true;
    const start = performance.now();
    api
      .getHealth()
      .then((data: any) => {
        if (!mounted) return;
        const rtt = Math.round(performance.now() - start);
        setSystemHealth({
          status: data.status || 'healthy',
          engine: data.database?.engine || 'PostgreSQL',
          rtt,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setSystemHealth({ status: 'degraded', engine: 'PostgreSQL', rtt: 35 });
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F2F2F2] selection:bg-[#E8E8E8] selection:text-[#080808] font-sans antialiased overflow-x-hidden">
      {/* ── Fixed Minimalist Navigation Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/90 backdrop-blur-md border-b border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Brand Wordmark */}
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-[#171717] border border-[#292929] flex items-center justify-center rounded-[3px]">
              <Cpu className="w-4 h-4 text-[#F2F2F2]" />
            </div>
            <span className="font-mono font-bold text-sm tracking-technical text-[#F2F2F2]">
              VGARSS <span className="text-[#707070] font-normal text-xs">// 2.0</span>
            </span>
          </div>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center space-x-7 text-xs font-mono text-[#A1A1A1]">
            <a href="#hero" className="hover:text-[#F2F2F2] transition no-underline">
              [OVERVIEW]
            </a>
            <a href="#topology" className="hover:text-[#F2F2F2] transition no-underline">
              [TOPOLOGY]
            </a>
            <a href="#features" className="hover:text-[#F2F2F2] transition no-underline">
              [FEATURES]
            </a>
            <a href="#tracer" className="hover:text-[#F2F2F2] transition no-underline">
              [TRACER]
            </a>
            <a href="#architecture" className="hover:text-[#F2F2F2] transition no-underline">
              [ARCHITECTURE]
            </a>
          </nav>

          {/* Actions & Live Telemetry Pill */}
          <div className="hidden sm:flex items-center space-x-3 font-mono text-xs">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#111111] border border-[#222222] text-[10px] text-[#A1A1A1]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span className="uppercase text-[#A1A1A1]">{systemHealth.engine}</span>
              <span className="text-[#444444]">|</span>
              <span className="text-[#22C55E]">{systemHealth.rtt}ms</span>
            </div>

            <button
              onClick={onOpenLogin}
              className="px-3 py-1.5 text-[#A1A1A1] hover:text-[#F2F2F2] transition text-xs font-mono uppercase"
            >
              Sign In
            </button>

            <button
              onClick={onEnterApp || onOpenRegister}
              className="px-3.5 py-1.5 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold text-xs uppercase tracking-wider rounded-[3px] transition active:scale-95 shadow-xs"
            >
              Enter Network &rarr;
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center space-x-2">
            <button
              onClick={onOpenRegister}
              className="px-2.5 py-1 bg-[#E8E8E8] text-[#080808] font-bold text-[11px] uppercase rounded-[3px]"
            >
              Enter
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-[#A1A1A1] hover:text-white"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-[#222222] bg-[#0C0C0C] px-4 py-3 space-y-2 font-mono text-xs">
            <a
              href="#topology"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-[#A1A1A1] hover:text-white no-underline"
            >
              Topology & ASCII Routing
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-[#A1A1A1] hover:text-white no-underline"
            >
              System Features
            </a>
            <a
              href="#tracer"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-[#A1A1A1] hover:text-white no-underline"
            >
              Packet Tracer
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-[#A1A1A1] hover:text-white no-underline"
            >
              Architecture Spec
            </a>
            <div className="pt-2 border-t border-[#1C1C1C] flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="flex-1 py-1.5 border border-[#292929] text-[#F2F2F2] rounded text-center text-xs"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenRegister();
                }}
                className="flex-1 py-1.5 bg-[#E8E8E8] text-[#080808] font-bold rounded text-center text-xs"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Cinematic Hero Section ── */}
      <section
        id="hero"
        className="relative min-h-[92vh] flex flex-col justify-between pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden"
      >
        {/* Photographic Silhouette Backdrop */}
        <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-30 sm:opacity-40">
          <img
            src="/vgarss/hero-silhouettes.jpg"
            alt="Ghostly human hands pressed against frosted translucent glass"
            className="w-full h-full object-cover object-center grayscale contrast-125 filter"
            onError={(e) => {
              // Fallback to relative path if hosted under subpath or root
              (e.currentTarget as HTMLImageElement).src = '/hero-silhouettes.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/60 to-[#080808]/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-transparent to-[#080808]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 my-auto max-w-3xl pt-8 sm:pt-14">
          {/* Eyebrow Label */}
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-[3px] bg-[#141414] border border-[#292929] text-[10px] sm:text-xs font-mono tracking-technical text-[#A1A1A1] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8E8E8] animate-pulse" />
            <span>REAL-TIME COLLABORATION / NETWORK SYSTEM</span>
          </div>

          {/* Large Editorial Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-editorial text-[#F2F2F2] leading-[1.05] mb-5">
            EVERY SIGNAL <br />
            FINDS ITS WAY.
          </h1>

          {/* Text Flipping Board Visual Reference */}
          <div className="mb-6 flex items-center space-x-3">
            <span className="text-xs font-mono text-[#707070] uppercase tracking-wider hidden sm:inline">
              SYNCHRONIZING:
            </span>
            <TextFlippingBoard words={['SIGNAL', 'PEOPLE', 'PROCESSES', 'SYSTEMS']} />
          </div>

          {/* Description */}
          <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed max-w-xl mb-8 font-normal">
            An invisible network connecting people, processes, and signals. VGARSS unifies bi-directional WebSocket
            collaboration, OS CPU scheduling simulation, and raw packet framing.
          </p>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onEnterApp || onOpenRegister}
              className="flex items-center space-x-2 px-5 py-3 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold text-xs sm:text-sm rounded-[3px] transition active:scale-95 shadow-sm"
            >
              <span>ENTER THE NETWORK</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#topology"
              className="px-5 py-3 bg-[#111111] hover:bg-[#1A1A1A] border border-[#292929] text-[#A1A1A1] hover:text-[#F2F2F2] font-mono text-xs sm:text-sm rounded-[3px] transition no-underline text-center"
            >
              [EXPLORE SYSTEM]
            </a>

            {installPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-2 px-4 py-3 bg-[#171717] hover:bg-[#222222] border border-[#292929] text-[#A1A1A1] hover:text-[#F2F2F2] font-mono text-xs rounded-[3px] transition"
                title="Install VGARSS PWA App"
              >
                <Download className="w-3.5 h-3.5" />
                <span>INSTALL APP</span>
              </button>
            )}
          </div>
        </div>

        {/* Hero Footer Indicator */}
        <div className="relative z-10 pt-8 border-t border-[#1C1C1C] flex flex-wrap items-center justify-between text-xs font-mono text-[#707070] gap-3">
          <div className="flex items-center space-x-3">
            <span>KERNEL: 0.2.0-STABLE</span>
            <span className="text-[#333333]">•</span>
            <span>AUTH: SHA-256 SESSION TOKENS</span>
            <span className="text-[#333333]">•</span>
            <span>STORAGE: NEON POSTGRESQL</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[#A1A1A1]">
            <span>SCROLL TO PROBE</span>
            <span className="animate-bounce">↓</span>
          </div>
        </div>
      </section>

      {/* ── Section: ASCII-Art Network Routing Topology ── */}
      <section id="topology" className="py-20 border-t border-[#1E1E1E] bg-[#0A0A0A] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono tracking-technical uppercase text-[#707070]">[01 / ROUTING LAYER]</span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-editorial text-[#F2F2F2] mt-1.5 mb-3">
              ASCII NETWORK TOPOLOGY
            </h2>
            <p className="text-sm text-[#A1A1A1]">
              Every packet moves across deterministic hops with sequential monotonically-incremented tracking, stateful
              authoritative buffers, and bi-directional delivery receipts.
            </p>
          </div>

          {/* ASCII Component */}
          <AsciiNetworkArt />
        </div>
      </section>

      {/* ── Section: Dither Shader Signal Field ── */}
      <section className="py-20 border-t border-[#1E1E1E] bg-[#080808] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-mono tracking-technical uppercase text-[#707070]">
                [02 / SHADER FIELD]
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-editorial text-[#F2F2F2] mt-1.5 mb-3">
                ORDERED BAYER DITHERING
              </h2>
              <p className="text-sm text-[#A1A1A1] leading-relaxed mb-6 font-normal">
                Subtle procedural signals render via an 8-bit monochromatic 4×4 Bayer matrix shader. WebGL coordinates
                quantize luminance to pure monochrome texture with offscreen frame pausing.
              </p>
              <div className="space-y-2 font-mono text-xs text-[#A1A1A1]">
                <div className="flex items-center space-x-2 p-2 border border-[#1E1E1E] bg-[#0E0E0E] rounded">
                  <span className="text-[#22C55E]">✓</span>
                  <span>Frame throttling: Pauses rendering when offscreen</span>
                </div>
                <div className="flex items-center space-x-2 p-2 border border-[#1E1E1E] bg-[#0E0E0E] rounded">
                  <span className="text-[#22C55E]">✓</span>
                  <span>Hardware fallback: Static SVG matrix for low-power mode</span>
                </div>
                <div className="flex items-center space-x-2 p-2 border border-[#1E1E1E] bg-[#0E0E0E] rounded">
                  <span className="text-[#22C55E]">✓</span>
                  <span>Accessibility: Honored prefers-reduced-motion</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 h-80 sm:h-96 border border-[#292929] bg-[#0A0A0A] rounded-md overflow-hidden relative shadow-lg">
              <DitherShader className="w-full h-full" gridSize={3} contrast={1.3} />
              <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#707070] bg-[#080808]/80 px-2 py-1 border border-[#222222] rounded">
                GLSL FRAGMENT SHADER // 4×4 BAYER MATRIX
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Product Features ── */}
      <section id="features" className="py-20 border-t border-[#1E1E1E] bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-mono tracking-technical uppercase text-[#707070]">
              [03 / SYSTEM CAPABILITIES]
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-editorial text-[#F2F2F2] mt-1.5 mb-3">
              ENGINEERED FOR SYNCHRONY
            </h2>
            <p className="text-sm text-[#A1A1A1]">
              Nine tightly integrated capabilities combining industrial real-time collaboration with operating systems
              curriculum simulations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature 1 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">01 // STREAM</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">Real-Time Messaging</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Full-duplex WebSocket communication with catchup replays, typing broadcasts, and monotonic sequence
                  ordering.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>STREAM: /ws/v2</span>
                <span className="text-[#22C55E]">LIVE</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">02 // CHANNELS</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">DMs & Multi-Tenancy</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Workspace isolation with cross-workspace direct messaging, channel unread counters, and instant member
                  context switching.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>FANOUT: MULTI-DEVICE</span>
                <span className="text-[#E8E8E8]">ACTIVE</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">03 // ACCESS</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">QR Group Invitations</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Cryptographic invite tokens render as scannable high-contrast QR codes and shareable links for 1-tap
                  workspace admission.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>TOKEN: 7-DAY TTL</span>
                <span className="text-[#A1A1A1]">SECURE</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">04 // LIFECYCLE</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">Neural Transmission Animation</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Outgoing messages visualize synaptic status changes (Pending &rarr; Sent &rarr; Delivered &rarr; Read)
                  backed by real receipt telemetry.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>STATUS: ✓ / ✓✓</span>
                <span className="text-[#22C55E]">VERIFIED</span>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">05 // WORKFLOW</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">Chat-to-Task Dispatch</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Turn message snippets into formal OS execution tasks. Tag priorities, assign team members, and observe
                  scheduler execution.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>QUEUE: READY / WAIT</span>
                <span className="text-[#E8E8E8]">DISPATCHED</span>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">06 // KERNEL</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">CPU Scheduler Engine</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Deterministic simulation of FCFS, SJF, SRTF, Round Robin (Quantum=2), and Preemptive Priority with
                  aging starvation prevention.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>BURST: MATHEMATICAL</span>
                <span className="text-[#22C55E]">EXACT</span>
              </div>
            </div>

            {/* Feature 7 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">07 // CONCURRENCY</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">Deadlock & Locks Lab</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Resource Allocation Graphs (RAG) with cycle detection, test-and-set atomic locks, counting semaphores,
                  and Banker's avoidance algorithms.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>CYCLES: DETECTED</span>
                <span className="text-[#F59E0B]">GUARDED</span>
              </div>
            </div>

            {/* Feature 8 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">08 // TELEMETRY</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">Network Diagnostics</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Live WebSocket packet inspector, round-trip ping telemetry, binary socket handling, and Raw TCP Port
                  9000 framing validation.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>PING: ~14MS</span>
                <span className="text-[#22C55E]">CONNECTED</span>
              </div>
            </div>

            {/* Feature 9 */}
            <div className="p-5 border border-[#222222] bg-[#111111] rounded-md hover:border-[#333333] transition flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono tracking-technical text-[#707070] mb-2">09 // DESKTOP/MOBILE</div>
                <h3 className="font-bold text-base text-[#F2F2F2] mb-1.5">Installable PWA</h3>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Progressive Web App with Service Worker offline caching, standalone desktop window frame, and native
                  mobile home screen integration.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#707070]">
                <span>MANIFEST: READY</span>
                <span className="text-[#22C55E]">PWA 2.0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Interactive Tracer ── */}
      <section id="tracer" className="py-20 border-t border-[#1E1E1E] bg-[#080808]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono tracking-technical uppercase text-[#707070]">[04 / SIMULATION]</span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-editorial text-[#F2F2F2] mt-1.5 mb-3">
              INTERACTIVE PACKET TRACER
            </h2>
            <p className="text-sm text-[#A1A1A1]">
              Test signal encapsulation, WebSocket framing, server persistence, and peer delivery acknowledgement in real
              time.
            </p>
          </div>

          <InteractiveNetworkDemo />
        </div>
      </section>

      {/* ── Section: Technical Architecture ── */}
      <section id="architecture" className="py-20 border-t border-[#1E1E1E] bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-mono tracking-technical uppercase text-[#707070]">
              [05 / SPECIFICATION]
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-editorial text-[#F2F2F2] mt-1.5 mb-3">
              DUAL-SYSTEM ARCHITECTURE
            </h2>
            <p className="text-sm text-[#A1A1A1]">
              VGARSS coordinates network message delivery and OS process scheduling through decoupled event loops.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Flow 1: Network Messaging */}
            <div className="p-6 border border-[#222222] bg-[#111111] rounded-md font-mono text-xs">
              <div className="flex items-center space-x-2 text-[#E8E8E8] font-bold text-sm mb-4">
                <Terminal className="w-4 h-4 text-[#A1A1A1]" />
                <span>MESSAGING & TELEMETRY STACK</span>
              </div>
              <div className="space-y-3 text-[#A1A1A1]">
                <div className="p-2.5 bg-[#171717] border border-[#292929] rounded">
                  <div className="text-[10px] text-[#707070]">LAYER 1 // CLIENT TRANSPORT</div>
                  <div className="text-[#F2F2F2] font-bold">REACT 18 + TYPESCRIPT PWA</div>
                  <div className="text-[11px] text-[#707070] mt-0.5">WSS Socket Handler & Message Lifecycle</div>
                </div>
                <div className="text-center text-[#707070] text-xs">&darr; JSON Framed WebSocket Frames</div>
                <div className="p-2.5 bg-[#171717] border border-[#292929] rounded">
                  <div className="text-[10px] text-[#707070]">LAYER 2 // ASYNC ORCHESTRATION</div>
                  <div className="text-[#F2F2F2] font-bold">FASTAPI ASGI + CHATHUB CORE</div>
                  <div className="text-[11px] text-[#707070] mt-0.5">Multi-session Fanout & Catchup Buffer</div>
                </div>
                <div className="text-center text-[#707070] text-xs">&darr; ACID Transaction Commit</div>
                <div className="p-2.5 bg-[#171717] border border-[#292929] rounded">
                  <div className="text-[10px] text-[#707070]">LAYER 3 // PERSISTENCE</div>
                  <div className="text-[#F2F2F2] font-bold">NEON POSTGRESQL 16 / SQLITE WAL</div>
                  <div className="text-[11px] text-[#707070] mt-0.5">Relational Integrity & Monotonic Sequences</div>
                </div>
              </div>
            </div>

            {/* Flow 2: OS Simulation */}
            <div className="p-6 border border-[#222222] bg-[#111111] rounded-md font-mono text-xs">
              <div className="flex items-center space-x-2 text-[#E8E8E8] font-bold text-sm mb-4">
                <Cpu className="w-4 h-4 text-[#A1A1A1]" />
                <span>OS PROCESS SCHEDULER PIPELINE</span>
              </div>
              <div className="space-y-3 text-[#A1A1A1]">
                <div className="p-2.5 bg-[#171717] border border-[#292929] rounded">
                  <div className="text-[10px] text-[#707070]">INPUT // TASK INGESTION</div>
                  <div className="text-[#F2F2F2] font-bold">CHAT MESSAGE &rarr; PCB CONVERSION</div>
                  <div className="text-[11px] text-[#707070] mt-0.5">Allocates PID, Burst Time, & Priority</div>
                </div>
                <div className="text-center text-[#707070] text-xs">&darr; Enqueue to Scheduler</div>
                <div className="p-2.5 bg-[#171717] border border-[#292929] rounded">
                  <div className="text-[10px] text-[#707070]">DISPATCH // MULTI-ALGORITHM ENGINE</div>
                  <div className="text-[#F2F2F2] font-bold">READY QUEUE &rarr; CPU DISPATCH</div>
                  <div className="text-[11px] text-[#707070] mt-0.5">FCFS, SJF, SRTF, RR (Q=2), Priority</div>
                </div>
                <div className="text-center text-[#707070] text-xs">&darr; Metrics Calculation</div>
                <div className="p-2.5 bg-[#171717] border border-[#292929] rounded">
                  <div className="text-[10px] text-[#707070]">OUTPUT // TELEMETRY & GANTT</div>
                  <div className="text-[#F2F2F2] font-bold">TAT, WAITING TIME, CPU UTILIZATION</div>
                  <div className="text-[11px] text-[#707070] mt-0.5">Real-time Gantt Chart History & PCB States</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA & Technical Footer ── */}
      <section className="py-24 border-t border-[#1E1E1E] bg-[#080808] relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#141414] border border-[#292929] text-[11px] font-mono tracking-technical text-[#A1A1A1] rounded-[3px] mb-6">
            <span>NETWORK PARTICIPATION</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-editorial text-[#F2F2F2] mb-6">
            THE NETWORK IS OPEN.
          </h2>

          <p className="text-sm sm:text-base text-[#A1A1A1] max-w-lg mx-auto mb-8 font-normal">
            Join the decentralized virtual workspace. Communicate with zero noise, manage system tasks, and study
            operating systems principles.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenRegister}
              className="px-6 py-3.5 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold text-xs sm:text-sm uppercase tracking-wider rounded-[3px] transition active:scale-95 shadow-sm"
            >
              Create Account &rarr;
            </button>
            <button
              onClick={onOpenLogin}
              className="px-6 py-3.5 bg-[#141414] hover:bg-[#1E1E1E] border border-[#292929] text-[#F2F2F2] font-mono text-xs sm:text-sm uppercase rounded-[3px] transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1C1C1C] bg-[#060606] py-8 text-xs font-mono text-[#707070]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-[#F2F2F2] font-bold">VGARSS 2.0</span>
            <span>//</span>
            <span>Virtual Group Asynchronous Real-Time Resource Synchronization</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>VERSION 0.2.0</span>
            <span>•</span>
            <span>POSTGRESQL 16</span>
            <span>•</span>
            <span className="text-[#22C55E]">STATUS: HEALTHY</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

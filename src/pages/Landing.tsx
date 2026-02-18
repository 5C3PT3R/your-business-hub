import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Landing = () => {
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".scroll-reveal").forEach((el) => {
      el.classList.add("transition-all", "duration-1000", "ease-out");
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const [email, setEmail] = useState("");
  const [chessSrc, setChessSrc] = useState("");

  useEffect(() => {
    const img = new Image();
    img.src = "/chess-queen.png";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (brightness < 12) {
          d[i + 3] = 0;
        } else if (brightness < 30) {
          d[i + 3] = Math.round(((brightness - 12) / 18) * 255);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setChessSrc(canvas.toDataURL("image/png"));
    };
  }, []);

  return (
    <div
      className="min-h-screen w-full relative antialiased"
      style={{
        backgroundColor: "#FDFBF7",
        color: "#1C1917",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 backdrop-blur-md border-b" style={{ backgroundColor: "rgba(253,251,247,0.9)", borderColor: "#E7E5E4" }}>
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
            <div className="relative w-8 h-8 flex items-center justify-center bg-stone-900 text-white rounded-sm overflow-hidden transition-transform duration-300 group-hover:rotate-180">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 5H9L12 2Z" fill="currentColor" />
                <path d="M16 6H8V8H16V6Z" fill="currentColor" />
                <path d="M7 9H17L18 12H6L7 9Z" fill="currentColor" />
                <path d="M6 13H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V13Z" fill="currentColor" fillOpacity="0.8" />
              </svg>
            </div>
            <span className="text-2xl tracking-tight font-medium" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Regent
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#solutions" className="hover:text-stone-900 transition-colors">Solutions</a>
            <a href="#methodology" className="hover:text-stone-900 transition-colors">Methodology</a>
            <a href="#access" className="hover:text-stone-900 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="px-5 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded-full hover:border-stone-400 transition-all duration-300"
              style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: "0.05em" }}
            >
              Log in
            </button>
            <a
              href="#access"
              className="group relative px-6 py-2 bg-stone-900 text-white rounded-full overflow-hidden transition-all hover:bg-[#CC5500]"
            >
              <span className="relative z-10 text-sm font-medium flex items-center gap-2">
                Start the Game
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 w-full max-w-[1600px] mx-auto border-l border-r bg-white" style={{ borderColor: "#E7E5E4" }}>
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 min-h-[85vh] border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="lg:col-span-7 p-8 md:p-16 lg:p-24 flex flex-col justify-center border-b lg:border-b-0 lg:border-r relative overflow-hidden" style={{ borderColor: "#E7E5E4" }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#CC5500] to-transparent animate-[fadeSlideUp_1.5s_ease-out]" />

            <div className="inline-flex items-center gap-2 mb-8 animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
              <span className="w-2 h-2 rounded-full bg-[#CC5500] animate-pulse" />
              <span className="text-xs uppercase tracking-widest text-[#CC5500] font-semibold" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                System Online &bull; v2.4
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl lg:text-[7rem] leading-[0.9] tracking-tight mb-8 animate-[fadeSlideUp_1s_ease-out_0.4s_both]" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Grandmaster<br />
              <span className="italic text-[#CC5500]">your Ops.</span>
            </h1>

            <p className="text-xl md:text-2xl text-stone-500 max-w-xl leading-relaxed mb-12 font-light animate-[fadeSlideUp_1s_ease-out_0.7s_both]">
              Every company plays a game. Most play without a system. Regent deploys autonomous AI agents to checkmate your operational inefficiency.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-[fadeSlideUp_1s_ease-out_1s_both]">
              <button
                onClick={() => navigate("/demo")}
                className="px-8 py-4 bg-stone-900 text-white text-lg rounded-lg hover:bg-[#CC5500] transition-colors duration-300 flex items-center justify-center gap-2"
              >
                Deploy Agents
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
              <a
                href="#demo"
                className="px-8 py-4 border border-stone-200 text-stone-900 text-lg rounded-lg hover:bg-stone-50 transition-colors duration-300 text-center"
              >
                View Demo
              </a>
            </div>
          </div>

          {/* Hero Right - Chess Piece */}
          <div className="lg:col-span-5 bg-[#F5F5F4] relative overflow-hidden flex items-center justify-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-gradient-to-br from-[#CC5500] via-purple-600 to-blue-600 opacity-15 blur-[80px] rounded-full animate-[glowPulse_6s_ease-in-out_infinite]" />
            {chessSrc && (
              <img
                src={chessSrc}
                alt="Chess Queen"
                className="absolute inset-0 w-full h-full object-contain object-center animate-[scaleIn_1.2s_ease-out_0.5s_both]"
              />
            )}

            <div className="relative z-10 w-full h-full flex items-center justify-center p-12">
              <div className="relative w-full max-w-[500px] aspect-[3/4]">

                {/* Ticket Card */}
                <div className="absolute top-20 -left-10 bg-white/95 backdrop-blur border border-white/20 p-4 rounded-xl shadow-xl w-64 animate-[float_8s_ease-in-out_infinite_1s]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900">Ticket #2940 Resolved</div>
                      <div className="text-[10px] text-stone-500">Autonomous Action &bull; 2s ago</div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-full" />
                  </div>
                </div>

                {/* Efficiency Card */}
                <div className="absolute bottom-20 -right-4 bg-stone-900/90 backdrop-blur border border-white/10 p-4 rounded-xl shadow-2xl w-56 animate-[float_7s_ease-in-out_infinite_2s]">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-bold text-white">Efficiency Score</div>
                    <div className="text-xs text-[#CC5500] font-mono">98.4%</div>
                  </div>
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-1/5 bg-stone-700 h-[40%] rounded-sm" />
                    <div className="w-1/5 bg-stone-700 h-[60%] rounded-sm" />
                    <div className="w-1/5 bg-stone-700 h-[45%] rounded-sm" />
                    <div className="w-1/5 bg-stone-700 h-[75%] rounded-sm" />
                    <div className="w-1/5 bg-[#CC5500] h-[90%] rounded-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee Ticker */}
        <div className="border-b bg-stone-900 text-stone-400 py-4 overflow-hidden" style={{ borderColor: "#E7E5E4" }}>
          <div className="whitespace-nowrap animate-[marquee_20s_linear_infinite]" style={{ fontFamily: "'Space Grotesk', monospace" }}>
            <span className="text-sm uppercase tracking-widest">
              Support Volume High &bull; Scaling Resources &bull; Invoice #9922 Processed &bull; Lead Qualified &bull; Meeting Scheduled &bull; Refund Processed &bull; Ticket Closed &bull; Support Volume High &bull; Scaling Resources &bull; Invoice #9922 Processed &bull; Lead Qualified &bull; Meeting Scheduled &bull; Refund Processed &bull; Ticket Closed &bull;&nbsp;
            </span>
          </div>
        </div>

        {/* Entropy Problem */}
        <section id="methodology" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="p-10 border-b md:border-b-0 border-r lg:col-span-2 scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4", backgroundColor: "#FDFBF7" }}>
            <h2 className="text-4xl mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>The Entropy Problem</h2>
            <p className="text-stone-600 text-lg leading-relaxed mb-6">
              As organizations grow, operational complexity doesn't just increase linearly&mdash;it compounds. The "Economies of Scale" lie is exposed when your headcount grows faster than your revenue.
            </p>
            <a href="#solutions" className="text-[#CC5500] font-medium border-b border-[#CC5500] hover:text-stone-900 hover:border-stone-900 transition-colors pb-0.5">
              Read the manifesto
            </a>
          </div>

          <div className="p-10 border-b md:border-b-0 border-r flex flex-col justify-between hover:bg-stone-50 transition-colors scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4", transitionDelay: "0.15s" }}>
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Human Latency</h3>
              <p className="text-sm text-stone-500">Manual review adds hours or days to processes that should take milliseconds.</p>
            </div>
          </div>

          <div className="p-10 hover:bg-stone-50 transition-colors flex flex-col justify-between scroll-reveal opacity-0 translate-y-10" style={{ transitionDelay: "0.3s" }}>
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Knowledge Loss</h3>
              <p className="text-sm text-stone-500">SOPs rot in wikis. Training is diluted with every new hire.</p>
            </div>
          </div>
        </section>

        {/* The New Standard - Dark Section */}
        <section id="demo" className="bg-[#0C0A09] text-white overflow-hidden">
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2">
            <div className="p-12 md:p-24 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10">
              <div className="mb-12 scroll-reveal opacity-0 translate-y-10">
                <span className="text-[#CC5500] text-sm tracking-widest uppercase mb-4 block" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                  The New Standard
                </span>
                <h2 className="text-5xl md:text-6xl mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>
                  Humans for strategy.<br />
                  <span className="text-stone-500 italic">AI for execution.</span>
                </h2>
                <p className="text-stone-400 text-lg max-w-md">
                  Regent ingests your documentation, connects to your tools (Zendesk, Salesforce, Linear), and starts working alongside your team.
                </p>
              </div>

              <div className="space-y-6">
                {[
                  { num: "1", title: "Ingest & Learn", desc: "Builds a dynamic knowledge graph of your company." },
                  { num: "2", title: "Autonomous Run", desc: "Executes tasks with 99.9% uptime and zero latency." },
                  { num: "3", title: "Human Oversight", desc: "Edge cases are routed to supervisors for review." },
                ].map((step) => (
                  <div key={step.num} className="flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded border border-white/10 flex items-center justify-center group-hover:bg-[#CC5500] group-hover:border-[#CC5500] transition-colors">
                      <span className="text-xl" style={{ fontFamily: "'Instrument Serif', serif" }}>{step.num}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-lg">{step.title}</h4>
                      <p className="text-sm text-stone-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Demo */}
            <div className="relative bg-gradient-to-br from-[#1C1917] to-black p-12 md:p-24 flex items-center justify-center">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#CC5500] opacity-10 blur-[120px] rounded-full" />

              <div className="relative w-full max-w-md bg-[#1C1917]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl scroll-reveal opacity-0 translate-y-10">
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-xs font-mono text-stone-500">regent_agent_core.py</div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-stone-700 flex-shrink-0" />
                    <div className="space-y-1">
                      <div className="text-xs text-stone-400">Customer (via Email)</div>
                      <div className="bg-stone-800 p-3 rounded-lg rounded-tl-none text-sm text-stone-300">
                        Hi, I need to add 5 more seats to our Enterprise plan for next month. Can you apply the volume discount?
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#CC5500]/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-[#CC5500] rounded-full animate-ping" />
                    </div>
                    <div className="space-y-2 w-full">
                      <div className="text-xs text-[#CC5500]">
                        Regent AI &bull; <span className="text-stone-500">Checking CRM &amp; Billing Policies...</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-stone-800/50 p-2 rounded border border-white/5">
                          <div className="text-[10px] text-stone-500 uppercase">Policy Check</div>
                          <div className="text-xs text-green-400">Allowed (&gt;20 seats)</div>
                        </div>
                        <div className="bg-stone-800/50 p-2 rounded border border-white/5">
                          <div className="text-[10px] text-stone-500 uppercase">Discount</div>
                          <div className="text-xs text-white">15% Applied</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#CC5500] flex items-center justify-center flex-shrink-0 text-white italic" style={{ fontFamily: "'Instrument Serif', serif" }}>
                      R
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-stone-400">Action Taken</div>
                      <div className="bg-stone-800 border border-[#CC5500]/30 p-3 rounded-lg rounded-tl-none text-sm text-white">
                        I've updated your subscription. The 5 seats are added effective Nov 1st with the 15% volume discount applied to the new total. Confirmation Invoice #INV-2024 sent.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Command the Board - Solutions */}
        <section id="solutions" className="py-24 px-6 md:px-12 bg-white relative">
          <div className="max-w-[1600px] mx-auto">
            <div className="mb-16 border-l-4 border-[#CC5500] pl-6 scroll-reveal opacity-0 translate-y-10">
              <h2 className="text-5xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Command the Board</h2>
              <p className="text-stone-500 text-xl max-w-2xl">
                Regent doesn't just chat. It acts. Capable of handling complex workflows across your entire stack.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Customer Support */}
              <div className="group border hover:shadow-2xl hover:border-[#CC5500] transition-all duration-500 relative overflow-hidden h-[500px] flex flex-col scroll-reveal opacity-0 translate-y-10 hover:-translate-y-2" style={{ borderColor: "#E7E5E4", backgroundColor: "#FDFBF7" }}>
                <div className="p-8 relative z-10">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-3xl mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>Customer Support</h3>
                  <p className="text-stone-500 mb-6">Deflect 60% of tickets instantly. Regent handles refunds, order tracking, and account management.</p>
                  <ul className="space-y-2 text-sm font-medium text-stone-700">
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-blue-500 rounded-full" />Multi-lingual Triage</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-blue-500 rounded-full" />Zendesk &amp; Intercom</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-blue-500 rounded-full" />SLA Monitoring</li>
                  </ul>
                </div>
                <div className="mt-auto relative h-48 bg-blue-50/50 border-t border-blue-100 overflow-hidden">
                  <div className="absolute top-4 left-4 right-4 space-y-2">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-white shadow-sm" />
                      <div className="h-8 flex-1 bg-white rounded-lg shadow-sm" />
                    </div>
                    <div className="flex gap-2 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-blue-500 shadow-sm" />
                      <div className="h-8 w-2/3 bg-blue-100 rounded-lg shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Ops */}
              <div className="group border hover:shadow-2xl hover:border-teal-500 transition-all duration-500 relative overflow-hidden h-[500px] flex flex-col scroll-reveal opacity-0 translate-y-10 hover:-translate-y-2" style={{ borderColor: "#E7E5E4", backgroundColor: "#FDFBF7", transitionDelay: "0.15s" }}>
                <div className="p-8 relative z-10">
                  <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center mb-6">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h3 className="text-3xl mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>Sales Ops</h3>
                  <p className="text-stone-500 mb-6">Automate the SDR grind. Lead enrichment, qualification, and meeting prep happened before you wake up.</p>
                  <ul className="space-y-2 text-sm font-medium text-stone-700">
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-teal-500 rounded-full" />CRM Hygiene</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-teal-500 rounded-full" />Outbound Personalization</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-teal-500 rounded-full" />Meeting Scheduling</li>
                  </ul>
                </div>
                <div className="mt-auto relative h-48 bg-teal-50/50 border-t border-teal-100 overflow-hidden flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border border-teal-200 flex items-center justify-center relative">
                    <div className="absolute inset-0 border border-teal-300 rounded-full animate-ping opacity-20" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-teal-700">+42%</div>
                      <div className="text-[10px] uppercase tracking-wide text-teal-600">Pipeline</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Back Office */}
              <div className="group border hover:shadow-2xl hover:border-[#CC5500] transition-all duration-500 relative overflow-hidden h-[500px] flex flex-col scroll-reveal opacity-0 translate-y-10 hover:-translate-y-2" style={{ borderColor: "#E7E5E4", backgroundColor: "#FDFBF7", transitionDelay: "0.3s" }}>
                <div className="p-8 relative z-10">
                  <div className="w-12 h-12 bg-orange-100 text-[#CC5500] rounded-lg flex items-center justify-center mb-6">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-3xl mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>Back Office</h3>
                  <p className="text-stone-500 mb-6">The invisible work, handled. Invoice processing, KYC checks, and vendor onboarding.</p>
                  <ul className="space-y-2 text-sm font-medium text-stone-700">
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-[#CC5500] rounded-full" />Invoice Extraction</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-[#CC5500] rounded-full" />Compliance Checks</li>
                    <li className="flex items-center gap-2"><span className="w-1 h-1 bg-[#CC5500] rounded-full" />Data Entry</li>
                  </ul>
                </div>
                <div className="mt-auto relative h-48 bg-orange-50/50 border-t border-orange-100 overflow-hidden p-6">
                  <div className="bg-white shadow-sm rounded border border-orange-100 p-3 rotate-3 origin-bottom-left transform transition-transform group-hover:rotate-0">
                    <div className="h-2 w-1/3 bg-stone-200 rounded mb-2" />
                    <div className="h-2 w-full bg-stone-100 rounded mb-1" />
                    <div className="h-2 w-full bg-stone-100 rounded mb-1" />
                    <div className="h-2 w-2/3 bg-stone-100 rounded" />
                  </div>
                  <div className="bg-white shadow-md rounded border border-orange-200 p-3 -rotate-2 origin-bottom-right absolute top-8 right-8 w-3/4 transform transition-transform group-hover:rotate-0">
                    <div className="flex justify-between items-center">
                      <div className="h-2 w-1/4 bg-stone-800 rounded" />
                      <div className="h-4 w-4 rounded-full bg-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Outcomes over Headcount */}
        <section className="border-y bg-stone-50 py-20" style={{ borderColor: "#E7E5E4" }}>
          <div className="max-w-4xl mx-auto text-center px-6">
            <h2 className="text-4xl md:text-5xl mb-12 scroll-reveal opacity-0 translate-y-10" style={{ fontFamily: "'Instrument Serif', serif" }}>Outcomes over Headcount</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "60%", label: "Cost Savings" },
                { value: "0s", label: "Wait Time" },
                { value: "24/7", label: "Availability" },
                { value: "100%", label: "Security" },
              ].map((stat) => (
                <div key={stat.label} className="text-center scroll-reveal opacity-0 translate-y-10">
                  <div className="text-4xl font-bold text-stone-900 mb-2">{stat.value}</div>
                  <div className="text-sm uppercase tracking-widest text-stone-500" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA - Your Move */}
        <section id="access" className="min-h-[600px] flex items-center justify-center relative overflow-hidden bg-[#CC5500]">
          <div
            className="absolute inset-0 opacity-10 animate-[patternShift_15s_linear_infinite]"
            style={{
              backgroundImage: "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
              backgroundSize: "40px 40px",
              backgroundPosition: "0 0, 0 20px, 20px -20px, -20px 0px",
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white opacity-10 blur-[150px] rounded-full animate-[glowPulse_4s_ease-in-out_infinite]" />

          <div className="relative z-10 text-center px-6 max-w-3xl">
            <h2 className="text-6xl md:text-8xl text-white mb-8 scroll-reveal opacity-0 translate-y-10" style={{ fontFamily: "'Instrument Serif', serif" }}>Your Move.</h2>
            <p className="text-white/80 text-xl md:text-2xl font-light mb-12 leading-relaxed scroll-reveal opacity-0 translate-y-10">
              Join the waitlist for Regent and stop playing defense with your operations.
            </p>
            <div className="scroll-reveal opacity-0 translate-y-10">
              <button
                onClick={() => navigate("/waitlist")}
                className="px-10 py-5 bg-white text-[#CC5500] font-bold text-lg rounded-lg hover:bg-stone-100 transition-colors shadow-xl"
              >
                Early Access
              </button>
            </div>
            <p className="mt-6 text-white/40 text-sm">Limited early access availability.</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t pt-24 pb-12 px-6 md:px-12" style={{ borderColor: "#E7E5E4" }}>
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 bg-stone-900 flex items-center justify-center text-white rounded-sm text-xs">R</div>
                <span className="text-xl font-medium" style={{ fontFamily: "'Instrument Serif', serif" }}>Regent</span>
              </div>
              <p className="text-stone-500 text-sm leading-relaxed">
                Building the autonomous enterprise.<br />
                Based in San Francisco.
              </p>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-stone-400 mb-6" style={{ fontFamily: "'Space Grotesk', monospace" }}>Platform</h4>
              <ul className="space-y-4 text-sm text-stone-600">
                <li><a href="#" className="hover:text-[#CC5500]">Agents</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Integrations</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Security</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-stone-400 mb-6" style={{ fontFamily: "'Space Grotesk', monospace" }}>Company</h4>
              <ul className="space-y-4 text-sm text-stone-600">
                <li><a href="#" className="hover:text-[#CC5500]">About</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Manifesto</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Careers</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest text-stone-400 mb-6" style={{ fontFamily: "'Space Grotesk', monospace" }}>Legal</h4>
              <ul className="space-y-4 text-sm text-stone-600">
                <li><a href="#" className="hover:text-[#CC5500]">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">Terms of Service</a></li>
                <li><a href="#" className="hover:text-[#CC5500]">DPA</a></li>
              </ul>
            </div>
          </div>

          <div className="max-w-[1600px] mx-auto pt-8 border-t flex flex-col md:flex-row justify-between items-center text-sm text-stone-400" style={{ borderColor: "#E7E5E4" }}>
            <div>&copy; {new Date().getFullYear()} Regent AI Inc.</div>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-stone-900">Twitter</a>
              <a href="#" className="hover:text-stone-900">LinkedIn</a>
              <a href="#" className="hover:text-stone-900">GitHub</a>
            </div>
          </div>
        </footer>
      </main>

      {/* Keyframe animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.08; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.18; transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes patternShift {
          0% { background-position: 0 0, 0 20px, 20px -20px, -20px 0px; }
          100% { background-position: 40px 40px, 40px 60px, 60px 20px, 20px 40px; }
        }
      `}</style>
    </div>
  );
};

export default Landing;

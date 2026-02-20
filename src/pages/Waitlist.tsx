import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabase } from "@/integrations/supabase/client";

const waitlistSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Please enter a valid email address").max(320),
  company: z.string().min(1, "Company name is required").max(200),
  industry: z.string().max(200).optional(),
  companySize: z.string().max(100).optional(),
  opsTeamSize: z.string().max(100).optional(),
  selectedFunction: z.enum(["support", "leads", "revops"]),
  bottleneck: z.string().max(2000).optional(),
});

export default function Waitlist() {
  const navigate = useNavigate();
  const [formLoading, setFormLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Scroll-reveal observer
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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [opsTeamSize, setOpsTeamSize] = useState("");
  const [selectedFunction, setSelectedFunction] = useState("support");
  const [bottleneck, setBottleneck] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = waitlistSchema.safeParse({
      name, email, company, industry, companySize, opsTeamSize, selectedFunction, bottleneck,
    });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    if (!turnstileToken) {
      toast.error("Please wait for bot verification to complete.");
      return;
    }

    setFormLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-waitlist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            turnstileToken,
            name: result.data.name,
            email: result.data.email,
            company: result.data.company,
            industry: result.data.industry,
            companySize: result.data.companySize,
            opsTeamSize: result.data.opsTeamSize,
            selectedFunction: result.data.selectedFunction,
            bottleneck: result.data.bottleneck,
          }),
        }
      );

      const json = await res.json();

      if (json.duplicate) {
        toast.info("You're already on the waitlist! We'll reach out soon.");
      } else if (json.error) {
        toast.error(json.error);
      } else {
        setFormSubmitted(true);
        toast.success("Application received! We'll review and get back to you.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

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
      <nav
        className="fixed top-0 w-full z-40 backdrop-blur-md border-b"
        style={{ backgroundColor: "rgba(253,251,247,0.9)", borderColor: "#E7E5E4" }}
      >
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

          <a
            href="#application"
            className="group relative px-6 py-2 bg-stone-900 text-white rounded-full overflow-hidden transition-all hover:bg-[#CC5500]"
          >
            <span className="relative z-10 text-sm font-medium flex items-center gap-2">
              Request Access
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 w-full max-w-[1600px] mx-auto border-l border-r bg-white" style={{ borderColor: "#E7E5E4" }}>

        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 min-h-[70vh] border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="lg:col-span-8 p-8 md:p-16 lg:p-24 flex flex-col justify-center border-b lg:border-b-0 lg:border-r relative overflow-hidden" style={{ borderColor: "#E7E5E4", backgroundColor: "#FDFBF7" }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#CC5500] to-transparent opacity-50" />

            <div className="inline-flex items-center gap-2 mb-8 animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
              <span className="w-2 h-2 rounded-full bg-[#CC5500] animate-pulse" />
              <span className="text-xs uppercase tracking-widest text-[#CC5500] font-semibold" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                Early Access &bull; Invite Only
              </span>
            </div>

            <h1
              className="text-6xl md:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tight mb-8 animate-[fadeSlideUp_1s_ease-out_0.4s_both]"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Operate at scale<br />
              <span className="italic text-[#CC5500]">without scaling your team.</span>
            </h1>

            <p className="text-xl text-stone-600 max-w-2xl leading-relaxed mb-12 font-light animate-[fadeSlideUp_1s_ease-out_0.7s_both]">
              Regent is an AI-led operations platform that runs customer support, lead generation, and revenue operations using specialized agents with human oversight.{" "}
              <span className="font-medium text-stone-900">Early access is selective and reviewed manually.</span>
            </p>

            <a
              href="#application"
              className="px-8 py-4 bg-stone-900 text-white text-lg rounded-lg hover:bg-[#CC5500] transition-colors duration-300 flex items-center justify-center gap-2 w-fit animate-[fadeSlideUp_1s_ease-out_1s_both]"
            >
              Apply for Waitlist
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
          </div>

          {/* Hero Right - Geometric */}
          <div className="lg:col-span-4 bg-[#F5F5F4] relative overflow-hidden flex items-center justify-center min-h-[300px]">
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            <div className="relative w-full h-full flex items-center justify-center p-12">
              <div className="relative w-64 h-64 animate-[float_6s_ease-in-out_infinite] animate-[scaleIn_1.2s_ease-out_0.5s_both]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-gradient-to-br from-[#CC5500] via-purple-900 to-black opacity-20 blur-[80px] rounded-full" />
                <div className="w-full h-full border border-stone-300 bg-white/50 backdrop-blur-sm relative rotate-45 transform transition-transform hover:rotate-0 duration-700">
                  <div className="absolute inset-4 border border-stone-300 flex items-center justify-center">
                    <svg className="w-24 h-24 text-[#CC5500]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.11 21 21 20.1 21 19V5C21 3.9 20.11 3 19 3M19 19H5V5H19V19M7 7H9V9H7V7M11 7H13V9H11V7M15 7H17V9H15V7M7 11H9V13H7V11M11 11H13V13H11V11M15 11H17V13H15V11M7 15H9V17H7V15M11 15H13V17H11V15M15 15H17V17H15V15Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who This Is For */}
        <section className="grid grid-cols-1 md:grid-cols-2 border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="p-10 lg:p-16 border-b md:border-b-0 border-r bg-white scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4" }}>
            <div className="mb-6">
              <span className="text-xs uppercase tracking-widest text-stone-500 font-semibold" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                Target Profile
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>Who this is for</h2>
            <p className="text-stone-500 text-lg leading-relaxed">
              If this isn't your situation yet, Regent may be early for you. We focus on teams hitting the breaking point of manual operations.
            </p>
          </div>
          <div className="p-10 lg:p-16 scroll-reveal opacity-0 translate-y-10" style={{ backgroundColor: "#FDFBF7" }}>
            <ul className="space-y-8">
              {[
                { title: "Support volume > Headcount", desc: "Tickets are piling up faster than you can hire quality agents." },
                { title: "SDR Repetition", desc: "Leadgen work has become a copy-paste grind without personalization." },
                { title: "RevOps Maintenance", desc: "CRM hygiene and data entry require constant manual effort." },
                { title: "Inefficient Scaling", desc: "Hiring more human operators no longer feels like the efficient path." },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#CC5500]/10 flex items-center justify-center text-[#CC5500] shrink-0 mt-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-lg text-stone-900">{item.title}</h3>
                    <p className="text-stone-500 mt-1">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What Early Access Means */}
        <section className="bg-[#1C1917] text-white border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col justify-between scroll-reveal opacity-0 translate-y-10">
              <div>
                <span className="text-[#CC5500] text-xs tracking-widest uppercase mb-4 block" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                  Partnership Model
                </span>
                <h2 className="text-4xl lg:text-5xl mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>What Early Access Means</h2>
                <p className="text-stone-400 text-lg max-w-md">
                  Early access is a working partnership. This is not a self-serve tool or a demo. We build the system around you.
                </p>
              </div>
            </div>
            <div className="p-10 lg:p-16 grid grid-cols-1 sm:grid-cols-2 gap-8 scroll-reveal opacity-0 translate-y-10">
              {[
                { num: "01", title: "Single Function Focus", desc: "We start with one operational function to ensure quality." },
                { num: "02", title: "Custom Configuration", desc: "Agents are configured specifically around your workflows." },
                { num: "03", title: "Human Oversight", desc: "Humans remain in the loop for oversight and edge cases." },
                { num: "04", title: "Iterative Improvement", desc: "The system improves through real usage and iteration." },
              ].map((item) => (
                <div key={item.num} className="space-y-3">
                  <div className="text-2xl text-[#CC5500]" style={{ fontFamily: "'Instrument Serif', serif" }}>{item.num}</div>
                  <h3 className="font-medium text-white">{item.title}</h3>
                  <p className="text-sm text-stone-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Start With */}
        <section className="border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="p-10 lg:p-16 border-b text-center scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4" }}>
            <h2 className="text-4xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>What we start with</h2>
            <p className="text-stone-500">You choose one function to start. Additional functions can be added once stable.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="p-10 border-b md:border-b-0 border-r hover:bg-stone-50 transition-all group scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4" }}>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl mb-2 group-hover:text-blue-700 transition-colors" style={{ fontFamily: "'Instrument Serif', serif" }}>Customer Support</h3>
              <div className="text-xs uppercase tracking-widest text-stone-400 mb-4" style={{ fontFamily: "'Space Grotesk', monospace" }}>The Knight</div>
              <p className="text-stone-600 text-sm leading-relaxed">Deflect tickets, handle refunds, order tracking, and account management autonomously.</p>
            </div>
            <div className="p-10 border-b md:border-b-0 border-r hover:bg-stone-50 transition-all group scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4" }}>
              <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-2xl mb-2 group-hover:text-teal-700 transition-colors" style={{ fontFamily: "'Instrument Serif', serif" }}>Lead Gen &amp; SDR</h3>
              <div className="text-xs uppercase tracking-widest text-stone-400 mb-4" style={{ fontFamily: "'Space Grotesk', monospace" }}>The Bishop</div>
              <p className="text-stone-600 text-sm leading-relaxed">Automated lead enrichment, qualification, and personalized outbound at scale.</p>
            </div>
            <div className="p-10 hover:bg-stone-50 transition-all group scroll-reveal opacity-0 translate-y-10">
              <div className="w-12 h-12 bg-orange-100 text-[#CC5500] rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl mb-2 group-hover:text-[#CC5500] transition-colors" style={{ fontFamily: "'Instrument Serif', serif" }}>Revenue Ops</h3>
              <div className="text-xs uppercase tracking-widest text-stone-400 mb-4" style={{ fontFamily: "'Space Grotesk', monospace" }}>The Rook</div>
              <p className="text-stone-600 text-sm leading-relaxed">Invoice processing, KYC checks, vendor onboarding, and CRM hygiene.</p>
            </div>
          </div>
        </section>

        {/* Regent Is Not + Onboarding */}
        <section className="grid grid-cols-1 lg:grid-cols-2 border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="p-10 lg:p-16 border-b lg:border-b-0 lg:border-r scroll-reveal opacity-0 translate-y-10" style={{ borderColor: "#E7E5E4", backgroundColor: "#FDFBF7" }}>
            <div className="mb-12">
              <h3 className="text-2xl mb-4 text-[#CC5500]" style={{ fontFamily: "'Instrument Serif', serif" }}>Regent is not...</h3>
              <ul className="space-y-3 text-stone-600">
                {["A CRM replacement", "A chatbot widget", "A generic automation tool", 'A hands-off "set and forget" system'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-stone-500 italic border-l-2 border-stone-200 pl-4">
                Regent works best with clear ownership and collaboration.
              </p>
            </div>
            <div>
              <h3 className="text-2xl mb-4 text-stone-900" style={{ fontFamily: "'Instrument Serif', serif" }}>Direct Pricing</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Pricing is direct and fixed. Monthly pricing per function based on scope and operational complexity.
              </p>
              <p className="text-xs text-stone-500 uppercase tracking-wide" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                Pricing shared after qualification
              </p>
            </div>
          </div>
          <div className="p-10 lg:p-16 bg-white flex flex-col justify-center scroll-reveal opacity-0 translate-y-10">
            <h3 className="text-3xl mb-8" style={{ fontFamily: "'Instrument Serif', serif" }}>Onboarding Process</h3>
            <div className="relative pl-6 border-l border-stone-200 space-y-8">
              {[
                { title: "Application Review", desc: "Founder-led review of your needs.", active: true },
                { title: "Short Qualification Call", desc: "Understanding your volume & complexity.", active: false },
                { title: "Workflow Mapping", desc: "Defining the rules for the agent.", active: false },
                { title: "Agent Configuration", desc: "Technical setup and integration.", active: false },
                { title: "Go Live", desc: "Launch with full human oversight.", active: false },
              ].map((step) => (
                <div key={step.title} className="relative">
                  <span className={`absolute -left-[1.6rem] top-1.5 w-3 h-3 rounded-full border-2 border-white ring-1 ring-stone-200 ${step.active ? "bg-stone-900" : "bg-white border-stone-300"}`} />
                  <h4 className="font-medium text-stone-900">{step.title}</h4>
                  <p className="text-xs text-stone-500 mt-1">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section id="application" className="py-24 px-6 md:px-12 bg-[#CC5500] relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
              backgroundSize: "40px 40px",
              backgroundPosition: "0 0, 0 20px, 20px -20px, -20px 0px",
            }}
          />

          <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 lg:p-16 rounded shadow-2xl relative z-10 scroll-reveal opacity-0 translate-y-10">
            {formSubmitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-4xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Application Received</h2>
                <p className="text-stone-500 text-lg mb-8">
                  Thanks — your application has been received. If Regent is a good fit, we'll reach out personally to discuss next steps.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="text-sm text-stone-400 hover:text-[#CC5500] transition-colors"
                  style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: "0.05em" }}
                >
                  &larr; Back to home
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-12">
                  <h2 className="text-4xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Request Early Access</h2>
                  <p className="text-stone-500">Fill out the details below. We process applications weekly.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField label="Full Name" value={name} onChange={setName} required />
                    <InputField label="Work Email" type="email" value={email} onChange={setEmail} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField label="Company Name" value={company} onChange={setCompany} required />
                    <InputField label="Industry" value={industry} onChange={setIndustry} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField label="Company Size" value={companySize} onChange={setCompanySize} />
                    <InputField label="Current Ops Team Size" value={opsTeamSize} onChange={setOpsTeamSize} />
                  </div>

                  {/* Function Selection */}
                  <div className="pt-4">
                    <label className="block text-xs uppercase tracking-widest text-stone-500 mb-4" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                      Which function first?
                    </label>
                    <div className="flex flex-col space-y-3">
                      {[
                        { value: "support", label: "Customer Support (The Knight)" },
                        { value: "leads", label: "Lead Generation / SDR (The Bishop)" },
                        { value: "revops", label: "Revenue Operations (The Rook)" },
                      ].map((option) => (
                        <label key={option.value} className="flex items-center cursor-pointer group">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-all ${
                              selectedFunction === option.value
                                ? "border-[#CC5500] bg-[#CC5500]"
                                : "border-stone-400 group-hover:border-stone-600"
                            }`}
                          >
                            {selectedFunction === option.value && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <input
                            type="radio"
                            name="function"
                            value={option.value}
                            checked={selectedFunction === option.value}
                            onChange={(e) => setSelectedFunction(e.target.value)}
                            className="hidden"
                          />
                          <span className="text-stone-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Bottleneck */}
                  <div className="relative pt-5">
                    <textarea
                      value={bottleneck}
                      onChange={(e) => setBottleneck(e.target.value)}
                      rows={2}
                      placeholder=" "
                      className="w-full bg-transparent border-b px-0 py-4 text-lg text-stone-900 placeholder-transparent focus:outline-none focus:border-[#CC5500] transition-all resize-none peer"
                      style={{ borderColor: "#E7E5E4" }}
                    />
                    <label className="absolute top-5 left-0 text-xs uppercase tracking-widest text-stone-400 pointer-events-none transition-all peer-focus:text-[#CC5500]" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                      Biggest operational bottleneck today
                    </label>
                  </div>

                  <div className="pt-4 space-y-4">
                    <Turnstile
                      siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                      onSuccess={(token) => { setTurnstileToken(token); setTurnstileReady(true); }}
                      onExpire={() => setTurnstileToken(null)}
                      onError={() => setTurnstileReady(true)}
                      options={{ theme: "light", size: "invisible" }}
                    />
                    <button
                      type="submit"
                      disabled={formLoading || !turnstileReady}
                      className="w-full py-4 bg-stone-900 text-white font-medium uppercase tracking-widest hover:bg-[#CC5500] transition-colors border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: "'Space Grotesk', monospace" }}
                    >
                      {formLoading ? "Submitting..." : !turnstileReady ? "Verifying..." : "Request Early Access"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t py-12 px-6 md:px-12" style={{ borderColor: "#E7E5E4" }}>
          <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <div className="w-6 h-6 bg-stone-900 flex items-center justify-center text-white rounded-sm text-xs">R</div>
              <span className="text-xl font-medium" style={{ fontFamily: "'Instrument Serif', serif" }}>Regent</span>
            </div>
            <div className="text-stone-500 text-sm">AI-led operations for support and revenue teams.</div>
            <div className="text-stone-400 text-xs" style={{ fontFamily: "'Space Grotesk', monospace" }}>
              &copy; {new Date().getFullYear()} Regent AI Inc.
            </div>
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="relative pt-5">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        required={required}
        className="w-full bg-transparent border-b px-0 py-4 text-lg text-stone-900 placeholder-transparent focus:outline-none focus:border-[#CC5500] transition-all peer"
        style={{ borderColor: "#E7E5E4" }}
      />
      <label className="absolute top-5 left-0 text-xs uppercase tracking-widest text-stone-400 pointer-events-none transition-all peer-focus:text-[#CC5500]" style={{ fontFamily: "'Space Grotesk', monospace" }}>
        {label}
      </label>
    </div>
  );
}

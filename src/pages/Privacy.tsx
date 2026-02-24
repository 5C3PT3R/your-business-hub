import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Privacy() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#FDFBF7", color: "#1C1917", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
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
            <span className="text-2xl tracking-tight font-medium" style={{ fontFamily: "'Instrument Serif', serif" }}>Regent</span>
          </div>
        </div>
      </nav>

      <main className="pt-40 pb-24 px-6 max-w-3xl mx-auto">
        <div className="mb-12">
          <span className="text-xs uppercase tracking-widest text-[#CC5500] font-semibold" style={{ fontFamily: "'Space Grotesk', monospace" }}>Legal</span>
          <h1 className="text-5xl mt-4 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Privacy Policy</h1>
          <p className="text-stone-500 text-sm">Last updated: February 2026</p>
        </div>

        <div className="prose prose-stone max-w-none space-y-10 text-stone-700 leading-relaxed">

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>1. Who we are</h2>
            <p>Regent AI Inc. ("Regent", "we", "us", or "our") operates the website <strong>hireregent.com</strong> and the Regent AI operations platform. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our site or use our services.</p>
            <p className="mt-3">For questions, contact us at: <a href="mailto:hello@hireregent.com" className="text-[#CC5500] hover:underline">hello@hireregent.com</a></p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>2. Information we collect</h2>
            <p><strong>Waitlist applications:</strong> When you apply for early access, we collect your name, work email, company name, industry, team size, and a description of your operational challenges.</p>
            <p className="mt-3"><strong>Account information:</strong> If you create an account, we collect your email address and any profile information you provide.</p>
            <p className="mt-3"><strong>Usage data:</strong> We automatically collect information about how you interact with our platform, including pages visited, features used, and timestamps.</p>
            <p className="mt-3"><strong>Communications:</strong> If you contact us, we retain the content of your messages.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>3. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To review and respond to your early access application</li>
              <li>To provide, operate, and improve the Regent platform</li>
              <li>To communicate with you about your account or our services</li>
              <li>To send product updates (you can opt out at any time)</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>4. Data storage and security</h2>
            <p>Your data is stored securely using Supabase (PostgreSQL) with row-level security enabled. We use HTTPS for all data transmission. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>5. Third-party services</h2>
            <p>We use the following third-party services which may process your data:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Vercel</strong> — website hosting</li>
              <li><strong>Cloudflare</strong> — bot protection (Turnstile)</li>
              <li><strong>Google</strong> — authentication (if you sign in with Google)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>6. Your rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. To exercise these rights, email us at <a href="mailto:hello@hireregent.com" className="text-[#CC5500] hover:underline">hello@hireregent.com</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>7. Cookies</h2>
            <p>We use only essential cookies required for authentication and security. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>8. Changes to this policy</h2>
            <p>We may update this policy from time to time. We will notify users of material changes via email or a prominent notice on our website.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>9. Contact</h2>
            <p>Regent AI Inc.<br />
            Email: <a href="mailto:hello@hireregent.com" className="text-[#CC5500] hover:underline">hello@hireregent.com</a><br />
            Website: <a href="https://www.hireregent.com" className="text-[#CC5500] hover:underline">www.hireregent.com</a></p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t flex gap-6 text-sm text-stone-400" style={{ borderColor: "#E7E5E4" }}>
          <button onClick={() => navigate("/")} className="hover:text-[#CC5500] transition-colors">← Back to home</button>
          <button onClick={() => navigate("/terms")} className="hover:text-[#CC5500] transition-colors">Terms of Service →</button>
        </div>
      </main>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Terms() {
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
          <h1 className="text-5xl mt-4 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Terms of Service</h1>
          <p className="text-stone-500 text-sm">Last updated: February 2026</p>
        </div>

        <div className="prose prose-stone max-w-none space-y-10 text-stone-700 leading-relaxed">

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>1. Acceptance</h2>
            <p>By accessing or using hireregent.com or the Regent platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>2. The Service</h2>
            <p>Regent provides an AI-powered operations platform that deploys autonomous agents for customer support, lead generation, and revenue operations. The platform is currently in early access and features may change without notice.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>3. Early access</h2>
            <p>Access to Regent is by invitation only. Submitting a waitlist application does not guarantee access. We reserve the right to accept or decline any application at our sole discretion.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Use the Service to send unsolicited communications (spam)</li>
              <li>Reverse engineer or attempt to extract the source code of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>5. Intellectual property</h2>
            <p>All content, features, and functionality of the Service — including but not limited to text, graphics, logos, and software — are the exclusive property of Regent AI Inc. and are protected by applicable intellectual property laws.</p>
            <p className="mt-3">You retain ownership of any data you input into the platform. By using the Service, you grant Regent a limited license to process that data solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>6. Disclaimer of warranties</h2>
            <p>The Service is provided "as is" and "as available" without warranties of any kind. Regent does not warrant that the Service will be uninterrupted, error-free, or free of harmful components.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>7. Limitation of liability</h2>
            <p>To the fullest extent permitted by law, Regent AI Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>8. Termination</h2>
            <p>We may suspend or terminate your access to the Service at any time, with or without notice, for any reason including breach of these Terms.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>9. Governing law</h2>
            <p>These Terms shall be governed by the laws of the jurisdiction in which Regent AI Inc. is incorporated, without regard to its conflict of law provisions.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>10. Changes</h2>
            <p>We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-2xl text-stone-900 mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>11. Contact</h2>
            <p>For questions about these Terms:<br />
            Email: <a href="mailto:hello@hireregent.com" className="text-[#CC5500] hover:underline">hello@hireregent.com</a></p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t flex gap-6 text-sm text-stone-400" style={{ borderColor: "#E7E5E4" }}>
          <button onClick={() => navigate("/")} className="hover:text-[#CC5500] transition-colors">← Back to home</button>
          <button onClick={() => navigate("/privacy")} className="hover:text-[#CC5500] transition-colors">Privacy Policy →</button>
        </div>
      </main>
    </div>
  );
}

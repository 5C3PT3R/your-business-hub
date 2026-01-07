import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  Brain, 
  Shield, 
  ArrowRight,
  Sparkles,
  Phone,
  Lock,
  Zap
} from "lucide-react";
import { BlurText, DecryptedText, Orb, DotGrid, ColorBends } from "@/components/reactbits";

const Landing = () => {
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navigation - Minimal Apple style */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-black">Upflo</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')}
                className="text-sm text-black/60 hover:text-black"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/demo')}
                className="text-sm bg-black text-white hover:bg-black/90 rounded-full px-5"
              >
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* SECTION 1 - Hero with ColorBends Background */}
      <section className="relative min-h-screen flex items-center justify-center pt-14 overflow-hidden bg-black">
        {/* ColorBends Background - Centered and More Vivid */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[120%] h-[120%] flex items-center justify-center">
            <ColorBends
              colors={["#ff1744", "#9c27ff", "#00e5ff", "#ff6d00", "#00ff88", "#ff4081"]}
              rotation={30}
              speed={0.4}
              scale={0.8}
              frequency={1.8}
              warpStrength={1.8}
              mouseInfluence={1.2}
              parallax={0.8}
              noise={0.05}
              transparent
            />
          </div>
        </div>

        <div className="relative max-w-4xl mx-auto text-center px-6 py-20 z-10">
          {/* Main Headline with BlurText */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05] mb-8">
            <BlurText
              text="The CRM that updates itself from your conversations"
              animateBy="words"
              direction="top"
              delay={100}
              className="inline"
            />
          </h1>

          {/* Subheadline with DecryptedText */}
          <p className="text-xl sm:text-2xl text-white/70 max-w-2xl mx-auto mb-12 font-normal">
            <DecryptedText
              text="Paste a call, meeting, or chat. AI does the rest."
              speed={40}
              maxIterations={15}
              animateOn="view"
              className="text-white/80"
              encryptedClassName="text-white/40"
            />
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="text-base px-8 py-6 bg-white text-black hover:bg-white/90 rounded-full group relative overflow-hidden"
              onClick={() => navigate('/demo')}
            >
              <span className="relative z-10 flex items-center">
                Try the Live Demo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 py-6 rounded-full border-white/30 text-white hover:bg-white/10"
            >
              Book a demo
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 2 - Problem Statement (No animations) */}
      <section className="py-32 px-6 bg-neutral-50">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-3xl sm:text-4xl font-medium text-black/80 leading-relaxed scroll-reveal">
            Every day, your sales team has conversations.
            <br />
            <span className="text-black/40">
              But most of that context never makes it into the CRM.
            </span>
          </p>
          <p className="mt-12 text-lg text-black/50 scroll-reveal">
            Reps forget to log calls. Pipelines become fiction. Managers stop trusting the data.
          </p>
        </div>
      </section>

      {/* SECTION 3 - How It Works (Bento-style grid) */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20 scroll-reveal">
            <h2 className="text-4xl sm:text-5xl font-bold text-black tracking-tight mb-4">
              Three steps. Zero effort.
            </h2>
            <p className="text-xl text-black/50">
              From conversation to updated CRM in seconds.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Paste a conversation",
                description: "Drop any call transcript, meeting notes, or chat log.",
                icon: MessageSquare
              },
              {
                step: "02",
                title: "AI extracts intent",
                description: "Understand deals, stages, sentiment, and next steps automatically.",
                icon: Brain
              },
              {
                step: "03",
                title: "CRM updates itself",
                description: "Deals created, stages moved, follow-ups scheduled.",
                icon: Sparkles
              }
            ].map((item, i) => (
              <Card 
                key={item.step}
                className={`scroll-reveal stagger-${i + 1} group border-black/5 bg-white hover:shadow-lg hover:shadow-black/5 transition-all duration-500 rounded-3xl overflow-hidden`}
              >
                <CardContent className="p-8">
                  <div className="text-sm font-mono text-black/30 mb-6">{item.step}</div>
                  <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-black mb-3">{item.title}</h3>
                  <p className="text-black/50 leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 - Trust & Explainability with DotGrid */}
      <section className="py-32 px-6 relative overflow-hidden">
        {/* DotGrid Background - Very subtle */}
        <div className="absolute inset-0 pointer-events-none">
          <DotGrid 
            dotSize={2}
            gap={30}
            baseColor="rgba(0, 0, 0, 0.04)"
            activeColor="rgba(0, 0, 0, 0.12)"
            proximity={80}
          />
        </div>
        
        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-16 scroll-reveal">
            <h2 className="text-4xl sm:text-5xl font-bold text-black tracking-tight mb-4">
              AI you can trust
            </h2>
            <p className="text-xl text-black/50">
              Every action explained. Every decision justified.
            </p>
          </div>
          
          <div className="bg-white border border-black/10 rounded-3xl p-8 sm:p-12 scroll-reveal">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-blue-600 mb-1">
                  AI Recommendation
                </div>
                <div className="text-lg font-semibold text-black">
                  Move deal to Proposal stage
                </div>
              </div>
            </div>
            
            <div className="bg-neutral-50 rounded-2xl p-6 mb-6">
              <div className="text-sm font-medium text-black/40 mb-2">Why AI did this</div>
              <p className="text-black/70 italic">
                "They asked for pricing and a timeline. We discussed implementation scope and they mentioned budget approval is pending."
              </p>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-black/50">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Confidence: 87%
              </span>
              <span>Based on conversation from Dec 24</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 - Features Navigation (Card Nav style) */}
      <section className="py-32 px-6 bg-neutral-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 scroll-reveal">
            <h2 className="text-4xl sm:text-5xl font-bold text-black tracking-tight mb-4">
              Everything you need
            </h2>
            <p className="text-xl text-black/50">
              Built for teams that close deals through conversations.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Brain,
                title: "AI CRM",
                description: "Auto-updates from calls, meetings, and chats"
              },
              {
                icon: Phone,
                title: "Call Intelligence",
                description: "Transcription, sentiment, and key points extraction"
              },
              {
                icon: Shield,
                title: "Trust & Transparency",
                description: "Every AI action explained with evidence"
              },
              {
                icon: Lock,
                title: "Enterprise Security",
                description: "SOC 2 compliant, encrypted, and private"
              }
            ].map((feature, i) => (
              <div 
                key={feature.title}
                className={`scroll-reveal stagger-${i + 1} group flex items-center gap-6 p-6 bg-white rounded-2xl border border-black/5 hover:border-black/10 hover:shadow-md transition-all duration-300 cursor-pointer`}
              >
                <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center flex-shrink-0 group-hover:bg-black group-hover:text-white transition-colors duration-300">
                  <feature.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-black mb-1">{feature.title}</h3>
                  <p className="text-black/50 text-sm">{feature.description}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-black/20 group-hover:text-black group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 - Final CTA (Simple, gentle fade) */}
      <section className="py-32 px-6 scroll-reveal">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-black tracking-tight mb-6">
            Ready to see it in action?
          </h2>
          <p className="text-xl text-black/50 mb-12">
            No signup required. See your CRM update itself in 2 minutes.
          </p>
          <Button 
            size="lg" 
            className="text-base px-10 py-6 bg-black text-white hover:bg-black/90 rounded-full group"
            onClick={() => navigate('/demo')}
          >
            Try the Live Demo
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="py-12 px-6 border-t border-black/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-black">Upflo</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-black/40">
              <a href="#" className="hover:text-black transition-colors">Privacy</a>
              <a href="#" className="hover:text-black transition-colors">Terms</a>
              <a href="#" className="hover:text-black transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-black/30">
            © {new Date().getFullYear()} Upflo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  Brain, 
  Shield, 
  Bell, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Users,
  Building2,
  Briefcase,
  Rocket
} from "lucide-react";

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-effect">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shadow-glow">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold tracking-tight">Upflo</span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')}
                className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/demo')}
                className="gradient-brand text-primary-foreground border-0 btn-glow rounded-xl px-5"
              >
                Try Demo
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        
        {/* Floating orbs */}
        <div className="absolute top-40 right-20 w-4 h-4 rounded-full bg-primary/30 animate-float" />
        <div className="absolute top-60 left-32 w-3 h-3 rounded-full bg-accent/40 animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 right-40 w-5 h-5 rounded-full bg-primary/20 animate-float" style={{ animationDelay: '2s' }} />
        
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
              <span className="gradient-text">The CRM that updates itself</span>
              <br />
              <span className="text-foreground">from your conversations</span>
            </h1>
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up-delayed">
            Paste a call, meeting, or chat. Upflo automatically creates deals, updates stages, 
            suggests follow-ups — and shows you why.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 gradient-brand text-primary-foreground border-0 rounded-xl btn-glow group"
              onClick={() => navigate('/demo')}
            >
              Try the Live Demo
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-6 rounded-xl bg-card hover:bg-muted/50"
            >
              Book a demo
            </Button>
          </div>
        </div>

        {/* Abstract UI Mockup */}
        <div className="relative max-w-5xl mx-auto mt-20 scroll-reveal">
          <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-glow-pulse">
            <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
              <span className="ml-4 text-sm text-muted-foreground font-medium">Pipeline — Upflo</span>
            </div>
            <div className="p-6 grid grid-cols-4 gap-4">
              {['Lead', 'Qualified', 'Proposal', 'Closed'].map((stage, i) => (
                <div key={stage} className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">{stage}</div>
                  {[...Array(3 - i)].map((_, j) => (
                    <div 
                      key={j} 
                      className="bg-muted/20 rounded-xl p-3 space-y-2 border border-border/50"
                    >
                      <div className="h-3 bg-muted rounded-full w-3/4" />
                      <div className="h-2 bg-muted/50 rounded-full w-1/2" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* AI notification card */}
          <div className="absolute -bottom-6 -right-4 sm:right-8 bg-card border border-border rounded-xl shadow-xl p-4 max-w-xs animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg gradient-brand-soft flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI</span>
                </div>
                <p className="text-sm font-medium">Stage → Proposal</p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "They asked for pricing and timeline"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 gradient-surface">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 scroll-reveal">
            CRMs fail because people don't update them
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {[
              "Reps forget to log calls",
              "Pipelines become fiction",
              "Follow-ups get missed",
              "Managers stop trusting the CRM"
            ].map((problem, i) => (
              <div 
                key={problem}
                className={`scroll-reveal flex items-center gap-3 p-5 bg-card rounded-xl border border-border card-hover stagger-${i + 1}`}
              >
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <span className="text-foreground font-medium">{problem}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-lg text-muted-foreground italic scroll-reveal">
            "If it's manual, it won't stay accurate."
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 scroll-reveal">
            Upflo listens. Your CRM works.
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto scroll-reveal">
            Three simple steps to a CRM that actually reflects reality.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Paste a conversation",
                description: "Copy any call transcript, meeting notes, or chat log. Drop it into Upflo.",
                icon: MessageSquare
              },
              {
                step: "2",
                title: "AI extracts insights",
                description: "Intent level, deal summary, key points, and recommended next steps — all automatic.",
                icon: Brain
              },
              {
                step: "3",
                title: "CRM updates itself",
                description: "Deals created, stages moved, follow-ups suggested. With evidence for every change.",
                icon: Sparkles
              }
            ].map((item, i) => (
              <div key={item.step} className={`relative scroll-reveal stagger-${i + 1}`}>
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full gradient-brand text-primary-foreground flex items-center justify-center font-bold text-lg shadow-glow">
                  {item.step}
                </div>
                <Card className="pt-8 h-full border-border card-hover rounded-2xl">
                  <CardContent className="pt-4">
                    <div className="w-12 h-12 rounded-xl gradient-brand-soft flex items-center justify-center mb-4">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 gradient-surface">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 scroll-reveal">
            Built different
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto scroll-reveal">
            AI that runs your CRM, not the other way around.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "AI That Runs the CRM",
                features: [
                  "Auto-creates and updates deals",
                  "Smart stage movement",
                  "Conservative, confidence-based decisions"
                ]
              },
              {
                icon: Shield,
                title: "Explainable & Trustworthy",
                features: [
                  '"Why AI did this" with real quotes',
                  "Confidence scores",
                  "Human approval before actions"
                ]
              },
              {
                icon: Bell,
                title: "Follow-Ups Done Right",
                features: [
                  "AI suggests next messages",
                  "Stale deals automatically flagged",
                  "Nothing sent without your approval"
                ]
              }
            ].map((feature, i) => (
              <Card 
                key={feature.title}
                className={`scroll-reveal stagger-${i + 1} border-border card-hover rounded-2xl overflow-hidden`}
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl gradient-brand-soft flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                  <ul className="space-y-3">
                    {feature.features.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Audience Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 scroll-reveal">
            Built for teams that live in conversations
          </h2>
          <p className="text-muted-foreground mb-12 scroll-reveal">
            If your revenue starts with conversations, Upflo fits.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: "Sales teams" },
              { icon: Building2, label: "Real estate brokers" },
              { icon: Briefcase, label: "Consultants & agencies" },
              { icon: Rocket, label: "Founders & operators" }
            ].map((audience, i) => (
              <div 
                key={audience.label}
                className={`scroll-reveal stagger-${i + 1} flex flex-col items-center gap-3 p-6 bg-card rounded-2xl border border-border card-hover`}
              >
                <div className="w-12 h-12 rounded-xl gradient-brand-soft flex items-center justify-center">
                  <audience.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium text-sm">{audience.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse-slow" />
        
        <div className="relative max-w-3xl mx-auto text-center scroll-reveal">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See your CRM update itself
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            No setup. No credit card. 2-minute demo.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-10 py-6 gradient-brand text-primary-foreground border-0 rounded-xl btn-glow group"
            onClick={() => navigate('/demo')}
          >
            Try the Live Demo
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <span className="text-lg font-semibold">Upflo</span>
                <p className="text-sm text-muted-foreground">The self-updating CRM</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Upflo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
// V1 MODE: Public landing page for Upflo - conversation-first CRM
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">Upflo</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')}
                className="hidden sm:inline-flex"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/auth?demo=true')}
              >
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            The CRM that updates itself from your{" "}
            <span className="text-primary">conversations</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Paste a call, meeting, or chat. Upflo automatically creates deals, updates stages, 
            suggests follow-ups — and shows you why.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => navigate('/auth?demo=true')}
            >
              Try the Live Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="lg"
              className="text-lg"
            >
              Book a demo
            </Button>
          </div>
        </div>

        {/* Abstract UI Mockup */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive/50" />
              <div className="w-3 h-3 rounded-full bg-warning/50" />
              <div className="w-3 h-3 rounded-full bg-success/50" />
              <span className="ml-4 text-sm text-muted-foreground">Pipeline — Upflo</span>
            </div>
            <div className="p-6 grid grid-cols-4 gap-4">
              {['Lead', 'Qualified', 'Proposal', 'Closed'].map((stage, i) => (
                <div key={stage} className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">{stage}</div>
                  {[...Array(3 - i)].map((_, j) => (
                    <div 
                      key={j} 
                      className="bg-muted/30 rounded-lg p-3 space-y-2"
                    >
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-muted/50 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 bg-card border border-border rounded-lg shadow-xl p-4 max-w-xs animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">AI updated stage → Proposal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  "They asked for pricing and timeline"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            CRMs fail because people don't update them
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            {[
              "Reps forget to log calls",
              "Pipelines become fiction",
              "Follow-ups get missed",
              "Managers stop trusting the CRM"
            ].map((problem) => (
              <div 
                key={problem}
                className="flex items-center gap-3 p-4 bg-background rounded-lg border border-border"
              >
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <span className="text-foreground">{problem}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-lg text-muted-foreground italic">
            "If it's manual, it won't stay accurate."
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Upflo listens. Your CRM works.
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
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
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <Card className="pt-8 h-full">
                  <CardContent className="pt-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Built different
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            AI that runs your CRM, not the other way around.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">AI That Runs the CRM</h3>
                <ul className="space-y-3">
                  {[
                    "Auto-creates and updates deals",
                    "Smart stage movement",
                    "Conservative, confidence-based decisions"
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Explainable & Trustworthy</h3>
                <ul className="space-y-3">
                  {[
                    '"Why AI did this" with real quotes',
                    "Confidence scores",
                    "Human approval before actions"
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Bell className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Follow-Ups Done Right</h3>
                <ul className="space-y-3">
                  {[
                    "AI suggests next messages",
                    "Stale deals automatically flagged",
                    "Nothing sent without your approval"
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Audience Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Built for teams that live in conversations
          </h2>
          <p className="text-muted-foreground mb-12">
            If your revenue starts with conversations, Upflo fits.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, label: "Sales teams" },
              { icon: Building2, label: "Real estate brokers" },
              { icon: Briefcase, label: "Consultants & agencies" },
              { icon: Rocket, label: "Founders & operators" }
            ].map((audience) => (
              <div 
                key={audience.label}
                className="flex flex-col items-center gap-3 p-6 bg-muted/30 rounded-xl"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <audience.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium text-sm">{audience.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See your CRM update itself
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            No setup. No credit card. 2-minute demo.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={() => navigate('/auth?demo=true')}
          >
            Try the Live Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
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

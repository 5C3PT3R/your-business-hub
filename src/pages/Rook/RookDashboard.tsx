/**
 * Rook Dashboard - Resume Screening Interface
 * 
 * Split-screen layout:
 * 1. Left Sidebar: Applicant queue sorted by score
 * 2. Right Panel: Selected applicant dossier with analysis
 */

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  AlertCircle, 
  FileText, 
  ThumbsUp, 
  ThumbsDown,
  Plus,
  Castle,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types matching our simplified schema
interface Applicant {
  id: string;
  job_id: string;
  name: string;
  email: string;
  resume_text: string;
  status: 'NEW' | 'SHORTLISTED' | 'REJECTED';
  score: number;
  analysis: {
    summary?: string;
    green_flags?: string[];
    red_flags?: string[];
  };
  created_at: string;
}

// Mock data matching our simplified schema
const MOCK_APPLICANTS: Applicant[] = [
  {
    id: '1',
    job_id: '1',
    name: 'Alex Chen',
    email: 'alex.chen@email.com',
    resume_text: `Senior Software Engineer with 7 years of experience at Google. 
Specialized in React, TypeScript, and Node.js. Led development of Google's internal 
dashboard used by 10,000+ employees. Strong background in performance optimization 
and scalable architecture. Open source contributor to React ecosystem.`,
    status: 'NEW',
    score: 94,
    analysis: {
      summary: 'Exceptional candidate with perfect skill alignment and FAANG experience.',
      green_flags: [
        'Ex-Google with 4 years of React experience',
        'Stanford CS degree',
        'Major OSS contributor to React ecosystem',
        'Strong TypeScript expertise'
      ],
      red_flags: [
        'Salary expectations may be high',
        'Currently employed, may have longer notice period'
      ]
    },
    created_at: '2026-01-22T10:00:00Z'
  },
  {
    id: '2',
    job_id: '1',
    name: 'Jordan Williams',
    email: 'jordan.w@email.com',
    resume_text: `Full Stack Developer at Stripe with 5 years of experience.
Built payment processing dashboards handling $1B+ in transactions. 
Expert in TypeScript, Node.js, and React. Strong focus on security 
and compliance in fintech applications.`,
    status: 'NEW',
    score: 82,
    analysis: {
      summary: 'Strong candidate with relevant fintech experience.',
      green_flags: [
        'Stripe experience with high-scale systems',
        'Strong TypeScript skills',
        'Payment processing expertise'
      ],
      red_flags: [
        'More backend-focused, less React depth',
        'Short tenure at previous company (1.5 years)'
      ]
    },
    created_at: '2026-01-22T11:00:00Z'
  },
  {
    id: '3',
    job_id: '1',
    name: 'Sam Rodriguez',
    email: 'sam.r@email.com',
    resume_text: `Frontend Developer at StartupXYZ with 3 years of experience.
Built customer-facing dashboards and admin panels. Self-taught developer 
with strong portfolio of React projects. Fast learner and team player.`,
    status: 'NEW',
    score: 58,
    analysis: {
      summary: 'Promising but lacks senior-level experience.',
      green_flags: [
        'Fast learner, went from junior to lead in 2 years',
        'Strong portfolio projects',
        'Self-motivated and proactive'
      ],
      red_flags: [
        'Only 3 years experience (below 5 year requirement)',
        'No large-scale production experience',
        'No formal CS education'
      ]
    },
    created_at: '2026-01-22T12:00:00Z'
  },
  {
    id: '4',
    job_id: '1',
    name: 'Taylor Kim',
    email: 'taylor.k@email.com',
    resume_text: `Junior Developer at Local Agency with 1 year of experience.
Worked on small React projects and WordPress sites. Eager to learn 
and grow in a professional environment.`,
    status: 'NEW',
    score: 28,
    analysis: {
      summary: 'Not qualified for senior role. Consider for junior positions.',
      green_flags: [
        'Enthusiastic and eager to learn',
        'Basic React knowledge'
      ],
      red_flags: [
        'Only 1 year of experience (needs 5+)',
        'Limited technical depth',
        'No production React experience'
      ]
    },
    created_at: '2026-01-22T13:00:00Z'
  },
  {
    id: '5',
    job_id: '1',
    name: 'Morgan Lee',
    email: 'morgan.lee@email.com',
    resume_text: `Senior Frontend Engineer at Meta with 6 years of experience.
Led React Native mobile app development for 5M+ users. Expert in 
performance optimization and accessibility.`,
    status: 'SHORTLISTED',
    score: 91,
    analysis: {
      summary: 'Top-tier candidate with Meta experience and strong leadership.',
      green_flags: [
        'Meta experience with large-scale React apps',
        'React Native expertise',
        'Strong leadership and mentoring skills'
      ],
      red_flags: [
        'May be overqualified for the role',
        'High compensation expectations'
      ]
    },
    created_at: '2026-01-22T09:00:00Z'
  },
  {
    id: '6',
    job_id: '1',
    name: 'Casey Smith',
    email: 'casey.smith@email.com',
    resume_text: `Mid-level Developer with inconsistent job history.
Multiple short-term positions in last 3 years. Basic React skills 
but lacks depth in modern frameworks.`,
    status: 'REJECTED',
    score: 35,
    analysis: {
      summary: 'Weak candidate with inconsistent employment history.',
      green_flags: [
        'Familiar with React basics'
      ],
      red_flags: [
        'Job hopper (3 roles in 2 years)',
        'Limited technical skills',
        'Poor communication in interview'
      ]
    },
    created_at: '2026-01-22T14:00:00Z'
  }
];

export default function RookDashboard() {
  const { toast } = useToast();
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(MOCK_APPLICANTS[0]);

  // Sort applicants by score (highest first)
  const sortedApplicants = [...applicants].sort((a, b) => b.score - a.score);

  // Get score badge color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500 text-white';
    if (score >= 50) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  // Get status badge variant
  const getStatusVariant = (status: Applicant['status']) => {
    switch (status) {
      case 'SHORTLISTED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  // Handle shortlist action
  const handleShortlist = (applicant: Applicant) => {
    setApplicants(prev =>
      prev.map(a =>
        a.id === applicant.id ? { ...a, status: 'SHORTLISTED' } : a
      )
    );
    
    if (selectedApplicant?.id === applicant.id) {
      setSelectedApplicant({ ...applicant, status: 'SHORTLISTED' });
    }

    toast({
      title: 'Candidate Shortlisted',
      description: `${applicant.name} has been added to your shortlist.`,
    });
  };

  // Handle reject action
  const handleReject = (applicant: Applicant) => {
    setApplicants(prev =>
      prev.map(a =>
        a.id === applicant.id ? { ...a, status: 'REJECTED' } : a
      )
    );
    
    if (selectedApplicant?.id === applicant.id) {
      setSelectedApplicant({ ...applicant, status: 'REJECTED' });
    }

    toast({
      title: 'Candidate Rejected',
      description: `${applicant.name} has been rejected.`,
    });
  };

  // Handle add applicant (mock)
  const handleAddApplicant = () => {
    toast({
      title: 'Add Applicant',
      description: 'This would open a resume upload dialog in production.',
    });
  };

  return (
    <MainLayout>
      <Header
        title="The Rook"
        subtitle="Resume Screening & Candidate Evaluation"
      />

      <div className="p-4 md:p-6">
        {/* Header with Add Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Castle className="h-8 w-8 text-stone-500" />
            <div>
              <h1 className="text-2xl font-bold">Candidate Dashboard</h1>
              <p className="text-muted-foreground">
                {applicants.length} applicants • {applicants.filter(a => a.status === 'SHORTLISTED').length} shortlisted
              </p>
            </div>
          </div>
          <Button onClick={handleAddApplicant}>
            <Plus className="h-4 w-4 mr-2" />
            Add Applicant
          </Button>
        </div>

        {/* Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - The Queue */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-lg">Applicant Queue</h2>
                  <p className="text-sm text-muted-foreground">
                    Sorted by score (highest first)
                  </p>
                </div>
                
                <ScrollArea className="h-[calc(100vh-280px)]">
                  {sortedApplicants.map((applicant) => (
                    <div
                      key={applicant.id}
                      className={cn(
                        'p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors',
                        selectedApplicant?.id === applicant.id && 'bg-muted'
                      )}
                      onClick={() => setSelectedApplicant(applicant)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center font-bold',
                            getScoreColor(applicant.score)
                          )}>
                            {applicant.score}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{applicant.name}</h3>
                            <Badge 
                              variant={getStatusVariant(applicant.status)}
                              className="text-xs"
                            >
                              {applicant.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground truncate">
                            {applicant.email}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              Score: {applicant.score}/100
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(applicant.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - The Dossier */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardContent className="p-0">
                {selectedApplicant ? (
                  <div className="h-full flex flex-col">
                    {/* Top Section: Score + Summary */}
                    <div className="p-6 border-b">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-4 mb-4">
                            <div className={cn(
                              'w-20 h-20 rounded-xl flex items-center justify-center font-bold text-3xl',
                              getScoreColor(selectedApplicant.score)
                            )}>
                              {selectedApplicant.score}
                            </div>
                            <div>
                              <h1 className="text-2xl font-bold">{selectedApplicant.name}</h1>
                              <p className="text-muted-foreground">{selectedApplicant.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant={getStatusVariant(selectedApplicant.status)}
                                  className="text-sm"
                                >
                                  {selectedApplicant.status}
                                </Badge>
                                <Badge variant="outline" className="text-sm">
                                  Applied: {new Date(selectedApplicant.created_at).toLocaleDateString()}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          {selectedApplicant.analysis.summary && (
                            <div className="mt-4">
                              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                                Summary
                              </h3>
                              <p className="text-sm bg-muted/50 rounded-lg p-3">
                                {selectedApplicant.analysis.summary}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          <Button
                            size="lg"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleShortlist(selectedApplicant)}
                            disabled={selectedApplicant.status === 'SHORTLISTED'}
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            {selectedApplicant.status === 'SHORTLISTED' ? 'Shortlisted' : 'Shortlist'}
                          </Button>
                          <Button
                            size="lg"
                            variant="destructive"
                            onClick={() => handleReject(selectedApplicant)}
                            disabled={selectedApplicant.status === 'REJECTED'}
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            {selectedApplicant.status === 'REJECTED' ? 'Rejected' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Green Flags vs Red Flags */}
                    <div className="p-6 border-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Green Flags */}
                        <div>
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-3">
                            <Check className="h-4 w-4 text-emerald-500" />
                            Green Flags
                          </h3>
                          <ul className="space-y-2">
                            {selectedApplicant.analysis.green_flags?.map((flag, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>{flag}</span>
                              </li>
                            )) || (
                              <li className="text-sm text-muted-foreground italic">
                                No green flags identified
                              </li>
                            )}
                          </ul>
                        </div>

                        {/* Red Flags */}
                        <div>
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-3">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            Red Flags
                          </h3>
                          <ul className="space-y-2">
                            {selectedApplicant.analysis.red_flags?.map((flag, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span>{flag}</span>
                              </li>
                            )) || (
                              <li className="text-sm text-muted-foreground italic">
                                No red flags identified
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section: Resume Text */}
                    <div className="p-6 flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Resume Text
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {selectedApplicant.resume_text.length} characters
                        </span>
                      </div>
                      
                      <ScrollArea className="h-64">
                        <div className="text-sm opacity-70 whitespace-pre-wrap bg-muted/30 rounded-lg p-4">
                          {selectedApplicant.resume_text}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No applicant selected</h3>
                    <p className="text-sm">Select an applicant from the queue to view their details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

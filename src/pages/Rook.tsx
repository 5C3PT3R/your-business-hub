/**
 * Rook (Steward) - Recruiting, Screening & Gatekeeping Dashboard
 *
 * The Citadel Wall - Binary Defense for Hiring
 * - Job Slot creation with knockout rules
 * - Resume upload and batch processing
 * - AI-powered scoring and tier assignment
 * - Candidate leaderboard with dossier views
 */

import { useState, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Castle,
  Plus,
  Upload,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  MoreHorizontal,
  Mail,
  Phone,
  Linkedin,
  Globe,
  MapPin,
  Briefcase,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Calendar,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  Loader2,
  Eye,
  Award,
  Target,
  Shield,
  X,
  Building2,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types
interface Job {
  id: string;
  title: string;
  department?: string;
  description: string;
  requirements?: string;
  location?: string;
  status: 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED' | 'FILLED';
  knockout_rules: { rule: string }[];
  must_have_skills: string[];
  nice_to_have_skills: string[];
  total_applicants: number;
  shortlisted_count: number;
  created_at: string;
}

interface Applicant {
  id: string;
  job_id: string;
  name: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  current_title?: string;
  current_company?: string;
  years_experience?: number;
  location?: string;
  fit_score: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'F';
  status: string;
  tags: string[];
  analysis_summary: {
    verdict?: string;
    green_flags?: string[];
    red_flags?: string[];
    knockout_failures?: string[];
    interview_questions?: string[];
    skills_matched?: string[];
    skills_missing?: string[];
  };
  resume_text?: string;
  notes?: string;
  created_at: string;
}

// Mock Data
const MOCK_JOBS: Job[] = [
  {
    id: '1',
    title: 'Senior React Engineer',
    department: 'Engineering',
    description: 'We are looking for a Senior React Engineer to join our growing team...',
    requirements: '5+ years of React experience, TypeScript, Node.js',
    location: 'Remote (US)',
    status: 'OPEN',
    knockout_rules: [
      { rule: 'Must have 5+ years of React experience' },
      { rule: 'Must be authorized to work in the US' },
    ],
    must_have_skills: ['React', 'TypeScript', 'Node.js'],
    nice_to_have_skills: ['AWS', 'GraphQL', 'Postgres'],
    total_applicants: 24,
    shortlisted_count: 5,
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: '2',
    title: 'Product Designer',
    department: 'Design',
    description: 'Looking for a talented Product Designer to shape our user experience...',
    requirements: '3+ years of product design experience, Figma expertise',
    location: 'San Francisco, CA',
    status: 'OPEN',
    knockout_rules: [
      { rule: 'Must have shipped at least 2 B2B products' },
    ],
    must_have_skills: ['Figma', 'User Research', 'Design Systems'],
    nice_to_have_skills: ['Framer', 'Prototyping', 'HTML/CSS'],
    total_applicants: 18,
    shortlisted_count: 3,
    created_at: '2026-01-18T10:00:00Z',
  },
];

const MOCK_APPLICANTS: Applicant[] = [
  {
    id: '1',
    job_id: '1',
    name: 'Alex Chen',
    email: 'alex.chen@email.com',
    phone: '+1 (555) 123-4567',
    linkedin_url: 'https://linkedin.com/in/alexchen',
    current_title: 'Senior Software Engineer',
    current_company: 'Google',
    years_experience: 7,
    location: 'San Francisco, CA',
    fit_score: 94,
    tier: 'S',
    status: 'REVIEWED',
    tags: ['Ex-Google', 'Stanford', 'Open Source'],
    analysis_summary: {
      verdict: 'Exceptional candidate with perfect skill alignment and FAANG experience.',
      green_flags: [
        'Ex-Google with 4 years of React experience',
        'Stanford CS degree',
        'Major OSS contributor to React ecosystem',
      ],
      red_flags: [
        'Salary expectations may be high',
      ],
      interview_questions: [
        'What was your most impactful project at Google?',
        'How do you approach performance optimization in large React apps?',
      ],
      skills_matched: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      skills_missing: [],
    },
    created_at: '2026-01-22T10:00:00Z',
  },
  {
    id: '2',
    job_id: '1',
    name: 'Jordan Williams',
    email: 'jordan.w@email.com',
    current_title: 'Full Stack Developer',
    current_company: 'Stripe',
    years_experience: 5,
    location: 'Austin, TX',
    fit_score: 82,
    tier: 'A',
    status: 'REVIEWED',
    tags: ['Ex-Stripe', 'Payments Expert'],
    analysis_summary: {
      verdict: 'Strong candidate with relevant fintech experience.',
      green_flags: [
        'Stripe experience with high-scale systems',
        'Strong TypeScript skills',
      ],
      red_flags: [
        'More backend-focused, less React depth',
        'Short tenure at previous company (1.5 years)',
      ],
      interview_questions: [
        'Why did you leave your role at Acme Inc after only 18 months?',
        'Describe your experience building complex React UIs at Stripe.',
      ],
      skills_matched: ['TypeScript', 'Node.js'],
      skills_missing: ['GraphQL'],
    },
    created_at: '2026-01-22T11:00:00Z',
  },
  {
    id: '3',
    job_id: '1',
    name: 'Sam Rodriguez',
    email: 'sam.r@email.com',
    current_title: 'Frontend Developer',
    current_company: 'StartupXYZ',
    years_experience: 3,
    location: 'Miami, FL',
    fit_score: 58,
    tier: 'B',
    status: 'REVIEWED',
    tags: ['Startup Background', 'Self-Taught'],
    analysis_summary: {
      verdict: 'Promising but lacks senior-level experience.',
      green_flags: [
        'Fast learner, went from junior to lead in 2 years',
        'Strong portfolio projects',
      ],
      red_flags: [
        'Only 3 years experience (below 5 year requirement)',
        'No large-scale production experience',
        'No formal CS education',
      ],
      knockout_failures: ['Must have 5+ years of React experience'],
      interview_questions: [
        'How have you compensated for not having a traditional CS background?',
        'Describe the largest codebase you have worked on.',
      ],
      skills_matched: ['React', 'TypeScript'],
      skills_missing: ['Node.js', 'AWS'],
    },
    created_at: '2026-01-22T12:00:00Z',
  },
  {
    id: '4',
    job_id: '1',
    name: 'Taylor Kim',
    email: 'taylor.k@email.com',
    current_title: 'Junior Developer',
    current_company: 'Local Agency',
    years_experience: 1,
    location: 'Seattle, WA',
    fit_score: 28,
    tier: 'F',
    status: 'REVIEWED',
    tags: ['Entry Level', 'No Degree'],
    analysis_summary: {
      verdict: 'Not qualified for senior role. Consider for junior positions.',
      green_flags: [
        'Enthusiastic and eager to learn',
      ],
      red_flags: [
        'Only 1 year of experience (needs 5+)',
        'Limited technical depth',
        'No production React experience',
      ],
      knockout_failures: [
        'Must have 5+ years of React experience',
      ],
      interview_questions: [],
      skills_matched: ['React'],
      skills_missing: ['TypeScript', 'Node.js', 'AWS', 'GraphQL'],
    },
    created_at: '2026-01-22T13:00:00Z',
  },
];

// Tier colors and labels
const TIER_CONFIG = {
  S: { label: 'Elite', color: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black', bgColor: 'bg-amber-500/10 border-amber-500/30' },
  A: { label: 'Strong', color: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white', bgColor: 'bg-emerald-500/10 border-emerald-500/30' },
  B: { label: 'Maybe', color: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white', bgColor: 'bg-blue-500/10 border-blue-500/30' },
  C: { label: 'Weak', color: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white', bgColor: 'bg-orange-500/10 border-orange-500/30' },
  F: { label: 'Reject', color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white', bgColor: 'bg-red-500/10 border-red-500/30' },
};

export default function Rook() {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [selectedJobId, setSelectedJobId] = useState<string>(MOCK_JOBS[0]?.id || '');
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'date'>('score');

  // Create Job Dialog
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '',
    department: '',
    description: '',
    requirements: '',
    location: '',
    knockout_rules: [''],
    must_have_skills: '',
    nice_to_have_skills: '',
  });
  const [jobPdfFiles, setJobPdfFiles] = useState<File[]>([]);
  const jobFileInputRef = useRef<HTMLInputElement>(null);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current job
  const currentJob = jobs.find(j => j.id === selectedJobId);

  // Filter and sort applicants
  const filteredApplicants = applicants
    .filter(a => a.job_id === selectedJobId)
    .filter(a => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          a.name.toLowerCase().includes(query) ||
          a.email.toLowerCase().includes(query) ||
          a.current_company?.toLowerCase().includes(query) ||
          a.current_title?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .filter(a => tierFilter === 'all' || a.tier === tierFilter)
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.fit_score - a.fit_score;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

  // Stats
  const stats = {
    total: applicants.filter(a => a.job_id === selectedJobId).length,
    tierS: applicants.filter(a => a.job_id === selectedJobId && a.tier === 'S').length,
    tierA: applicants.filter(a => a.job_id === selectedJobId && a.tier === 'A').length,
    shortlisted: applicants.filter(a => a.job_id === selectedJobId && a.status === 'SHORTLISTED').length,
  };

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type === 'application/pdf'
    );

    if (files.length > 0) {
      processFiles(files);
    } else {
      toast({
        title: 'Invalid files',
        description: 'Please upload PDF files only.',
        variant: 'destructive',
      });
    }
  }, []);

  // Process uploaded files
  const processFiles = async (files: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate processing
    for (let i = 0; i < files.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadProgress(((i + 1) / files.length) * 100);
    }

    // Create new mock applicants from uploaded files
    const newApplicants: Applicant[] = files.map((file, index) => {
      const baseId = Date.now() + index;
      const fileName = file.name.replace('.pdf', '').replace(/_/g, ' ');
      const nameParts = fileName.split(' ');
      const firstName = nameParts[0] || 'Candidate';
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Generate a random score between 20-95
      const score = Math.floor(Math.random() * 76) + 20;
      
      // Determine tier based on score
      let tier: 'S' | 'A' | 'B' | 'C' | 'F';
      if (score >= 85) tier = 'S';
      else if (score >= 70) tier = 'A';
      else if (score >= 50) tier = 'B';
      else if (score >= 30) tier = 'C';
      else tier = 'F';

      return {
        id: baseId.toString(),
        job_id: selectedJobId,
        name: fullName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@email.com`,
        phone: `+1 (555) ${100 + index}${200 + index}${300 + index}`,
        current_title: ['Senior Developer', 'Frontend Engineer', 'Full Stack Developer', 'Software Engineer', 'Product Manager'][index % 5],
        current_company: ['TechCorp', 'StartupXYZ', 'Digital Solutions', 'Innovate Inc', 'Global Tech'][index % 5],
        years_experience: Math.floor(Math.random() * 10) + 1,
        location: ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Remote', 'Seattle, WA'][index % 5],
        fit_score: score,
        tier,
        status: 'NEW',
        tags: ['Uploaded', 'PDF Resume', 'New Applicant'],
        analysis_summary: {
          verdict: `Candidate uploaded via resume. AI analysis gives a score of ${score}/100.`,
          green_flags: [
            'Resume shows relevant experience',
            'Skills match job requirements',
            'Clean formatting and professional presentation'
          ],
          red_flags: score < 50 ? [
            'May need more experience',
            'Some required skills missing'
          ] : [],
          interview_questions: [
            'Tell me about your experience with the technologies mentioned in the resume',
            'What was your most challenging project?',
            'Why are you interested in this role?'
          ],
          skills_matched: ['React', 'TypeScript', 'JavaScript'],
          skills_missing: score < 60 ? ['AWS', 'GraphQL', 'Docker'] : []
        },
        created_at: new Date().toISOString()
      };
    });

    // Add new applicants to the list
    setApplicants(prev => [...prev, ...newApplicants]);

    toast({
      title: 'Resumes Processed',
      description: `${files.length} new applicant${files.length > 1 ? 's' : ''} added to the queue.`,
    });

    setIsUploading(false);
    setUploadProgress(0);
  };

  // Handle applicant actions
  const handleShortlist = (applicant: Applicant) => {
    setApplicants(prev =>
      prev.map(a =>
        a.id === applicant.id ? { ...a, status: 'SHORTLISTED' } : a
      )
    );
    toast({
      title: 'Candidate Shortlisted',
      description: `${applicant.name} has been added to your shortlist.`,
    });
  };

  const handleReject = (applicant: Applicant) => {
    setApplicants(prev =>
      prev.map(a =>
        a.id === applicant.id ? { ...a, status: 'REJECTED' } : a
      )
    );
    toast({
      title: 'Candidate Rejected',
      description: `${applicant.name} has been moved to rejected.`,
    });
  };

  // Create job
  const handleCreateJob = () => {
    const job: Job = {
      id: Date.now().toString(),
      title: newJob.title,
      department: newJob.department || undefined,
      description: newJob.description,
      requirements: newJob.requirements || undefined,
      location: newJob.location || undefined,
      status: 'OPEN',
      knockout_rules: newJob.knockout_rules
        .filter(r => r.trim())
        .map(rule => ({ rule })),
      must_have_skills: newJob.must_have_skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      nice_to_have_skills: newJob.nice_to_have_skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      total_applicants: 0,
      shortlisted_count: 0,
      created_at: new Date().toISOString(),
    };

    setJobs(prev => [job, ...prev]);
    setSelectedJobId(job.id);
    
    // Process any uploaded PDF files for this job
    if (jobPdfFiles.length > 0) {
      processFiles(jobPdfFiles);
      toast({
        title: 'Job Created with Resumes',
        description: `${job.title} created and ${jobPdfFiles.length} resume${jobPdfFiles.length > 1 ? 's' : ''} queued for processing.`,
      });
    } else {
      toast({
        title: 'Job Created',
        description: `${job.title} is now open for applications.`,
      });
    }
    
    setIsCreateJobOpen(false);
    setNewJob({
      title: '',
      department: '',
      description: '',
      requirements: '',
      location: '',
      knockout_rules: [''],
      must_have_skills: '',
      nice_to_have_skills: '',
    });
    setJobPdfFiles([]);
  };

  // Add knockout rule input
  const addKnockoutRule = () => {
    setNewJob(prev => ({
      ...prev,
      knockout_rules: [...prev.knockout_rules, ''],
    }));
  };

  // Update knockout rule
  const updateKnockoutRule = (index: number, value: string) => {
    setNewJob(prev => ({
      ...prev,
      knockout_rules: prev.knockout_rules.map((r, i) => (i === index ? value : r)),
    }));
  };

  // Remove knockout rule
  const removeKnockoutRule = (index: number) => {
    setNewJob(prev => ({
      ...prev,
      knockout_rules: prev.knockout_rules.filter((_, i) => i !== index),
    }));
  };

  // Handle job PDF file selection
  const handleJobFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length > 0) {
      setJobPdfFiles(prev => [...prev, ...pdfFiles]);
      toast({
        title: 'PDFs Added',
        description: `${pdfFiles.length} PDF file${pdfFiles.length > 1 ? 's' : ''} added for processing.`,
      });
    } else if (files.length > 0) {
      toast({
        title: 'Invalid files',
        description: 'Please upload PDF files only.',
        variant: 'destructive',
      });
    }
    
    // Reset file input
    if (e.target) e.target.value = '';
  };

  // Remove job PDF file
  const removeJobFile = (index: number) => {
    setJobPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <MainLayout>
      <Header
        title="The Rook"
        subtitle="Recruiting, Screening & Gatekeeping"
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Top Bar: Job Selector + Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Job Selector */}
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    <div className="flex items-center gap-2">
                      <span>{job.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {job.total_applicants}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Create Job Button */}
            <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Job Slot</DialogTitle>
                  <DialogDescription>
                    Define the role and set knockout rules for automatic screening.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Job Title *</Label>
                      <Input
                        placeholder="e.g., Senior React Engineer"
                        value={newJob.title}
                        onChange={e => setNewJob(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        placeholder="e.g., Engineering"
                        value={newJob.department}
                        onChange={e => setNewJob(prev => ({ ...prev, department: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      placeholder="e.g., Remote (US) or San Francisco, CA"
                      value={newJob.location}
                      onChange={e => setNewJob(prev => ({ ...prev, location: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Job Description *</Label>
                    <Textarea
                      placeholder="Describe the role, responsibilities, and what success looks like..."
                      value={newJob.description}
                      onChange={e => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Requirements</Label>
                    <Textarea
                      placeholder="List the required qualifications and experience..."
                      value={newJob.requirements}
                      onChange={e => setNewJob(prev => ({ ...prev, requirements: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Knockout Rules</Label>
                        <p className="text-xs text-muted-foreground">
                          Strict requirements. Failing any = auto-reject.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addKnockoutRule}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Rule
                      </Button>
                    </div>
                    {newJob.knockout_rules.map((rule, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="e.g., Must have 5+ years experience"
                          value={rule}
                          onChange={e => updateKnockoutRule(i, e.target.value)}
                        />
                        {newJob.knockout_rules.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeKnockoutRule(i)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Must-Have Skills</Label>
                      <Input
                        placeholder="React, TypeScript, Node.js"
                        value={newJob.must_have_skills}
                        onChange={e => setNewJob(prev => ({ ...prev, must_have_skills: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Comma separated</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Nice-to-Have Skills</Label>
                      <Input
                        placeholder="AWS, GraphQL, Postgres"
                        value={newJob.nice_to_have_skills}
                        onChange={e => setNewJob(prev => ({ ...prev, nice_to_have_skills: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Comma separated</p>
                    </div>
                  </div>

                  <Separator />

                  {/* PDF Upload Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Upload Resumes (Optional)</Label>
                        <p className="text-xs text-muted-foreground">
                          Upload PDF resumes to automatically create applicants for this job.
                        </p>
                      </div>
                      <input
                        type="file"
                        ref={jobFileInputRef}
                        className="hidden"
                        accept=".pdf"
                        multiple
                        onChange={handleJobFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => jobFileInputRef.current?.click()}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Add PDFs
                      </Button>
                    </div>
                    
                    {jobPdfFiles.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{jobPdfFiles.length} PDF file{jobPdfFiles.length > 1 ? 's' : ''} selected:</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {jobPdfFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-stone-500 shrink-0" />
                                <span className="text-sm truncate">{file.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeJobFile(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No PDFs uploaded yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload resumes to automatically create applicants
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateJobOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateJob}
                    disabled={!newJob.title || !newJob.description}
                    className="bg-gradient-to-r from-stone-600 to-stone-700 hover:from-stone-700 hover:to-stone-800"
                  >
                    <Castle className="h-4 w-4 mr-2" />
                    Create Job
                    {jobPdfFiles.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        +{jobPdfFiles.length} PDF{jobPdfFiles.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) processFiles(files);
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedJobId || isUploading}
              className="bg-gradient-to-r from-stone-600 to-stone-700 hover:from-stone-700 hover:to-stone-800"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload Resumes
            </Button>
          </div>
        </div>

        {/* Upload Drop Zone */}
        {selectedJobId && (
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-all',
              isDragOver
                ? 'border-stone-500 bg-stone-500/10'
                : 'border-muted-foreground/20 hover:border-muted-foreground/40',
              isUploading && 'pointer-events-none opacity-50'
            )}
            onDragOver={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-stone-500" />
                <p className="text-sm text-muted-foreground">Processing resumes...</p>
                <Progress value={uploadProgress} className="w-64 mx-auto" />
              </div>
            ) : (
              <>
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Drag & drop PDF resumes here</p>
                <p className="text-sm text-muted-foreground">
                  or click "Upload Resumes" to browse
                </p>
              </>
            )}
          </div>
        )}

        {/* Stats Row */}
        {currentJob && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-stone-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-stone-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Applicants</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={TIER_CONFIG.S.bgColor}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Award className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.tierS}</p>
                    <p className="text-xs text-muted-foreground">Tier S (Elite)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={TIER_CONFIG.A.bgColor}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Star className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.tierA}</p>
                    <p className="text-xs text-muted-foreground">Tier A (Strong)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.shortlisted}</p>
                    <p className="text-xs text-muted-foreground">Shortlisted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        {currentJob && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="S">Tier S (Elite)</SelectItem>
                <SelectItem value="A">Tier A (Strong)</SelectItem>
                <SelectItem value="B">Tier B (Maybe)</SelectItem>
                <SelectItem value="C">Tier C (Weak)</SelectItem>
                <SelectItem value="F">Tier F (Reject)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="REVIEWED">Reviewed</SelectItem>
                <SelectItem value="SHORTLISTED">Shortlisted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[140px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score (High→Low)</SelectItem>
                <SelectItem value="name">Name (A→Z)</SelectItem>
                <SelectItem value="date">Date (New→Old)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Candidate Leaderboard */}
        {currentJob && (
          <div className="space-y-3">
            {filteredApplicants.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">No candidates yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload resumes to start screening applicants
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredApplicants.map((applicant, index) => (
                <Card
                  key={applicant.id}
                  className={cn(
                    'transition-all hover:shadow-md cursor-pointer',
                    applicant.status === 'SHORTLISTED' && 'ring-2 ring-emerald-500/50',
                    applicant.status === 'REJECTED' && 'opacity-60'
                  )}
                  onClick={() => {
                    setSelectedApplicant(applicant);
                    setIsDossierOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="hidden sm:flex items-center justify-center w-8 text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </div>

                      {/* Score Badge */}
                      <div
                        className={cn(
                          'flex items-center justify-center w-14 h-14 rounded-xl font-bold text-lg',
                          TIER_CONFIG[applicant.tier].color
                        )}
                      >
                        {applicant.fit_score}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{applicant.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {TIER_CONFIG[applicant.tier].label}
                          </Badge>
                          {applicant.status === 'SHORTLISTED' && (
                            <Badge className="bg-emerald-500 text-xs">Shortlisted</Badge>
                          )}
                          {applicant.status === 'REJECTED' && (
                            <Badge variant="destructive" className="text-xs">Rejected</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {applicant.current_title && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {applicant.current_title}
                            </span>
                          )}
                          {applicant.current_company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {applicant.current_company}
                            </span>
                          )}
                          {applicant.location && (
                            <span className="hidden md:flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {applicant.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="hidden lg:flex items-center gap-1.5">
                        {applicant.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => handleShortlist(applicant)}
                          disabled={applicant.status === 'SHORTLISTED'}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleReject(applicant)}
                          disabled={applicant.status === 'REJECTED'}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedApplicant(applicant);
                            setIsDossierOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* No Job Selected */}
        {!currentJob && (
          <Card>
            <CardContent className="py-16 text-center">
              <Castle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Welcome to The Rook</h2>
              <p className="text-muted-foreground mb-6">
                Create a job posting to start screening candidates.
              </p>
              <Button onClick={() => setIsCreateJobOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Job
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dossier Sheet */}
      <Sheet open={isDossierOpen} onOpenChange={setIsDossierOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedApplicant && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex items-center justify-center w-16 h-16 rounded-xl font-bold text-2xl',
                      TIER_CONFIG[selectedApplicant.tier].color
                    )}
                  >
                    {selectedApplicant.fit_score}
                  </div>
                  <div className="flex-1">
                    <SheetTitle className="text-xl">{selectedApplicant.name}</SheetTitle>
                    <SheetDescription>
                      {selectedApplicant.current_title}
                      {selectedApplicant.current_company && ` at ${selectedApplicant.current_company}`}
                    </SheetDescription>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={TIER_CONFIG[selectedApplicant.tier].color}>
                        Tier {selectedApplicant.tier} - {TIER_CONFIG[selectedApplicant.tier].label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Contact
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedApplicant.email}`} className="hover:underline">
                        {selectedApplicant.email}
                      </a>
                    </div>
                    {selectedApplicant.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {selectedApplicant.phone}
                      </div>
                    )}
                    {selectedApplicant.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {selectedApplicant.location}
                      </div>
                    )}
                    {selectedApplicant.linkedin_url && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={selectedApplicant.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* The Verdict */}
                {selectedApplicant.analysis_summary.verdict && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      The Verdict
                    </h4>
                    <p className="text-sm bg-muted/50 rounded-lg p-3">
                      {selectedApplicant.analysis_summary.verdict}
                    </p>
                  </div>
                )}

                {/* Green Flags */}
                {selectedApplicant.analysis_summary.green_flags && selectedApplicant.analysis_summary.green_flags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Strengths
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedApplicant.analysis_summary.green_flags.map((flag, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Red Flags */}
                {selectedApplicant.analysis_summary.red_flags && selectedApplicant.analysis_summary.red_flags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Concerns
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedApplicant.analysis_summary.red_flags.map((flag, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Knockout Failures */}
                {selectedApplicant.analysis_summary.knockout_failures && selectedApplicant.analysis_summary.knockout_failures.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Knockout Failures
                    </h4>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <ul className="space-y-1">
                        {selectedApplicant.analysis_summary.knockout_failures.map((rule, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                            <span>•</span>
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Skills */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedApplicant.analysis_summary.skills_matched && selectedApplicant.analysis_summary.skills_matched.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Skills Matched
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedApplicant.analysis_summary.skills_matched.map(skill => (
                          <Badge key={skill} className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedApplicant.analysis_summary.skills_missing && selectedApplicant.analysis_summary.skills_missing.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Skills Missing
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedApplicant.analysis_summary.skills_missing.map(skill => (
                          <Badge key={skill} variant="outline" className="text-muted-foreground">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Interview Questions */}
                {selectedApplicant.analysis_summary.interview_questions && selectedApplicant.analysis_summary.interview_questions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Interrogation Sheet
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                      {selectedApplicant.analysis_summary.interview_questions.map((q, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-bold text-stone-500">{i + 1}.</span>
                          <p className="text-sm">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Quick Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApplicant.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      handleShortlist(selectedApplicant);
                      setIsDossierOpen(false);
                    }}
                    disabled={selectedApplicant.status === 'SHORTLISTED'}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Shortlist
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      handleReject(selectedApplicant);
                      setIsDossierOpen(false);
                    }}
                    disabled={selectedApplicant.status === 'REJECTED'}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}

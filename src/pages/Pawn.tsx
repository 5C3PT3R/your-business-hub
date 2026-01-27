/**
 * Pawn (Scout) - Intelligence & Reconnaissance Dashboard
 *
 * Two Modes:
 * - Dragnet: Lead generation from search criteria
 * - Dossier: Deep enrichment of specific domains
 *
 * UI Components:
 * - Mission Control (left): Form inputs and deploy button
 * - Terminal Feed (center): Real-time execution logs
 * - Staging Area (bottom): Found targets ready to promote
 */

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ScanSearch,
  Radar,
  Target,
  FileText,
  Rocket,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Trash2,
  Users,
  Building2,
  Mail,
  Signal,
  History,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  X,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types
interface ScoutMission {
  id: string;
  name: string;
  mission_type: 'dragnet' | 'dossier';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  targets_found: number;
  targets_verified: number;
  targets_promoted: number;
  created_at: string;
}

interface ScoutTarget {
  id: string;
  name: string;
  email: string;
  company: string;
  domain: string;
  role: string;
  email_confidence: number;
  email_status: 'unverified' | 'valid' | 'risky' | 'invalid';
  signal_strength: number;
  icebreaker_context?: string;
  selected?: boolean;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  prefix?: string;
}

// Mock data for demo
const MOCK_TARGETS: ScoutTarget[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@techcorp.io',
    company: 'TechCorp',
    domain: 'techcorp.io',
    role: 'CEO',
    email_confidence: 95,
    email_status: 'valid',
    signal_strength: 87,
    icebreaker_context: 'Just raised $12M Series A, expanding sales team',
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    email: 'marcus.j@saasly.com',
    company: 'SaaSly',
    domain: 'saasly.com',
    role: 'VP Sales',
    email_confidence: 78,
    email_status: 'risky',
    signal_strength: 72,
    icebreaker_context: 'Launched new enterprise product last month',
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    email: 'emily@dataflow.ai',
    company: 'DataFlow AI',
    domain: 'dataflow.ai',
    role: 'Founder',
    email_confidence: 92,
    email_status: 'valid',
    signal_strength: 91,
    icebreaker_context: 'Featured in TechCrunch for AI innovation',
  },
];

const INDUSTRIES = [
  'B2B SaaS',
  'FinTech',
  'HealthTech',
  'E-Commerce',
  'MarTech',
  'EdTech',
  'Cybersecurity',
  'AI/ML',
  'Other',
];

const ROLES = [
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'VP Sales',
  'VP Marketing',
  'VP Engineering',
  'Head of Growth',
  'Director of Sales',
  'Director of Marketing',
  'Founder',
  'Co-Founder',
];

const LOCATIONS = [
  'San Francisco, CA',
  'New York, NY',
  'Austin, TX',
  'Los Angeles, CA',
  'Seattle, WA',
  'Boston, MA',
  'Chicago, IL',
  'Denver, CO',
  'Miami, FL',
  'Atlanta, GA',
  'London, UK',
  'Toronto, Canada',
  'Remote / Global',
];

export default function Pawn() {
  const { user } = useAuth();
  const { addLead } = useLeads();
  const { toast } = useToast();

  // Mission Control State
  const [missionType, setMissionType] = useState<'dragnet' | 'dossier'>('dragnet');
  const [missionName, setMissionName] = useState('');
  const [targetRoles, setTargetRoles] = useState<Set<string>>(new Set());
  const [targetIndustries, setTargetIndustries] = useState<Set<string>>(new Set());
  const [targetLocations, setTargetLocations] = useState<Set<string>>(new Set());
  const [targetDomains, setTargetDomains] = useState('');

  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Staging Area State
  const [targets, setTargets] = useState<ScoutTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());

  // Mission History
  const [missions, setMissions] = useState<ScoutMission[]>([]);

  // Auto-scroll logs within the terminal container only
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Add log entry
  const addLog = (level: LogEntry['level'], message: string, prefix?: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { timestamp, level, message, prefix }]);
  };

  // Simulate mission execution
  const deployScouts = async () => {
    if (!missionName) {
      addLog('error', 'Mission name is required', 'System');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setLogs([]);
    setTargets([]);

    // Simulate execution
    addLog('info', `Initializing mission: ${missionName}`, 'System');

    await simulateDelay(500);
    addLog('info', `Mode: ${missionType.toUpperCase()}`, 'Config');

    if (missionType === 'dragnet') {
      const rolesStr = targetRoles.size > 0 ? Array.from(targetRoles).join(', ') : 'Any';
      const industriesStr = targetIndustries.size > 0 ? Array.from(targetIndustries).join(', ') : 'Any';
      const locationsStr = targetLocations.size > 0 ? Array.from(targetLocations).join(', ') : 'Global';
      addLog('info', `Target Roles: ${rolesStr}`, 'Config');
      addLog('info', `Industries: ${industriesStr}`, 'Config');
      addLog('info', `Locations: ${locationsStr}`, 'Config');
    } else {
      const domains = targetDomains.split('\n').filter(d => d.trim());
      addLog('info', `Domains to scan: ${domains.length}`, 'Config');
    }

    await simulateDelay(800);
    setProgress(10);
    addLog('success', 'Mission parameters validated', 'System');

    // Simulate scanning
    addLog('info', 'Deploying scout agents...', 'System');
    await simulateDelay(600);
    setProgress(20);

    const scanDomains = missionType === 'dossier'
      ? targetDomains.split('\n').filter(d => d.trim())
      : ['techcorp.io', 'saasly.com', 'dataflow.ai'];

    for (let i = 0; i < scanDomains.length; i++) {
      const domain = scanDomains[i] || `target-${i + 1}.com`;
      addLog('info', `Scanning ${domain}...`, `Scout-${i + 1}`);
      await simulateDelay(400);

      addLog('info', `Extracting leadership data...`, `Scout-${i + 1}`);
      await simulateDelay(300);

      const mockTarget = MOCK_TARGETS[i % MOCK_TARGETS.length];
      addLog('success', `Target identified: ${mockTarget.name}`, `Scout-${i + 1}`);
      await simulateDelay(200);

      // Gate 1: Email verification
      addLog('info', `Verifying email...`, 'Gate-1');
      await simulateDelay(300);
      if (mockTarget.email_confidence >= 70) {
        addLog('success', `Email verified (${mockTarget.email_confidence}% confidence)`, 'Gate-1');
      } else {
        addLog('warning', `Low confidence (${mockTarget.email_confidence}%)`, 'Gate-1');
      }

      // Gate 2: News check
      addLog('info', `Checking recent news...`, 'Gate-2');
      await simulateDelay(400);
      if (mockTarget.icebreaker_context) {
        addLog('success', `Signal found: "${mockTarget.icebreaker_context}"`, 'Gate-2');
      } else {
        addLog('warning', 'No recent signals detected', 'Gate-2');
      }

      // Gate 3: LLM synthesis
      addLog('info', `Synthesizing intelligence...`, 'Gate-3');
      await simulateDelay(500);
      addLog('success', `Icebreaker generated`, 'Gate-3');

      setProgress(20 + ((i + 1) / scanDomains.length) * 70);
    }

    // Finalize
    await simulateDelay(500);
    setProgress(95);
    addLog('info', 'Compiling results...', 'System');

    await simulateDelay(300);
    setTargets(MOCK_TARGETS.map((t, i) => ({ ...t, id: `${Date.now()}-${i}` })));
    setProgress(100);
    addLog('success', `Mission complete! Found ${MOCK_TARGETS.length} targets.`, 'System');

    setIsRunning(false);
  };

  const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Toggle target selection
  const toggleTarget = (id: string) => {
    setSelectedTargets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all targets
  const toggleAllTargets = () => {
    if (selectedTargets.size === targets.length) {
      setSelectedTargets(new Set());
    } else {
      setSelectedTargets(new Set(targets.map(t => t.id)));
    }
  };

  // Promote selected to leads
  const promoteToBoard = async () => {
    const selectedList = targets.filter(t => selectedTargets.has(t.id));
    const count = selectedList.length;

    if (count === 0) return;

    addLog('info', `Promoting ${count} targets to Board...`, 'System');

    let successCount = 0;
    let failCount = 0;

    for (const target of selectedList) {
      const lead = await addLead({
        name: target.name,
        email: target.email,
        phone: null,
        company: target.company,
        source: 'Pawn Scout',
        status: 'new',
        value: 0,
      });

      if (lead) {
        successCount++;
        addLog('success', `Added: ${target.name} (${target.company})`, 'Promote');
      } else {
        failCount++;
        addLog('error', `Failed: ${target.name}`, 'Promote');
      }
    }

    // Remove promoted targets from staging
    setTargets(prev => prev.filter(t => !selectedTargets.has(t.id)));
    setSelectedTargets(new Set());

    if (successCount > 0) {
      addLog('success', `${successCount} leads added to Bishop's queue!`, 'System');
      toast({
        title: 'Targets Promoted',
        description: `${successCount} lead${successCount === 1 ? '' : 's'} added to your pipeline.`,
      });
    }

    if (failCount > 0) {
      addLog('warning', `${failCount} targets failed to promote`, 'System');
    }
  };

  // Discard selected
  const discardSelected = () => {
    const count = selectedTargets.size;
    setTargets(prev => prev.filter(t => !selectedTargets.has(t.id)));
    setSelectedTargets(new Set());
    addLog('info', `Discarded ${count} targets`, 'System');
  };

  // Get signal badge color
  const getSignalBadge = (strength: number) => {
    if (strength >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (strength >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  };

  // Get email status badge
  const getEmailBadge = (status: ScoutTarget['email_status'], confidence: number) => {
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {confidence}%
          </Badge>
        );
      case 'risky':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {confidence}%
          </Badge>
        );
      case 'invalid':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Invalid
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Unverified
          </Badge>
        );
    }
  };

  return (
    <MainLayout>
      <Header
        title="The Pawn"
        subtitle="Intelligence, Reconnaissance & Data Enrichment"
        icon={<ScanSearch className="h-6 w-6 text-amber-500" />}
      />

      <div className="p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT PANEL: Mission Control */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radar className="h-5 w-5 text-amber-500" />
                Mission Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={missionType} onValueChange={(v) => setMissionType(v as 'dragnet' | 'dossier')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dragnet" className="gap-1">
                    <Target className="h-4 w-4" />
                    Dragnet
                  </TabsTrigger>
                  <TabsTrigger value="dossier" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Dossier
                  </TabsTrigger>
                </TabsList>

                <div className="mt-4 space-y-4">
                  {/* Mission Name */}
                  <div className="space-y-2">
                    <Label>Mission Name</Label>
                    <Input
                      placeholder="e.g., Austin SaaS Scan"
                      value={missionName}
                      onChange={(e) => setMissionName(e.target.value)}
                    />
                  </div>

                  <TabsContent value="dragnet" className="mt-0 space-y-4">
                    {/* Target Roles - Multi-select */}
                    <div className="space-y-2">
                      <Label>Target Roles</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            {targetRoles.size > 0 ? (
                              <span className="truncate">
                                {targetRoles.size} role{targetRoles.size > 1 ? 's' : ''} selected
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Select roles...</span>
                            )}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-2" align="start">
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {ROLES.map((role) => (
                              <div
                                key={role}
                                className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                                onClick={() => {
                                  setTargetRoles(prev => {
                                    const next = new Set(prev);
                                    if (next.has(role)) {
                                      next.delete(role);
                                    } else {
                                      next.add(role);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <Checkbox checked={targetRoles.has(role)} />
                                <span className="text-sm">{role}</span>
                              </div>
                            ))}
                          </div>
                          {targetRoles.size > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => setTargetRoles(new Set())}
                            >
                              Clear all
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      {/* Selected chips */}
                      {targetRoles.size > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Array.from(targetRoles).map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className="gap-1 cursor-pointer hover:bg-destructive/20"
                              onClick={() => {
                                setTargetRoles(prev => {
                                  const next = new Set(prev);
                                  next.delete(role);
                                  return next;
                                });
                              }}
                            >
                              {role}
                              <X className="h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Target Industries - Multi-select */}
                    <div className="space-y-2">
                      <Label>Target Industries</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            {targetIndustries.size > 0 ? (
                              <span className="truncate">
                                {targetIndustries.size} industr{targetIndustries.size > 1 ? 'ies' : 'y'} selected
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Select industries...</span>
                            )}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-2" align="start">
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {INDUSTRIES.map((industry) => (
                              <div
                                key={industry}
                                className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                                onClick={() => {
                                  setTargetIndustries(prev => {
                                    const next = new Set(prev);
                                    if (next.has(industry)) {
                                      next.delete(industry);
                                    } else {
                                      next.add(industry);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <Checkbox checked={targetIndustries.has(industry)} />
                                <span className="text-sm">{industry}</span>
                              </div>
                            ))}
                          </div>
                          {targetIndustries.size > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => setTargetIndustries(new Set())}
                            >
                              Clear all
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      {/* Selected chips */}
                      {targetIndustries.size > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Array.from(targetIndustries).map((industry) => (
                            <Badge
                              key={industry}
                              variant="secondary"
                              className="gap-1 cursor-pointer hover:bg-destructive/20"
                              onClick={() => {
                                setTargetIndustries(prev => {
                                  const next = new Set(prev);
                                  next.delete(industry);
                                  return next;
                                });
                              }}
                            >
                              {industry}
                              <X className="h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Target Locations - Multi-select */}
                    <div className="space-y-2">
                      <Label>Target Locations</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            {targetLocations.size > 0 ? (
                              <span className="truncate">
                                {targetLocations.size} location{targetLocations.size > 1 ? 's' : ''} selected
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Select locations...</span>
                            )}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-2" align="start">
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {LOCATIONS.map((location) => (
                              <div
                                key={location}
                                className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                                onClick={() => {
                                  setTargetLocations(prev => {
                                    const next = new Set(prev);
                                    if (next.has(location)) {
                                      next.delete(location);
                                    } else {
                                      next.add(location);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <Checkbox checked={targetLocations.has(location)} />
                                <span className="text-sm">{location}</span>
                              </div>
                            ))}
                          </div>
                          {targetLocations.size > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => setTargetLocations(new Set())}
                            >
                              Clear all
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      {/* Selected chips */}
                      {targetLocations.size > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Array.from(targetLocations).map((location) => (
                            <Badge
                              key={location}
                              variant="secondary"
                              className="gap-1 cursor-pointer hover:bg-destructive/20"
                              onClick={() => {
                                setTargetLocations(prev => {
                                  const next = new Set(prev);
                                  next.delete(location);
                                  return next;
                                });
                              }}
                            >
                              <MapPin className="h-3 w-3" />
                              {location}
                              <X className="h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="dossier" className="mt-0 space-y-4">
                    {/* Domains Input */}
                    <div className="space-y-2">
                      <Label>Target Domains</Label>
                      <Textarea
                        placeholder="stripe.com&#10;airbnb.com&#10;notion.so"
                        value={targetDomains}
                        onChange={(e) => setTargetDomains(e.target.value)}
                        rows={6}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        One domain per line
                      </p>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>

              {/* Deploy Button */}
              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                size="lg"
                onClick={deployScouts}
                disabled={isRunning || !missionName}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Rocket className="h-5 w-5 mr-2" />
                    DEPLOY SCOUTS
                  </>
                )}
              </Button>

              {/* Progress Bar */}
              {isRunning && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {progress}% complete
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CENTER: Terminal Feed */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-emerald-500" />
                  Live Feed
                </span>
                {logs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogs([])}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={logsContainerRef}
                className="bg-[#0a0a0f] rounded-lg p-4 h-[300px] overflow-y-auto font-mono text-sm"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500">
                    <span className="animate-pulse">Awaiting mission deployment...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="flex">
                        <span className="text-zinc-600 mr-2">{log.timestamp}</span>
                        {log.prefix && (
                          <span className={cn(
                            'mr-2',
                            log.prefix.startsWith('Scout') && 'text-blue-400',
                            log.prefix.startsWith('Gate') && 'text-purple-400',
                            log.prefix === 'System' && 'text-zinc-400',
                            log.prefix === 'Config' && 'text-cyan-400'
                          )}>
                            [{log.prefix}]
                          </span>
                        )}
                        <span className={cn(
                          log.level === 'info' && 'text-zinc-300',
                          log.level === 'success' && 'text-emerald-400',
                          log.level === 'warning' && 'text-amber-400',
                          log.level === 'error' && 'text-red-400'
                        )}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* BOTTOM: Staging Area */}
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-amber-500" />
                Staging Area
                {targets.length > 0 && (
                  <Badge variant="secondary">{targets.length} targets</Badge>
                )}
              </CardTitle>

              {selectedTargets.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedTargets.size} selected</Badge>
                  <Button
                    size="sm"
                    onClick={promoteToBoard}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Promote to Board
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={discardSelected}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Discard
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {targets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Target className="h-8 w-8 mb-2" />
                <p className="text-sm">No targets in staging</p>
                <p className="text-xs">Deploy a mission to find leads</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedTargets.size === targets.length}
                        onCheckedChange={toggleAllTargets}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((target) => (
                    <TableRow key={target.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTargets.has(target.id)}
                          onCheckedChange={() => toggleTarget(target.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{target.name}</p>
                          <p className="text-xs text-muted-foreground">{target.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {target.company}
                        </div>
                      </TableCell>
                      <TableCell>{target.role}</TableCell>
                      <TableCell>
                        {getEmailBadge(target.email_status, target.email_confidence)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getSignalBadge(target.signal_strength)}>
                          <Signal className="h-3 w-3 mr-1" />
                          {target.signal_strength}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate" title={target.icebreaker_context}>
                          {target.icebreaker_context || '-'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

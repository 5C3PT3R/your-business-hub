import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Bell, Shield, CreditCard, Users, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    timezone: 'est',
    company: '',
  });
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    dealUpdates: true,
    newLeads: true,
    taskReminders: true,
    weeklyDigest: false,
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    if (data) {
      const nameParts = (data.full_name || '').split(' ');
      setProfile({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: data.email || user.email || '',
        phone: '',
        timezone: 'est',
        company: data.company || '',
      });
    } else {
      setProfile(prev => ({
        ...prev,
        email: user.email || '',
      }));
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName,
        email: profile.email,
        company: profile.company,
      });
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match.",
        variant: "destructive",
      });
      return;
    }
    
    if (passwords.new.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: passwords.new,
    });
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error updating password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated",
        description: "Your password has been changed.",
      });
      setPasswords({ current: '', new: '', confirm: '' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const initials = `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase() || 'U';

  return (
    <MainLayout>
      <Header
        title="Settings"
        subtitle="Manage your account and preferences"
      />
      
      <div className="p-6 max-w-4xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="animate-fade-in">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="animate-slide-up">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Profile Information</h3>
                <p className="text-sm text-muted-foreground">Update your personal details</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full gradient-primary text-primary-foreground text-2xl font-semibold">
                  {initials}
                </div>
                <Button variant="outline">Change Photo</Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input 
                    id="firstName" 
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone" 
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input 
                    id="company" 
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={profile.timezone} onValueChange={(value) => setProfile({ ...profile, timezone: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                      <SelectItem value="mst">Mountain Time (MT)</SelectItem>
                      <SelectItem value="cst">Central Time (CT)</SelectItem>
                      <SelectItem value="est">Eastern Time (ET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
                <Button variant="gradient" onClick={handleSaveProfile} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="animate-slide-up">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
                <p className="text-sm text-muted-foreground">Manage how you receive notifications</p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email notifications', description: 'Receive email updates for important events' },
                  { key: 'push', label: 'Push notifications', description: 'Get push notifications on your devices' },
                  { key: 'dealUpdates', label: 'Deal updates', description: 'Notify when deals progress through stages' },
                  { key: 'newLeads', label: 'New leads', description: 'Alert when new leads are assigned to you' },
                  { key: 'taskReminders', label: 'Task reminders', description: 'Send reminders for upcoming tasks' },
                  { key: 'weeklyDigest', label: 'Weekly digest', description: 'Receive a weekly summary report' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch 
                      checked={notifications[item.key as keyof typeof notifications]}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })}
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end">
                <Button variant="gradient" onClick={() => toast({ title: "Preferences saved", description: "Your notification preferences have been updated." })}>
                  Save Preferences
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="animate-slide-up">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Security Settings</h3>
                <p className="text-sm text-muted-foreground">Manage your account security</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword" 
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Button variant="outline" onClick={() => toast({ title: "Coming soon", description: "Two-factor authentication will be available soon." })}>
                  Enable
                </Button>
              </div>

              <div className="flex justify-end">
                <Button variant="gradient" onClick={handleUpdatePassword} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="animate-slide-up">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
                  <p className="text-sm text-muted-foreground">Manage your team access</p>
                </div>
                <Button variant="gradient" onClick={() => toast({ title: "Coming soon", description: "Team invitations will be available soon." })}>
                  Invite Member
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                      {initials}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{profile.firstName} {profile.lastName}</p>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Admin</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">You</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="animate-slide-up">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Billing & Subscription</h3>
                <p className="text-sm text-muted-foreground">Manage your subscription and payment methods</p>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">Free Plan</p>
                    <p className="text-sm text-muted-foreground">Current plan</p>
                  </div>
                  <Button variant="outline" onClick={() => toast({ title: "Coming soon", description: "Upgrade options will be available soon." })}>
                    Upgrade
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Payment Method</h4>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-14 items-center justify-center rounded bg-muted">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">No payment method</p>
                      <p className="text-sm text-muted-foreground">Add a card to upgrade</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toast({ title: "Coming soon", description: "Payment methods will be available soon." })}>
                    Add Card
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Globe, Plus, Check, X, AlertCircle } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['click', 'link_created']);
  const [newDomain, setNewDomain] = useState('');

  const { data: domains } = useQuery({
    queryKey: ['domains', user?.userId],
    queryFn: () => backend.domains.listDomains({ userId: user!.userId }),
    enabled: !!user,
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { url: string; events: string[] }) =>
      backend.integrations.createWebhook({
        userId: user!.userId,
        url: data.url,
        events: data.events,
        active: true
      }),
    onSuccess: () => {
      setWebhookUrl('');
      setWebhookEvents(['click', 'link_created']);
      toast({
        title: "Success",
        description: "Webhook created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Create webhook error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create webhook.",
        variant: "destructive",
      });
    },
  });

  const createDomainMutation = useMutation({
    mutationFn: (domain: string) =>
      backend.domains.createDomain({
        userId: user!.userId,
        domain,
        isDefault: false,
        sslEnabled: true
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      setNewDomain('');
      toast({
        title: "Success",
        description: `Domain ${data.domain} added successfully. Please verify it using the provided code.`,
      });
    },
    onError: (error: any) => {
      console.error('Create domain error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add domain.",
        variant: "destructive",
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: (domainId: string) =>
      backend.domains.verifyDomain({
        domainId,
        userId: user!.userId
      }),
    onSuccess: (data, domainId) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast({
        title: data.success ? "Success" : "Verification Failed",
        description: data.success 
          ? "Domain verified successfully!" 
          : "Domain verification failed. Please check your DNS settings.",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      console.error('Verify domain error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify domain.",
        variant: "destructive",
      });
    },
  });

  const handleCreateWebhook = () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL.",
        variant: "destructive",
      });
      return;
    }

    if (webhookEvents.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one event.",
        variant: "destructive",
      });
      return;
    }

    createWebhookMutation.mutate({
      url: webhookUrl.trim(),
      events: webhookEvents
    });
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a domain name.",
        variant: "destructive",
      });
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    if (!domainRegex.test(newDomain.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid domain name.",
        variant: "destructive",
      });
      return;
    }

    createDomainMutation.mutate(newDomain.trim());
  };

  const toggleEvent = (event: string) => {
    if (webhookEvents.includes(event)) {
      setWebhookEvents(webhookEvents.filter(e => e !== event));
    } else {
      setWebhookEvents([...webhookEvents, event]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const availableEvents = [
    { id: 'click', name: 'Link Clicked', description: 'Triggered when a link is clicked' },
    { id: 'link_created', name: 'Link Created', description: 'Triggered when a new link is created' },
    { id: 'campaign_created', name: 'Campaign Created', description: 'Triggered when a new campaign is created' },
    { id: 'link_updated', name: 'Link Updated', description: 'Triggered when a link is updated' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure your account preferences, custom domains, and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input value={user?.email || ''} disabled />
            </div>
            
            <div>
              <Label>User ID</Label>
              <Input value={user?.userId || ''} disabled />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-gray-600">Receive email updates about your campaigns</p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Weekly Reports</Label>
                <p className="text-sm text-gray-600">Get weekly performance summaries</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Settings</CardTitle>
            <CardDescription>
              Configure API access and rate limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>API Key</Label>
              <div className="flex space-x-2">
                <Input value="••••••••••••••••" disabled />
                <Button variant="outline">Regenerate</Button>
              </div>
            </div>
            
            <div>
              <Label>Rate Limit</Label>
              <Select defaultValue="1000">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 requests/hour</SelectItem>
                  <SelectItem value="500">500 requests/hour</SelectItem>
                  <SelectItem value="1000">1,000 requests/hour</SelectItem>
                  <SelectItem value="5000">5,000 requests/hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>API Access</Label>
                <p className="text-sm text-gray-600">Enable API access for your account</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Custom Domains
            </CardTitle>
            <CardDescription>
              Add your own domains for link redirection and better branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex space-x-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1"
              />
              <Button
                onClick={handleAddDomain}
                disabled={createDomainMutation.isPending}
              >
                {createDomainMutation.isPending ? 'Adding...' : 'Add Domain'}
              </Button>
            </div>

            {domains?.domains.length ? (
              <div className="space-y-3">
                {domains.domains.map((domain) => (
                  <div key={domain.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{domain.domain}</span>
                        <Badge className={getStatusColor(domain.status)}>
                          {getStatusIcon(domain.status)}
                          <span className="ml-1">{domain.status}</span>
                        </Badge>
                        {domain.isDefault && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>
                      {domain.status === 'pending' && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                          <p className="font-medium text-yellow-800">Verification Required</p>
                          <p className="text-yellow-700">
                            Add this TXT record to your DNS:
                          </p>
                          <code className="block mt-1 p-1 bg-yellow-100 rounded text-xs">
                            {domain.verificationCode}
                          </code>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {domain.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyDomainMutation.mutate(domain.id)}
                          disabled={verifyDomainMutation.isPending}
                        >
                          {verifyDomainMutation.isPending ? 'Verifying...' : 'Verify'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No custom domains added yet</p>
                <p className="text-sm text-gray-400">Add your first domain to get started with custom branding</p>
              </div>
            )}

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Domain Setup Instructions</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Add your domain above</li>
                <li>2. Add the verification TXT record to your DNS</li>
                <li>3. Click "Verify" to activate the domain</li>
                <li>4. Point your domain's A record to our servers (provided after verification)</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Webhook Integration</CardTitle>
            <CardDescription>
              Set up webhooks to receive real-time notifications about events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/webhook"
                  />
                </div>
                
                <div>
                  <Label>Events to Subscribe</Label>
                  <div className="space-y-2 mt-2">
                    {availableEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{event.name}</div>
                          <div className="text-sm text-gray-600">{event.description}</div>
                        </div>
                        <Switch
                          checked={webhookEvents.includes(event.id)}
                          onCheckedChange={() => toggleEvent(event.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={handleCreateWebhook}
                  disabled={createWebhookMutation.isPending}
                  className="w-full"
                >
                  {createWebhookMutation.isPending ? 'Creating...' : 'Create Webhook'}
                </Button>
              </div>
              
              <div>
                <Label>Webhook Payload Example</Label>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
{`{
  "event": "click",
  "data": {
    "linkId": "link_123",
    "shortUrl": "https://9qr.de/abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1",
    "geoLocation": "London, UK"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "webhook_id": "webhook_456"
}`}
                  </pre>
                </div>
                
                <div className="mt-4">
                  <Label>Security</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Webhooks include an X-Webhook-Secret header for verification. 
                    Store this secret securely and validate incoming requests.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>
              Export your data for backup or analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex-col">
                <span className="font-medium">Export Links</span>
                <span className="text-sm text-gray-600">All your affiliate links</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex-col">
                <span className="font-medium">Export Analytics</span>
                <span className="text-sm text-gray-600">Click data and statistics</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex-col">
                <span className="font-medium">Export All Data</span>
                <span className="text-sm text-gray-600">Complete data export</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
              <div>
                <div className="font-medium text-red-900">Delete All Links</div>
                <div className="text-sm text-red-600">Permanently delete all your affiliate links</div>
              </div>
              <Button variant="destructive" size="sm">
                Delete Links
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
              <div>
                <div className="font-medium text-red-900">Delete Account</div>
                <div className="text-sm text-red-600">Permanently delete your account and all data</div>
              </div>
              <Button variant="destructive" size="sm">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

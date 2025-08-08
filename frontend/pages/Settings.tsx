import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function Settings() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['click', 'link_created']);

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

  const toggleEvent = (event: string) => {
    if (webhookEvents.includes(event)) {
      setWebhookEvents(webhookEvents.filter(e => e !== event));
    } else {
      setWebhookEvents([...webhookEvents, event]);
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
          Configure your account preferences and integrations
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

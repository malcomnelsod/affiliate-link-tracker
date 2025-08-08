import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Plus, Shield, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LinkGenerator() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rawUrl, setRawUrl] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('default');
  const [enableCloaking, setEnableCloaking] = useState(true);
  const [customAlias, setCustomAlias] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', user?.userId],
    queryFn: () => backend.campaigns.list({ userId: user!.userId }),
    enabled: !!user,
  });

  const { data: domains } = useQuery({
    queryKey: ['domains', user?.userId],
    queryFn: () => backend.domains.listDomains({ userId: user!.userId }),
    enabled: !!user,
  });

  const { data: links } = useQuery({
    queryKey: ['links', user?.userId],
    queryFn: () => backend.links.list({ userId: user!.userId, limit: 10 }),
    enabled: !!user,
  });

  const createCampaignMutation = useMutation({
    mutationFn: (name: string) => backend.campaigns.create({ name, userId: user!.userId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setSelectedCampaign(data.id);
      setNewCampaignName('');
      setShowNewCampaign(false);
      toast({
        title: "Success",
        description: "Campaign created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Create campaign error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign.",
        variant: "destructive",
      });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: (data: { 
      rawUrl: string; 
      campaignId: string; 
      userId: string; 
      customDomain?: string;
      enableCloaking: boolean;
      customAlias?: string;
    }) => backend.links.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      setRawUrl('');
      setCustomAlias('');
      toast({
        title: "Success",
        description: "Link generated successfully with cloaking protection.",
      });
    },
    onError: (error: any) => {
      console.error('Create link error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate link.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCampaign = () => {
    if (!newCampaignName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a campaign name.",
        variant: "destructive",
      });
      return;
    }
    createCampaignMutation.mutate(newCampaignName.trim());
  };

  const handleGenerateLink = () => {
    if (!rawUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCampaign) {
      toast({
        title: "Error",
        description: "Please select a campaign.",
        variant: "destructive",
      });
      return;
    }

    const selectedDomainData = domains?.domains.find(d => d.id === selectedDomain);

    createLinkMutation.mutate({
      rawUrl: rawUrl.trim(),
      campaignId: selectedCampaign,
      userId: user!.userId,
      customDomain: selectedDomainData?.domain,
      enableCloaking,
      customAlias: customAlias.trim() || undefined,
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Link copied to clipboard.",
      });
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
          title: "Copied",
          description: "Link copied to clipboard.",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to copy link. Please copy manually.",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const testRedirect = (url: string) => {
    // Open in new tab to test redirect
    window.open(url, '_blank');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Please log in to generate links.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Link Generator</h1>
        <p className="text-gray-600 mt-2">
          Generate trackable affiliate links with advanced cloaking and custom domains
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate New Link</CardTitle>
            <CardDescription>
              Create a trackable affiliate link with anti-detection features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="rawUrl">Affiliate URL</Label>
              <Input
                id="rawUrl"
                type="url"
                value={rawUrl}
                onChange={(e) => setRawUrl(e.target.value)}
                placeholder="https://example.com/affiliate-link"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="campaign">Campaign</Label>
              <div className="flex space-x-2 mt-1">
                {campaignsLoading ? (
                  <div className="flex-1 flex items-center justify-center py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                ) : campaigns?.campaigns.length ? (
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex-1 text-center py-2 text-gray-500">
                    No campaigns available
                  </div>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewCampaign(!showNewCampaign)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showNewCampaign && (
              <div className="flex space-x-2">
                <Input
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="New campaign name"
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateCampaign}
                  disabled={createCampaignMutation.isPending}
                >
                  {createCampaignMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            )}

            <div>
              <Label htmlFor="domain">Custom Domain (Optional)</Label>
              <div className="flex space-x-2 mt-1">
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Use default domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Domain</SelectItem>
                    {domains?.domains.filter(d => d.status === 'active').map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.domain} {domain.isDefault && '(Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link to="/settings">
                  <Button variant="outline" size="icon">
                    <Globe className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div>
              <Label htmlFor="customAlias">Custom Alias (Optional)</Label>
              <Input
                id="customAlias"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                placeholder="my-custom-link"
                className="mt-1"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableCloaking"
                checked={enableCloaking}
                onCheckedChange={(checked) => setEnableCloaking(checked as boolean)}
              />
              <Label htmlFor="enableCloaking" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Enable Advanced Cloaking</span>
              </Label>
            </div>

            {enableCloaking && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Cloaking Features:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• Bot detection and filtering</li>
                  <li>• JavaScript-based redirects</li>
                  <li>• User agent rotation</li>
                  <li>• Referrer spoofing</li>
                  <li>• Random redirect delays</li>
                </ul>
              </div>
            )}

            {!campaignsLoading && !campaigns?.campaigns.length && !showNewCampaign && (
              <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-2">No campaigns found</p>
                <Link to="/campaign-manager">
                  <Button variant="outline" size="sm">
                    Create Your First Campaign
                  </Button>
                </Link>
              </div>
            )}

            <Button
              onClick={handleGenerateLink}
              disabled={createLinkMutation.isPending || !selectedCampaign}
              className="w-full"
            >
              {createLinkMutation.isPending ? 'Generating...' : 'Generate Protected Link'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Links</CardTitle>
            <CardDescription>
              Your recently generated affiliate links
            </CardDescription>
          </CardHeader>
          <CardContent>
            {links?.links.length ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {links.links.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 bg-gray-50 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate flex-1">
                        {link.shortUrl}
                      </p>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(link.shortUrl)}
                          title="Copy short URL"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(link.cloakedUrl)}
                          title="Copy cloaked URL"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testRedirect(link.cloakedUrl)}
                          title="Test redirect"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {link.enableCloaking && (
                      <div className="flex items-center space-x-1">
                        <Shield className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">Cloaked</span>
                      </div>
                    )}
                    
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><strong>Short:</strong> {link.shortUrl}</p>
                      <p><strong>Cloaked:</strong> {link.cloakedUrl}</p>
                      <p className="truncate"><strong>Original:</strong> {link.rawUrl}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{link.clickCount || 0} clicks</span>
                      <span>Created {new Date(link.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No links generated yet. Create your first link above.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

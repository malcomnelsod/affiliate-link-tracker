import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Plus } from 'lucide-react';

export default function LinkGenerator() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rawUrl, setRawUrl] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', user?.userId],
    queryFn: () => backend.campaigns.list({ userId: user!.userId }),
    enabled: !!user,
  });

  const { data: links } = useQuery({
    queryKey: ['links', user?.userId],
    queryFn: () => backend.links.list({ userId: user!.userId }),
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
    mutationFn: (data: { rawUrl: string; campaignId: string; userId: string }) =>
      backend.links.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      setRawUrl('');
      toast({
        title: "Success",
        description: "Link generated successfully.",
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
    if (!newCampaignName.trim()) return;
    createCampaignMutation.mutate(newCampaignName);
  };

  const handleGenerateLink = () => {
    if (!rawUrl.trim() || !selectedCampaign) {
      toast({
        title: "Error",
        description: "Please enter a URL and select a campaign.",
        variant: "destructive",
      });
      return;
    }

    createLinkMutation.mutate({
      rawUrl,
      campaignId: selectedCampaign,
      userId: user!.userId,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Link copied to clipboard.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Link Generator</h1>
        <p className="text-gray-600 mt-2">
          Generate trackable affiliate links with spam bypass features
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate New Link</CardTitle>
            <CardDescription>
              Create a trackable affiliate link for your campaigns
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
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns?.campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  Create
                </Button>
              </div>
            )}

            <Button
              onClick={handleGenerateLink}
              disabled={createLinkMutation.isPending}
              className="w-full"
            >
              {createLinkMutation.isPending ? 'Generating...' : 'Generate Link'}
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
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(link.shortUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {link.rawUrl}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(link.createdAt).toLocaleDateString()}
                    </p>
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

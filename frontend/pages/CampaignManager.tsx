import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Search, Filter, BarChart3, Link as LinkIcon } from 'lucide-react';

export default function CampaignManager() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ['campaigns', user?.userId, search, statusFilter, page],
    queryFn: async () => {
      console.log('Fetching campaigns for user:', user?.userId);
      const result = await backend.campaigns.list({ 
        userId: user!.userId,
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20
      });
      console.log('Campaigns fetched:', result);
      return result;
    },
    enabled: !!user,
    retry: 1,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating campaign:', data);
      const result = await backend.campaigns.create({
        userId: user!.userId,
        ...data
      });
      console.log('Campaign created:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreateDialog(false);
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

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Updating campaign:', data);
      const result = await backend.campaigns.update(data);
      console.log('Campaign updated:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setEditingCampaign(null);
      toast({
        title: "Success",
        description: "Campaign updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Update campaign error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update campaign.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCampaign = (campaignData: any) => {
    createCampaignMutation.mutate(campaignData);
  };

  const handleUpdateCampaign = (campaignData: any) => {
    updateCampaignMutation.mutate({
      campaignId: editingCampaign.id,
      userId: user!.userId,
      ...campaignData
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Please log in to manage campaigns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaign Manager</h1>
          <p className="text-gray-600 mt-2">
            Organize and manage your affiliate marketing campaigns
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up a new campaign to organize your affiliate links
              </DialogDescription>
            </DialogHeader>
            <CampaignForm
              onSave={handleCreateCampaign}
              onCancel={() => setShowCreateDialog(false)}
              isLoading={createCampaignMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-red-500 mb-4">Failed to load campaigns</p>
            <p className="text-sm text-gray-500 mb-4">Error: {error.message}</p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['campaigns'] })}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaignsData?.campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold truncate">{campaign.name}</h3>
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                    
                    {campaign.description && (
                      <p className="text-gray-600 mb-3">{campaign.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center space-x-2">
                        <LinkIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {campaign.linkCount || 0} links
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {campaign.totalClicks || 0} clicks
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Budget: ${campaign.budget || 0}
                      </div>
                      <div className="text-sm text-gray-600">
                        Created: {new Date(campaign.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {campaign.tags && campaign.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {campaign.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {campaign.targetUrl && (
                      <p className="text-sm text-gray-500 truncate">
                        Target: {campaign.targetUrl}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCampaign(campaign)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Campaign</DialogTitle>
                          <DialogDescription>
                            Update campaign settings and metadata
                          </DialogDescription>
                        </DialogHeader>
                        {editingCampaign && (
                          <CampaignForm
                            campaign={editingCampaign}
                            onSave={handleUpdateCampaign}
                            onCancel={() => setEditingCampaign(null)}
                            isLoading={updateCampaignMutation.isPending}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {campaignsData?.campaigns.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500 mb-4">No campaigns found.</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Pagination */}
          {campaignsData && campaignsData.totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {page} of {campaignsData.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === campaignsData.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CampaignFormProps {
  campaign?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CampaignForm({ campaign, onSave, onCancel, isLoading }: CampaignFormProps) {
  const [name, setName] = useState(campaign?.name || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [status, setStatus] = useState(campaign?.status || 'active');
  const [budget, setBudget] = useState(campaign?.budget?.toString() || '0');
  const [targetUrl, setTargetUrl] = useState(campaign?.targetUrl || '');
  const [tags, setTags] = useState<string[]>(campaign?.tags || []);
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      status,
      budget: parseFloat(budget) || 0,
      targetUrl: targetUrl.trim(),
      tags
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Campaign Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter campaign name"
          required
        />
      </div>
      
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your campaign..."
          rows={3}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Budget ($)</Label>
          <Input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
          />
        </div>
      </div>
      
      <div>
        <Label>Target URL</Label>
        <Input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>
      
      <div>
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <Badge key={index} variant="secondary">
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 text-xs"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex space-x-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button onClick={addTag} variant="outline" type="button">
            Add
          </Button>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading || !name.trim()} type="button">
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

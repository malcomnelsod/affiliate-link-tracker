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
import { Copy, ExternalLink, Edit, QrCode, Search, Filter } from 'lucide-react';

export default function LinkManager() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [qrLink, setQrLink] = useState<string>('');

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', user?.userId],
    queryFn: () => backend.campaigns.list({ userId: user!.userId }),
    enabled: !!user,
  });

  const { data: linksData, isLoading } = useQuery({
    queryKey: ['links', user?.userId, search, statusFilter, campaignFilter, page],
    queryFn: () => backend.links.list({ 
      userId: user!.userId,
      search: search || undefined,
      status: statusFilter || undefined,
      campaignId: campaignFilter || undefined,
      page,
      limit: 20
    }),
    enabled: !!user,
  });

  const { data: qrCode } = useQuery({
    queryKey: ['qr-code', qrLink],
    queryFn: () => backend.qr.generate({ url: qrLink }),
    enabled: !!qrLink,
  });

  const updateLinkMutation = useMutation({
    mutationFn: (data: any) => backend.links.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      setEditingLink(null);
      toast({
        title: "Success",
        description: "Link updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Update link error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update link.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLink = (linkData: any) => {
    updateLinkMutation.mutate({
      linkId: editingLink.id,
      userId: user!.userId,
      ...linkData
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Link Manager</h1>
        <p className="text-gray-600 mt-2">
          Manage and organize all your affiliate links
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search links..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>Campaign</Label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All campaigns</SelectItem>
                  {campaigns?.campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  setCampaignFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Links List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {linksData?.links.map((link) => (
            <Card key={link.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium truncate">{link.shortUrl}</h3>
                      <Badge className={getStatusColor(link.status)}>
                        {link.status}
                      </Badge>
                      {link.customAlias && (
                        <Badge variant="outline">{link.customAlias}</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mb-2">
                      {link.rawUrl}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{link.clickCount || 0} clicks</span>
                      <span>Created {new Date(link.createdAt).toLocaleDateString()}</span>
                      {link.tags.length > 0 && (
                        <div className="flex space-x-1">
                          {link.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {link.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{link.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {link.notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        {link.notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
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
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setQrLink(link.shortUrl)}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>QR Code</DialogTitle>
                          <DialogDescription>
                            Scan this QR code to access the link
                          </DialogDescription>
                        </DialogHeader>
                        {qrCode && (
                          <div className="flex justify-center">
                            <img src={qrCode.qrCodeUrl} alt="QR Code" className="max-w-xs" />
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLink(link)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Link</DialogTitle>
                          <DialogDescription>
                            Update link settings and metadata
                          </DialogDescription>
                        </DialogHeader>
                        {editingLink && (
                          <EditLinkForm
                            link={editingLink}
                            onSave={handleUpdateLink}
                            onCancel={() => setEditingLink(null)}
                            isLoading={updateLinkMutation.isPending}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {linksData?.links.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500 mb-4">No links found.</p>
                <p className="text-sm text-gray-400">Try adjusting your filters or create some links first.</p>
              </CardContent>
            </Card>
          )}
          
          {/* Pagination */}
          {linksData && linksData.totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {page} of {linksData.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === linksData.totalPages}
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

interface EditLinkFormProps {
  link: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function EditLinkForm({ link, onSave, onCancel, isLoading }: EditLinkFormProps) {
  const [customAlias, setCustomAlias] = useState(link.customAlias || '');
  const [status, setStatus] = useState(link.status);
  const [notes, setNotes] = useState(link.notes || '');
  const [tags, setTags] = useState<string[]>(link.tags || []);
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
    onSave({
      customAlias: customAlias || undefined,
      status,
      notes,
      tags
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Custom Alias</Label>
        <Input
          value={customAlias}
          onChange={(e) => setCustomAlias(e.target.value)}
          placeholder="Custom alias"
        />
      </div>
      
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
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this link..."
          rows={3}
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
                addTag();
              }
            }}
          />
          <Button onClick={addTag} variant="outline">
            Add
          </Button>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

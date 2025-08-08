import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BulkUrl {
  rawUrl: string;
  customAlias?: string;
  tags?: string[];
}

export default function BulkLinkGenerator() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [bulkUrls, setBulkUrls] = useState<BulkUrl[]>([{ rawUrl: '', customAlias: '', tags: [] }]);
  const [csvInput, setCsvInput] = useState('');
  const [showCsvInput, setShowCsvInput] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', user?.userId],
    queryFn: () => backend.campaigns.list({ userId: user!.userId }),
    enabled: !!user,
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data: { urls: BulkUrl[]; campaignId: string; userId: string }) =>
      backend.links.bulkCreate(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      setBulkUrls([{ rawUrl: '', customAlias: '', tags: [] }]);
      setCsvInput('');
      toast({
        title: "Bulk Creation Complete",
        description: `Successfully created ${result.successCount} links. ${result.failureCount} failed.`,
      });
    },
    onError: (error: any) => {
      console.error('Bulk create error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create links in bulk.",
        variant: "destructive",
      });
    },
  });

  const addUrl = () => {
    setBulkUrls([...bulkUrls, { rawUrl: '', customAlias: '', tags: [] }]);
  };

  const removeUrl = (index: number) => {
    if (bulkUrls.length > 1) {
      setBulkUrls(bulkUrls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index: number, field: keyof BulkUrl, value: any) => {
    const updated = [...bulkUrls];
    updated[index] = { ...updated[index], [field]: value };
    setBulkUrls(updated);
  };

  const addTag = (index: number, tag: string) => {
    if (!tag.trim()) return;
    const updated = [...bulkUrls];
    const currentTags = updated[index].tags || [];
    if (!currentTags.includes(tag.trim())) {
      updated[index].tags = [...currentTags, tag.trim()];
      setBulkUrls(updated);
    }
  };

  const removeTag = (index: number, tagToRemove: string) => {
    const updated = [...bulkUrls];
    updated[index].tags = (updated[index].tags || []).filter(tag => tag !== tagToRemove);
    setBulkUrls(updated);
  };

  const parseCsvInput = () => {
    if (!csvInput.trim()) return;

    const lines = csvInput.trim().split('\n');
    const parsed: BulkUrl[] = lines.map(line => {
      const parts = line.split(',').map(part => part.trim());
      return {
        rawUrl: parts[0] || '',
        customAlias: parts[1] || '',
        tags: parts[2] ? parts[2].split(';').map(tag => tag.trim()).filter(Boolean) : []
      };
    }).filter(item => item.rawUrl);

    setBulkUrls(parsed);
    setShowCsvInput(false);
    toast({
      title: "CSV Parsed",
      description: `Imported ${parsed.length} URLs from CSV.`,
    });
  };

  const exportTemplate = () => {
    const template = "URL,Custom Alias,Tags (semicolon separated)\nhttps://example.com,my-alias,tag1;tag2\nhttps://another.com,,tag3";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_links_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkCreate = () => {
    const validUrls = bulkUrls.filter(item => item.rawUrl.trim());
    
    if (validUrls.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one valid URL.",
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

    bulkCreateMutation.mutate({
      urls: validUrls,
      campaignId: selectedCampaign,
      userId: user!.userId,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Link Generator</h1>
        <p className="text-gray-600 mt-2">
          Create multiple affiliate links at once for efficient campaign setup
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Selection</CardTitle>
              <CardDescription>
                Choose the campaign for your bulk links
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns?.campaigns.length ? (
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
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
                <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-2">No campaigns found</p>
                  <Link to="/campaign-manager">
                    <Button variant="outline" size="sm">
                      Create Your First Campaign
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Bulk URLs
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTemplate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCsvInput(!showCsvInput)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Add multiple URLs to create links in bulk
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showCsvInput && (
                <div className="space-y-2">
                  <Label>CSV Input (URL, Custom Alias, Tags)</Label>
                  <Textarea
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    placeholder="https://example.com,my-alias,tag1;tag2&#10;https://another.com,,tag3"
                    rows={4}
                  />
                  <div className="flex space-x-2">
                    <Button onClick={parseCsvInput} size="sm">
                      Parse CSV
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowCsvInput(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {bulkUrls.map((urlData, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label>URL {index + 1}</Label>
                    {bulkUrls.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUrl(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <Input
                    value={urlData.rawUrl}
                    onChange={(e) => updateUrl(index, 'rawUrl', e.target.value)}
                    placeholder="https://example.com/affiliate-link"
                  />
                  
                  <Input
                    value={urlData.customAlias || ''}
                    onChange={(e) => updateUrl(index, 'customAlias', e.target.value)}
                    placeholder="Custom alias (optional)"
                  />
                  
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(urlData.tags || []).map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="secondary">
                          {tag}
                          <button
                            onClick={() => removeTag(index, tag)}
                            className="ml-1 text-xs"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add tag and press Enter"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addTag(index, e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addUrl} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Another URL
              </Button>
            </CardContent>
          </Card>

          <Button
            onClick={handleBulkCreate}
            disabled={bulkCreateMutation.isPending || !selectedCampaign}
            className="w-full"
            size="lg"
          >
            {bulkCreateMutation.isPending ? 'Creating Links...' : 'Create All Links'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">Manual Entry</h4>
              <p className="text-gray-600">
                Add URLs one by one using the form fields. You can specify custom aliases and tags for each link.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">CSV Import</h4>
              <p className="text-gray-600">
                Import multiple URLs from CSV format. Use the template button to download the correct format.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">CSV Format</h4>
              <p className="text-gray-600">
                URL, Custom Alias, Tags (separated by semicolons)
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">Tags</h4>
              <p className="text-gray-600">
                Use tags to organize and filter your links. Press Enter to add a tag.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

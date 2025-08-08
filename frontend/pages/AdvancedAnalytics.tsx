import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, TrendingUp, Globe, Smartphone, Download } from 'lucide-react';

export default function AdvancedAnalytics() {
  const { user } = useAuth();
  const backend = useBackend();
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', user?.userId],
    queryFn: () => backend.campaigns.list({ userId: user!.userId }),
    enabled: !!user,
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['campaign-analytics', selectedCampaign, dateFrom, dateTo],
    queryFn: () => backend.analytics.getCampaignAnalytics({ 
      campaignId: selectedCampaign,
      userId: user!.userId,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    }),
    enabled: !!selectedCampaign && !!user,
  });

  const exportData = async (type: 'csv' | 'json') => {
    try {
      const result = await backend.analytics.exportData({
        userId: user!.userId,
        type: 'all',
        campaignId: selectedCampaign || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        format: type
      });

      // Open download URL
      window.open(result.downloadUrl, '_blank');
      
      toast({
        title: "Export Started",
        description: `Exporting ${result.recordCount} records as ${type.toUpperCase()}.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data.",
        variant: "destructive",
      });
    }
  };

  const stats = [
    {
      title: 'Total Links',
      value: analytics?.totalLinks || 0,
      icon: BarChart3,
      description: 'Links in campaign',
    },
    {
      title: 'Total Clicks',
      value: analytics?.totalClicks || 0,
      icon: TrendingUp,
      description: 'All time clicks',
    },
    {
      title: 'Unique Clicks',
      value: analytics?.uniqueClicks || 0,
      icon: Globe,
      description: 'Unique visitors',
    },
    {
      title: 'Conversion Rate',
      value: `${(analytics?.conversionRate || 0).toFixed(1)}%`,
      icon: Smartphone,
      description: 'Click-through rate',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive performance insights and data visualization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="campaign">Campaign</Label>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger>
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select campaign</SelectItem>
              {campaigns?.campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="dateFrom">From Date</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="dateTo">To Date</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        
        <div className="flex items-end space-x-2">
          <Button
            variant="outline"
            onClick={() => exportData('csv')}
            disabled={!selectedCampaign || selectedCampaign === 'none'}
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportData('json')}
            disabled={!selectedCampaign || selectedCampaign === 'none'}
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {selectedCampaign && selectedCampaign !== 'none' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Clicks Over Time</CardTitle>
                  <CardDescription>Daily click performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
                    <p className="text-gray-500">Chart visualization would appear here</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Links</CardTitle>
                  <CardDescription>Links with most clicks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.topPerformingLinks.map((link, index) => (
                      <div key={link.linkId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.shortUrl}</p>
                          <p className="text-xs text-gray-500">Link ID: {link.linkId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{link.clicks} clicks</p>
                        </div>
                      </div>
                    )) || <p className="text-gray-500 text-center py-4">No data available</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clicks by Country</CardTitle>
                  <CardDescription>Geographic distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.clicksByCountry.map((country, index) => (
                      <div key={country.country} className="flex items-center justify-between">
                        <span className="text-sm">{country.country}</span>
                        <span className="text-sm font-bold">{country.clicks}</span>
                      </div>
                    )) || <p className="text-gray-500 text-center py-4">No data available</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Device Types</CardTitle>
                  <CardDescription>Clicks by device category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.clicksByDevice.map((device, index) => (
                      <div key={device.device} className="flex items-center justify-between">
                        <span className="text-sm">{device.device}</span>
                        <span className="text-sm font-bold">{device.clicks}</span>
                      </div>
                    )) || <p className="text-gray-500 text-center py-4">No data available</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

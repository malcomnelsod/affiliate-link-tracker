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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

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
            disabled={!selectedCampaign}
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportData('json')}
            disabled={!selectedCampaign}
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {selectedCampaign && (
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
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics?.clicksByDate || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="clicks" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Links</CardTitle>
                  <CardDescription>Links with most clicks</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics?.topPerformingLinks || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="shortUrl" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clicks by Country</CardTitle>
                  <CardDescription>Geographic distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics?.clicksByCountry || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ country, percent }) => `${country} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="clicks"
                      >
                        {(analytics?.clicksByCountry || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Device Types</CardTitle>
                  <CardDescription>Clicks by device category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics?.clicksByDevice || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="device" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

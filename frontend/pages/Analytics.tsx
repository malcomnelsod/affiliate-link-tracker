import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, MousePointer, Users, TrendingUp } from 'lucide-react';

export default function Analytics() {
  const { user } = useAuth();
  const backend = useBackend();
  const [selectedLink, setSelectedLink] = useState('');

  const { data: links } = useQuery({
    queryKey: ['links', user?.userId],
    queryFn: () => backend.links.list({ userId: user!.userId }),
    enabled: !!user,
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics', selectedLink],
    queryFn: () => backend.analytics.getLinkAnalytics({ linkId: selectedLink }),
    enabled: !!selectedLink,
  });

  const stats = [
    {
      title: 'Total Clicks',
      value: analytics?.totalClicks || 0,
      icon: MousePointer,
      description: 'All time clicks',
    },
    {
      title: 'Unique Clicks',
      value: analytics?.uniqueClicks || 0,
      icon: Users,
      description: 'Unique visitors',
    },
    {
      title: 'Click Rate',
      value: analytics?.totalClicks ? 
        `${((analytics.uniqueClicks / analytics.totalClicks) * 100).toFixed(1)}%` : '0%',
      icon: TrendingUp,
      description: 'Unique/Total ratio',
    },
    {
      title: 'Recent Activity',
      value: analytics?.clicks.length || 0,
      icon: BarChart3,
      description: 'Click events',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">
          Detailed performance metrics for your affiliate links
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Link</CardTitle>
          <CardDescription>
            Choose a link to view detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLink} onValueChange={setSelectedLink}>
            <SelectTrigger>
              <SelectValue placeholder="Select a link to analyze" />
            </SelectTrigger>
            <SelectContent>
              {links?.links.map((link) => (
                <SelectItem key={link.id} value={link.id}>
                  {link.shortUrl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedLink && (
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

          <Card>
            <CardHeader>
              <CardTitle>Click History</CardTitle>
              <CardDescription>
                Recent click events for the selected link
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.clicks.length ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {analytics.clicks.map((click) => (
                    <div
                      key={click.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(click.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {click.geoLocation || 'Unknown location'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {click.ipAddress || 'Unknown IP'}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-32">
                          {click.userAgent || 'Unknown browser'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No clicks recorded yet for this link.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

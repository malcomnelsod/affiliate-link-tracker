import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Link as LinkIcon, Target, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const backend = useBackend();

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

  const stats = [
    {
      title: 'Total Campaigns',
      value: campaigns?.campaigns.length || 0,
      icon: Target,
      description: 'Active campaigns',
    },
    {
      title: 'Total Links',
      value: links?.links.length || 0,
      icon: LinkIcon,
      description: 'Generated links',
    },
    {
      title: 'Click Rate',
      value: '0%',
      icon: TrendingUp,
      description: 'Average CTR',
    },
    {
      title: 'Analytics',
      value: 'View',
      icon: BarChart3,
      description: 'Detailed reports',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Overview of your affiliate link performance
        </p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>
              Your latest campaign activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns?.campaigns.length ? (
              <div className="space-y-3">
                {campaigns.campaigns.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-gray-600">
                        Created {new Date(campaign.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No campaigns yet. Create your first campaign to get started.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Links</CardTitle>
            <CardDescription>
              Your latest generated links
            </CardDescription>
          </CardHeader>
          <CardContent>
            {links?.links.length ? (
              <div className="space-y-3">
                {links.links.slice(0, 5).map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{link.shortUrl}</p>
                      <p className="text-sm text-gray-600 truncate">
                        {link.rawUrl}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No links yet. Generate your first link to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

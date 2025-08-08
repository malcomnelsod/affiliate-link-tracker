import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBackend } from '../hooks/useBackend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Link as LinkIcon, Target, TrendingUp, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const backend = useBackend();

  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ['campaigns', user?.userId],
    queryFn: () => backend.campaigns.list({ userId: user!.userId, limit: 10 }),
    enabled: !!user,
    retry: 1,
  });

  const { data: links, isLoading: linksLoading, error: linksError } = useQuery({
    queryKey: ['links', user?.userId],
    queryFn: () => backend.links.list({ userId: user!.userId, limit: 10 }),
    enabled: !!user,
    retry: 1,
  });

  // Calculate total clicks from all links
  const totalClicks = links?.links.reduce((sum, link) => sum + (link.clickCount || 0), 0) || 0;
  const totalLinks = links?.links.length || 0;
  const averageCTR = totalLinks > 0 ? ((totalClicks / totalLinks) * 100).toFixed(1) : '0';

  const stats = [
    {
      title: 'Total Campaigns',
      value: campaignsLoading ? '...' : (campaigns?.campaigns.length || 0),
      icon: Target,
      description: 'Active campaigns',
      href: '/campaign-manager'
    },
    {
      title: 'Total Links',
      value: linksLoading ? '...' : totalLinks,
      icon: LinkIcon,
      description: 'Generated links',
      href: '/link-manager'
    },
    {
      title: 'Total Clicks',
      value: linksLoading ? '...' : totalClicks,
      icon: TrendingUp,
      description: 'All time clicks',
      href: '/analytics'
    },
    {
      title: 'Avg. CTR',
      value: linksLoading ? '...' : `${averageCTR}%`,
      icon: BarChart3,
      description: 'Click-through rate',
      href: '/advanced-analytics'
    },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Please log in to view your dashboard.</p>
      </div>
    );
  }

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
          <Link key={stat.title} to={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>
                Your latest campaign activity
              </CardDescription>
            </div>
            <Link to="/campaign-manager">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : campaignsError ? (
              <div className="text-center py-8">
                <p className="text-red-500 mb-4">Failed to load campaigns</p>
                <p className="text-sm text-gray-500">Please try refreshing the page</p>
              </div>
            ) : campaigns?.campaigns.length ? (
              <div className="space-y-3">
                {campaigns.campaigns.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.name}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{campaign.linkCount || 0} links</span>
                        <span>{campaign.totalClicks || 0} clicks</span>
                        <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No campaigns yet.</p>
                <Link to="/campaign-manager">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Campaign
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Links</CardTitle>
              <CardDescription>
                Your latest generated links
              </CardDescription>
            </div>
            <Link to="/links">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {linksLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : linksError ? (
              <div className="text-center py-8">
                <p className="text-red-500 mb-4">Failed to load links</p>
                <p className="text-sm text-gray-500">Please try refreshing the page</p>
              </div>
            ) : links?.links.length ? (
              <div className="space-y-3">
                {links.links.slice(0, 5).map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{link.shortUrl}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>{link.clickCount || 0} clicks</span>
                        <span>Created {new Date(link.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No links yet.</p>
                <Link to="/links">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Your First Link
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to get you started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/links">
              <Button variant="outline" className="w-full h-20 flex-col">
                <LinkIcon className="h-6 w-6 mb-2" />
                <span>Generate Link</span>
              </Button>
            </Link>
            <Link to="/bulk-links">
              <Button variant="outline" className="w-full h-20 flex-col">
                <Target className="h-6 w-6 mb-2" />
                <span>Bulk Generate</span>
              </Button>
            </Link>
            <Link to="/campaign-manager">
              <Button variant="outline" className="w-full h-20 flex-col">
                <Plus className="h-6 w-6 mb-2" />
                <span>New Campaign</span>
              </Button>
            </Link>
            <Link to="/analytics">
              <Button variant="outline" className="w-full h-20 flex-col">
                <BarChart3 className="h-6 w-6 mb-2" />
                <span>View Analytics</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, ArrowLeft, Activity, BarChart2, 
  Users, Clock, ArrowDown, CheckCircle, Share2, MousePointer,
  ArrowUpRight, ArrowDownRight, Eye, Link2, Type, Loader2,
  MapPin, Layout
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import BlurPage from '@/components/global/blur-page';
import dynamic from 'next/dynamic';
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClientAnalytics } from '@/lib/google-analytics/client-analytics';
import { toast } from "@/components/ui/use-toast";

// Lazy load charts
const LineChart = dynamic(
  () => import('@tremor/react').then(mod => mod.LineChart),
  { ssr: false, loading: () => <Skeleton className="h-72" /> }
);

const BarChart = dynamic(
  () => import('@tremor/react').then(mod => mod.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-60" /> }
);

// Mock data for individual page analytics
const mockPageAnalytics = {
  overview: {
    pageViews: 2500,
    uniqueViews: 1800,
    averageTimeOnPage: "3:45",
    bounceRate: 28.5,
    completionRate: 72.3,
    shares: 145
  },
  timeline: [
    { date: "2024-01", views: 800, uniqueUsers: 600, avgTime: 215 },
    { date: "2024-02", views: 950, uniqueUsers: 720, avgTime: 225 },
    { date: "2024-03", views: 750, uniqueUsers: 580, avgTime: 205 }
  ],
  sections: [
    { name: "Header", clicks: 450, avgTime: 15 },
    { name: "Main Content", clicks: 850, avgTime: 120 },
    { name: "Image Gallery", clicks: 320, avgTime: 45 },
    { name: "Contact Form", clicks: 180, avgTime: 90 }
  ],
  referrers: [
    { source: "Direct", visits: 980 },
    { source: "Internal Links", visits: 750 },
    { source: "Search", visits: 420 },
    { source: "Social Media", visits: 350 }
  ]
};

// Update the time periods
const timePeriods = [
  { id: 'day', label: 'Last 24 Hours' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: '12m', label: 'Last 12 Months' }
] as const;

type TimePeriod = typeof timePeriods[number]['id'];

// Update the getStartDate function to handle the new periods
const getStartDate = (period: string): string => {
  const now = new Date();
  switch (period) {
    case 'day':
      const oneDayAgo = new Date(now);
      oneDayAgo.setHours(now.getHours() - 24);
      return oneDayAgo.toISOString();
    case 'week':
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      return sevenDaysAgo.toISOString();
    case 'month':
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return thirtyDaysAgo.toISOString();
    case '90d':
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);
      return ninetyDaysAgo.toISOString();
    case '12m':
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      return oneYearAgo.toISOString();
    default:
      const defaultDate = new Date(now);
      defaultDate.setDate(now.getDate() - 30);
      return defaultDate.toISOString();
  }
};

// Update the formatTimelineDate function to handle YYYYMMDD format
const formatTimelineDate = (dateStr: string): string => {
  try {
    // Handle YYYYMMDD format from GA4
    if (/^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      
      // Format as MM/DD
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    
    // Handle other date formats if needed
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error(`Invalid date: ${dateStr}`);
      return dateStr;
    }
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch (error) {
    console.error(`Error formatting date ${dateStr}:`, error);
    return dateStr;
  }
};

interface Props {
  params: {
    projectId: string;
    clientId: string;
    pageId: string;
  };
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon,
  suffix = "",
  tooltip,
  isLoading = false,
  description,
  change,
  trend
}: { 
  title: string; 
  value: string | number; 
  icon: any;
  suffix?: string;
  tooltip?: string;
  isLoading?: boolean;
  description?: string;
  change?: number;
  trend?: 'up' | 'down';
}) {
  return (
    <Card className={`p-4 relative ${isLoading ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">{title}</div>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div className="text-2xl font-bold flex items-center gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            {value}
            {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
            {change && (
              <span className={`text-sm font-normal ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend === 'up' ? '+' : '-'}{Math.abs(change)}%
              </span>
            )}
          </>
        )}
      </div>
      {description && (
        <div className="text-sm text-muted-foreground mt-1">
          {description}
        </div>
      )}
      {tooltip && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/80 rounded-lg flex items-center justify-center text-white text-sm p-2">
          {tooltip}
        </div>
      )}
    </Card>
  );
}

const analyticsFeatures = [
  { id: 'insights', label: 'Analytics', icon: BarChart2 },
  { id: 'heatmap', label: 'Heatmap', icon: Activity },
];

// Update the analytics interface to match the content analytics data structure
interface PageAnalytics {
  pageViews: number;
  uniqueVisitors: number;
  averageTimeOnPage: number;
  bounceRate: number;
  timelineData?: Array<{
    date: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
}

interface VideoMetrics {
  totalViews: number;
  totalCompletions: number;
  averageWatchTime: number;
  completionRate: number;
  videosByViews: Array<{
    title: string;
    views: number;
    completions: number;
    avgWatchTime: number;
    completionRate: number;
  }>;
  engagementByQuartile: {
    '25%': number;
    '50%': number;
    '75%': number;
    '100%': number;
  };
}

// Update the CTAMetrics interface
interface CTAMetrics {
  totalClicks: number;
  totalPageViews: number;
  conversionRate: number;
}

// Format URL into a readable page name
const formatPageName = (url: string): string => {
  try {
    // Try to extract section or page from query parameters
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      // If not a valid URL, try adding https://
      try {
        parsedUrl = new URL(`https://${url}`);
      } catch (e2) {
        // If still not valid, return as is with first letter capitalized
        return url.charAt(0).toUpperCase() + url.slice(1);
      }
    }
    
    // Check for section or page in query parameters
    const searchParams = new URLSearchParams(parsedUrl.search);
    const section = searchParams.get('section');
    const page = searchParams.get('page');
    
    // If section exists, use it as the page name
    if (section) {
      return section.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    
    // If page exists, use it as the page name
    if (page) {
      return page.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    
    // Otherwise, use the path as the page name
    let pathName = parsedUrl.pathname;
    if (pathName === '/' || !pathName) {
      return 'Home Page';
    }
    
    // Remove leading and trailing slashes
    pathName = pathName.replace(/^\/|\/$/g, '');
    
    // Replace slashes, dashes and underscores with spaces
    pathName = pathName.replace(/[\/\-_]/g, ' ');
    
    // Capitalize words
    return pathName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch (error) {
    console.error('Error formatting page name:', error);
    return url;
  }
};

export default function PageInsights({ params }: Props) {
  const searchParams = useSearchParams();
  const pageName = searchParams.get('page') || 'Unknown Page';
  const displayName = formatPageName(pageName);
  const period = searchParams.get('period') || '30d';
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [analytics, setAnalytics] = useState<PageAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPeriod, setIsChangingPeriod] = useState(false);
  const [ctaMetrics, setCtaMetrics] = useState<CTAMetrics | null>(null);
  const [isLoadingCTA, setIsLoadingCTA] = useState(false);
  const [videoMetrics, setVideoMetrics] = useState<VideoMetrics | null>(null);

  // Create analytics client
  const analyticsClient = createClientAnalytics(params.projectId);

  // Function to fetch analytics data
  const fetchAnalytics = async (isRefreshRequest = false) => {
    try {
      if (isRefreshRequest) {
        setIsRefreshing(true);
      } else {
        setIsChangingPeriod(true);
      }
      
      const now = new Date();
      let startDate = new Date();
      
      switch (selectedPeriod) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case '12m':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      // First get the URL metrics
      const urls = await analyticsClient.getUrlsFromGA(
        startDate.toISOString(),
        now.toISOString(),
        'screenPageViews',
        true
      );

      // Find the matching URL data
      const pageData = urls.find(url => url.url === pageName || url.path === pageName);

      if (pageData) {
        try {
          // Get timeline data specifically for this URL
          const response = await fetch(
            `/api/projects/${params.projectId}/analytics/timeline?` + 
            new URLSearchParams({
              startDate: startDate.toISOString(),
              endDate: now.toISOString(),
              url: pageName
            })
          );

          if (!response.ok) {
            throw new Error('Failed to fetch timeline data');
          }

          const timelineData = await response.json();
          console.log('Timeline data response:', timelineData);

          setAnalytics({
            pageViews: pageData.pageViews || 0,
            uniqueVisitors: pageData.uniqueVisitors || 0,
            averageTimeOnPage: pageData.averageTimeOnPage || 0,
            bounceRate: pageData.bounceRate || 0,
            timelineData: timelineData.data || []
          });
        } catch (error) {
          console.error('Error fetching timeline data:', error);
          // Still set the analytics data even if timeline fails
          setAnalytics({
            pageViews: pageData.pageViews || 0,
            uniqueVisitors: pageData.uniqueVisitors || 0,
            averageTimeOnPage: pageData.averageTimeOnPage || 0,
            bounceRate: pageData.bounceRate || 0,
            timelineData: []
          });
        }
      } else {
        console.warn('No data found for URL:', pageName);
        setAnalytics({
          pageViews: 0,
          uniqueVisitors: 0,
          averageTimeOnPage: 0,
          bounceRate: 0,
          timelineData: []
        });
      }
    } catch (error) {
      console.error('Error fetching page analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch page analytics data',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
      setIsChangingPeriod(false);
      setIsLoading(false);
    }
  };

  // Add function to fetch CTA metrics
  const fetchCtaMetrics = async () => {
    try {
      setIsLoadingCTA(true);
      const startDate = getStartDate(selectedPeriod);
      const response = await fetch(
        `/api/projects/${params.projectId}/analytics/cta-metrics?` +
        new URLSearchParams({
          startDate,
          endDate: new Date().toISOString(),
          url: pageName
        })
      );

      if (!response.ok) {
        throw new Error('Failed to fetch CTA metrics');
      }

      const data = await response.json();
      setCtaMetrics(data.cta);
    } catch (error) {
      console.error('Error fetching CTA metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch CTA metrics',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingCTA(false);
    }
  };

  // Update useEffect to handle initial load
  useEffect(() => {
    if (pageName) {
      setIsLoading(true);
      fetchAnalytics();
    }
  }, []);

  // Add separate effect for period changes
  useEffect(() => {
    if (pageName && !isLoading) { // Don't trigger on initial load
      fetchAnalytics();
    }
  }, [selectedPeriod]);

  // Update useEffect to fetch CTA metrics when tab changes
  useEffect(() => {
    if (activeTab === 'engagement') {
      fetchCtaMetrics();
    }
  }, [activeTab, selectedPeriod]);

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  // Format time in seconds to mm:ss
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <BlurPage>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link 
                href={`/client/${params.clientId}/projects/${params.projectId}/insights`}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-4xl font-bold">{displayName}</h1>
            </div>
            <p className="text-muted-foreground">
              Detailed analytics for this page
            </p>
          </div>
          {/* <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {analyticsFeatures.map((feature) => {
                const Icon = feature.icon;
                const isActive = feature.id === 'insights';
                return (
                  <Link
                    key={feature.id}
                    href={feature.id === 'heatmap' 
                      ? `/standalone/heatmap?projectId=${params.projectId}&pageUrl=${encodeURIComponent(pageName)}`
                      : `/client/${params.clientId}/projects/${params.projectId}/insights/${feature.id}?page=${encodeURIComponent(pageName)}`
                    }
                    target={feature.id === 'heatmap' ? "_blank" : undefined}
                    rel={feature.id === 'heatmap' ? "noopener noreferrer" : undefined}
                  >
                    <Button 
                      variant={isActive ? "default" : "outline"}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {feature.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div> */}
        </div>

        <Tabs defaultValue="overview" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            {/* <TabsTrigger value="behavior">User Behavior</TabsTrigger> */}
          </TabsList>

          <TabsContent value="overview">
            <div className="flex items-center justify-end mb-6 gap-4">
              <Button 
                variant="outline"
                onClick={handleRefresh}
                className="gap-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              <div className="flex bg-secondary rounded-lg p-1">
                {timePeriods.map((period) => (
                  <Button
                    key={period.id}
                    variant={period.id === selectedPeriod ? 'default' : 'ghost'}
                    className="text-sm"
                    onClick={() => setSelectedPeriod(period.id)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Page Views"
                value={(analytics?.pageViews || 0).toLocaleString()}
                icon={Eye}
                isLoading={isLoading || isRefreshing || isChangingPeriod}
              />
              <MetricCard
                title="Unique Visitors"
                value={(analytics?.uniqueVisitors || 0).toLocaleString()}
                icon={Users}
                isLoading={isLoading || isRefreshing || isChangingPeriod}
              />
              <MetricCard
                title="Avg. Time on Page"
                value={formatTime(analytics?.averageTimeOnPage || 0)}
                icon={Clock}
                isLoading={isLoading || isRefreshing || isChangingPeriod}
              />
              <MetricCard
                title="Bounce Rate"
                value={`${((analytics?.bounceRate || 0) * 100).toFixed(1)}%`}
                icon={ArrowDown}
                isLoading={isLoading || isRefreshing || isChangingPeriod}
              />
            </div>

            {/* Timeline Chart */}
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-semibold mb-6">Page Performance</h3>
              <Suspense fallback={<Skeleton className="h-96" />}>
                {(isLoading || isRefreshing || isChangingPeriod) ? (
                  <Skeleton className="w-full h-96" />
                ) : analytics?.timelineData && analytics.timelineData.length > 0 ? (
                  <>
                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm">Page Views</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm">Unique Visitors</span>
                      </div>
                    </div>
                    <LineChart
                      data={analytics.timelineData.map(point => ({
                        date: formatTimelineDate(point.date),
                        views: point.pageViews,
                        visitors: point.uniqueVisitors
                      }))}
                      index="date"
                      categories={["views", "visitors"]}
                      colors={["blue", "green"]}
                      valueFormatter={(value) => value.toLocaleString()}
                      yAxisWidth={48}
                      className="h-96"
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    No timeline data available for the selected period
                  </div>
                )}
              </Suspense>
            </Card>
          </TabsContent>

          <TabsContent value="engagement">
            <div className="flex items-center justify-end mb-6 gap-4">
              <Button 
                variant="outline"
                onClick={handleRefresh}
                className="gap-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              <div className="flex bg-secondary rounded-lg p-1">
                {timePeriods.map((period) => (
                  <Button
                    key={period.id}
                    variant={period.id === selectedPeriod ? 'default' : 'ghost'}
                    className="text-sm"
                    onClick={() => setSelectedPeriod(period.id)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Register Button Metrics */}
            <div className="grid grid-cols-1 gap-4 mb-8">
              <MetricCard
                title="Total Register Clicks"
                value={ctaMetrics?.totalClicks.toLocaleString() || '0'}
                icon={MousePointer}
                isLoading={isLoadingCTA}
                description="Total clicks across all pages"
              />
            </div>
          </TabsContent>

          {/* <TabsContent value="behavior">
            <div className="flex items-center justify-end mb-6 gap-4">
              <Button 
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <div className="flex bg-secondary rounded-lg p-1">
                {timePeriods.map((period) => (
                  <Button
                    key={period.id}
                    variant={period.id === selectedPeriod ? 'default' : 'ghost'}
                    className="text-sm"
                    onClick={() => setSelectedPeriod(period.id)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div> */}

            {/* Visual Insights */}
            {/* <div className="grid grid-cols-1 gap-6"> */}
              {/* Click Statistics */}
              {/* <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Click Activity</h3>
                    <p className="text-sm text-gray-500 mt-1">Most engaged elements</p>
                  </div>
                  <Link 
                    href={`/standalone/heatmap?projectId=${params.projectId}&pageUrl=${encodeURIComponent(pageName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-2">
                      <Activity className="h-4 w-4" />
                      View Heatmap
                    </Button>
                  </Link>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-3">
                      <MousePointer className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="font-medium">Navigation Menu</div>
                        <div className="text-sm text-gray-500">Header section</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">1,245 clicks</div>
                      <div className="text-sm text-gray-500">42% of total</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-3">
                      <MousePointer className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="font-medium">CTA Buttons</div>
                        <div className="text-sm text-gray-500">Primary actions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">856 clicks</div>
                      <div className="text-sm text-gray-500">35% of total</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-3">
                      <MousePointer className="h-5 w-5 text-purple-500" />
                      <div>
                        <div className="font-medium">Product Images</div>
                        <div className="text-sm text-gray-500">Gallery section</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">578 clicks</div>
                      <div className="text-sm text-gray-500">23% of total</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent> */}
        </Tabs>
      </div>
    </BlurPage>
  );
} 
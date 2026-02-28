"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, BarChart2, Activity, PlayCircle, Settings, AlertCircle,
  Users, Clock, ArrowDown, CheckCircle, Share2, Globe,
  Video, FileAudio, MousePointer, UserPlus, Leaf, DollarSign,
  BookOpen, Timer, ArrowUpRight, ArrowDownRight, Laptop, Smartphone, Tablet, MapPin,
  ArrowRight, Link2, Search, Facebook, Twitter, Linkedin, Instagram, FileText, Type, Eye,
  Loader2, Droplets, Wind, TreeDeciduous, Factory, Recycle, Coins, Receipt,
  TreePine, Sprout, CloudSun, Calculator
} from "lucide-react";
import { ProjectWithDetails } from "@/lib/types";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import BlurPage from '@/components/global/blur-page'
import dynamic from 'next/dynamic';
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { createClientAnalytics } from '@/lib/google-analytics/client-analytics';
import { 
  TimelineDataPoint, 
  DeviceData, 
  GeographicData,
  TrafficSource as AnalyticsTrafficSource,
  TrafficSourceDetail as AnalyticsTrafficSourceDetail
} from '@/lib/google-analytics/types/analytics';
import { 
  ResponsiveContainer, 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  BarChart as RechartsBarChart,
  Bar
} from "recharts";

// Lazy load charts
const LineChart = dynamic(
  () => import('@tremor/react').then(mod => mod.LineChart),
  { ssr: false, loading: () => <Skeleton className="h-72" /> }
);

const BarChart = dynamic(
  () => import('@tremor/react').then(mod => mod.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-60" /> }
);

const DonutChart = dynamic(
  () => import('@tremor/react').then(mod => mod.DonutChart),
  { ssr: false, loading: () => <Skeleton className="h-60" /> }
);

// Update the time periods
const timePeriods = [
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: '12m', label: 'Last 12 Months' }
] as const;

type TimePeriod = typeof timePeriods[number]['id'];

interface Props {
  project: ProjectWithDetails | null;
  params: {
    projectId: string;
    clientId: string;
  };
}

interface AnalyticsConfig {
  gaEnabled: boolean;
  gaPropertyId?: string;
}

// Update the PageAnalytics type at the top of the file
type PageAnalytics = {
  pageViews: number;
  uniqueVisitors: number;
  averageTimeOnPage: number;
  bounceRate: number;
};

interface TrackedPage {
  url: string;
  path: string;
  title?: string | null;
  lastVisited: string | null;
  isActive: boolean;
  analytics?: PageAnalytics;
  // Add optional properties that might come directly from the API
  pageViews?: number;
  uniqueVisitors?: number;
  averageTimeOnPage?: number;
  bounceRate?: number;
}

interface OverviewData {
  totalViews: number
  uniqueViews: number
  totalSessions: number
  totalClicks: number
  averageTimeOnPage: number
  bounceRate: number
  pageViews: number
  newUsers: number // Add this
  activeUsers: number // Add this
}

// Extend the analytics types to add required fields
interface TrafficSource extends AnalyticsTrafficSource {
  details: TrafficSourceDetail[]; // Ensure details is required
}

interface TrafficSourceDetail extends AnalyticsTrafficSourceDetail {
  url?: string | null;
}

interface TrafficTypeStats {
  visits: number;
  percentage: number;
  sources: TrafficSourceDetail[];
}

interface TrafficResponse {
  sources: TrafficSource[];
  total: number;
}

// Add section interface
interface Section {
  name: string;
  views: number;
  avgTime: number;
  scrollDepth: number;
}

// Add interfaces for API responses
interface MetricsResponse {
  pageViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  totalClicks: number;
  averageTimeOnSite: number;
  bounceRate: number;
  timelineData?: Array<TimelineDataPoint>;
}

interface DeviceResponse {
  devices: Array<DeviceData>;
  total: number;
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon,
  suffix = "",
  tooltip,
  isLoading = false, // Add loading prop
  description
}: { 
  title: string; 
  value: string | number; 
  icon: any;
  suffix?: string;
  tooltip?: string;
  isLoading?: boolean;
  description?: string;
}) {
  // Format the value based on type and loading state
  const formattedValue = isLoading 
    ? '--' 
    : typeof value === 'number' 
      ? value.toLocaleString()
      : value;

  return (
    <Card className={`p-4 relative group ${isLoading ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">{title}</div>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div className="text-2xl font-bold flex items-center">
        {formattedValue}
        {!isLoading && suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </div>
      {tooltip && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {tooltip}
        </div>
      )}
      {description && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {description}
        </div>
      )}
    </Card>
  );
}

// Add mapping functions to convert GA data to UI format
const mapDeviceData = (devices: any[]): DeviceData[] => {
  if (!devices || !Array.isArray(devices)) return [];
  
  return devices.map(device => ({
    type: device.device || 'desktop', // Map 'device' to 'type'
    percentage: device.percentage || 0,
    visits: device.visits || device.pageViews || 0
  }));
};

const mapGeographicData = (geoData: any[]): GeographicData[] => {
  if (!geoData || !Array.isArray(geoData)) return [];
  
  return geoData.map(country => ({
    country: country.country || '',
    percentage: country.percentage || 0,
    visits: country.visits || country.sessions || 0,
    cities: (country.cities || []).map((city: any) => ({
      name: city.city || city.name || '', // Map 'city' to 'name'
      percentage: city.percentage || 0,
      visits: city.visits || city.sessions || 0
    }))
  }));
};

const mapTrafficSources = (sources: any[]): TrafficSource[] => {
  if (!sources || !Array.isArray(sources)) return [];
  
  return sources.map(source => ({
    source: source.source || '',
    type: source.type || source.medium || 'direct',
    visits: source.visits || source.sessions || 0,
    percentage: source.percentage || 0,
    details: (source.details || []).map((detail: any) => ({
      source: detail.source || '',
      visits: detail.visits || detail.sessions || 0,
      percentage: detail.percentage || 0,
      url: detail.url || null
    }))
  }));
};

export function ProjectInsightsClient({ project, params }: Props) {
  const { userId } = useAuth();
  const [selectedPeriods, setSelectedPeriods] = useState({
    overview: '30d',
    engagement: '30d',
    leads: '30d',
    content: '30d',  // Add content period
    impact: '30d',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [analyticsConfig, setAnalyticsConfig] = useState<AnalyticsConfig | null>({ gaEnabled: false });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [trackedPages, setTrackedPages] = useState<TrackedPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<{ [key: string]: PageAnalytics }>({});
  const [overviewData, setOverviewData] = useState<OverviewData>({
    totalViews: 0,
    uniqueViews: 0,
    totalSessions: 0,
    totalClicks: 0,
    averageTimeOnPage: 0,
    bounceRate: 0,
    pageViews: 0,
    newUsers: 0, // Add this
    activeUsers: 0, // Add this
  });
  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([]);
  const [geographicData, setGeographicData] = useState<GeographicData[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceData[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficResponse>({
    sources: [],
    total: 0
  });

  // Create an instance of the ClientAnalytics service
  const analyticsClient = useMemo(() => createClientAnalytics(params.projectId), [params.projectId]);

  // Add new state for engagement metrics
  const [engagementData, setEngagementData] = useState<{
    timeOfDay: {
      morning: number;
      afternoon: number;
      evening: number;
      night: number;
      total: number;
    };
    dayOfWeek: {
      weekdays: number;
      weekends: number;
      total: number;
    };
    userType: {
      new: number;
      returning: number;
      total: number;
    };
    userFlow?: {
      entryPages: Array<{url: string, title: string, entries: number, percentage: number}>;
      exitPages: Array<{url: string, title: string, percentage: number, exits: number}>;
    };
  } | null>(null);

  // Add loading state for engagement data
  const [isLoadingEngagement, setIsLoadingEngagement] = useState(false);

  // Add new state for content sorting
  const [contentSortBy, setContentSortBy] = useState<'pageViews' | 'uniqueVisitors' | 'averageTimeOnPage' | 'bounceRate'>('pageViews');
  const [contentSortOrder, setContentSortOrder] = useState<'asc' | 'desc'>('desc');

  // Add a new state variable for lead generation metrics
  const [leadGenerationData, setLeadGenerationData] = useState<{
    totalInteractions: number;
    interactionRate: number;
    formStarts: number;
    formCompletions: number;
    formCompletionRate: number;
    conversionsBySource: Array<{source: string, conversions: number, percentage: number}>;
    formPerformance?: Array<{ formName: string, starts: number, completions: number, completionRate: number }>;
    conversionTrends?: Array<{ date: string, conversions: number }>;
    topConversionPages?: Array<{ page: string, conversions: number, conversionRate: number }>;
    leadQualityScore?: number;
    avgLeadValue?: number;
    totalVisitors?: number;
    formViews?: number;
  } | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingLeadGeneration, setIsLoadingLeadGeneration] = useState(false);

  // First add a loading state for lead metrics
  const [isLeadMetricsLoading, setIsLeadMetricsLoading] = useState(false);

  // Improved formatTimelineDate function to handle different date formats
  const formatTimelineDate = (dateStr: string): string => {
    try {
      // If the date is already in a readable format like "7 AM", it's likely a time, not a date
      if (dateStr.includes('AM') || dateStr.includes('PM')) {
        console.log(`[Timeline] Received time instead of date: ${dateStr}`);
        return dateStr; // Return as is for now
      }
      
      // Handle different date formats that might come from analytics providers
      let date: Date;
      
      // Check if it's a YYYYMMDD format (common in Google Analytics)
      if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        date = new Date(`${year}-${month}-${day}`);
      } 
      // Check if it's a timestamp (number)
      else if (!isNaN(Number(dateStr))) {
        date = new Date(Number(dateStr));
      }
      // Otherwise assume it's an ISO string or other date format
      else {
        date = new Date(dateStr);
      }
      
      // Validate the date is valid
      if (isNaN(date.getTime())) {
        console.error(`[Timeline] Invalid date: ${dateStr}`);
        return dateStr; // Return original if parsing failed
      }
      
      // Format the date as MM/DD
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch (error) {
      console.error(`[Timeline] Error formatting date ${dateStr}:`, error);
      return dateStr; // Return original on error
    }
  };

  // Function to format time in seconds to mm:ss
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    // Ensure seconds is a positive number
    seconds = Math.max(0, seconds);
    
    // Format as mm:ss or hh:mm:ss for longer durations
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    // For longer durations (over an hour), format as hh:mm:ss
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Update the getStartDate function to ensure proper date formatting based on selected period
  const getStartDate = (period: string): string => {
    const now = new Date();
    switch (period) {
      case '24h':
        const oneDayAgo = new Date(now);
        oneDayAgo.setHours(now.getHours() - 24);
        return oneDayAgo.toISOString();
      case '7d':
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return sevenDaysAgo.toISOString();
      case '30d':
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

  // Helper function to get date range for a period
  const getDateRange = (period: string): { startDate: Date; endDate: Date } => {
    const endDate = new Date();
    let startDate: Date;
    
    switch (period) {
      case '24h':
        startDate = new Date(endDate);
        startDate.setHours(endDate.getHours() - 24);
        break;
      case '7d':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '12m':
        startDate = new Date(endDate);
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);
    }
    
    return { startDate, endDate };
  };

  // Add this new function
  const fetchImpactData = async (period: string) => {
    setIsImpactLoading(true);
    
    try {
      const startDate = getStartDate(period);
      const endDate = new Date().toISOString();
      
      const metrics = await analyticsClient.getMetricsDirectly(startDate, endDate);
      
      setOverviewData(prev => ({
        ...prev,
        totalViews: metrics.pageViews ?? prev.totalViews,
        uniqueViews: metrics.uniqueVisitors ?? prev.uniqueViews,
        totalSessions: metrics.totalSessions ?? prev.totalSessions,
        totalClicks: metrics.totalSessions ?? prev.totalClicks,
        averageTimeOnPage: metrics.averageTimeOnPage ?? prev.averageTimeOnPage,
        bounceRate: metrics.bounceRate ?? prev.bounceRate,
        pageViews: metrics.pageViews ?? prev.pageViews,
        newUsers: metrics.newUsers ?? prev.newUsers, // Add this
        activeUsers: metrics.activeUsers ?? prev.activeUsers // Add this
      }));
    } catch (error) {
      console.error('[Impact] Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch impact data',
        variant: 'destructive'
      });
    } finally {
      setIsImpactLoading(false);
    }
  };

  // Update the handlePeriodChange function
  const handlePeriodChange = (tab: string, period: string) => {
    // Update the period first
    setSelectedPeriods(prev => ({
      ...prev,
      [tab]: period
    }));

    // For overview tab, use incremental state updates
    if (tab === 'overview') {
      setIsOverviewLoading(true);
      const startDate = getStartDate(period);
      const endDate = new Date().toISOString();
      
      analyticsClient.getMetricsDirectly(startDate, endDate)
        .then(metrics => {
          // Update states incrementally to prevent full re-render
          setOverviewData(prev => ({
            ...prev,
            totalViews: metrics.pageViews ?? prev.totalViews,
            uniqueViews: metrics.uniqueVisitors ?? prev.uniqueViews,
            totalSessions: metrics.totalSessions ?? prev.totalSessions,
            totalClicks: metrics.totalSessions ?? prev.totalClicks,
            averageTimeOnPage: metrics.averageTimeOnPage ?? prev.averageTimeOnPage,
            bounceRate: metrics.bounceRate ?? prev.bounceRate,
            pageViews: metrics.pageViews ?? prev.pageViews,
            newUsers: metrics.newUsers ?? prev.newUsers, // Add this
            activeUsers: metrics.activeUsers ?? prev.activeUsers // Add this
          }));
          
          if (metrics.timelineData && Array.isArray(metrics.timelineData)) {
            setTimelineData(prev => {
              const newData = sortTimelineData(metrics.timelineData);
              return JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;
            });
          }
          
          if (metrics.deviceData && Array.isArray(metrics.deviceData)) {
            setDeviceData(prev => {
              const newData = mapDeviceData(metrics.deviceData);
              return JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;
            });
          }
          
          if (metrics.trafficSources && Array.isArray(metrics.trafficSources)) {
            const formattedSources = mapTrafficSources(metrics.trafficSources);
            setTrafficSources(prev => 
              JSON.stringify(prev) === JSON.stringify(formattedSources) ? prev : formattedSources
            );
            setTrafficData(prev => {
              const newData = {
                sources: formattedSources,
                total: metrics.totalSessions
              };
              return JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;
            });
          }
        })
        .catch(error => {
          console.error('[Overview] Error fetching metrics:', error);
          toast({
            title: 'Error',
            description: 'Failed to fetch analytics data',
            variant: 'destructive'
          });
        })
        .finally(() => {
          setIsOverviewLoading(false);
        });
    } else {
      // For other tabs, use the appropriate fetch function
      switch (tab) {
        case 'engagement':
          fetchEngagementData(period);
          break;
        case 'leads':
          fetchLeadGenerationData(period);
          break;
        case 'content':
          fetchTrackedPages(period);
          break;
        case 'impact':
          fetchImpactData(period);
          break;
      }
    }
  };

  // Update the period change effect to be more selective
  useEffect(() => {
    // This effect will run when selectedPeriods changes
    console.log(`\n[Period Effect] Selected periods changed for ${activeTab} tab:`, selectedPeriods[activeTab as keyof typeof selectedPeriods]);
    
    // Get the current period for the active tab
    const currentPeriod = selectedPeriods[activeTab as keyof typeof selectedPeriods];
    
    // Only fetch initial data if none exists
    if (activeTab === 'overview' && !overviewData) {
      handlePeriodChange('overview', currentPeriod);
    } else if (activeTab === 'content' && trackedPages.length === 0) {
      handlePeriodChange('content', currentPeriod);
    } else if (activeTab === 'engagement' && !engagementData) {
      handlePeriodChange('engagement', currentPeriod);
    } else if (activeTab === 'leads' && !leadGenerationData) {
      handlePeriodChange('leads', currentPeriod);
    } else if (activeTab === 'impact' && !overviewData) {
      handlePeriodChange('impact', currentPeriod);
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriods[activeTab as keyof typeof selectedPeriods], activeTab]);

  // Update fetchOverviewData to accept a period parameter
  const fetchOverviewData = async (period?: string) => {
    if (!project) return;
    
    setIsLoading(true);
    
    try {
      const periodToUse = period || selectedPeriods.overview;
      console.log(`\n[Overview] Fetching overview data for period: ${periodToUse}`);
      
      const startDate = getStartDate(periodToUse);
      const endDate = new Date().toISOString();
      
      console.log('\n[Overview] Date range:', { 
        startDate, 
        endDate,
        formattedStart: new Date(startDate).toLocaleDateString(),
        formattedEnd: new Date(endDate).toLocaleDateString(),
        startYear: new Date(startDate).getFullYear(),
        startMonth: new Date(startDate).getMonth() + 1,
        startDay: new Date(startDate).getDate()
      });
      
      // Use direct fetching as the primary method
      try {
        console.log('\n[Overview] Attempting direct fetch...');
        const metrics = await analyticsClient.getMetricsDirectly(startDate, endDate);
        console.log('\n[Overview] Direct fetch successful:', metrics);
        
        // Update state with the fetched data
        setOverviewData({
        totalViews: metrics.pageViews ?? 0,
        uniqueViews: metrics.uniqueVisitors ?? 0,
        totalSessions: metrics.totalSessions ?? 0,
          totalClicks: metrics.totalSessions ?? 0, // Using sessions as proxy for clicks
          averageTimeOnPage: metrics.averageTimeOnPage ?? 0,
        bounceRate: metrics.bounceRate ?? 0,
        pageViews: metrics.pageViews ?? 0,
        newUsers: metrics.newUsers ?? 0, // Add this
        activeUsers: metrics.activeUsers ?? 0 // Add this
        });
        
        if (metrics.timelineData && Array.isArray(metrics.timelineData)) {
          // Use the helper function to sort and format timeline data
          const sortedTimelineData = sortTimelineData(metrics.timelineData);
          setTimelineData(sortedTimelineData);
          console.log('\n[Overview] Sorted timeline data:', sortedTimelineData);
        }
        
        if (metrics.deviceData && Array.isArray(metrics.deviceData)) {
          setDeviceData(mapDeviceData(metrics.deviceData));
        }
        
        if (metrics.trafficSources && Array.isArray(metrics.trafficSources)) {
          // Replace the existing mapping with our new mapping function
          setTrafficSources(mapTrafficSources(metrics.trafficSources));
          setTrafficData(prev => {
            const newData = {
              sources: mapTrafficSources(metrics.trafficSources),
              total: metrics.totalSessions
            };
            return JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;
          });
        }
      } catch (directError) {
        console.warn('\n[Overview] Direct fetch failed, falling back to API routes:', directError);
        // Continue with the API routes approach
      }
      
      // Fall back to the original method using getAllMetrics
      console.log('\n[Overview] Falling back to API routes...');
      const allData = await analyticsClient.getAllMetrics(startDate, endDate);
      console.log('\n[Overview] API routes data:', allData);
      
      setOverviewData({
        totalViews: allData.metrics.pageViews,
        uniqueViews: allData.metrics.uniqueVisitors,
        totalSessions: allData.metrics.totalSessions,
        totalClicks: allData.metrics.totalSessions, // Using sessions as proxy for clicks
        averageTimeOnPage: allData.metrics.averageTimeOnPage,
        bounceRate: allData.metrics.bounceRate,
        pageViews: allData.metrics.pageViews,
        newUsers: allData.metrics.newUsers, // Add this
        activeUsers: allData.metrics.activeUsers // Add this
      });
      
      if (allData.metrics.timelineData) {
        // Use the helper function to sort and format timeline data
        const sortedTimelineData = sortTimelineData(allData.metrics.timelineData);
        setTimelineData(sortedTimelineData);
        console.log('\n[API Routes] Sorted timeline data:', sortedTimelineData);
      }
      
      if (allData.devices.devices) {
        setDeviceData(mapDeviceData(allData.devices.devices));
      }
      
      if (allData.traffic.sources) {
        // Replace the existing mapping with our new mapping function
        const formattedTrafficSources = mapTrafficSources(allData.traffic.sources);
        setTrafficSources(formattedTrafficSources);
        setTrafficData({
          sources: formattedTrafficSources,
          total: allData.traffic.total
        });
      }
      
      if (allData.geographic.geographicData) {
        setGeographicData(mapGeographicData(allData.geographic.geographicData));
      }
    } catch (error) {
      console.error('\n[Overview] Error fetching overview data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch analytics data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update fetchEngagementData to accept a period parameter
  const fetchEngagementData = useCallback(async (period?: string) => {
    const periodToUse = period || selectedPeriods.engagement;
    console.log('\n[Engagement] Starting to fetch engagement data...', {
      projectId: params.projectId,
      period: periodToUse,
      startDate: getStartDate(periodToUse),
      endDate: new Date().toISOString()
    });

    setIsLoadingEngagement(true);
    try {
      const startDate = getStartDate(periodToUse);
      const response = await fetch(
        `/api/projects/${params.projectId}/analytics/engagement?` +
        new URLSearchParams({
          startDate,
          endDate: new Date().toISOString()
        })
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Engagement] API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error('Failed to fetch engagement data');
      }

      const data = await response.json();
      console.log('\n[Engagement] Raw response:', JSON.stringify(data, null, 2));

      // Validate the data structure
      if (!data.timeOfDay || !data.dayOfWeek || !data.userType) {
        console.error('[Engagement] Invalid data structure:', data);
        throw new Error('Invalid engagement data structure');
      }

      // Log key metrics
      console.log('\n[Engagement] Key metrics:', {
        timeOfDayTotal: data.timeOfDay.total,
        userTypeTotal: data.userType.total,
        returningUsers: data.userType.returning,
        newUsers: data.userType.new
      });

      setEngagementData(data);
      console.log('[Engagement] Data successfully processed and state updated');
    } catch (error) {
      console.error('[Engagement] Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch engagement data',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingEngagement(false);
    }
  }, [params.projectId, selectedPeriods.engagement]);

  // Update fetchTrackedPages to handle period changes properly
  const fetchTrackedPages = useCallback(async (period?: string) => {
    try {
      const periodToUse = period || selectedPeriods.content;
      console.log(`\n[Content] Fetching tracked pages for period: ${periodToUse}`);
      
      // Always clear existing data when fetching new data
      setTrackedPages([]);
      setIsLoadingPages(true);
      
      // Get the start date based on the selected period
      const startDate = getStartDate(periodToUse);
      const endDate = new Date().toISOString();
      
      console.log(`\n[Content] Date range: ${startDate} to ${endDate}`);
      
      // Map the UI sort option to GA4 metric name
      const sortByMapping: Record<string, string> = {
        'pageViews': 'screenPageViews',
        'uniqueVisitors': 'totalUsers',
        'averageTimeOnPage': 'averageSessionDuration',
        'bounceRate': 'bounceRate'
      };
      
      const gaSortBy = sortByMapping[contentSortBy] || 'screenPageViews';
      console.log(`\n[Content] Sorting by: ${contentSortBy} (GA metric: ${gaSortBy})`);
      
      // First try to get URLs from Google Analytics
      console.log(`\n[Content] Attempting to fetch URLs from Google Analytics...`);
      try {
        // Include the date range in the request to get metrics for the specific period
        const gaUrls = await analyticsClient.getUrlsFromGA(startDate, endDate, gaSortBy as any);
        
        console.log(`\n[Content] GA URLs response:`, gaUrls?.length || 0, 'URLs received');
        
        if (gaUrls && gaUrls.length > 0) {
          // Filter out any localhost URLs that might have made it through
          const productionUrls = gaUrls.filter((page: any) => {
            return !(page.url?.includes('localhost') || page.url?.includes('127.0.0.1'));
          });
          
          console.log(`\n[Content] Filtered ${gaUrls.length - productionUrls.length} localhost URLs, keeping ${productionUrls.length} production URLs`);
          
          console.log(`\n[Content] Using ${productionUrls.length} URLs from Google Analytics`);
          
          // Format the URLs to match the TrackedPage interface
          const formattedUrls = productionUrls
            .filter((page: any) => {
              // Filter out entries with "(not set)" as title or path
              if (page.title === "(not set)" || page.path === "(not set)") {
                return false;
              }
              
              // No keyword filtering anymore, include all URLs
              return true;
            })
            .map((page: any) => ({
              url: page.url, // Ensure the URL is included
              path: page.path,
              // Replace "(not set)" with a more descriptive title based on the path
              title: page.title === "(not set)" ? 
                page.path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Page' : 
                page.title,
              lastVisited: new Date().toISOString(),
              isActive: true,
              analytics: {
                pageViews: page.pageViews,
                uniqueVisitors: page.uniqueVisitors,
                averageTimeOnPage: page.averageTimeOnPage,
                bounceRate: page.bounceRate
              }
            }));
          
          // Deduplicate URLs based on normalized path
          const uniqueUrlsMap = new Map<string, TrackedPage>();
          
          formattedUrls.forEach((page: TrackedPage) => {
            try {
              // Normalize the path (lowercase, remove trailing slashes)
              const normalizedPath = page.path.toLowerCase().replace(/\/+$/, '');
              
              // If this path is already in our map, only replace it if the new page has more complete data
              if (uniqueUrlsMap.has(normalizedPath)) {
                const existingPage = uniqueUrlsMap.get(normalizedPath)!;
                
                // Get analytics values or default to 0
                const existingPageViews = existingPage.analytics?.pageViews || 0;
                const existingUniqueVisitors = existingPage.analytics?.uniqueVisitors || 0;
                const existingAvgTime = existingPage.analytics?.averageTimeOnPage || 0;
                
                const newPageViews = page.analytics?.pageViews || 0;
                const newUniqueVisitors = page.analytics?.uniqueVisitors || 0;
                const newAvgTime = page.analytics?.averageTimeOnPage || 0;
                
                // Calculate total metrics
                const totalPageViews = existingPageViews + newPageViews;
                const totalUniqueVisitors = existingUniqueVisitors + newUniqueVisitors;
                
                // Calculate weighted average time on page
                const weightedAvgTime = totalPageViews > 0 
                  ? Math.round((existingAvgTime * existingPageViews + newAvgTime * newPageViews) / totalPageViews) 
                  : 0;
                
                // Check title quality
                const existingHasGenericTitle = 
                  !existingPage.title || 
                  existingPage.title === 'Newing' || 
                  existingPage.title === 'Page';
                
                const newHasGenericTitle = 
                  !page.title || 
                  page.title === 'Newing' || 
                  page.title === 'Page';
                
                // Determine which title to keep
                let titleToUse;
                if (!newHasGenericTitle) {
                  // New title is better
                  titleToUse = page.title;
                } else if (!existingHasGenericTitle) {
                  // Existing title is better
                  titleToUse = existingPage.title;
                } else {
                  // Both generic, keep the existing one
                  titleToUse = existingPage.title;
                }
                
                // Create updated page with merged metrics
                const updatedPage: TrackedPage = {
                  ...existingPage,
                  title: titleToUse,
                  analytics: {
                    pageViews: totalPageViews,
                    uniqueVisitors: totalUniqueVisitors,
                    averageTimeOnPage: weightedAvgTime,
                    bounceRate: page.analytics?.bounceRate || existingPage.analytics?.bounceRate || 0
                  }
                };
                
                uniqueUrlsMap.set(normalizedPath, updatedPage);
              } else {
                // This is a new path, add it to our map
                uniqueUrlsMap.set(normalizedPath, page);
              }
            } catch (e) {
              // If there's any error in normalization, just use the original page
              console.error(`\n[Content] Error normalizing path ${page.path}:`, e);
              uniqueUrlsMap.set(page.path, page);
            }
          });
          
          const dedupedUrls = Array.from(uniqueUrlsMap.values());
          console.log(`\n[Content] Deduplicated from ${formattedUrls.length} to ${dedupedUrls.length} URLs`);
          
          setTrackedPages(dedupedUrls);
          
          // Check if we need to fetch additional analytics data
          const urlsWithoutAnalytics = dedupedUrls.filter((url: TrackedPage) => 
            !url.analytics || 
            url.analytics.pageViews === undefined || 
            url.analytics.uniqueVisitors === undefined
          );
          
          if (urlsWithoutAnalytics.length > 0) {
            console.log(`\n[Content] Fetching analytics for ${urlsWithoutAnalytics.length} URLs without metrics`);
            await fetchAllAnalytics(periodToUse, urlsWithoutAnalytics);
          } else {
            console.log(`\n[Content] All URLs already have analytics data, no need for additional fetching`);
            setIsLoadingPages(false);
          }
          return;
        } else {
          console.log('\n[Content] No URLs returned from Google Analytics, falling back to API');
        }
      } catch (gaError) {
        console.error('\n[Content] Error fetching URLs from Google Analytics:', gaError);
        // Continue to fallback instead of throwing
      }
      
      // Fallback to the existing API if Google Analytics data is not available
      console.log(`\n[Content] No Google Analytics data available, falling back to existing API`);
      try {
        // Include the date range in the request to get metrics for the specific period
        const response = await fetch(`/api/projects/${params.projectId}/analytics/urls?` + new URLSearchParams({
          startDate: startDate,
          endDate: endDate
        }));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`\n[Content] API error (${response.status}):`, errorText);
          throw new Error(`Failed to fetch URLs: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`\n[Content] Fallback API response:`, data);
        
        if (!data.urls || !Array.isArray(data.urls)) {
          console.error('\n[Content] Invalid response format from fallback API:', data);
          throw new Error('Invalid response format from API');
        }
        
        // Filter out any localhost URLs that might have made it through
        const productionUrls = data.urls.filter((page: any) => {
          return !(page.url?.includes('localhost') || page.url?.includes('127.0.0.1'));
        });
        
        console.log(`\n[Content] Filtered ${data.urls.length - productionUrls.length} localhost URLs from fallback API, keeping ${productionUrls.length}`);
      
        // Filter and clean up pages
        const filteredPages = productionUrls
          .filter((page: TrackedPage) => {
            // Filter out entries with "(not set)" as title
            if (page.title === "(not set)") {
              return false;
            }
            
            // No keyword filtering, include all URLs
            return true;
          })
          .map((page: TrackedPage) => ({
            ...page,
            // Replace "(not set)" with a more descriptive title based on the path
            title: page.title === "(not set)" ? 
              page.path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Page' : 
              page.title,
            // Extract analytics data if it exists in the response
            analytics: page.analytics || {
              pageViews: page.pageViews || 0,
              uniqueVisitors: page.uniqueVisitors || 0,
              averageTimeOnPage: page.averageTimeOnPage || 0,
              bounceRate: page.bounceRate || 0
            }
          }));
        
        // Deduplicate URLs based on normalized path
        const uniqueUrlsMap = new Map<string, TrackedPage>();
        
        filteredPages.forEach((page: TrackedPage) => {
          try {
            // Normalize the path (lowercase, remove trailing slashes)
            const normalizedPath = page.path.toLowerCase().replace(/\/+$/, '');
            
            // If this path is already in our map, only replace it if the new page has more complete data
            if (uniqueUrlsMap.has(normalizedPath)) {
              const existingPage = uniqueUrlsMap.get(normalizedPath)!;
              const existingHasAnalytics = existingPage.analytics && 
                existingPage.analytics.pageViews !== undefined && 
                existingPage.analytics.uniqueVisitors !== undefined;
              const newHasAnalytics = page.analytics && 
                page.analytics.pageViews !== undefined && 
                page.analytics.uniqueVisitors !== undefined;
              
              // Replace only if new page has analytics and existing doesn't, or new page has more views
              if ((newHasAnalytics && !existingHasAnalytics) || 
                  (newHasAnalytics && existingHasAnalytics && 
                   (page.analytics!.pageViews > existingPage.analytics!.pageViews))) {
                uniqueUrlsMap.set(normalizedPath, page);
              }
            } else {
              // This is a new path, add it to our map
              uniqueUrlsMap.set(normalizedPath, page);
            }
          } catch (e) {
            // If there's any error in normalization, just use the original page
            console.error(`\n[Content] Error normalizing path ${page.path}:`, e);
            uniqueUrlsMap.set(page.path, page);
          }
        });
        
        const dedupedUrls = Array.from(uniqueUrlsMap.values())
          .sort((a: TrackedPage, b: TrackedPage) => {
            const dateA = a.lastVisited ? new Date(a.lastVisited).getTime() : 0;
            const dateB = b.lastVisited ? new Date(b.lastVisited).getTime() : 0;
            return dateB - dateA;
          });
        
        console.log(`\n[Content] Deduplicated from ${filteredPages.length} to ${dedupedUrls.length} URLs`);
        setTrackedPages(dedupedUrls);

        // Check if we need to fetch additional analytics data
        const urlsWithoutAnalytics = dedupedUrls.filter((url: TrackedPage) => 
          !url.analytics || 
          url.analytics.pageViews === undefined || 
          url.analytics.uniqueVisitors === undefined
        );
        
        if (urlsWithoutAnalytics.length > 0) {
          console.log(`\n[Content] Fetching analytics for ${urlsWithoutAnalytics.length} URLs without metrics`);
          await fetchAllAnalytics(periodToUse, urlsWithoutAnalytics);
        } else {
          console.log(`\n[Content] All URLs already have analytics data, no need for additional fetching`);
          setIsLoadingPages(false);
        }
      } catch (fallbackError: unknown) {
        console.error('\n[Content] Error in fallback API:', fallbackError);
        // Show a more specific error message
        toast({
          title: 'Error',
          description: `Failed to load tracked pages: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
          variant: 'destructive'
        });
        
        // Set empty array to prevent infinite loading
        setTrackedPages([]);
        setIsLoadingPages(false);
      }
    } catch (error) {
      console.error('Error fetching tracked pages:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tracked pages',
        variant: 'destructive'
      });
      setIsLoadingPages(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, analyticsClient, getStartDate, toast, contentSortBy]);

  // Function to fetch analytics for all tracked pages
  const fetchAllAnalytics = async (period: string, pagesToFetch?: TrackedPage[]) => {
    setIsLoadingPages(true);
    const analytics: { [key: string]: PageAnalytics } = {};
    
    try {
      // Always fetch fresh data when period changes, don't rely on existing data
      console.log('\n[Content] Fetching analytics for each page with period:', period);
      
      // Get the date range for the selected period
      const startDate = getStartDate(period);
      const endDate = new Date().toISOString();
      
      console.log(`\n[Content] Date range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`);
      
      // Use the provided pages or all tracked pages
      const pages = pagesToFetch || trackedPages;
      
      // Process each URL in sequence rather than in parallel to avoid overwhelming the API
      for (const page of pages) {
        try {
          // Skip if the page already has analytics data
          if (page.analytics && 
              page.analytics.pageViews !== undefined && 
              page.analytics.uniqueVisitors !== undefined) {
            console.log(`\n[Content] Skipping ${page.path} - already has analytics data`);
            analytics[page.url] = page.analytics;
            continue;
          }
          
      // Parse the URL and remove query parameters
          const urlObj = new URL(page.url);
      urlObj.search = ''; // Remove query parameters
      const cleanUrl = urlObj.toString();
      const path = urlObj.pathname;

          console.log(`\n[Content] Fetching core metrics for ${path}`);
          
          // Make a simplified request for just the core metrics
      const response = await fetch(
        `/api/projects/${params.projectId}/analytics/metrics?` + new URLSearchParams({
          url: encodeURIComponent(cleanUrl),
          path: encodeURIComponent(path),
              startDate: startDate,
              endDate: endDate,
          properties: JSON.stringify([
            {
              key: '$pathname',
              value: path,
              operator: 'exact'
            }
          ])
        })
      );

      if (!response.ok) {
            console.error(`\n[Content] API error for ${path}: ${response.status}`);
            continue; // Skip this URL and move to the next one
      }

      const data = await response.json();
          
          // Store only the core metrics we need
          analytics[page.url] = {
        pageViews: parseInt(data.pageViews) || 0,
        uniqueVisitors: parseInt(data.uniqueVisitors) || 0,
        averageTimeOnPage: parseInt(data.averageTimeOnSite) || 0,
        bounceRate: parseFloat(data.bounceRate) || 0
          };
          
          console.log(`\n[Content] Got metrics for ${path}:`, analytics[page.url]);
          
          // Update the state after each URL to show progress
          setAnalyticsData({...analytics});
          
          // Add a small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
          
    } catch (error) {
          console.error(`\n[Content] Error fetching analytics for ${page.url}:`, error);
          // Continue with the next URL even if this one fails
        }
      }
      
      // Final update to the state
      setAnalyticsData(analytics);
      console.log('\n[Content] Completed fetching analytics for all pages');
      
    } catch (error) {
      console.error('\n[Content] Error in fetchAllAnalytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch page analytics',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingPages(false);
    }
  };

  // New function to fetch default tracked pages from GA4
  const fetchDefaultTrackedPages = async (period: string) => {
    setIsLoadingPages(true);
    
    try {
      console.log('\n[Content] Fetching default tracked pages with period:', period);
      
      // Get analytics config to check if GA is enabled - update to correct endpoint
      const config = await fetch(`/api/projects/${params.projectId}/analytics-config`).then(res => res.json());
      
      if (!config?.gaEnabled || !config?.gaPropertyId) {
        console.log('\n[Content] Google Analytics not enabled for this project');
        // Fall back to original method silently
        await fetchTrackedPages(period);
        return;
      }
      
      // Get the date range for the selected period
      const startDate = getStartDate(period);
      const endDate = new Date();
      
      console.log(`\n[Content] Date range for default pages: ${startDate} to ${endDate.toISOString()}`);
      
      // Fetch default pages from GA4 using the simplified method
      const defaultPages = await analyticsClient.getDefaultPageUrls(
        config.gaPropertyId,
        new Date(startDate),
        endDate,
        100 // Reasonable limit for most sites
      );
      
      console.log(`\n[Content] Fetched ${defaultPages.length} default pages from GA4`);
      
      // If no pages returned, fall back to original method without error message
      if (!defaultPages || defaultPages.length === 0) {
        console.log('\n[Content] No default pages found, falling back to fetchTrackedPages');
        await fetchTrackedPages(period);
        return;
      }
      
      // Format the pages to match the TrackedPage interface
      const formattedPages: TrackedPage[] = defaultPages.map((page: any) => ({
        url: page.url,
        path: page.path,
        title: page.title,
        lastVisited: new Date().toISOString(), // We don't have this data, so use current date
        isActive: true,
        analytics: {
          pageViews: page.pageViews,
          uniqueVisitors: page.uniqueVisitors,
          averageTimeOnPage: page.averageTimeOnPage,
          bounceRate: page.bounceRate
        }
      }));
      
      // Deduplicate URLs based on normalized path
      const uniqueUrlsMap = new Map<string, TrackedPage>();
      
      formattedPages.forEach((page: TrackedPage) => {
        try {
          // Normalize the path (lowercase, remove trailing slashes)
          const normalizedPath = page.path.toLowerCase().replace(/\/+$/, '');
          
          // If this path is already in our map, only replace it if the new page has more complete data
          if (uniqueUrlsMap.has(normalizedPath)) {
            const existingPage = uniqueUrlsMap.get(normalizedPath)!;
            const existingHasAnalytics = existingPage.analytics && 
              existingPage.analytics.pageViews !== undefined && 
              existingPage.analytics.uniqueVisitors !== undefined;
            const newHasAnalytics = page.analytics && 
              page.analytics.pageViews !== undefined && 
              page.analytics.uniqueVisitors !== undefined;
            
            // Replace only if new page has analytics and existing doesn't, or new page has more views
            if ((newHasAnalytics && !existingHasAnalytics) || 
                (newHasAnalytics && existingHasAnalytics && 
                 (page.analytics!.pageViews > existingPage.analytics!.pageViews))) {
              uniqueUrlsMap.set(normalizedPath, page);
            }
          } else {
            // This is a new path, add it to our map
            uniqueUrlsMap.set(normalizedPath, page);
          }
        } catch (e) {
          // If there's any error in normalization, just use the original page
          console.error(`\n[Content] Error normalizing path ${page.path}:`, e);
          uniqueUrlsMap.set(page.path, page);
        }
      });
      
      const dedupedPages = Array.from(uniqueUrlsMap.values());
      console.log(`\n[Content] Deduplicated from ${formattedPages.length} to ${dedupedPages.length} pages`);
      
      // Update the tracked pages
      setTrackedPages(dedupedPages);
      
      // Create analytics data for these pages
      const analytics: { [key: string]: PageAnalytics } = {};
      
      dedupedPages.forEach((page: TrackedPage) => {
        if (page.analytics) {
          analytics[page.url] = page.analytics;
        }
      });
      
      setAnalyticsData(analytics);
      
    } catch (error) {
      // Handle errors silently by falling back to the regular method without showing error message
      console.error('\n[Content] Error fetching default tracked pages:', error);
      await fetchTrackedPages(period);
    } finally {
      setIsLoadingPages(false);
    }
  };

  // Update the handleRefresh function to be more selective
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      if (activeTab === 'overview') {
        setIsOverviewLoading(true); // Show loading state
        const startDate = getStartDate(selectedPeriods.overview);
        const endDate = new Date().toISOString();
        
        const metrics = await analyticsClient.getMetricsDirectly(startDate, endDate);
        
        // Update states individually to prevent full re-render
        setOverviewData(prev => ({
          ...prev,
          totalViews: metrics.pageViews ?? prev.totalViews,
          uniqueViews: metrics.uniqueVisitors ?? prev.uniqueViews,
          totalSessions: metrics.totalSessions ?? prev.totalSessions,
          totalClicks: metrics.totalSessions ?? prev.totalClicks,
          averageTimeOnPage: metrics.averageTimeOnPage ?? prev.averageTimeOnPage,
          bounceRate: metrics.bounceRate ?? prev.bounceRate,
          pageViews: metrics.pageViews ?? prev.pageViews,
          newUsers: metrics.newUsers ?? prev.newUsers, // Add this
          activeUsers: metrics.activeUsers ?? prev.activeUsers // Add this
        }));
        
        if (metrics.timelineData && Array.isArray(metrics.timelineData)) {
          setTimelineData(sortTimelineData(metrics.timelineData));
        }
        
        if (metrics.deviceData && Array.isArray(metrics.deviceData)) {
          setDeviceData(mapDeviceData(metrics.deviceData));
        }
        
        if (metrics.trafficSources && Array.isArray(metrics.trafficSources)) {
          const formattedSources = mapTrafficSources(metrics.trafficSources);
          setTrafficSources(formattedSources);
          setTrafficData({
            sources: formattedSources,
            total: metrics.totalSessions
          });
        }
      } else {
        // For other tabs, use existing refresh logic
        switch (activeTab) {
          case 'content':
            // Use the new method for fetching default pages from GA4
            await fetchDefaultTrackedPages(selectedPeriods.content);
            break;
          case 'engagement':
            await fetchEngagementData(selectedPeriods.engagement);
            break;
          case 'leads':
            await fetchLeadGenerationData(selectedPeriods.leads);
            break;
          case 'impact':
            handlePeriodChange('impact', selectedPeriods.impact);
            break;
        }
      }
      
      toast({
        title: 'Success',
        description: 'Analytics data refreshed successfully',
      });
    } catch (error) {
      console.error('\n[Refresh] Error refreshing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh analytics data',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
      setIsOverviewLoading(false);
    }
  };

  // Update the useEffect to load the analytics config and data
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch analytics config
        const config = await analyticsClient.getConfig();
        setAnalyticsConfig(config);
        
        // After loading the config, load the overview data
        console.log('\n[Initial Load] Analytics config loaded, now loading overview data');
        await fetchOverviewData();
        
        // Also load lead generation data
        console.log('\n[Initial Load] Loading lead generation data');
        await fetchLeadGenerationData(selectedPeriods.leads);
      } catch (error) {
        console.error('Error loading analytics config:', error);
        setError('Failed to load analytics configuration');
      }
    };

    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]); // Only depend on projectId, not fetchOverviewData

  // Keep only one useEffect for tab changes and update it
  useEffect(() => {
    if (!project?.id) return;

    const loadDataForTab = async () => {
      try {
        switch (activeTab) {
          case 'overview':
            // Only fetch if we don't have data or if data is empty
            if (!overviewData || 
                (Object.keys(overviewData).length === 0) || 
                !timelineData.length || 
                !deviceData.length || 
                !trafficSources.length) {
              console.log('\n[Tab Change] Loading overview data - no existing data found');
              await fetchOverviewData(selectedPeriods.overview);
            } else {
              console.log('\n[Tab Change] Overview data already exists, skipping fetch');
            }
            break;
          case 'engagement':
            if (!engagementData) {
              console.log('\n[Tab Change] Loading engagement data...');
              await fetchEngagementData(selectedPeriods.engagement);
            }
            break;
          case 'leads':
            if (!leadGenerationData) {
              console.log('\n[Tab Change] Loading lead generation data...');
              await fetchLeadGenerationData(selectedPeriods.leads);
            }
            break;
          case 'content':
            // Only fetch if we don't have data
            if (!trackedPages.length) {
              console.log('\n[Tab Change] Loading content data...');
              // Use the new method for fetching default pages from GA4
              await fetchDefaultTrackedPages(selectedPeriods.content);
            }
            break;
          case 'impact':
            if (!overviewData) {
              console.log('\n[Tab Change] Loading impact data...');
              handlePeriodChange('impact', selectedPeriods.impact);
            }
            break;
        }
      } catch (error) {
        console.error(`Error loading data for ${activeTab}:`, error);
      }
    };

    loadDataForTab();
  }, [activeTab]); // Only depend on activeTab to prevent loops

  // Add a debug effect to log state changes with better formatting
  useEffect(() => {
    console.log('\n[State Update] Overview data:', JSON.stringify(overviewData, null, 2));
    console.log('\n[State Update] Device data:', JSON.stringify(deviceData, null, 2));
    console.log('\n[State Update] Traffic sources:', JSON.stringify(trafficSources, null, 2));
    console.log('\n[State Update] Timeline data:', JSON.stringify(timelineData, null, 2));
  }, [overviewData, deviceData, trafficSources, timelineData]);

  // Add helper function to get icons for traffic sources
  const getTrafficSourceIcon = (type: string) => {
    switch (type) {
      case 'direct':
        return ArrowRight;
      case 'referral':
        return Link2;
      case 'search':
        return Search;
      case 'social':
        return Share2;
      default:
        return Link2;
    }
  };

  // Function to fetch analytics for a specific page
  const fetchPageAnalytics = async (url: string, period: string) => {
    try {
      // Parse the URL and remove query parameters
      const urlObj = new URL(url);
      urlObj.search = ''; // Remove query parameters
      const cleanUrl = urlObj.toString();
      const path = urlObj.pathname;

      console.log(`\n[Page Analytics] Fetching analytics for ${path} with period: ${period}`);
      const startDate = getStartDate(period);
      const endDate = new Date().toISOString();
      
      console.log(`\n[Page Analytics] Date range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`);

      // Simplified request with just the pathname for more reliable matching
      const response = await fetch(
        `/api/projects/${params.projectId}/analytics/metrics?` + new URLSearchParams({
          url: encodeURIComponent(cleanUrl),
          path: encodeURIComponent(path),
          startDate: startDate,
          endDate: endDate,
          properties: JSON.stringify([
            {
              key: '$pathname',
              value: path,
              operator: 'exact'
            }
          ])
        })
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`\n[Page Analytics] API error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`\n[Page Analytics] Response for ${path}:`, {
        pageViews: data.pageViews,
        uniqueVisitors: data.uniqueVisitors,
        averageTimeOnPage: data.averageTimeOnSite
      });
      
      // Ensure we have valid numbers or default to 0
      return {
        pageViews: parseInt(data.pageViews) || 0,
        uniqueVisitors: parseInt(data.uniqueVisitors) || 0,
        averageTimeOnPage: parseInt(data.averageTimeOnSite) || 0,
        bounceRate: parseFloat(data.bounceRate) || 0
      };
    } catch (error) {
      console.error(`\n[Page Analytics] Error fetching analytics for ${url}:`, error);
      return {
        pageViews: 0,
        uniqueVisitors: 0,
        averageTimeOnPage: 0,
        bounceRate: 0
      };
    }
  };

  // Helper function to sort timeline data chronologically
  const sortTimelineData = (timelineData: TimelineDataPoint[]): TimelineDataPoint[] => {
    if (!timelineData || !Array.isArray(timelineData) || timelineData.length === 0) {
      console.log('[Timeline] No timeline data to sort');
      return [];
    }
    
    console.log('[Timeline] Raw timeline data:', timelineData);
    
    // First, check if we're dealing with time-based data (like "7 AM")
    const hasTimeFormat = timelineData.some(point => 
      typeof point.date === 'string' && (point.date.includes('AM') || point.date.includes('PM'))
    );
    
    if (hasTimeFormat) {
      console.log('[Timeline] Detected time-based data, converting to proper dates');
      
      // For time-based data, we need to convert to a proper date format
      // Assume the data is for the current day and create proper date objects
      const today = new Date();
      const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      return timelineData.map(point => {
        // Parse the time (e.g., "7 AM" to hours)
        let hours = 0;
        try {
          if (typeof point.date === 'string') {
            const timeParts = point.date.trim().split(' ');
            hours = parseInt(timeParts[0]);
            if (timeParts[1] === 'PM' && hours < 12) hours += 12;
            if (timeParts[1] === 'AM' && hours === 12) hours = 0;
          }
        } catch (e) {
          console.error('[Timeline] Error parsing time:', point.date, e);
        }
        
        // Create a new date with the parsed hours
        const dateWithHours = new Date(baseDate);
        dateWithHours.setHours(hours);
        
        // Format as HH:00
        const formattedTime = `${dateWithHours.getHours()}:00`;
        
        return {
          ...point,
          date: formattedTime,
          originalDate: dateWithHours
        };
      })
      .sort((a: any, b: any) => a.originalDate.getTime() - b.originalDate.getTime())
      .map(({ originalDate, ...rest }: any) => rest);
    }
    
    // For regular date-based data
    return timelineData.map(point => {
      // Parse the date for sorting purposes
      let dateObj;
      try {
        // Handle different date formats
        if (/^\d{8}$/.test(point.date)) {
          // YYYYMMDD format
          const year = point.date.substring(0, 4);
          const month = point.date.substring(4, 6);
          const day = point.date.substring(6, 8);
          dateObj = new Date(`${year}-${month}-${day}`);
        } else if (!isNaN(Number(point.date))) {
          // Timestamp
          dateObj = new Date(Number(point.date));
      } else {
          // ISO string or other format
          dateObj = new Date(point.date);
        }
        
        // Validate date
        if (isNaN(dateObj.getTime())) {
          console.error(`[Timeline] Invalid date in sorting: ${point.date}`);
          dateObj = new Date(); // Use current date as fallback
        }
    } catch (error) {
        console.error(`[Timeline] Error parsing date ${point.date}:`, error);
        // Use current date as fallback for sorting
        dateObj = new Date();
      }
      
      return {
        ...point,
        // Format the date for display
        date: formatTimelineDate(point.date),
        // Keep original date object for sorting
        originalDate: dateObj
      };
    })
    // Sort by the original date to ensure chronological order
    .sort((a: any, b: any) => a.originalDate.getTime() - b.originalDate.getTime())
    // Remove the originalDate property before returning
    .map(({ originalDate, ...rest }: any) => rest);
  };

  // At the top of the component, add this helper function
  const getDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        console.log('\n[Client] Calculating 24h range:', {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        });
        break;
      case '7d':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        console.log('\n[Client] Calculating 7d range:', {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        });
        break;
      case '30d':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        console.log('\n[Client] Calculating 30d range:', {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        });
        break;
      default:
        console.warn('\n[Client] Unknown period:', period, 'defaulting to 30d');
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }

    return { startDate, endDate };
  };

  // Update fetchLeadGenerationData to accept period parameter
  const fetchLeadGenerationData = useCallback(async (period: string) => {
    if (!project?.id) return;
    
    setIsLoadingLeadGeneration(true);
    try {
      // Get date range based on selected period
      const { startDate, endDate } = getDateRange(period);
      
      console.log('\n[Leads] Fetching data for period:', {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      const response = await fetch(
        `/api/projects/${project.id}/analytics/leads?` + 
        new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      );

      if (!response.ok) throw new Error('Failed to fetch lead generation data');
      const data = await response.json();
      setLeadGenerationData(data);
    } catch (error) {
      console.error('[Leads] Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch lead generation data',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingLeadGeneration(false);
    }
  }, [project?.id]);
  // Update the refresh function for leads
  const refreshLeadGenerationData = async () => {
    if (isLoadingLeadGeneration) return;
    await fetchLeadGenerationData(selectedPeriods.leads);
  };

  // Update the useEffect for tab changes
  useEffect(() => {
    if (!project?.id) return;

    const loadDataForTab = async () => {
      try {
        switch (activeTab) {
          case 'overview':
            // Only fetch if we don't have data or if data is empty
            if (!overviewData || 
                (Object.keys(overviewData).length === 0) || 
                !timelineData.length || 
                !deviceData.length || 
                !trafficSources.length) {
              console.log('\n[Tab Change] Loading overview data - no existing data found');
              await fetchOverviewData(selectedPeriods.overview);
            } else {
              console.log('\n[Tab Change] Overview data already exists, skipping fetch');
            }
            break;
          case 'engagement':
            if (!engagementData) {
              console.log('\n[Tab Change] Loading engagement data...');
              await fetchEngagementData(selectedPeriods.engagement);
            }
            break;
          case 'leads':
            if (!leadGenerationData) {
              console.log('\n[Tab Change] Loading lead generation data...');
              await fetchLeadGenerationData(selectedPeriods.leads);
            }
            break;
          case 'content':
            // Only fetch if we don't have data
            if (!trackedPages.length) {
              console.log('\n[Tab Change] Loading content data...');
              // Use the new method for fetching default pages from GA4
              await fetchDefaultTrackedPages(selectedPeriods.content);
            }
            break;
          case 'impact':
            if (!overviewData) {
              console.log('\n[Tab Change] Loading impact data...');
              handlePeriodChange('impact', selectedPeriods.impact);
            }
            break;
        }
      } catch (error) {
        console.error(`Error loading data for ${activeTab}:`, error);
      }
    };

    loadDataForTab();
  }, [activeTab]); // Only depend on activeTab to prevent loops

  // Add a new effect for initial data loading
  useEffect(() => {
    if (!project?.id) return;

    const loadInitialData = async () => {
      // Only load data if we don't have it yet
      if (activeTab === 'overview' && !overviewData) {
        const startDate = getStartDate(selectedPeriods.overview);
        const endDate = new Date().toISOString();
        
        try {
          const metrics = await analyticsClient.getMetricsDirectly(startDate, endDate);
          
          setOverviewData({
            totalViews: metrics.pageViews ?? 0,
            uniqueViews: metrics.uniqueVisitors ?? 0,
            totalSessions: metrics.totalSessions ?? 0,
            totalClicks: metrics.totalSessions ?? 0,
            averageTimeOnPage: metrics.averageTimeOnPage ?? 0,
            bounceRate: metrics.bounceRate ?? 0,
            pageViews: metrics.pageViews ?? 0,
            newUsers: metrics.newUsers ?? 0, // Add this
            activeUsers: metrics.activeUsers ?? 0 // Add this
          });
          
          if (metrics.timelineData && Array.isArray(metrics.timelineData)) {
            setTimelineData(sortTimelineData(metrics.timelineData));
          }
          
          if (metrics.deviceData && Array.isArray(metrics.deviceData)) {
            setDeviceData(mapDeviceData(metrics.deviceData));
          }
          
          if (metrics.trafficSources && Array.isArray(metrics.trafficSources)) {
            const formattedSources = mapTrafficSources(metrics.trafficSources);
            setTrafficSources(formattedSources);
            setTrafficData({
              sources: formattedSources,
              total: metrics.totalSessions
            });
          }
        } catch (error) {
          console.error('\n[Initial Load] Error:', error);
        }
      }
    };

    loadInitialData();
  }, [project?.id, activeTab]); // Only run on initial load and tab changes

  // Add to state declarations
  const [isImpactLoading, setIsImpactLoading] = useState(false);

  if (isLoading) {
    return (
      <BlurPage>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold">Project Insights</h1>
            <Card className="p-8">
              <div className="animate-pulse flex flex-col gap-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </BlurPage>
    );
  }

  // Check if user is a guest
  const isGuest = project?.client.clientUsers.some(
    cu => cu.userId === userId && cu.role === 'GUEST'
  );

  if (!analyticsConfig?.gaEnabled) {
    return (
      <BlurPage>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold">Project Insights</h1>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Analytics Not Configured</AlertTitle>
              <AlertDescription>
                To view analytics insights, you need to configure Google Analytics integration for this project.
                Please add your Google Analytics property ID in the project settings.
                <div className="mt-4">
                  <Link href={`/client/${params.clientId}/projects/${params.projectId}/settings`}>
                    <Button variant="outline">Configure Analytics</Button>
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </BlurPage>
    );
  }

  // If everything is configured, show analytics dashboard
  return (
    <BlurPage>
      <div className="flex flex-col gap-8 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Project Insights</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive analytics and insights for your GreenBook
            </p>
          </div>
          <div className="flex items-center gap-4">
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content Analytics</TabsTrigger>
            <TabsTrigger value="engagement">User Engagement</TabsTrigger>
            <TabsTrigger value="leads">Lead Generation</TabsTrigger>
            <TabsTrigger value="impact">Environmental Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Overview</h2>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
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
                      variant={selectedPeriods.overview === period.id ? 'default' : 'ghost'}
                      className="text-sm"
                      onClick={() => handlePeriodChange('overview', period.id)}
                    >
                      {period.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Key Business Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Page Views"
                value={overviewData.totalViews?.toLocaleString() || '0'}
                icon={Eye}
                tooltip="Total number of pages viewed"
                isLoading={isOverviewLoading}
              />
              <MetricCard
                title="Visitors"
                value={overviewData.uniqueViews?.toLocaleString() || '0'}
                icon={Users}
                tooltip="Unique visitors to your site"
                isLoading={isOverviewLoading}
              />
              <MetricCard
                title="Sessions"
                value={overviewData.totalSessions?.toLocaleString() || '0'}
                icon={Activity}
                tooltip="Total number of user sessions"
                isLoading={isOverviewLoading}
              />
              <MetricCard
                title="Avg. Session Duration"
                value={overviewData.averageTimeOnPage > 0 ? formatTime(overviewData.averageTimeOnPage) : '0:00'}
                icon={Clock}
                tooltip="Average time spent per session"
                isLoading={isOverviewLoading}
              />
            </div>

            {/* New User Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <MetricCard
                title="New Users"
                value={overviewData.newUsers?.toLocaleString() || '0'}
                icon={UserPlus}
                tooltip="First-time visitors to your site"
                isLoading={isOverviewLoading}
                description={`${((overviewData.newUsers / overviewData.uniqueViews) * 100).toFixed(1)}% of total visitors`}
              />
              <MetricCard
                title="Active Users"
                value={overviewData.activeUsers?.toLocaleString() || '0'}
                icon={Users}
                tooltip="Users who actively engaged with your site"
                isLoading={isOverviewLoading}
                description={`${((overviewData.activeUsers / overviewData.uniqueViews) * 100).toFixed(1)}% engagement rate`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <MetricCard
                title="Bounce Rate"
                value={overviewData.bounceRate > 0 
                  ? `${(overviewData.bounceRate * 100).toFixed(2)}%` 
                  : '0%'}
                icon={ArrowDown}
                tooltip="Percentage of sessions with only one page view"
                isLoading={isOverviewLoading}
              />
              <MetricCard
                title="Page Views per Session"
                value={overviewData.totalSessions > 0 
                  ? (overviewData.totalViews / overviewData.totalSessions).toFixed(2) 
                  : '0.00'}
                icon={FileText}
                tooltip="Average number of pages viewed per session"
                isLoading={isOverviewLoading}
              />
            </div>

            {/* Visitor Trends - Full Width */}
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-semibold mb-6">Visitor Trends</h3>
              {isOverviewLoading ? (
                <Skeleton className="h-96" />
              ) : timelineData && timelineData.length > 0 ? (
                <LineChart
                  data={timelineData}
                  index="date"
                  categories={["pageViews", "uniqueVisitors"]}  // Changed from ["views", "visitors"]
                  colors={["blue", "green"]}
                  valueFormatter={(value) => value.toLocaleString()}
                  yAxisWidth={48}
                  className="h-96"
                />
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  No timeline data available for the selected period
                </div>
              )}
            </Card>

            {/* Distribution Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Traffic Sources */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Traffic Sources</h3>
                {isOverviewLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <Tabs defaultValue="overview">
                    <TabsList className="mb-4">
                      <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                      <TabsTrigger value="referral" className="text-xs">Referral</TabsTrigger>
                      <TabsTrigger value="search" className="text-xs">Search</TabsTrigger>
                      <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-0">
                      <div className="space-y-4 h-[300px] overflow-y-auto">
                        {trafficData.sources
                          ?.sort((a: TrafficSource, b: TrafficSource) => b.visits - a.visits)
                          .map((sourceData: TrafficSource) => {
                            const Icon = getTrafficSourceIcon(sourceData.type);
                            const typeVisits = sourceData.details.reduce((sum, detail) => sum + detail.visits, 0);
                            return (
                              <div key={sourceData.type} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 ${
                                    sourceData.type === 'direct' ? 'text-blue-500' :
                                    sourceData.type === 'referral' ? 'text-green-500' :
                                    sourceData.type === 'search' ? 'text-orange-500' :
                                    'text-purple-500'
                                  }`} />
                                  <div>
                                    <div className="font-medium">{sourceData.source}</div>
                                    <div className="text-sm text-gray-500">
                                      {typeVisits.toLocaleString()} visits
                                    </div>
                                  </div>
                                </div>
                                <div className="font-medium">{sourceData.percentage}%</div>
                              </div>
                            );
                        })}
                        {(!trafficData.sources?.length) && (
                          <div className="flex items-center justify-center h-full text-center text-sm text-gray-500">
                            No traffic data available for this period
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {(['referral', 'search', 'social'] as const).map((tabType) => (
                      <TabsContent key={tabType} value={tabType} className="mt-0">
                        <div className="space-y-4 h-[300px] overflow-y-auto">
                          {trafficData.sources
                            ?.find((source: TrafficSource) => source.type === tabType)
                            ?.details
                            ?.filter(detail => detail.source && detail.source !== "(not set)" && detail.source !== "not set")
                            ?.sort((a: TrafficSourceDetail, b: TrafficSourceDetail) => b.visits - a.visits)
                            .map((detail: TrafficSourceDetail) => {
                              const sourceData = trafficData.sources.find(s => s.type === tabType);
                              const typeTotal = sourceData?.details.reduce((sum, d) => sum + d.visits, 0) || 0;
                              const percentage = typeTotal > 0 ? Math.round((detail.visits / typeTotal) * 100) : 0;
                              
                              // Generate a URL for the source if it doesn't have one
                              let sourceUrl = detail.url;
                              if (!sourceUrl && detail.source) {
                                // Try to create a URL based on the source name
                                if (tabType === 'search') {
                                  // For search engines
                                  if (detail.source.toLowerCase().includes('google')) {
                                    sourceUrl = 'https://www.google.com';
                                  } else if (detail.source.toLowerCase().includes('bing')) {
                                    sourceUrl = 'https://www.bing.com';
                                  } else if (detail.source.toLowerCase().includes('yahoo')) {
                                    sourceUrl = 'https://www.yahoo.com';
                                  } else if (detail.source.toLowerCase().includes('duckduckgo')) {
                                    sourceUrl = 'https://duckduckgo.com';
                                  }
                                } else if (tabType === 'social') {
                                  // For social media
                                  if (detail.source.toLowerCase().includes('facebook')) {
                                    sourceUrl = 'https://www.facebook.com';
                                  } else if (detail.source.toLowerCase().includes('twitter') || detail.source.toLowerCase().includes('x.com')) {
                                    sourceUrl = 'https://twitter.com';
                                  } else if (detail.source.toLowerCase().includes('linkedin')) {
                                    sourceUrl = 'https://www.linkedin.com';
                                  } else if (detail.source.toLowerCase().includes('instagram')) {
                                    sourceUrl = 'https://www.instagram.com';
                                  } else if (detail.source.toLowerCase().includes('pinterest')) {
                                    sourceUrl = 'https://www.pinterest.com';
                                  } else if (detail.source.toLowerCase().includes('reddit')) {
                                    sourceUrl = 'https://www.reddit.com';
                                  }
                                } else if (tabType === 'referral') {
                                  // For referrals, try to construct a URL
                                  if (detail.source.includes('.')) {
                                    sourceUrl = `https://${detail.source}`;
                                  }
                                }
                              }
                              
                              return (
                                <div key={detail.source} className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    {tabType === 'referral' && <Link2 className="h-4 w-4 text-green-500" />}
                                    {tabType === 'search' && <Search className="h-4 w-4 text-orange-500" />}
                                    {tabType === 'social' && (
                                      detail.source.toLowerCase().includes('facebook') ? <Facebook className="h-4 w-4 text-blue-600" /> :
                                      detail.source.toLowerCase().includes('twitter') || detail.source.toLowerCase().includes('x.com') ? <Twitter className="h-4 w-4 text-blue-400" /> :
                                      detail.source.toLowerCase().includes('linkedin') ? <Linkedin className="h-4 w-4 text-blue-700" /> :
                                      detail.source.toLowerCase().includes('instagram') ? <Instagram className="h-4 w-4 text-pink-500" /> :
                                      <Share2 className="h-4 w-4 text-purple-500" />
                                    )}
                                    <div>
                                      <div className="font-medium">
                                        {sourceUrl ? (
                                          <Link href={sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                            {detail.source}
                                            <ArrowUpRight className="h-3 w-3" />
                                          </Link>
                                        ) : (
                                          detail.source
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {detail.visits.toLocaleString()} visits ({percentage}% of {tabType} traffic)
                                      </div>
                                    </div>
                                  </div>
                                  <div className="font-medium">{percentage}%</div>
                                </div>
                              );
                          })}
                          {(!trafficData.sources?.find((source: TrafficSource) => source.type === tabType)?.details?.length) && (
                            <div className="flex items-center justify-center h-full text-center text-sm text-gray-500">
                              No {tabType} traffic for this period
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </Card>

              {/* Device Types */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Device Types</h3>
                {isOverviewLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 h-[300px] overflow-y-auto">
                    {deviceData.map((device) => (
                      <div key={device.type} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                          {device.type === 'desktop' && <Laptop className="h-4 w-4 text-blue-500" />}
                          {device.type === 'mobile' && <Smartphone className="h-4 w-4 text-green-500" />}
                          {device.type === 'tablet' && <Tablet className="h-4 w-4 text-purple-500" />}
                              <div>
                            <div className="font-medium capitalize">{device.type}</div>
                            <div className="text-sm text-gray-500">
                              {device.visits ? device.visits.toLocaleString() : Math.round((device.percentage / 100) * overviewData.totalViews).toLocaleString()} visits
                            </div>
                          </div>
                        </div>
                        <div className="font-medium">{device.percentage}%</div>
                      </div>
                    ))}
                    {deviceData.length === 0 && (
                      <div className="flex items-center justify-center h-full text-center text-sm text-gray-500">
                        No device data available for this period
                      </div>
                    )}
                    </div>
                )}
              </Card>

              {/* Geographic Distribution */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Geographic Distribution</h3>
                {isOverviewLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <Tabs defaultValue="countries">
                    <TabsList className="mb-4">
                      <TabsTrigger value="countries" className="text-xs">Countries</TabsTrigger>
                      <TabsTrigger value="cities" className="text-xs">Cities by Country</TabsTrigger>
                      <TabsTrigger value="top-cities" className="text-xs">Top Cities Overall</TabsTrigger>
                    </TabsList>

                    <TabsContent value="countries" className="mt-0">
                      <div className="space-y-4 h-[400px] overflow-y-auto">
                        {geographicData
                          .filter(item => item.country && item.country !== "(not set)" && item.country !== "not set")
                          .sort((a, b) => b.percentage - a.percentage)
                          .slice(0, 10)
                          .map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-blue-500" />
                              <div>
                                <div className="font-medium">{item.country}</div>
                                <div className="text-sm text-gray-500">
                                  {item.visits ? item.visits.toLocaleString() : Math.round((item.percentage / 100) * overviewData.totalViews).toLocaleString()} visits
                                </div>
                              </div>
                            </div>
                            <div className="font-medium">{item.percentage}%</div>
                          </div>
                        ))}
                          {geographicData.filter(item => item.country && item.country !== "(not set)" && item.country !== "not set").length === 0 && (
                            <div className="flex items-center justify-center h-full text-center text-sm text-gray-500">
                              No country data available for this period
                            </div>
                          )}
                    </div>
                  </TabsContent>

                    <TabsContent value="cities" className="mt-0">
                      <div className="space-y-4 h-[400px] overflow-y-auto">
                        {geographicData
                          .filter(country => country.country && country.country !== "(not set)" && country.country !== "not set")
                          .map(country => (
                            <div key={country.country} className="mb-6">
                              <div className="flex items-center gap-2 mb-2">
                                <Globe className="h-4 w-4 text-blue-500" />
                                <h4 className="font-medium">{country.country}</h4>
                              </div>
                              <div className="pl-6 space-y-3">
                                {(country.cities || [])
                                  .filter(city => city.name && city.name !== "(not set)" && city.name !== "not set")
                                  .sort((a, b) => b.percentage - a.percentage)
                                  .slice(0, 3)
                                  .map(city => (
                            <div key={`${country.country}-${city.name}`} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-500" />
                              <div>
                                  <div className="font-medium">{city.name}</div>
                                  <div className="text-sm text-gray-500">
                                            {city.visits ? city.visits.toLocaleString() : Math.round((city.percentage / 100) * country.visits).toLocaleString()} visits
                                  </div>
                              </div>
                            </div>
                              <div className="font-medium">{city.percentage}%</div>
                          </div>
                                  ))}
                                {(country.cities || []).filter(city => city.name && city.name !== "(not set)" && city.name !== "not set").length === 0 && (
                                  <div className="text-sm text-gray-500">No city data available</div>
                                )}
                              </div>
                            </div>
                          ))}
                          {geographicData.filter(country => country.country && country.country !== "(not set)" && country.country !== "not set").length === 0 && (
                            <div className="flex items-center justify-center h-full text-center text-sm text-gray-500">
                              No geographic data available for this period
                            </div>
                          )}
                      </div>
                    </TabsContent>

                    <TabsContent value="top-cities" className="mt-0">
                      <div className="space-y-4 h-[400px] overflow-y-auto">
                        {geographicData
                          .flatMap(country => 
                            (country.cities || [])
                              .filter(city => city.name && city.name !== "(not set)" && city.name !== "not set")
                              .map(city => ({
                                name: city.name,
                                country: country.country,
                                visits: city.visits || Math.round((city.percentage / 100) * country.visits),
                                percentage: city.percentage
                              }))
                          )
                          .sort((a, b) => b.visits - a.visits)
                          .slice(0, 10)
                          .map((city, index) => (
                            <div key={`${city.country}-${city.name}-${index}`} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-500" />
                                <div>
                                  <div className="font-medium">{city.name}</div>
                                  <div className="text-sm text-gray-500">
                                    {city.visits.toLocaleString()} visits, {city.country}
                                  </div>
                                </div>
                              </div>
                              <div className="font-medium">{index + 1}</div>
                            </div>
                          ))}
                          {geographicData.flatMap(country => (country.cities || [])).filter(city => city.name && city.name !== "(not set)" && city.name !== "not set").length === 0 && (
                            <div className="flex items-center justify-center h-full text-center text-sm text-gray-500">
                              No city data available for this period
                            </div>
                          )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Content Analytics</h2>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline"
                  onClick={() => fetchTrackedPages(selectedPeriods.content)}
                  disabled={isLoadingPages}
                  className="gap-2"
                >
                  {isLoadingPages ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
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
                      variant={selectedPeriods.content === period.id ? 'default' : 'ghost'}
                      className="text-sm"
                      onClick={() => handlePeriodChange('content', period.id)}
                    >
                      {period.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Pages Overview */}
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Top Pages</h3>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500 mr-2">Sort by:</div>
                  <select 
                    className="text-sm border rounded p-1"
                    value={contentSortBy}
                    onChange={(e) => setContentSortBy(e.target.value as any)}
                    aria-label="Sort content by metric"
                  >
                    <option value="pageViews">Page Views</option>
                    <option value="uniqueVisitors">Unique Visitors</option>
                    <option value="averageTimeOnPage">Time on Page</option>
                    <option value="bounceRate">Bounce Rate</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContentSortOrder(contentSortOrder === 'desc' ? 'asc' : 'desc')}
                    className="gap-1"
                  >
                    {contentSortOrder === 'desc' ? 
                      <ArrowDownRight className="h-4 w-4" /> : 
                      <ArrowUpRight className="h-4 w-4" />
                    }
                    {contentSortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
                  </Button>
                </div>
              </div>

              {isLoadingPages ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center p-2 border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-6 text-sm text-gray-400">{i + 1}.</div>
                        <div>
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32 mt-1" />
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 pb-2 border-b text-sm font-medium text-gray-500">
                    <div className="col-span-5">Page</div>
                    <div className="col-span-2 text-right">Views</div>
                    <div className="col-span-2 text-right">Visitors</div>
                    <div className="col-span-2 text-right">Avg. Time</div>
                    <div className="col-span-1 text-right">Bounce</div>
                  </div>
                  
                  {trackedPages
                    .sort((a, b) => {
                      // Get the values to compare based on the selected sort field
                      const aValue = a.analytics?.[contentSortBy] ?? 
                                    analyticsData[a.url]?.[contentSortBy] ?? 
                                    a[contentSortBy as keyof TrackedPage] ?? 0;
                      const bValue = b.analytics?.[contentSortBy] ?? 
                                    analyticsData[b.url]?.[contentSortBy] ?? 
                                    b[contentSortBy as keyof TrackedPage] ?? 0;
                      
                      // For bounce rate, lower is better, so we might want to invert the sort
                      if (contentSortBy === 'bounceRate') {
                        return contentSortOrder === 'desc' ? bValue - aValue : aValue - bValue;
                      }
                      
                      // For other metrics, higher is better
                      return contentSortOrder === 'desc' ? bValue - aValue : aValue - bValue;
                    })
                    .slice(0, 10) // Show top 10 pages
                    .map((page, index) => {
                      const pageViews = page.analytics?.pageViews || analyticsData[page.url]?.pageViews || 0;
                      const uniqueVisitors = page.analytics?.uniqueVisitors || analyticsData[page.url]?.uniqueVisitors || 0;
                      const avgTime = page.analytics?.averageTimeOnPage || analyticsData[page.url]?.averageTimeOnPage || 0;
                      const bounceRate = page.analytics?.bounceRate || analyticsData[page.url]?.bounceRate || 0;
                      
                      return (
                        <div key={page.url} className="grid grid-cols-12 gap-4 py-3 border-b items-center">
                          <div className="col-span-5 flex items-center gap-2">
                            <div className="w-6 text-sm text-gray-400">{index + 1}.</div>
                            <div>
                              <div className="font-medium truncate max-w-xs">{page.title || page.path || 'Homepage'}</div>
                              <div className="text-xs text-gray-500 truncate max-w-xs">{page.path}</div>
                            </div>
                          </div>
                          <div className={`col-span-2 text-right font-medium ${contentSortBy === 'pageViews' ? 'text-blue-600' : ''}`}>
                            {pageViews.toLocaleString()}
                          </div>
                          <div className={`col-span-2 text-right font-medium ${contentSortBy === 'uniqueVisitors' ? 'text-blue-600' : ''}`}>
                            {uniqueVisitors.toLocaleString()}
                          </div>
                          <div className={`col-span-2 text-right font-medium ${contentSortBy === 'averageTimeOnPage' ? 'text-blue-600' : ''}`}>
                            {formatTime(avgTime)}
                          </div>
                          <div className={`col-span-1 text-right font-medium ${contentSortBy === 'bounceRate' ? 'text-blue-600' : ''}`}>
                            {(bounceRate * 100).toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                    
                  {trackedPages.length === 0 && (
                    <div className="py-8 text-center text-gray-500">
                      No page data available for the selected period
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Content Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
              <MetricCard
                title="Total Pages Tracked"
                value={trackedPages.length}
                icon={FileText}
                tooltip="Number of pages being tracked"
                isLoading={isLoadingPages}
              />
              <MetricCard
                title="Avg. Views per Page"
                value={trackedPages.length > 0 ? 
                  Math.round(overviewData.totalViews / trackedPages.length) : 0}
                icon={Eye}
                tooltip="Average number of views per page"
                isLoading={isLoadingPages}
              />
            </div>

            {/* Pages List */}
            <div className="grid gap-4">
              {isLoadingPages ? (
                // Loading state
                Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i}>
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
                    </div>
                  </Card>
                ))
              ) : trackedPages.length > 0 ? (
                trackedPages
                  .sort((a, b) => {
                    // Sort by the same criteria as the top pages section
                    const aValue = a.analytics?.[contentSortBy] ?? 
                                  analyticsData[a.url]?.[contentSortBy] ?? 
                                  a[contentSortBy as keyof TrackedPage] ?? 0;
                    const bValue = b.analytics?.[contentSortBy] ?? 
                                  analyticsData[b.url]?.[contentSortBy] ?? 
                                  b[contentSortBy as keyof TrackedPage] ?? 0;
                    
                    // For bounce rate, lower is better, so we might want to invert the sort
                    if (contentSortBy === 'bounceRate') {
                      return contentSortOrder === 'desc' ? bValue - aValue : aValue - bValue;
                    }
                    
                    // For other metrics, higher is better
                    return contentSortOrder === 'desc' ? bValue - aValue : aValue - bValue;
                  })
                  .map((page) => (
                  <Card key={page.url} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">{page.title || page.path || 'Homepage'}</h3>
                        <p className="text-sm text-muted-foreground">{page.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/client/${params.clientId}/projects/${params.projectId}/insights/${encodeURIComponent(page.path)}?page=${encodeURIComponent(page.url)}&period=${selectedPeriods.content}`}
                        >
                          <Button variant="outline" size="sm" className="gap-2">
                            <BarChart2 className="h-4 w-4" />
                            Analytics
                          </Button>
                        </Link>
                        {/* <Link 
                          href={`/standalone/heatmap?projectId=${params.projectId}&pageUrl=${encodeURIComponent(page.url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-2">
                            <Activity className="h-4 w-4" />
                            Heatmap
                          </Button>
                        </Link> */}
                      </div>
                    </div>

                      <div className="grid grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-sm text-gray-500">Page Views</div>
                          <div className={`text-lg font-medium ${contentSortBy === 'pageViews' ? 'text-blue-600' : ''}`}>
                            {(page.analytics?.pageViews || analyticsData[page.url]?.pageViews || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Unique Visitors</div>
                          <div className={`text-lg font-medium ${contentSortBy === 'uniqueVisitors' ? 'text-blue-600' : ''}`}>
                            {(page.analytics?.uniqueVisitors || analyticsData[page.url]?.uniqueVisitors || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Avg. Time</div>
                          <div className={`text-lg font-medium ${contentSortBy === 'averageTimeOnPage' ? 'text-blue-600' : ''}`}>
                            {formatTime(page.analytics?.averageTimeOnPage || analyticsData[page.url]?.averageTimeOnPage || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Bounce Rate</div>
                          <div className={`text-lg font-medium ${contentSortBy === 'bounceRate' ? 'text-blue-600' : ''}`}>
                            {((page.analytics?.bounceRate || analyticsData[page.url]?.bounceRate || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-8 text-center">
                  <div className="text-muted-foreground">
                    No tracked pages found. Start tracking pages to see analytics data here.
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="engagement">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">User Engagement</h2>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline"
                  onClick={() => fetchEngagementData(selectedPeriods.engagement)}
                  disabled={isLoadingEngagement}
                  className="gap-2"
                >
                  {isLoadingEngagement ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
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
                      variant={selectedPeriods.engagement === period.id ? 'default' : 'ghost'}
                      className="text-sm"
                      onClick={() => handlePeriodChange('engagement', period.id)}
                    >
                      {period.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Engagement Overview Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Avg. Session Duration"
                value={isLoadingEngagement ? '--' : (overviewData.averageTimeOnPage ? formatTime(overviewData.averageTimeOnPage) : '--')}
                icon={Clock}
                tooltip="Average time spent per session"
              />
              <MetricCard
                title="Pages per Session"
                value={isLoadingEngagement ? '--' : (overviewData.totalSessions > 0 ? 
                  (overviewData.totalViews / overviewData.totalSessions).toFixed(1) : '--')}
                icon={FileText}
                tooltip="Average number of pages viewed per session"
              />
              <MetricCard
                title="Engagement Rate"
                value={isLoadingEngagement ? '--' : (overviewData.bounceRate > 0 
                  ? `${(100 - overviewData.bounceRate * 100).toFixed(1)}%` 
                  : '--')}
                icon={Activity}
                tooltip="Percentage of engaged visitors (non-bounced)"
              />
              <MetricCard
                title="Return Rate"
                value={isLoadingEngagement ? '--' : (engagementData?.userType?.returning ? `${engagementData.userType.returning}%` : '--')}
                icon={UserPlus}
                tooltip="Percentage of returning visitors"
              />
            </div>

            {/* Detailed Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Flow */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">User Flow</h3>
                <Tabs defaultValue="entry">
                  <TabsList className="mb-4">
                    <TabsTrigger value="entry" className="text-xs">Entry Pages</TabsTrigger>
                    <TabsTrigger value="exit" className="text-xs">Exit Pages</TabsTrigger>
                  </TabsList>

                  <TabsContent value="entry" className="mt-0">
                    <div className="space-y-4">
                      {isLoadingEngagement ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-6 text-sm text-gray-400">{i + 1}.</div>
                              <div>
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-32 mt-1" />
                              </div>
                            </div>
                            <Skeleton className="h-5 w-16" />
                          </div>
                        ))
                      ) : (
                        engagementData?.userFlow?.entryPages && engagementData.userFlow.entryPages.length > 0 ? (
                          engagementData.userFlow.entryPages.map((page, index) => (
                            <div key={page.url} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-6 text-sm text-gray-400">{index + 1}.</div>
                                <div>
                                  <div className="font-medium">{page.title || page.url}</div>
                                  <div className="text-sm text-gray-500">
                                    {page.entries.toLocaleString()} entries
                                  </div>
                                </div>
                              </div>
                              <div className="font-medium">
                                {page.percentage}%
                              </div>
                            </div>
                          ))
                        ) : (
                          trackedPages
                            .sort((a, b) => {
                              const aViews = a.analytics?.pageViews || analyticsData[a.url]?.pageViews || 0;
                              const bViews = b.analytics?.pageViews || analyticsData[b.url]?.pageViews || 0;
                              return bViews - aViews;
                            })
                            .slice(0, 5)
                            .map((page, index) => {
                              const pageViews = page.analytics?.pageViews || analyticsData[page.url]?.pageViews || 0;
                              const percentage = overviewData.totalViews > 0 
                                ? ((pageViews / overviewData.totalViews) * 100).toFixed(1) 
                                : '0.0';
                              
                              return (
                              <div key={page.url} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 text-sm text-gray-400">{index + 1}.</div>
                                  <div>
                                    <div className="font-medium">{page.title || page.path}</div>
                                    <div className="text-sm text-gray-500">
                                        {pageViews.toLocaleString()} entries
                                    </div>
                                  </div>
                                </div>
                                <div className="font-medium">
                                    {percentage}%
                                </div>
                              </div>
                              );
                            })
                        )
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="exit" className="mt-0">
                    <div className="space-y-4">
                      {isLoadingEngagement ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-6 text-sm text-gray-400">{i + 1}.</div>
                              <div>
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-32 mt-1" />
                              </div>
                            </div>
                            <Skeleton className="h-5 w-16" />
                          </div>
                        ))
                      ) : (
                        engagementData?.userFlow?.exitPages && engagementData.userFlow.exitPages.length > 0 ? (
                          engagementData.userFlow.exitPages.map((page, index) => (
                            <div key={page.url} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-6 text-sm text-gray-400">{index + 1}.</div>
                                <div>
                                  <div className="font-medium">{page.title || page.url}</div>
                                  <div className="text-sm text-gray-500">
                                    {page.exits.toLocaleString()} exits
                                  </div>
                                </div>
                              </div>
                              <div className="font-medium">
                                {page.percentage}%
                              </div>
                            </div>
                          ))
                        ) : (
                          trackedPages
                            .sort((a, b) => (b.analytics?.bounceRate || 0) - (a.analytics?.bounceRate || 0))
                            .slice(0, 5)
                            .map((page, index) => (
                              <div key={page.url} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 text-sm text-gray-400">{index + 1}.</div>
                                  <div>
                                    <div className="font-medium">{page.title || page.path}</div>
                                    <div className="text-sm text-gray-500">
                                      {Math.round((page.analytics?.bounceRate || 0) * (page.analytics?.pageViews || 0)).toLocaleString()} exits
                                    </div>
                                  </div>
                                </div>
                                <div className="font-medium">
                                  {page.analytics?.bounceRate 
                                    ? (page.analytics.bounceRate * 100).toFixed(1) 
                                    : 0}%
                                </div>
                              </div>
                            ))
                        )
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>

              {/* Engagement Patterns */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Engagement Patterns</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Time of Day</h4>
                    <div className="space-y-3">
                      {isLoadingEngagement ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-12" />
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Morning (6am-12pm)</div>
                            <div className="font-medium">{engagementData?.timeOfDay.morning || 0}%</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Afternoon (12pm-6pm)</div>
                            <div className="font-medium">{engagementData?.timeOfDay.afternoon || 0}%</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Evening (6pm-12am)</div>
                            <div className="font-medium">{engagementData?.timeOfDay.evening || 0}%</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Night (12am-6am)</div>
                            <div className="font-medium">{engagementData?.timeOfDay.night || 0}%</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Day of Week</h4>
                    <div className="space-y-3">
                      {isLoadingEngagement ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-12" />
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Weekdays</div>
                            <div className="font-medium">{engagementData?.dayOfWeek.weekdays || 0}%</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Weekends</div>
                            <div className="font-medium">{engagementData?.dayOfWeek.weekends || 0}%</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">User Type</h4>
                    <div className="space-y-3">
                      {isLoadingEngagement ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-12" />
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">New Visitors</div>
                            <div className="font-medium">{engagementData?.userType.new || 0}%</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-sm">Returning Visitors</div>
                            <div className="font-medium">{engagementData?.userType.returning || 0}%</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leads">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Lead Generation</h2>
                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshLeadGenerationData} 
                    disabled={isLoadingLeadGeneration}
                    className="gap-2"
                  >
                    {isLoadingLeadGeneration ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
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
                        variant={selectedPeriods.leads === period.id ? 'default' : 'ghost'}
                        className="text-sm"
                        onClick={() => handlePeriodChange('leads', period.id)}
                      >
                        {period.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lead Generation Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {isLoadingLeadGeneration ? (
                  // Loading state for metric cards
                  Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-8 w-24 mt-1" />
                          <Skeleton className="h-3 w-40 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  // Existing metric cards with loading prop
                  <>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Total Interactions</p>
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">
                              {leadGenerationData?.totalInteractions?.toLocaleString() || '0'}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Form clicks, scrolls, and other interactions
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Interaction Rate</p>
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">
                              {leadGenerationData?.interactionRate?.toFixed(1) || '0'}%
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Percentage of visitors who interact with forms
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Form Starts</p>
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">
                              {leadGenerationData?.formStarts?.toLocaleString() || '0'}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Number of users who began filling a form
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium text-muted-foreground">Form Completions</p>
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">
                              {leadGenerationData?.formCompletions?.toLocaleString() || '0'}
                            </h3>
                            <span className="text-sm font-medium text-muted-foreground">
                              ({leadGenerationData?.formCompletionRate?.toFixed(1) || '0'}% completion)
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Number of successfully submitted forms
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                  <CardDescription>
                    Track how visitors convert through your forms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Funnel Visualization */}
                    <div className="relative pt-4 px-4">
                      {isLoadingLeadGeneration ? (
                        // Loading state for funnel
                        <div className="space-y-6">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="relative">
                              <Skeleton className={`h-24 w-${100 - i * 20}%`} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Existing funnel content
                        <>
                          {[
                            { 
                              label: 'Total Visitors',
                              value: leadGenerationData?.totalVisitors || 0,
                              description: 'Unique visitors to your site'
                            },
                            { 
                              label: 'Form Starts', 
                              value: leadGenerationData?.formStarts || 0,
                              description: 'Users who started filling a form'
                            },
                            { 
                              label: 'Form Submits', 
                              value: leadGenerationData?.formCompletions || 0,
                              description: 'Successfully submitted forms'
                            },
                          ].map((step, index, array) => {
                            // Calculate percentage based on previous step
                            const baseValue = index === 0 ? step.value : (array[index - 1].value || 1);
                              const percentage = Math.round((step.value / baseValue) * 100) || 0;
                              
                            // Calculate widths for funnel effect
                            const maxWidth = 100;
                            const minWidth = 40;
                            const widthDiff = maxWidth - minWidth;
                            const stepWidth = maxWidth - (index * (widthDiff / (array.length - 1)));
                              
                            return (
                              <div 
                                key={index}
                                className="relative mb-4 mx-auto"
                                style={{ width: `${stepWidth}%` }}
                              >
                                <div className="relative">
                                  {/* Funnel segment */}
                                  <div 
                                    className={`
                                      bg-primary/10 hover:bg-primary/20 
                                      transition-all duration-200 
                                      p-4 rounded-md
                                      border border-primary/20
                                      ${index === 0 ? 'rounded-t-lg' : ''}
                                      ${index === array.length - 1 ? 'rounded-b-lg' : ''}
                                    `}
                                  >
                                    <div className="flex justify-between items-center gap-4">
                                      <div>
                                        <p className="font-medium text-sm">{step.label}</p>
                                        <p className="text-xs text-muted-foreground">{step.description}</p>
                                    </div>
                                      <div className="text-right">
                                    <p className="font-bold">{step.value.toLocaleString()}</p>
                                        {index > 0 && (
                                          <p className="text-xs text-muted-foreground">
                                            {percentage}% of previous
                                          </p>
                                        )}
                                  </div>
                                </div>
                          </div>
                          
                                  {/* Connector lines */}
                                  {index < array.length - 1 && (
                                    <div className="absolute -bottom-4 left-0 right-0 h-4 overflow-hidden">
                                      <div 
                                        className="
                                          w-0 h-0 mx-auto
                                          border-l-[20px] border-l-transparent
                                          border-r-[20px] border-r-transparent
                                          border-t-[16px] border-primary/10
                                        "
                                  />
                                </div>
                                  )}
                          </div>
                                </div>
                            );
                          })}
                        </>
                      )}
                    </div>

                    {/* Additional metrics */}
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      {isLoadingLeadGeneration ? (
                        // Loading state for additional metrics
                        <>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </>
                      ) : (
                        // Existing metrics content
                        <>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Overall Conversion Rate</p>
                            <p className="text-2xl font-bold">
                              {leadGenerationData?.totalVisitors 
                                ? Math.round((leadGenerationData.formCompletions / leadGenerationData.totalVisitors) * 100)
                                : 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Visitors who completed forms
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Form Completion Rate</p>
                            <p className="text-2xl font-bold">
                              {leadGenerationData?.formCompletionRate || 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started forms that were completed
                          </p>
                        </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="impact">
            {/* Header with eco badge and controls */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">Environmental Impact</h2>
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Sprout className="w-3 h-3" />
                  Eco-Friendly Initiative
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline"
                  onClick={() => handlePeriodChange('impact', selectedPeriods.impact)}
                  disabled={isImpactLoading}
                  className="gap-2"
                >
                  {isImpactLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
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
                      variant={selectedPeriods.impact === period.id ? 'default' : 'ghost'}
                      className="text-sm"
                      onClick={() => handlePeriodChange('impact', period.id)}
                    >
                      {period.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* New Environmental Impact Journey */}
            <Card className="p-6 mb-8 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-green-800">Your Green Journey</h3>
                <p className="text-green-600 mt-2">
                  Every unique visitor creates a ripple of positive environmental impact. Here's your story:
                </p>
              </div>

              <div className="max-w-4xl mx-auto">
                <div className="relative space-y-8 py-4">
                  {isImpactLoading ? (
                    // Keep existing loading state
                    Array.from({ length: 5 }).map((_, i) => (
                      <div 
                        key={i} 
                        className="relative mx-auto" 
                        style={{ width: `${90 - (i * 10)}%` }}
                      >
                        <div className="bg-white/50 border border-green-100 rounded-lg p-4 animate-pulse">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-green-200 rounded" />
                              <div className="w-24 h-4 bg-green-200 rounded" />
                            </div>
                            <div className="w-16 h-6 bg-green-200 rounded" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    // Enhanced story-driven funnel
                    [
                      {
                        label: 'Digital Transformation',
                        value: overviewData.uniqueViews.toLocaleString(),
                        color: 'bg-green-100/80',
                        borderColor: 'border-green-200',
                        width: '90%',
                        icon: Eye,
                        description: 'Digital views replacing printed materials',
                        story: 'Your journey begins with every unique visitor. Instead of printed brochures, you\'ve embraced sustainable digital solutions.'
                      },
                      {
                        label: 'Forest Protection',
                        value: `${calculateTreesSaved(overviewData.uniqueViews)} trees`,
                        color: 'bg-green-200/80',
                        borderColor: 'border-green-300',
                        width: '80%',
                        icon: TreeDeciduous,
                        description: 'Trees preserved from paper production',
                        story: 'These trees continue to clean our air and provide habitat for countless species.'
                      },
                      {
                        label: 'Water Conservation',
                        value: `${calculateWaterSaved(overviewData.uniqueViews)}L`,
                        color: 'bg-green-300/80',
                        borderColor: 'border-green-400',
                        width: '70%',
                        icon: Droplets,
                        description: 'Clean water saved from paper production',
                        story: 'That\'s enough water to sustain a family of four for several months!'
                      },
                      {
                        label: 'Waste Reduction',
                        value: `${calculateWasteReduced(overviewData.uniqueViews)} kg`,
                        color: 'bg-green-400/80',
                        borderColor: 'border-green-500',
                        width: '60%',
                        icon: Recycle,
                        description: 'Paper waste prevented',
                        story: 'By going digital, you\'ve prevented this much paper waste from being generated.'
                      },
                      {
                        label: 'Climate Impact',
                        value: `${calculateCO2Reduced(overviewData.uniqueViews)} kg CO₂`,
                        color: 'bg-green-500/80',
                        borderColor: 'border-green-600',
                        width: '50%',
                        icon: CloudSun,
                        description: 'Carbon emissions prevented',
                        story: 'Your reduction in CO₂ emissions equals planting a small forest!'
                      }
                    ].map((step, index) => (
                      <div
                        key={step.label}
                        className="relative mx-auto transition-all duration-500"
                        style={{ width: step.width }}
                      >
                        <div className={`
                          ${step.color} ${step.borderColor}
                          border rounded-lg p-6
                          transition-all duration-300 hover:scale-[1.02]
                          hover:shadow-lg hover:shadow-green-100
                          backdrop-blur-sm
                        `}>
                          <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/80 rounded-full">
                                  <step.icon className="h-6 w-6 text-green-700" />
                              </div>
                              <div>
                                  <span className="font-bold text-lg text-green-800">{step.label}</span>
                                  <p className="text-sm text-green-700">{step.description}</p>
                              </div>
                            </div>
                              <span className="text-xl font-bold text-green-900">{step.value}</span>
                          </div>
                            <div className="pl-12">
                              <p className="text-green-700 italic">{step.story}</p>
                        </div>
                          </div>
                        </div>
                        {index < 4 && (
                          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-green-500 animate-bounce">↓</span>
                              <span className="text-xs text-green-600 font-medium">Leading to</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            {/* Financial Impact - Enhanced Story */}
            <Card className="p-6 mb-8 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-green-800">The Green Economy</h3>
                <p className="text-green-600 mt-2">
                  Sustainability isn't just good for the planet - it's good for business
                </p>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isImpactLoading ? (
                  // Loading state cards
                  Array.from({ length: 3 }).map((_, i) => (
                    <div 
                      key={i}
                      className="bg-white/60 rounded-lg p-6 border border-green-200 animate-pulse"
                    >
                      <div className="w-8 h-8 bg-green-200 rounded-full mb-4" />
                      <div className="h-6 w-32 bg-green-200 rounded mb-2" />
                      <div className="h-8 w-24 bg-green-200 rounded mb-2" />
                      <div className="h-4 w-48 bg-green-200 rounded" />
                    </div>
                  ))
                ) : (
                  // Actual content
                  <>
                    <div className="bg-white/60 rounded-lg p-6 border border-green-200 hover:shadow-lg transition-all duration-300">
                      <DollarSign className="h-8 w-8 text-green-600 mb-4" />
                      <h4 className="text-lg font-semibold text-green-800 mb-2">Direct Savings</h4>
                      <p className="text-3xl font-bold text-green-900 mb-2">
                        ${calculatePrintingCostsSaved(overviewData.uniqueViews)}
                      </p>
                      <p className="text-green-600">
                        Money saved on printing costs alone - that's enough to fund new sustainable initiatives!
                      </p>
                    </div>

                    <div className="bg-white/60 rounded-lg p-6 border border-green-200 hover:shadow-lg transition-all duration-300">
                      <Coins className="h-8 w-8 text-green-600 mb-4" />
                      <h4 className="text-lg font-semibold text-green-800 mb-2">Distribution Impact</h4>
                      <p className="text-3xl font-bold text-green-900 mb-2">
                        ${calculateDistributionSavings(overviewData.uniqueViews)}
                      </p>
                      <p className="text-green-600">
                        Saved on distribution costs while reducing transportation emissions
                      </p>
                    </div>

                    <div className="bg-white/60 rounded-lg p-6 border border-green-200 hover:shadow-lg transition-all duration-300">
                      <Receipt className="h-8 w-8 text-green-600 mb-4" />
                      <h4 className="text-lg font-semibold text-green-800 mb-2">Total Impact</h4>
                      <p className="text-3xl font-bold text-green-900 mb-2">
                        ${calculateTotalSavings(overviewData.uniqueViews)}
                      </p>
                      <p className="text-green-600">
                        Total savings from your digital transformation journey
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Achievement Badge */}
            <Card className="p-6 mb-8 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="text-center">
                <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
                  <TreePine className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Environmental Champion</h3>
                <p className="text-green-600 max-w-md mx-auto">
                  Your digital transformation journey has made a real environmental impact. 
                  Keep tracking your contribution to a greener future!
                </p>
              </div>
            </Card>

            {/* Methodology & Sources */}
            <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-green-800">Our Calculation Methodology</h3>
                  <p className="text-green-600 mt-2">
                    Transparent and evidence-based environmental impact calculations
                  </p>
                </div>

                <div className="space-y-8">
                  {/* Base Assumptions */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Base Calculation Assumptions
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">Core Metrics:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>Document Format: A4 Brochure (210mm × 297mm)
                            <span className="block text-sm text-green-600 mt-1">
                              Standard international paper size for professional brochures
                            </span>
                          </li>
                          <li>Paper Type: Coated Paper (100 gsm)
                            <span className="block text-sm text-green-600 mt-1">
                              High-quality glossy paper typically used for color brochures
                            </span>
                          </li>
                          <li>Pages per Document: {SHEETS_PER_VIEW} sheets ({SHEETS_PER_VIEW * 2} pages, double-sided)
                            <span className="block text-sm text-green-600 mt-1">
                              Standard brochure length with full-color printing
                            </span>
                          </li>
                          <li>Paper Weight: {PAPER_WEIGHT_PER_SHEET * 1000}g per sheet
                            <span className="block text-sm text-green-600 mt-1">
                              100 gsm coated paper weight (standard for professional brochures)
                            </span>
                          </li>
                          <li>Digital Impact: 1.76g CO₂ per webpage view
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: Website Carbon Calculator (2023)
                            </cite>
                          </li>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        All calculations are based on unique visitors rather than total page views to provide conservative, real-world impact estimates. Paper specifications are based on standard professional brochure printing requirements.
                      </div>
                    </div>
                  </div>

                  {/* Tree Impact */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <TreeDeciduous className="h-5 w-5" />
                      Forest Impact Calculations
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">Paper to Tree Ratio:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>One average pine tree (50-80 feet tall, 8-10 inches diameter) produces 10,000-15,000 sheets of paper
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: Tenere Team Research - <a href="https://www.tenereteam.com/blogs/how-much-paper-does-a-tree-produce/" target="_blank" rel="noopener noreferrer" className="underline">How Much Paper Does a Tree Produce?</a>
                            </cite>
                          </li>
                          <li>Paper production accounts for 13-15% of total global wood consumption
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: World Wildlife Fund (WWF) - <a href="https://www.worldwildlife.org/industries/pulp-and-paper" target="_blank" rel="noopener noreferrer" className="underline">Pulp and Paper Industry Overview</a>
                            </cite>
                          </li>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        Formula: Trees Saved = Digital Views × Pages per View ÷ 12,500 (average sheets per tree)
                      </div>
                    </div>
                  </div>

                  {/* Water Conservation */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Droplets className="h-5 w-5" />
                      Water Conservation Metrics
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">Water Usage in Paper Production:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>2-13 liters of water per A4 sheet of paper, varying by production method
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: Water Resources Management Journal - <a href="https://link.springer.com/article/10.1007/s11269-011-9942-7" target="_blank" rel="noopener noreferrer" className="underline">Springer Link</a>
                            </cite>
                          </li>
                          <li>Variation depends on wood type and regional production practices
                          </li>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        Formula: Water Saved = Digital Views × Pages per View × 2–13 Liters (range based on production method)
                      </div>
                    </div>
                  </div>

                  {/* Energy Savings */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Wind className="h-5 w-5" />
                      Energy Conservation Analysis
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">Energy Consumption in Paper Production:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>34.3 GJ energy per ton of paper production
                          </li>
                          <li>Specific electrical consumption: 91.85 kWh/ton paper
                          </li>
                          <li>CO₂ emissions: 3.4 tons per ton of paper produced
                          <cite className="block text-sm text-green-600 mt-1">
                              Source: Energy Conservation in Paper Industry - <a href="https://www.scirp.org/journal/paperinformation?paperid=88981" target="_blank" rel="noopener noreferrer" className="underline">Scientific Research Publishing</a>
                          </cite>
                          </li>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        Formula: Energy Saved = (Digital Views × Pages × Weight per page × 34.3 GJ/ton) / 1000000 (to convert to appropriate units)
                      </div>
                    </div>
                  </div>

                  {/* CO2 Emissions */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <CloudSun className="h-5 w-5" />
                      Carbon Footprint Reduction
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">CO₂ Emissions in Paper Lifecycle:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>942 kg CO₂ equivalent per metric ton of paper product (production weighted average)
                          </li>
                          <li>Emissions range from 608 to 1,978 kg CO₂eq per metric ton depending on paper grade
                          </li>
                          <cite className="block text-sm text-green-600 mt-1">
                              Source: Tomberlin, Venditti, & Yao (2020) - Cradle-to-gate lifecycle analysis of US paper production - <a href="https://bioresources.cnr.ncsu.edu/resources/life-cycle-carbon-footprint-analysis-of-pulp-and-paper-grades-in-the-united-states-using-production-line-based-data-and-integration/" target="_blank" rel="noopener noreferrer" className="underline">BioResources Journal (2020)</a>
                          </cite>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        Formula: CO₂ Reduced = (Unique Visitors × Pages × Weight per page × 0.942) (using average CO₂eq emissions per metric ton)
                      </div>
                    </div>
                  </div>

                  {/* Waste Reduction */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Recycle className="h-5 w-5" />
                      Waste Reduction Impact
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">Paper Waste Prevention:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>Paper and paperboard products make up 23.1% of total municipal solid waste generation
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: EPA Facts and Figures on Materials, Waste and Recycling - <a href="https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling/national-overview-facts-and-figures-materials" target="_blank" rel="noopener noreferrer" className="underline">EPA.gov</a>
                            </cite>
                          </li>
                          <li>Digital transformation eliminates paper waste from outdated materials, misprints, and disposal
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: Environmental Paper Network - <a href="https://environmentalpaper.org/2022/11/calculating-your-paper-waste-reduction-impacts/" target="_blank" rel="noopener noreferrer" className="underline">Calculating Your Paper Waste Reduction Impacts</a>
                            </cite>
                          </li>
                          <li>Paper recycling saved over 155 million metric tons of CO₂ equivalent in 2018
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: EPA Waste Reduction Model (WARM)
                            </cite>
                          </li>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        Formula: Waste Reduced = Unique Visitors × Pages × Paper Weight per Sheet (4.536g)<br/>
                        Landfill Waste Avoided = Total Waste × 50% (EPA landfill rate)
                      </div>
                    </div>
                  </div>

                  {/* Financial Impact */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Cost Savings Methodology
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-green-800 font-medium">Cost Factors:</p>
                        <ul className="list-disc pl-6 text-green-700 space-y-2 mt-2">
                          <li>Brochure printing costs: $0.75-$1.10 per brochure (100 units) or $0.25-$0.35 per brochure (1,000+ units)
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: Talo Cost Guide 2023 - <a href="https://talo.com/costs/brochure-design-costs" target="_blank" rel="noopener noreferrer" className="underline">Brochure Design & Printing Costs</a>
                            </cite>
                          </li>
                          <li>Tri-fold A4 brochure (100 gsm coated paper): $0.23 per piece (low volume) to $0.13 per piece (high volume)
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: PostcardMania Pricing Guide 2023
                            </cite>
                          </li>
                          <li>Distribution costs: $0.50 per piece for First-Class Mail or $0.29 per piece for USPS Marketing Mail
                            <cite className="block text-sm text-green-600 mt-1">
                              Source: USPS Direct Mail Cost Calculator - <a href="https://www.uspsdelivers.com/direct-mail-cost-calculator/" target="_blank" rel="noopener noreferrer" className="underline">USPS Delivers</a>
                            </cite>
                          </li>
                        </ul>
                      </div>
                      <div className="text-sm text-green-600 bg-green-50 p-4 rounded">
                        Formula: Total Savings = (Printing Costs × Pages) + (Distribution Costs × Unique Visitors)<br/>
                        Using average values: ($0.50 printing per brochure × 4 pages) + ($0.50 shipping per brochure)
                      </div>
                    </div>
                  </div>

                  {/* Digital Impact Consideration */}
                  <div className="bg-white/60 rounded-lg p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Laptop className="h-5 w-5" />
                      Digital Environmental Impact
                    </h4>
                    <div className="space-y-4">
                      <p className="text-green-700">
                        While we calculate the savings from reducing paper usage, we acknowledge that digital solutions also have an environmental impact. The average webpage produces approximately 1.76g CO₂ per view. However, this is significantly less than the carbon footprint of printed materials for equivalent information sharing.
                      </p>
                      <cite className="block text-sm text-green-600">
                        Source: Website Carbon Calculator, Sustainable Web Design (2023) - <a href="https://www.websitecarbon.com/" target="_blank" rel="noopener noreferrer" className="underline">Website Carbon Calculator</a>
                      </cite>
                    </div>
                  </div>

                  {/* Update Notice */}
                  <div className="text-sm text-green-600 text-center mt-8">
                    <p>Calculations and methodologies are regularly updated based on the latest research and industry standards.</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </BlurPage>
  );
} 

// Add these utility functions at the bottom of the file
const SHEETS_PER_VIEW = 4; // Assuming each brochure is 4 sheets (8 pages double-sided)
const PAPER_WEIGHT_PER_SHEET = 0.01; // kg per sheet (10g per sheet - 100 gsm coated paper for brochures)
const WATER_PER_SHEET_MIN = 2; // Minimum liters of water per sheet
const WATER_PER_SHEET_MAX = 13; // Maximum liters of water per sheet
const GJ_PER_TON = 34.3; // 34.3 GJ per ton of paper from research
const KWH_PER_TON = 91.85; // 91.85 kWh/ton from research
const CO2_KG_PER_TON = 942; // 942 kg CO2eq per metric ton from Tomberlin et al. research

function calculateTreesSaved(uniqueVisitors: number): string {
  const sheets = uniqueVisitors * SHEETS_PER_VIEW;
  const trees = sheets / 12500; // One tree produces ~12,500 sheets (average of 10,000-15,000)
  return trees.toFixed(2);
}

function calculateWaterSaved(uniqueVisitors: number): string {
  const sheets = uniqueVisitors * SHEETS_PER_VIEW;
  // Using minimum value for conservative estimate
  const liters = sheets * WATER_PER_SHEET_MIN;
  // Add range in parentheses
  const maxLiters = sheets * WATER_PER_SHEET_MAX;
  return `${Math.round(liters).toLocaleString()} (range: ${Math.round(liters).toLocaleString()}-${Math.round(maxLiters).toLocaleString()})`;
}

function calculateEnergySaved(uniqueVisitors: number): string {
  const sheets = uniqueVisitors * SHEETS_PER_VIEW;
  const paperWeightTons = sheets * PAPER_WEIGHT_PER_SHEET / 1000; // Convert kg to metric tons
  
  // Calculate both GJ and kWh
  const energyGJ = paperWeightTons * GJ_PER_TON;
  const energyKWh = paperWeightTons * KWH_PER_TON;
  
  // Return combined format
  return `${Math.round(energyKWh).toLocaleString()} kWh (${energyGJ.toFixed(2)} GJ)`;
}

function calculateCO2Reduced(uniqueVisitors: number): string {
  const sheets = uniqueVisitors * SHEETS_PER_VIEW;
  const paperWeightTons = sheets * PAPER_WEIGHT_PER_SHEET / 1000; // Convert kg to metric tons
  const co2Kg = paperWeightTons * CO2_KG_PER_TON;
  
  // Add range based on research (608-1978 kg CO2eq per ton)
  const minCO2 = paperWeightTons * 608;
  const maxCO2 = paperWeightTons * 1978;
  
  return `${co2Kg.toFixed(2)} (range: ${minCO2.toFixed(2)}-${maxCO2.toFixed(2)})`;
}

function calculateWasteReduced(uniqueVisitors: number): string {
  const sheets = uniqueVisitors * SHEETS_PER_VIEW;
  const wasteKg = sheets * PAPER_WEIGHT_PER_SHEET;
  
  // Calculate percentage of waste that would have gone to landfill (50% according to EPA)
  const landfillWasteKg = wasteKg * 0.5;
  
  // Calculate recycling impact (68.2% paper recycling rate according to EPA)
  const recycledWasteKg = wasteKg * 0.682;
  
  // Return total with breakdown
  return `${wasteKg.toFixed(2)} (${landfillWasteKg.toFixed(2)} landfill avoided)`;
}

// Update constants for cost calculations
const PRINTING_COST_PER_PAGE = 0.50; // $0.50 per page for high-quality brochure printing (average)
const DISTRIBUTION_COST_PER_BROCHURE = 0.50; // $0.50 per brochure for First-Class Mail

function calculatePrintingCostsSaved(uniqueVisitors: number): string {
  const sheets = uniqueVisitors * SHEETS_PER_VIEW;
  const totalCost = sheets * PRINTING_COST_PER_PAGE;
  return totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateDistributionSavings(uniqueVisitors: number): string {
  const brochures = uniqueVisitors; // Assume one brochure per unique visitor
  const totalCost = brochures * DISTRIBUTION_COST_PER_BROCHURE;
  return totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateTotalSavings(uniqueVisitors: number): string {
  const printingCosts = Number(calculatePrintingCostsSaved(uniqueVisitors).replace(/,/g, ''));
  const distributionCosts = Number(calculateDistributionSavings(uniqueVisitors).replace(/,/g, ''));
  return (printingCosts + distributionCosts).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
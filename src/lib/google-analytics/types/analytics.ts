export interface TimelineDataPoint {
  date: string;
  views: number;
  visitors: number;
}

export interface DeviceData {
  type: 'desktop' | 'mobile' | 'tablet';
  percentage: number;
  visits: number;
}

export interface TrafficSourceDetail {
  source: string;
  visits: number;
  percentage: number;
}

export interface TrafficSource {
  source: string;
  type: 'direct' | 'referral' | 'social' | 'search';
  visits: number;
  percentage: number;
  details?: TrafficSourceDetail[];
}

export interface GeographicData {
  country: string;
  percentage: number;
  visits: number;
  cities?: Array<{
    name: string;
    percentage: number;
    visits: number;
  }>;
}

export interface SessionDurationDistribution {
  ranges: {
    range: string;
    sessions: number;
    percentage: number;
  }[];
  total: number;
}

export interface PageDepthDistribution {
  ranges: {
    range: string;
    sessions: number;
    percentage: number;
  }[];
  total: number;
}

export interface TimeDistribution {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
  total: number;
}

export interface WeekdayDistribution {
  weekdays: number;
  weekends: number;
  total: number;
}

export interface UserTypeDistribution {
  new: number;
  returning: number;
  total: number;
}

export interface EngagementMetrics {
  sessionDuration: SessionDurationDistribution;
  pageDepth: PageDepthDistribution;
  timeOfDay: TimeDistribution;
  dayOfWeek: WeekdayDistribution;
  userType: UserTypeDistribution;
  retention: {
    rate: number;
    total: number;
  };
}

export interface AnalyticsMetrics {
  pageViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  averageTimeOnPage: number;
  bounceRate: number;
  pagesPerSession: number;
  timelineData: TimelineDataPoint[];
  deviceData: DeviceData[];
  trafficSources: TrafficSource[];
  geographicData: GeographicData[];
  newUsers: number;
  activeUsers: number;
}

export interface MetricsResponse {
  pageViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  totalClicks?: number;
  averageTimeOnSite: number;
  bounceRate: number;
  timelineData?: TimelineDataPoint[];
}

export interface TrafficResponse {
  sources: TrafficSource[];
}

export interface DeviceResponse {
  devices: DeviceData[];
}

export interface GeographicResponse {
  countries: GeographicData[];
} 
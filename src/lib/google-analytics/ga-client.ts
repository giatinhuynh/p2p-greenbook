// Google Analytics 4 Client Implementation
import { cache } from 'react';
import { JWT } from 'google-auth-library';

// Types for Google Analytics data
export interface GAMetrics {
  pageViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  averageTimeOnPage: number;  // Changed from averageSessionDuration
  bounceRate: number;
  pagesPerSession: number;
  newUsers: number;
  activeUsers: number;
  timelineData: TimelineDataPoint[];
  deviceData: DeviceData[];
  trafficSources: TrafficSource[];
  geographicData: GeographicData[];
}

export interface TimelineDataPoint {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
}

export interface DeviceData {
  device: string;
  pageViews: number;
  percentage: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  percentage: number;
}

export interface GeographicData {
  country: string;
  sessions: number;
  percentage: number;
  cities?: {
    city: string;
    sessions: number;
    percentage: number;
  }[];
}

export interface PageUrlData {
  url: string;
  path: string;
  title: string;
  pageViews: number;
  uniqueVisitors: number;
  averageTimeOnPage: number;
  bounceRate: number;
  engagementRate: number;
  sessionsPerUser: number;
  eventCount: number;
}

// Add engagement metrics interfaces
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
  timeOfDay: TimeDistribution;
  dayOfWeek: WeekdayDistribution;
  userType: UserTypeDistribution;
  retention: {
    rate: number;
    total: number;
  };
  userFlow: {
    entryPages: Array<{url: string, title: string, entries: number, percentage: number}>;
    exitPages: Array<{url: string, title: string, percentage: number, exits: number}>;
  };
}

// Add this interface near the top of the file with the other interfaces
export interface GAReportRow {
  dimensionValues: Array<{value: string}>;
  metricValues: Array<{value: string}>;
}

// Add interface for GA4 row type
interface GA4Row {
  dimensionValues: Array<{value: string}>;
  metricValues: Array<{value: string}>;
}

interface DimensionFilter {
  filter?: {
    fieldName: string;
    stringFilter: {
      value: string;
      matchType: string;
    };
  };
  andGroup?: {
    expressions: Array<{
      filter: {
        fieldName: string;
        stringFilter: {
          value: string;
          matchType: string;
        };
      };
    }>;
  };
}

export class GoogleAnalyticsClient {
  private readonly CACHE_TTL = 30; // 30 seconds (reduced from 5 minutes)
  private cache = new Map<string, { data: any; timestamp: number }>();
  private authClient: JWT | null = null;

  constructor() {
    this.initAuthClient();
  }

  private initAuthClient() {
    try {
      console.log('[GA Client] Initializing Google Analytics auth client...');
      
      // Check if environment variables are set
      if (!process.env.GA_CLIENT_EMAIL || !process.env.GA_PRIVATE_KEY) {
        console.error('[GA Client] Missing required environment variables for Google Analytics authentication');
        console.error('[GA Client] GA_CLIENT_EMAIL:', process.env.GA_CLIENT_EMAIL ? 'Set' : 'Not set');
        console.error('[GA Client] GA_PRIVATE_KEY:', process.env.GA_PRIVATE_KEY ? 'Set' : 'Not set');
        throw new Error('Missing required environment variables for Google Analytics authentication');
      }
      
      // Create JWT client
      this.authClient = new JWT({
        email: process.env.GA_CLIENT_EMAIL,
        key: process.env.GA_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/analytics.readonly']
      });
      
      console.log('[GA Client] Auth client initialized successfully with email:', process.env.GA_CLIENT_EMAIL);
    } catch (error) {
      console.error('[GA Client] Error initializing Google Analytics auth client:', error);
      throw error;
    }
  }

  private getCacheKey(method: string, params: any): string {
    // Extract date ranges if they exist to create a unique cache key for different time periods
    let cacheBuster = '';
    if (params.dateRanges && params.dateRanges.length > 0) {
      const dateRange = params.dateRanges[0];
      cacheBuster = `-${dateRange.startDate}-${dateRange.endDate}`;
    }
    
    return `${method}${cacheBuster}:${JSON.stringify(params)}`;
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 1000) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Clear the entire cache or cache entries matching a prefix
  public clearCache(prefix?: string): void {
    console.log(`[GA Client] Clearing cache${prefix ? ` with prefix: ${prefix}` : ''}`);
    
    if (prefix) {
      // Clear only cache entries that match the prefix
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear the entire cache
      this.cache.clear();
    }
  }

  // Fetch metrics from Google Analytics Data API
  private async fetchGAData(propertyId: string, params: any): Promise<any> {
    if (!this.authClient) {
      throw new Error('Google Analytics auth client not initialized');
    }

    console.log(`[GA Client] fetchGAData called for property ${propertyId}`);
    
    const cacheKey = this.getCacheKey(`ga-data-${propertyId}`, params);
    console.log(`[GA Client] Cache key: ${cacheKey}`);
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      console.log(`[GA Client] Returning cached data for ${cacheKey}`);
      return cached;
    }
    
    console.log(`[GA Client] No cache found, fetching fresh data from GA API`);

    try {
      // Ensure the client is authenticated
      console.log(`[GA Client] Authorizing Google Analytics client`);
      await this.authClient.authorize();
      console.log(`[GA Client] Authorization successful, access token obtained`);

      // GA4 Data API endpoint
      const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
      
      console.log(`[GA Client] Calling GA4 Data API for property ${propertyId} with params:`, JSON.stringify(params, null, 2));
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      console.log(`[GA Client] Request timeout set to 8 seconds`);
      
      try {
        console.log(`[GA Client] Sending fetch request to ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authClient.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        console.log(`[GA Client] Fetch request completed, status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[GA Client] Google Analytics API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            endpoint,
            params: JSON.stringify(params)
          });
          throw new Error(`Google Analytics API error: ${response.status} - ${errorText}`);
        }

        console.log(`[GA Client] Parsing response JSON`);
        const data = await response.json();
        console.log('[GA Client] GA4 Data API response summary:', {
          rowCount: data.rows?.length || 0,
          dimensionHeaders: data.dimensionHeaders,
          metricHeaders: data.metricHeaders,
          rowsPreview: data.rows?.slice(0, 2) || []
        });
        
        // Check if the response contains rows
        if (!data.rows || data.rows.length === 0) {
          console.warn('[GA Client] GA4 Data API returned no rows for property:', propertyId);
        } else {
          console.log(`[GA Client] GA4 Data API returned ${data.rows.length} rows`);
        }
        
        console.log(`[GA Client] Caching data with key: ${cacheKey}`);
        this.setCachedData(cacheKey, data);
        return data;
      } catch (error: any) {
        // Clear the timeout if there was an error
        clearTimeout(timeoutId);
        
        // Handle abort errors specifically
        if (error.name === 'AbortError') {
          console.error('[GA Client] Request timed out after 8 seconds');
          throw new Error('Google Analytics API request timed out');
        }
        
        console.error('[GA Client] Error during fetch:', error);
        throw error;
      }
    } catch (error) {
      console.error('[GA Client] Error fetching Google Analytics data:', error);
      throw error;
    }
  }

  // Cache the metrics for better performance
  getMetrics = cache(async (
    propertyId: string,
    url: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<GAMetrics> => {
    try {
      console.log(`Getting metrics for property ${propertyId}, url: ${url || 'all'}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Validate dates to ensure they're not in the future
      const now = new Date();
      let validStartDate = new Date(startDate);
      let validEndDate = new Date(endDate);
      
      // Check if start date is in the future
      if (validStartDate > now) {
        console.error(`[GA Client] Start date ${validStartDate.toISOString()} is in the future! Using 30 days ago instead.`);
        validStartDate = new Date(now);
        validStartDate.setDate(now.getDate() - 30);
        validStartDate.setHours(0, 0, 0, 0);
      }
      
      // Check if end date is in the future
      if (validEndDate > now) {
        console.error(`[GA Client] End date ${validEndDate.toISOString()} is in the future! Using current date instead.`);
        validEndDate = new Date(now);
      }
      
      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = validStartDate.toISOString().split('T')[0];
      const formattedEndDate = validEndDate.toISOString().split('T')[0];

      console.log(`[GA Client] Formatted date range: ${formattedStartDate} to ${formattedEndDate}`);
      console.log(`[GA Client] Date details:`, {
        originalStartDate: startDate.toISOString(),
        originalEndDate: endDate.toISOString(),
        validatedStartDate: validStartDate.toISOString(),
        validatedEndDate: validEndDate.toISOString(),
        formattedStartDate,
        formattedEndDate,
        startYear: validStartDate.getFullYear(),
        startMonth: validStartDate.getMonth() + 1,
        startDay: validStartDate.getDate(),
        endYear: validEndDate.getFullYear(),
        endMonth: validEndDate.getMonth() + 1,
        endDay: validEndDate.getDate(),
        currentDate: now.toISOString()
      });

      // Process URL to extract just the path and decode any URL encoding
      let pagePath = null;
      if (url) {
        try {
          // First decode any URL encoding
          const decodedUrl = decodeURIComponent(url);
          console.log(`[GA Client] Decoded URL: ${decodedUrl}`);
          
          // Try to parse as a URL to extract just the path
          try {
            const urlObj = new URL(decodedUrl);
            pagePath = urlObj.pathname;
            console.log(`[GA Client] Extracted path from URL: ${pagePath}`);
          } catch (e) {
            // If it's not a valid URL, it might be just a path
            pagePath = decodedUrl.startsWith('/') ? decodedUrl : `/${decodedUrl}`;
            console.log(`[GA Client] Using path directly: ${pagePath}`);
          }
        } catch (e) {
          console.error(`[GA Client] Error processing URL ${url}:`, e);
          pagePath = url; // Fallback to using the original value
        }
      }

      // Filter for specific page if URL is provided
      const pageFilter = pagePath ? {
        dimensionFilter: {
          filter: {
            name: 'pagePath',
            stringFilter: {
              matchType: 'EXACT',
              value: pagePath
            }
          }
        }
      } : undefined;

      console.log('Page filter:', pageFilter);

      // Base request for core metrics
      const coreParams = {
        dateRanges: [{
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }],
        dimensions: [
          { name: 'date' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'sessionsPerUser' },
          { name: 'newUsers' },
          { name: 'activeUsers' }
        ],
        dimensionFilter: pageFilter ? {
          filter: pageFilter
        } : undefined
      };

      console.log('Core params for GA request:', JSON.stringify(coreParams, null, 2));

      // Fetch core metrics
      console.log('Fetching core metrics from GA...');
      const coreData = await this.fetchGAData(propertyId, coreParams);
      console.log('Core metrics response received');
      
      // Process timeline data with date range
      const timelineData = this.processTimelineData(coreData, validStartDate, validEndDate);

      // Extract metrics
      const metrics = this.extractMetrics(coreData);

      // Fetch device data
      const deviceData = await this.fetchDeviceData(propertyId, url, validStartDate, validEndDate);

      // Fetch traffic sources
      const trafficSources = await this.fetchTrafficSources(propertyId, url, validStartDate, validEndDate);

      // Fetch geographic data
      const geographicData = await this.fetchGeographicData(propertyId, url, validStartDate, validEndDate);

      const result = {
        ...metrics,
        timelineData,
        deviceData,
        trafficSources,
        geographicData
      };
      
      console.log(`Metrics result for property ${propertyId}:`, JSON.stringify(result, null, 2));
      
      return result;
    } catch (error) {
      console.error(`Error getting Google Analytics metrics for property ${propertyId}:`, error);
      // Return default empty metrics on error
      return {
        pageViews: 0,
        uniqueVisitors: 0,
        totalSessions: 0,
        averageTimeOnPage: 0,
        bounceRate: 0,
        pagesPerSession: 0,
        newUsers: 0,
        activeUsers: 0,
        timelineData: this.generateEmptyDailyData(startDate, endDate),
        deviceData: [],
        trafficSources: [],
        geographicData: []
      };
    }
  });

  private processTimelineData(data: any, startDate: Date, endDate: Date): TimelineDataPoint[] {
    if (!data.rows || data.rows.length === 0) {
      return this.generateEmptyDailyData(startDate, endDate);
    }

    // Create a map of existing data points
    const dataMap = new Map<string, { pageViews: number; uniqueVisitors: number }>();
    data.rows.forEach((row: GAReportRow) => {
      const dateStr = row.dimensionValues[0].value;
      dataMap.set(dateStr, {
        pageViews: parseInt(row.metricValues[0].value) || 0,
        uniqueVisitors: parseInt(row.metricValues[1].value) || 0
      });
    });

    // Generate complete daily timeline
    const timeline: TimelineDataPoint[] = [];
    const currentDate = new Date(startDate);
    const endDateTime = endDate.getTime();

    while (currentDate.getTime() <= endDateTime) {
      // Format date as YYYYMMDD
      const dateKey = currentDate.toISOString().split('T')[0].replace(/-/g, '');
      
      // Get data for this date or use zeros
      const dayData = dataMap.get(dateKey) || { pageViews: 0, uniqueVisitors: 0 };
      
      timeline.push({
        date: dateKey,
        pageViews: dayData.pageViews,
        uniqueVisitors: dayData.uniqueVisitors
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return timeline;
  }

  private extractMetrics(data: any): {
    pageViews: number;
    uniqueVisitors: number;
    totalSessions: number;
    averageTimeOnPage: number;
    bounceRate: number;
    pagesPerSession: number;
    newUsers: number;
    activeUsers: number;
  } {
    console.log('[GA Client] Extracting metrics from GA4 data:', {
      hasRows: !!data.rows,
      rowCount: data.rows?.length || 0,
      dimensionHeaders: data.dimensionHeaders?.map((h: any) => h.name),
      metricHeaders: data.metricHeaders?.map((h: any) => h.name)
    });
    
    if (!data.rows || data.rows.length === 0) {
      console.warn('[GA Client] No data rows returned from GA4');
      return {
        pageViews: 0,
        uniqueVisitors: 0,
        totalSessions: 0,
        averageTimeOnPage: 0,
        bounceRate: 0,
        pagesPerSession: 0,
        newUsers: 0,
        activeUsers: 0
      };
    }

    // Sum up metrics from all rows
    let pageViews = 0;
    let uniqueVisitors = 0;
    let totalSessions = 0;
    let totalDuration = 0;
    let totalBounceRate = 0;
    let totalSessionsPerUser = 0;
    let newUsers = 0;
    let activeUsers = 0;

    console.log('[GA Client] Processing metrics from rows...');
    data.rows.forEach((row: any, index: number) => {
      // Make sure we're accessing the right metrics based on the GA4 Data API response structure
      // GA4 Data API returns metrics in the order they were requested
      const views = parseInt(row.metricValues[0]?.value) || 0;
      const visitors = parseInt(row.metricValues[1]?.value) || 0;
      const sessions = parseInt(row.metricValues[2]?.value) || 0;
      const duration = parseFloat(row.metricValues[3]?.value) || 0;
      const bounceRate = parseFloat(row.metricValues[4]?.value) || 0;
      const sessionsPerUser = parseFloat(row.metricValues[5]?.value) || 0;
      const newUserCount = parseInt(row.metricValues[6]?.value) || 0; // New users metric
      const activeUserCount = parseInt(row.metricValues[7]?.value) || 0; // Active users metric
      
      // Only log a few rows to avoid console spam
      if (index < 3 || index === data.rows.length - 1) {
        console.log(`[GA Client] Row ${index} metrics:`, { 
          date: row.dimensionValues[0]?.value,
          views, 
          visitors, 
          sessions, 
          duration, 
          bounceRate,
          sessionsPerUser
        });
      }
      
      pageViews += views;
      uniqueVisitors += visitors;
      totalSessions += sessions;
      totalDuration += duration * sessions; // Weight by sessions for proper averaging
      totalBounceRate += bounceRate * sessions; // Weight by sessions for proper averaging
      totalSessionsPerUser += sessionsPerUser * visitors; // Weight by visitors for proper averaging
      newUsers += newUserCount;
      activeUsers += activeUserCount;
    });

    // Calculate averages
    const averageSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    const bounceRate = totalSessions > 0 ? totalBounceRate / totalSessions : 0;
    const pagesPerSession = totalSessions > 0 ? pageViews / totalSessions : 0;

    const result = {
      pageViews,
      uniqueVisitors,
      totalSessions,
      averageTimeOnPage: averageSessionDuration,
      bounceRate,
      pagesPerSession,
      newUsers,
      activeUsers
    };

    console.log('[GA Client] Extracted metrics:', result);
    return result;
  }

  /**
   * Fetch device data from Google Analytics
   */
  fetchDeviceData = async (
    propertyId: string,
    url: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<DeviceData[]> => {
    try {
      // Process URL to extract just the path and decode any URL encoding
      let pagePath = null;
      if (url) {
        try {
          // First decode any URL encoding
          const decodedUrl = decodeURIComponent(url);
          console.log(`[GA Client] Decoded URL for device data: ${decodedUrl}`);
          
          // Try to parse as a URL to extract just the path
          try {
            const urlObj = new URL(decodedUrl);
            pagePath = urlObj.pathname;
            console.log(`[GA Client] Extracted path from URL for device data: ${pagePath}`);
          } catch (e) {
            // If it's not a valid URL, it might be just a path
            pagePath = decodedUrl.startsWith('/') ? decodedUrl : `/${decodedUrl}`;
            console.log(`[GA Client] Using path directly for device data: ${pagePath}`);
          }
        } catch (e) {
          console.error(`[GA Client] Error processing URL ${url} for device data:`, e);
          pagePath = url; // Fallback to using the original value
        }
      }

      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      // Filter for specific page if URL is provided
      const dimensionFilter = pagePath ? {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT',
            value: pagePath
          }
        }
      } : undefined;

      const params = {
        dateRanges: [{
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }],
        dimensions: [
          { name: 'deviceCategory' }
        ],
        metrics: [
          { name: 'screenPageViews' }
        ],
        dimensionFilter: dimensionFilter
      };

      const data = await this.fetchGAData(propertyId, params);
      return this.processDeviceData(data);
    } catch (error) {
      console.error('Error fetching device data:', error);
      return [];
    }
  }

  private processDeviceData(data: any): DeviceData[] {
    console.log('Processing device data:', JSON.stringify(data, null, 2));
    
    if (!data.rows || data.rows.length === 0) {
      console.warn('No device data rows returned from GA4');
      return [];
    }

    const total = data.rows.reduce((sum: number, row: any) => {
      return sum + parseInt(row.metricValues[0].value || 0);
    }, 0);

    return data.rows.map((row: any) => {
      const deviceType = row.dimensionValues[0].value.toLowerCase();
      const views = parseInt(row.metricValues[0].value || 0);
      const percentage = total > 0 ? Math.round((views / total) * 100) : 0;
      
      return {
        device: deviceType,
        pageViews: views,
        percentage,
        visits: views
      };
    }).sort((a: DeviceData, b: DeviceData) => b.percentage - a.percentage);
  }

  /**
   * Fetch traffic sources from Google Analytics
   */
  fetchTrafficSources = async (
    propertyId: string,
    url: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<TrafficSource[]> => {
    try {
      // Process URL to extract just the path and decode any URL encoding
      let pagePath = null;
      if (url) {
        try {
          // First decode any URL encoding
          const decodedUrl = decodeURIComponent(url);
          console.log(`[GA Client] Decoded URL for traffic sources: ${decodedUrl}`);
          
          // Try to parse as a URL to extract just the path
          try {
            const urlObj = new URL(decodedUrl);
            pagePath = urlObj.pathname;
            console.log(`[GA Client] Extracted path from URL for traffic sources: ${pagePath}`);
          } catch (e) {
            // If it's not a valid URL, it might be just a path
            pagePath = decodedUrl.startsWith('/') ? decodedUrl : `/${decodedUrl}`;
            console.log(`[GA Client] Using path directly for traffic sources: ${pagePath}`);
          }
        } catch (e) {
          console.error(`[GA Client] Error processing URL ${url} for traffic sources:`, e);
          pagePath = url; // Fallback to using the original value
        }
      }

      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      // Filter for specific page if URL is provided
      const dimensionFilter = pagePath ? {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT',
            value: pagePath
          }
        }
      } : undefined;

      const params = {
        dateRanges: [{
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' }
        ],
        metrics: [
          { name: 'sessions' }
        ],
        dimensionFilter: dimensionFilter
      };

      const data = await this.fetchGAData(propertyId, params);
      return this.processTrafficSources(data);
    } catch (error) {
      console.error('Error fetching traffic sources:', error);
      return [];
    }
  }

  private processTrafficSources(data: any): TrafficSource[] {
    console.log('Processing traffic sources data:', JSON.stringify(data, null, 2));
    
    if (!data.rows || data.rows.length === 0) {
      console.warn('No traffic sources data rows returned from GA4');
      return [];
    }

    const total = data.rows.reduce((sum: number, row: any) => {
      return sum + parseInt(row.metricValues[0].value || 0);
    }, 0);

    // Process and categorize sources
    const sourceMap = new Map<string, {
      type: 'direct' | 'referral' | 'social' | 'search';
      sources: {
        source: string;
        visits: number;
        percentage: number;
      }[];
      totalVisits: number;
    }>();

    data.rows.forEach((row: any) => {
      const source = row.dimensionValues[0].value;
      const medium = row.dimensionValues[1].value;
      const visits = parseInt(row.metricValues[0].value || 0);
      
      let type: 'direct' | 'referral' | 'social' | 'search';
      
      // Categorize based on GA4 medium and source
      if (medium === 'organic') {
        type = 'search';
      } else if (medium === 'social' || source.match(/facebook|twitter|linkedin|instagram|pinterest|reddit|youtube/i)) {
        type = 'social';
      } else if (medium === 'referral') {
        type = 'referral';
      } else {
        type = 'direct';
      }
      
      // Add to the appropriate category
      if (!sourceMap.has(type)) {
        sourceMap.set(type, {
          type,
          sources: [],
          totalVisits: 0
        });
      }
      
      const category = sourceMap.get(type)!;
      category.sources.push({
        source: source || 'Direct Traffic',
        visits,
        percentage: total > 0 ? Math.round((visits / total) * 100) : 0
      });
      category.totalVisits += visits;
    });

    // Convert map to array and calculate percentages
    return Array.from(sourceMap.values()).map(category => {
      return {
        source: this.capitalizeFirstLetter(category.type),
        medium: category.type,
        sessions: category.totalVisits,
        percentage: total > 0 ? Math.round((category.totalVisits / total) * 100) : 0,
        details: category.sources.sort((a, b) => b.visits - a.visits)
      };
    }).sort((a, b) => b.sessions - a.sessions);
  }

  /**
   * Fetch geographic data from Google Analytics
   */
  fetchGeographicData = async (
    propertyId: string,
    url: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<GeographicData[]> => {
    try {
      // Process URL to extract just the path and decode any URL encoding
      let pagePath = null;
      if (url) {
        try {
          // First decode any URL encoding
          const decodedUrl = decodeURIComponent(url);
          console.log(`[GA Client] Decoded URL for geographic data: ${decodedUrl}`);
          
          // Try to parse as a URL to extract just the path
          try {
            const urlObj = new URL(decodedUrl);
            pagePath = urlObj.pathname;
            console.log(`[GA Client] Extracted path from URL for geographic data: ${pagePath}`);
          } catch (e) {
            // If it's not a valid URL, it might be just a path
            pagePath = decodedUrl.startsWith('/') ? decodedUrl : `/${decodedUrl}`;
            console.log(`[GA Client] Using path directly for geographic data: ${pagePath}`);
          }
        } catch (e) {
          console.error(`[GA Client] Error processing URL ${url} for geographic data:`, e);
          pagePath = url; // Fallback to using the original value
        }
      }

      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      // Filter for specific page if URL is provided
      const dimensionFilter = pagePath ? {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT',
            value: pagePath
          }
        }
      } : undefined;

      // First fetch countries
      const countryParams = {
        dateRanges: [{
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }],
        dimensions: [
          { name: 'country' }
        ],
        metrics: [
          { name: 'sessions' }
        ],
        dimensionFilter: dimensionFilter
      };

      try {
        console.log('Fetching country data from GA4...');
        const countryData = await this.fetchGAData(propertyId, countryParams);
        
        // Process country data
        const countries = this.processCountryData(countryData);
        
        // Now fetch city data with country dimension
        const cityParams = {
          dateRanges: [{
            startDate: formattedStartDate,
            endDate: formattedEndDate
          }],
          dimensions: [
            { name: 'country' },
            { name: 'city' }
          ],
          metrics: [
            { name: 'sessions' }
          ],
          dimensionFilter: dimensionFilter
        };
        
        console.log('Fetching city data from GA4...');
        const cityData = await this.fetchGAData(propertyId, cityParams);
        
        // Merge city data with country data
        return this.mergeGeographicData(countries, cityData);
      } catch (error) {
        console.error('Error fetching geographic data:', error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching geographic data:', error);
      return [];
    }
  }

  private processCountryData(data: any): GeographicData[] {
    console.log('Processing country data:', JSON.stringify(data, null, 2));
    
    if (!data.rows || data.rows.length === 0) {
      console.warn('No country data rows returned from GA4');
      return [];
    }

    const total = data.rows.reduce((sum: number, row: any) => {
      return sum + parseInt(row.metricValues[0].value || 0);
    }, 0);

    return data.rows
      .filter((row: any) => {
        const country = row.dimensionValues[0].value;
        return country && country !== '(not set)' && country !== 'not set';
      })
      .map((row: any) => {
        const country = row.dimensionValues[0].value;
        const visits = parseInt(row.metricValues[0].value || 0);
        const percentage = total > 0 ? Math.round((visits / total) * 100) : 0;
        
        return {
          country,
          sessions: visits,
          percentage,
          cities: []
        };
      })
      .sort((a: GeographicData, b: GeographicData) => b.sessions - a.sessions)
      .slice(0, 10); // Limit to top 10 countries
  }

  private mergeGeographicData(countries: GeographicData[], cityData: any): GeographicData[] {
    console.log('Merging city data with countries...');
    
    if (!cityData.rows || cityData.rows.length === 0) {
      console.warn('No city data rows returned from GA4');
      return countries;
    }

    // Create a map of countries for faster lookup
    const countryMap = new Map<string, GeographicData>();
    countries.forEach(country => {
      countryMap.set(country.country, country);
    });

    // Process city data and add to respective countries
    const cityMap = new Map<string, Map<string, { visits: number, percentage: number }>>();
    
    // First, group cities by country and calculate totals
    cityData.rows.forEach((row: any) => {
      const country = row.dimensionValues[0].value;
      const city = row.dimensionValues[1].value;
      const visits = parseInt(row.metricValues[0].value || 0);
      
      // Skip invalid data
      if (!country || !city || country === '(not set)' || city === '(not set)' || 
          country === 'not set' || city === 'not set') {
        return;
      }
      
      if (!cityMap.has(country)) {
        cityMap.set(country, new Map());
      }
      
      const countryCities = cityMap.get(country)!;
      countryCities.set(city, { visits, percentage: 0 });
    });
    
    // Calculate percentages for cities within each country
    cityMap.forEach((cities, countryName) => {
      const countryTotal = Array.from(cities.values()).reduce((sum, city) => sum + city.visits, 0);
      
      cities.forEach((city, cityName) => {
        city.percentage = countryTotal > 0 ? Math.round((city.visits / countryTotal) * 100) : 0;
      });
      
      // Add cities to country data
      const country = countryMap.get(countryName);
      if (country) {
        country.cities = Array.from(cities.entries())
          .map(([name, data]) => ({
            city: name,
            sessions: data.visits,
            percentage: data.percentage
          }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 5); // Top 5 cities per country
      }
    });
    
    // Also create a flat list of all cities for the "Top Cities Overall" tab
    const allCities: Array<{
      city: string;
      country: string;
      sessions: number;
      percentage: number;
    }> = [];
    
    cityMap.forEach((cities, countryName) => {
      cities.forEach((cityData, cityName) => {
        allCities.push({
          city: cityName,
          country: countryName,
          sessions: cityData.visits,
          percentage: cityData.percentage
        });
      });
    });
    
    // Sort all cities by sessions and store in a global variable or cache if needed
    const topCities = allCities
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10); // Top 10 cities overall
    
    console.log(`Processed ${allCities.length} cities, top 10:`, topCities);
    
    return countries;
  }

  private processGeographicData(data: any): GeographicData[] {
    // This method is now replaced by processCountryData and mergeGeographicData
    return this.processCountryData(data);
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Get page URLs from Google Analytics
   */
  async getPageUrls(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
    sortBy: 'screenPageViews' | 'totalUsers' | 'averageSessionDuration' | 'bounceRate' = 'screenPageViews',
    fetchAllUrls: boolean = true
  ): Promise<PageUrlData[]> {
    try {
      console.log(`[GA Client] Fetching page URLs for property ${propertyId}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}, fetchAllUrls: ${fetchAllUrls}`);
      
      // For SPA, we need to look at page_view events and their parameters
      const params = {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        dimensions: [
          { name: 'eventName' },
          { name: 'pageLocation' },
          { name: 'pageTitle' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'userEngagementDuration' },
          { name: 'bounceRate' },
          { name: 'engagementRate' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: {
              matchType: 'EXACT',
              value: 'page_view'
            }
          }
        },
        orderBys: [
          {
            desc: true,
            metric: { metricName: sortBy === 'screenPageViews' ? 'screenPageViews' : 
                              sortBy === 'totalUsers' ? 'totalUsers' : 
                              sortBy === 'averageSessionDuration' ? 'userEngagementDuration' : 
                              sortBy === 'bounceRate' ? 'bounceRate' : 'screenPageViews' }
          }
        ],
        limit: limit
      };

      console.log('[GA Client] Fetching page views from GA4...');
      console.log(`[GA Client] Request params:`, JSON.stringify(params, null, 2));
      const data = await this.fetchGAData(propertyId, params);
      
      if (!data.rows || data.rows.length === 0) {
        console.warn('[GA Client] No page views returned from GA4');
        return [];
      }

      console.log(`[GA Client] Received ${data.rows.length} page views from GA4`);
      console.log('[GA Client] Sample rows:', JSON.stringify(data.rows.slice(0, 3), null, 2));
      
      // Filter out any localhost URLs before processing
      const filteredRows = data.rows.filter((row: any) => {
        const location = row.dimensionValues[1].value;
        return !(location.includes('localhost') || location.includes('127.0.0.1'));
      });
      
      console.log(`[GA Client] Filtered out ${data.rows.length - filteredRows.length} localhost URLs, keeping ${filteredRows.length} production URLs`);
      
      // Process the response and filter results
      const allPages = filteredRows.map((row: any) => {
        const location = row.dimensionValues[1].value; // Get pageLocation
        const title = row.dimensionValues[2].value; // Get pageTitle
        const pageViews = parseInt(row.metricValues[0].value) || 0;
        const uniqueVisitors = parseInt(row.metricValues[1].value) || 0;
        const engagementDuration = parseInt(row.metricValues[2].value) || 0;
        
        // Parse bounce rate and engagement rate if available
        let bounceRate = 0;
        let engagementRate = 0;
        
        if (row.metricValues.length > 3) {
          bounceRate = parseFloat(row.metricValues[3].value) || 0;
        }
        
        if (row.metricValues.length > 4) {
          engagementRate = parseFloat(row.metricValues[4].value) || 0;
        }
        
        // Extract path information from URL
        let section = '';
        let pageNumber = null;
        let path = '';
        
        try {
          // Try to parse the URL to get path information
          try {
            const url = new URL(location);
            path = url.pathname;
            
            // Extract section and page number from URL parameters
            const searchParams = new URLSearchParams(url.search);
            section = searchParams.get('section') || '';
            const pageParam = searchParams.get('page');
            pageNumber = pageParam ? parseInt(pageParam, 10) : null;
          } catch (e) {
            // If URL parsing fails, use the location as-is
            path = location;
          }
          
          // Clean up and capitalize title
          let cleanTitle;
          if (title && title !== '(not set)') {
            cleanTitle = title;
          } else if (section) {
            cleanTitle = pageNumber ? `${section} - Page ${pageNumber}` : section;
          } else {
            cleanTitle = path.split('/').pop() || 'Page';
          }
          
          return {
            url: location,
            path: path || location,
            title: cleanTitle,
            pageViews,
            uniqueVisitors,
            averageTimeOnPage: pageViews > 0 ? Math.round(engagementDuration / pageViews) : 0,
            bounceRate,
            engagementRate,
            sessionsPerUser: uniqueVisitors > 0 ? Math.round((pageViews / uniqueVisitors) * 100) / 100 : 0,
            eventCount: pageViews,
            lastVisited: new Date().toISOString(),
            isActive: true
          };
        } catch (e) {
          console.error('[GA Client] Error processing URL:', location, e);
          // Even if there's an error, return basic info
          return {
            url: location,
            path: location,
            title: title || 'Page',
            pageViews,
            uniqueVisitors,
            averageTimeOnPage: pageViews > 0 ? Math.round(engagementDuration / pageViews) : 0,
            bounceRate,
            engagementRate,
            sessionsPerUser: 0,
            eventCount: pageViews,
            lastVisited: new Date().toISOString(),
            isActive: true
          };
        }
      }).filter(Boolean); // Filter out undefined/null entries
      
      // Merge duplicate URLs from different environments (localhost vs production)
      // and prioritize entries with proper titles
      const mergedPages = new Map<string, PageUrlData>();
      
      allPages.forEach((page: PageUrlData) => {
        // Extract the path part of the URL to use as a normalized key
        let normalizedPath = '';
        try {
          // Parse the URL to get just the pathname and query parameters
          const url = new URL(page.url);
          normalizedPath = url.pathname + url.search;
        } catch (e) {
          // If URL parsing fails, use the whole URL or path
          normalizedPath = page.path;
        }
        
        // Normalize the path (lowercase, remove trailing slashes)
        normalizedPath = normalizedPath.toLowerCase().replace(/\/+$/, '');
        
        if (mergedPages.has(normalizedPath)) {
          // If we already have this URL, decide whether to replace or merge
          const existingPage = mergedPages.get(normalizedPath)!;
          
          // Calculate total metrics
          const totalPageViews = existingPage.pageViews + page.pageViews;
          const totalUniqueVisitors = existingPage.uniqueVisitors + page.uniqueVisitors;
          
          // Check if the current entry has a better title
          const currentHasGenericTitle = page.title === 'Newing' || page.title === 'Page';
          const existingHasGenericTitle = existingPage.title === 'Newing' || existingPage.title === 'Page';
          
          // Prefer entries with proper titles over generic "Newing" titles
          if (existingHasGenericTitle && !currentHasGenericTitle) {
            // Current page has a better title, use it but sum the metrics
            mergedPages.set(normalizedPath, {
              ...page,
              pageViews: totalPageViews,
              uniqueVisitors: totalUniqueVisitors,
              // Recalculate averages
              averageTimeOnPage: totalPageViews > 0 ? 
                Math.round((existingPage.averageTimeOnPage * existingPage.pageViews + 
                           page.averageTimeOnPage * page.pageViews) / totalPageViews) : 0
            });
          } else if (!existingHasGenericTitle) {
            // Existing page has a good title, just update metrics
            mergedPages.set(normalizedPath, {
              ...existingPage,
              pageViews: totalPageViews,
              uniqueVisitors: totalUniqueVisitors,
              // Recalculate averages
              averageTimeOnPage: totalPageViews > 0 ? 
                Math.round((existingPage.averageTimeOnPage * existingPage.pageViews + 
                           page.averageTimeOnPage * page.pageViews) / totalPageViews) : 0
            });
          }
        } else {
          // This is a new path, add it to our map
          mergedPages.set(normalizedPath, page);
        }
      });
      
      const processedPages = Array.from(mergedPages.values());
      
      console.log(`[GA Client] Merged duplicate URLs: ${allPages.length} -> ${processedPages.length}`);
      console.log('[GA Client] Sample processed pages:', JSON.stringify(processedPages.slice(0, 3), null, 2));
      
      return processedPages;
    } catch (error) {
      console.error('[GA Client] Error fetching page URLs:', error);
      return [];
    }
  }

  /**
   * Get engagement metrics from Google Analytics 4
   */
  getEngagementMetrics = cache(async (
    propertyId: string,
    url: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<EngagementMetrics> => {
    try {
      console.log(`[GA Client] Getting engagement metrics for property ${propertyId}, url: ${url || 'all'}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Validate dates to ensure they're not in the future
      const now = new Date();
      let validStartDate = new Date(startDate);
      let validEndDate = new Date(endDate);
      
      // Check if start date is in the future
      if (validStartDate > now) {
        console.error(`[GA Client] Start date ${validStartDate.toISOString()} is in the future! Using 30 days ago instead.`);
        validStartDate = new Date(now);
        validStartDate.setDate(now.getDate() - 30);
        validStartDate.setHours(0, 0, 0, 0);
      }
      
      // Check if end date is in the future
      if (validEndDate > now) {
        console.error(`[GA Client] End date ${validEndDate.toISOString()} is in the future! Using current date instead.`);
        validEndDate = new Date(now);
      }
      
      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = validStartDate.toISOString().split('T')[0];
      const formattedEndDate = validEndDate.toISOString().split('T')[0];

      console.log(`[GA Client] Formatted date range: ${formattedStartDate} to ${formattedEndDate}`);
      
      // Process URL to extract just the path and decode any URL encoding
      let pagePath = null;
      if (url) {
        try {
          // First decode any URL encoding
          const decodedUrl = decodeURIComponent(url);
          console.log(`[GA Client] Decoded URL: ${decodedUrl}`);
          
          // Try to parse as a URL to extract just the path
          try {
            const urlObj = new URL(decodedUrl);
            pagePath = urlObj.pathname;
            console.log(`[GA Client] Extracted path from URL: ${pagePath}`);
          } catch (e) {
            // If it's not a valid URL, it might be just a path
            pagePath = decodedUrl.startsWith('/') ? decodedUrl : `/${decodedUrl}`;
            console.log(`[GA Client] Using path directly: ${pagePath}`);
          }
        } catch (e) {
          console.error(`[GA Client] Error processing URL ${url}:`, e);
          pagePath = url; // Fallback to using the original value
        }
      }

      // Filter for specific page if URL is provided
      const pageFilter = pagePath ? {
        dimensionFilter: {
          filter: {
            name: 'pagePath',
            stringFilter: {
              matchType: 'EXACT',
              value: pagePath
            }
          }
        }
      } : undefined;

      // Get default metrics to use as fallbacks
      const defaultMetrics = this.getDefaultEngagementMetrics();
      
      // Removed session duration and page depth fetching
      
      // 1. Fetch time of day distribution
      let timeOfDayData;
      try {
        timeOfDayData = await this.fetchTimeOfDayDistribution(
          propertyId, 
          formattedStartDate, 
          formattedEndDate, 
          pageFilter
        );
      } catch (error) {
        console.error('[GA Client] Error fetching time of day distribution:', error);
        timeOfDayData = defaultMetrics.timeOfDay;
      }
      
      // 2. Fetch day of week distribution
      let dayOfWeekData;
      try {
        dayOfWeekData = await this.fetchDayOfWeekDistribution(
          propertyId, 
          formattedStartDate, 
          formattedEndDate, 
          pageFilter
        );
      } catch (error) {
        console.error('[GA Client] Error fetching day of week distribution:', error);
        dayOfWeekData = defaultMetrics.dayOfWeek;
      }
      
      // 3. Fetch user type distribution (new vs returning)
      let userTypeData;
      try {
        userTypeData = await this.fetchUserTypeDistribution(
          propertyId, 
          formattedStartDate, 
          formattedEndDate, 
          pageFilter
        );
      } catch (error) {
        console.error('[GA Client] Error fetching user type distribution:', error);
        userTypeData = defaultMetrics.userType;
      }
      
      // 4. Fetch landing pages (entry pages)
      let landingPagesData: Array<{url: string, title: string, entries: number, percentage: number}> = [];
      try {
        landingPagesData = await this.fetchLandingPages(
          propertyId,
          formattedStartDate,
          formattedEndDate,
          pageFilter
        );
      } catch (error) {
        console.error('[GA Client] Error fetching landing pages:', error);
        landingPagesData = defaultMetrics.userFlow.entryPages;
      }
      
      // 5. Fetch exit pages
      let exitPagesData: Array<{url: string, title: string, percentage: number, exits: number}> = [];
      try {
        exitPagesData = await this.fetchExitPages(
          propertyId,
          formattedStartDate,
          formattedEndDate,
          pageFilter
        );
      } catch (error) {
        console.error('[GA Client] Error fetching exit pages:', error);
        exitPagesData = defaultMetrics.userFlow.exitPages;
      }
      
      // Calculate retention rate from user type data
      const retentionRate = userTypeData.returning;
      const retentionTotal = userTypeData.new + userTypeData.returning;
      
      // Combine all metrics into the engagement metrics object
      const engagementMetrics: EngagementMetrics = {
        timeOfDay: timeOfDayData,
        dayOfWeek: dayOfWeekData,
        userType: userTypeData,
        retention: {
          rate: retentionRate,
          total: retentionTotal
        },
        userFlow: {
          entryPages: landingPagesData,
          exitPages: exitPagesData
        }
      };
      
      console.log(`[GA Client] Engagement metrics:`, JSON.stringify(engagementMetrics, null, 2));
      
      return engagementMetrics;
    } catch (error) {
      console.error(`[GA Client] Error getting engagement metrics for property ${propertyId}:`, error);
      
      // Return default engagement metrics on error
      return this.getDefaultEngagementMetrics();
    }
  });

  /**
   * Fetch time of day distribution from GA4
   */
  private async fetchTimeOfDayDistribution(
    propertyId: string,
    startDate: string,
    endDate: string,
    dimensionFilter?: any
  ): Promise<TimeDistribution> {
    try {
      // Get sessions by hour of day
      const timeParams = {
        dateRanges: [{
          startDate,
          endDate
        }],
        dimensions: [
          { name: 'hour' }
        ],
        metrics: [
          { name: 'sessions' }
        ],
        dimensionFilter: dimensionFilter ? {
          filter: dimensionFilter
        } : undefined
      };
      
      const timeData = await this.fetchGAData(propertyId, timeParams);
      
      // Process the hourly data
      const hourlyData: Record<string, number> = {};
      let totalSessions = 0;
      
      if (timeData.rows && timeData.rows.length > 0) {
        timeData.rows.forEach((row: any) => {
          const hour = parseInt(row.dimensionValues[0].value);
          const sessions = parseInt(row.metricValues[0].value);
          hourlyData[hour] = sessions;
          totalSessions += sessions;
        });
      }
      
      // Calculate time of day distribution
      let morning = 0; // 6am-12pm (hours 6-11)
      let afternoon = 0; // 12pm-6pm (hours 12-17)
      let evening = 0; // 6pm-12am (hours 18-23)
      let night = 0; // 12am-6am (hours 0-5)
      
      for (let hour = 0; hour < 24; hour++) {
        const sessions = hourlyData[hour] || 0;
        
        if (hour >= 6 && hour < 12) {
          morning += sessions;
        } else if (hour >= 12 && hour < 18) {
          afternoon += sessions;
        } else if (hour >= 18 && hour < 24) {
          evening += sessions;
        } else {
          night += sessions;
        }
      }
      
      // Calculate percentages
      const morningPct = totalSessions > 0 ? Math.round((morning / totalSessions) * 100) : 25;
      const afternoonPct = totalSessions > 0 ? Math.round((afternoon / totalSessions) * 100) : 40;
      const eveningPct = totalSessions > 0 ? Math.round((evening / totalSessions) * 100) : 25;
      const nightPct = totalSessions > 0 ? Math.round((night / totalSessions) * 100) : 10;
      
      // Ensure percentages sum to 100%
      const totalPct = morningPct + afternoonPct + eveningPct + nightPct;
      let adjustedMorningPct = morningPct;
      let adjustedAfternoonPct = afternoonPct;
      let adjustedEveningPct = eveningPct;
      let adjustedNightPct = nightPct;
      
      if (totalPct !== 100) {
        const diff = 100 - totalPct;
        // Add the difference to the largest segment
        if (morningPct >= afternoonPct && morningPct >= eveningPct && morningPct >= nightPct) {
          adjustedMorningPct += diff;
        } else if (afternoonPct >= morningPct && afternoonPct >= eveningPct && afternoonPct >= nightPct) {
          adjustedAfternoonPct += diff;
        } else if (eveningPct >= morningPct && eveningPct >= afternoonPct && eveningPct >= nightPct) {
          adjustedEveningPct += diff;
        } else {
          adjustedNightPct += diff;
        }
      }
      
      return {
        morning: adjustedMorningPct,
        afternoon: adjustedAfternoonPct,
        evening: adjustedEveningPct,
        night: adjustedNightPct,
        total: totalSessions
      };
    } catch (error) {
      console.error('[GA Client] Error fetching time of day distribution:', error);
      
      // Return default distribution on error
      return {
        morning: 25,
        afternoon: 40,
        evening: 25,
        night: 10,
        total: 100
      };
    }
  }

  /**
   * Fetch day of week distribution from GA4
   */
  private async fetchDayOfWeekDistribution(
    propertyId: string,
    startDate: string,
    endDate: string,
    dimensionFilter?: any
  ): Promise<WeekdayDistribution> {
    try {
      // Get sessions by day of week
      const dayParams = {
        dateRanges: [{
          startDate,
          endDate
        }],
        dimensions: [
          { name: 'dayOfWeek' }
        ],
        metrics: [
          { name: 'sessions' }
        ],
        dimensionFilter: dimensionFilter ? {
          filter: dimensionFilter
        } : undefined
      };
      
      const dayData = await this.fetchGAData(propertyId, dayParams);
      
      // Process the day of week data
      let weekdaySessions = 0;
      let weekendSessions = 0;
      let totalSessions = 0;
      
      if (dayData.rows && dayData.rows.length > 0) {
        dayData.rows.forEach((row: any) => {
          const day = parseInt(row.dimensionValues[0].value);
          const sessions = parseInt(row.metricValues[0].value);
          
          // In GA4, 1 = Sunday, 2 = Monday, ..., 7 = Saturday
          if (day === 1 || day === 7) {
            weekendSessions += sessions;
          } else {
            weekdaySessions += sessions;
          }
          
          totalSessions += sessions;
        });
      }
      
      // Calculate percentages
      const weekdayPct = totalSessions > 0 ? Math.round((weekdaySessions / totalSessions) * 100) : 70;
      const weekendPct = totalSessions > 0 ? Math.round((weekendSessions / totalSessions) * 100) : 30;
      
      // Ensure percentages sum to 100%
      let adjustedWeekdayPct = weekdayPct;
      let adjustedWeekendPct = weekendPct;
      
      if (weekdayPct + weekendPct !== 100) {
        if (weekdayPct > weekendPct) {
          adjustedWeekdayPct = 100 - weekendPct;
        } else {
          adjustedWeekendPct = 100 - weekdayPct;
        }
      }
      
      return {
        weekdays: adjustedWeekdayPct,
        weekends: adjustedWeekendPct,
        total: totalSessions
      };
    } catch (error) {
      console.error('[GA Client] Error fetching day of week distribution:', error);
      
      // Return default distribution on error
      return {
        weekdays: 70,
        weekends: 30,
        total: 100
      };
    }
  }

  /**
   * Fetch user type distribution (new vs returning) from GA4
   */
  private async fetchUserTypeDistribution(
    propertyId: string,
    startDate: string,
    endDate: string,
    dimensionFilter?: any
  ): Promise<UserTypeDistribution> {
    try {
      // Get sessions by user type (new vs returning)
      const userParams = {
        dateRanges: [{
          startDate,
          endDate
        }],
        dimensions: [
          { name: 'newVsReturning' }
        ],
        metrics: [
          { name: 'sessions' }
        ],
        dimensionFilter: dimensionFilter ? {
          filter: dimensionFilter
        } : undefined
      };
      
      const userData = await this.fetchGAData(propertyId, userParams);
      
      // Process the user type data
      let newUsers = 0;
      let returningUsers = 0;
      let totalSessions = 0;
      
      if (userData.rows && userData.rows.length > 0) {
        userData.rows.forEach((row: any) => {
          const userType = row.dimensionValues[0].value;
          const sessions = parseInt(row.metricValues[0].value);
          
          if (userType === 'new') {
            newUsers += sessions;
          } else if (userType === 'returning') {
            returningUsers += sessions;
          }
          
          totalSessions += sessions;
        });
      }
      
      // Calculate percentages
      const newPct = totalSessions > 0 ? Math.round((newUsers / totalSessions) * 100) : 75;
      const returningPct = totalSessions > 0 ? Math.round((returningUsers / totalSessions) * 100) : 25;
      
      // Ensure percentages sum to 100%
      let adjustedNewPct = newPct;
      let adjustedReturningPct = returningPct;
      
      if (newPct + returningPct !== 100) {
        if (newPct > returningPct) {
          adjustedNewPct = 100 - returningPct;
        } else {
          adjustedReturningPct = 100 - newPct;
        }
      }
      
      return {
        new: adjustedNewPct,
        returning: adjustedReturningPct,
        total: totalSessions
      };
    } catch (error) {
      console.error('[GA Client] Error fetching user type distribution:', error);
      
      // Return default distribution on error
      return {
        new: 75,
        returning: 25,
        total: 100
      };
    }
  }

  /**
   * Fetch landing pages (entry pages) from GA4
   */
  private async fetchLandingPages(
    propertyId: string,
    startDate: string,
    endDate: string,
    dimensionFilter?: any
  ): Promise<Array<{url: string, title: string, entries: number, percentage: number}>> {
    try {
      console.log('[GA Client] Fetching landing pages data...');
      
      // Get landing pages data
      const params = {
        dateRanges: [{
          startDate,
          endDate
        }],
        dimensions: [
          { name: 'landingPage' },
          { name: 'pageTitle' }
        ],
        metrics: [
          { name: 'sessions' }
        ],
        orderBys: [
          {
            desc: true,
            metric: { metricName: 'sessions' }
          }
        ],
        limit: 25, // Increased limit to get more pages before filtering
        dimensionFilter: dimensionFilter ? {
          filter: dimensionFilter
        } : undefined
      };
      
      const data = await this.fetchGAData(propertyId, params);
      
      // Process landing pages data
      let landingPages: Array<{url: string, title: string, entries: number, percentage: number}> = [];
      let totalEntries = 0;
      
      // Define allowed path prefixes
      const allowedPaths = ['/home', '/service', '/client', '/team', '/value', '/about', '/contact', '/portfolio'];
      
      // Create a map to deduplicate by path
      const pageMap = new Map<string, {url: string, title: string, entries: number, hasGenericTitle: boolean}>();
      
      if (data.rows && data.rows.length > 0) {
        // Filter out localhost entries before processing
        const filteredRows = data.rows.filter((row: any) => {
          const location = row.dimensionValues[0].value;
          return !(location.includes('localhost') || location.includes('127.0.0.1'));
        });
        
        console.log(`[GA Client] Filtered out ${data.rows.length - filteredRows.length} localhost landing page URLs, keeping ${filteredRows.length} production URLs`);
        
        // Process each landing page
        filteredRows.forEach((row: any) => {
          const rawUrl = row.dimensionValues[0].value;
          const rawTitle = row.dimensionValues[1].value;
          const entries = parseInt(row.metricValues[0].value);
          
          // Skip invalid or empty URLs
          if (!rawUrl || rawUrl === '(not set)' || rawUrl === '/') {
            return;
          }
          
          try {
            // Normalize URL
            let normalizedUrl: string;
            let path: string;
            
            // Check if it's already a path or a full URL
            if (rawUrl.startsWith('/')) {
              path = rawUrl;
              normalizedUrl = rawUrl;
            } else {
              try {
                // Try to parse as URL
                const urlObj = new URL(rawUrl);
                path = urlObj.pathname;
                normalizedUrl = path;
              } catch (e) {
                // If not a valid URL, treat as path
                path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
                normalizedUrl = path;
              }
            }
            
            // Clean up the path - remove query params and hash
            const cleanPath = path.split('?')[0].split('#')[0];
            
            // Check if path is allowed
            const isAllowed = allowedPaths.some(allowedPath => 
              cleanPath.startsWith(allowedPath) || 
              cleanPath.includes(allowedPath.substring(1))
            );
            
            if (!isAllowed) {
              return;
            }
            
            // Check if title is generic
            const isGenericTitle = !rawTitle || 
                                  rawTitle === '(not set)' || 
                                  rawTitle === '' || 
                                  rawTitle === 'Newing' || 
                                  rawTitle === 'Page' ||
                                  /^Home\s*\|\s*Newing$/i.test(rawTitle) ||
                                  /^Newing\s*\|\s*.*$/i.test(rawTitle);
            
            // Clean up title
            let title = rawTitle;
            let hasGenericTitle = isGenericTitle;
            
            if (hasGenericTitle) {
              // Extract a title from the path if no title is available
              const pathSegments = cleanPath.split('/').filter(Boolean);
              title = pathSegments.length > 0 
                ? pathSegments[pathSegments.length - 1].replace(/-/g, ' ')
                : cleanPath;
              
              // Capitalize the title
              title = title.split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
            
            // Add or update in the map (combine entries for duplicate paths)
            const key = cleanPath.toLowerCase();
            if (pageMap.has(key)) {
              const existing = pageMap.get(key)!;
              
              // Combine entries
              existing.entries += entries;
              
              // Keep better title (non-generic)
              if (existing.hasGenericTitle && !hasGenericTitle) {
                existing.title = title;
                existing.hasGenericTitle = false;
              }
            } else {
              pageMap.set(key, {
                url: cleanPath,
                title,
                entries,
                hasGenericTitle
              });
            }
          } catch (e) {
            console.error('[GA Client] Error processing landing page URL:', rawUrl, e);
          }
        });
        
        // Convert map to array and calculate total entries
        const processedPages = Array.from(pageMap.values())
          .filter(page => page.entries > 0) // Remove pages with zero entries
          .map(({ url, title, entries }) => ({ 
            url, 
            title, 
            entries 
          }));
        
        totalEntries = processedPages.reduce((sum, page) => sum + page.entries, 0);
        
        // Calculate percentages and sort by entries
        landingPages = processedPages.map(page => ({
          ...page,
          percentage: totalEntries > 0 ? Math.round((page.entries / totalEntries) * 100) : 0
        }))
        .sort((a, b) => b.entries - a.entries)
        .slice(0, 10); // Take top 10 after filtering and deduplication
      }
      
      console.log(`[GA Client] Processed ${landingPages.length} landing pages after filtering`);
      
      return landingPages;
    } catch (error) {
      console.error('[GA Client] Error fetching landing pages:', error);
      
      // Return empty array on error
      return [];
    }
  }

  /**
   * Fetch exit pages from GA4
   */
  private async fetchExitPages(
    propertyId: string,
    startDate: string,
    endDate: string,
    dimensionFilter?: any
  ): Promise<Array<{url: string, title: string, percentage: number, exits: number}>> {
    try {
      console.log('[GA Client] Fetching exit pages data...');
      
      // Get exit pages data using pagePath with sessionEnd metrics
      // Note: GA4 doesn't have a direct "exits" metric, so we use a combination of metrics
      // to calculate exit rates for pages
      const params = {
        dateRanges: [{
          startDate,
          endDate
        }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'pageTitle' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'bounceRate' }
        ],
        orderBys: [
          {
            desc: true,
            metric: { metricName: 'bounceRate' }
          }
        ],
        limit: 25, // Increased limit to get more pages before filtering
        dimensionFilter: dimensionFilter ? {
          filter: dimensionFilter
        } : undefined
      };
      
      const data = await this.fetchGAData(propertyId, params);
      
      // Process exit pages data
      let exitPages: Array<{url: string, title: string, percentage: number, exits: number}> = [];
      
      // Define allowed path prefixes
      const allowedPaths = ['/home', '/service', '/client', '/team', '/value', '/about', '/contact', '/portfolio'];
      
      // Create a map to deduplicate by path
      const pageMap = new Map<string, {url: string, title: string, exits: number, views: number, hasGenericTitle: boolean}>();
      
      if (data.rows && data.rows.length > 0) {
        // Filter out localhost entries before processing
        const filteredRows = data.rows.filter((row: any) => {
          const location = row.dimensionValues[0].value;
          return !(location.includes('localhost') || location.includes('127.0.0.1'));
        });
        
        console.log(`[GA Client] Filtered out ${data.rows.length - filteredRows.length} localhost exit page URLs, keeping ${filteredRows.length} production URLs`);
      
        // Process each page
        filteredRows.forEach((row: any) => {
          const rawUrl = row.dimensionValues[0].value;
          const rawTitle = row.dimensionValues[1].value;
          const pageViews = parseInt(row.metricValues[0].value) || 0;
          const sessions = parseInt(row.metricValues[1].value) || 0;
          const bounceRate = parseFloat(row.metricValues[2].value) || 0;
          
          // Calculate estimated exits based on bounce rate and sessions
          // This is an approximation since GA4 doesn't provide direct exit counts
          const estimatedExits = Math.round(sessions * bounceRate);
          
          // Skip invalid or empty URLs
          if (!rawUrl || rawUrl === '(not set)' || rawUrl === '/') {
            return;
          }
          
          try {
            // Normalize URL
            let normalizedUrl: string;
            let path: string;
            
            // Check if it's already a path or a full URL
            if (rawUrl.startsWith('/')) {
              path = rawUrl;
              normalizedUrl = rawUrl;
            } else {
              try {
                // Try to parse as URL
                const urlObj = new URL(rawUrl);
                path = urlObj.pathname;
                normalizedUrl = path;
              } catch (e) {
                // If not a valid URL, treat as path
                path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
                normalizedUrl = path;
              }
            }
            
            // Clean up the path - remove query params and hash
            const cleanPath = path.split('?')[0].split('#')[0];
            
            // Check if path is allowed
            const isAllowed = allowedPaths.some(allowedPath => 
              cleanPath.startsWith(allowedPath) || 
              cleanPath.includes(allowedPath.substring(1))
            );
            
            if (!isAllowed) {
              return;
            }
            
            // Check if title is generic
            const isGenericTitle = !rawTitle || 
                                 rawTitle === '(not set)' || 
                                 rawTitle === '' || 
                                 rawTitle === 'Newing' || 
                                 rawTitle === 'Page' ||
                                 /^Home\s*\|\s*Newing$/i.test(rawTitle) ||
                                 /^Newing\s*\|\s*.*$/i.test(rawTitle);
            
            // Clean up title
            let title = rawTitle;
            let hasGenericTitle = isGenericTitle;
            
            if (hasGenericTitle) {
              // Extract a title from the path if no title is available
              const pathSegments = cleanPath.split('/').filter(Boolean);
              title = pathSegments.length > 0 
                ? pathSegments[pathSegments.length - 1].replace(/-/g, ' ')
                : cleanPath;
              
              // Capitalize the title
              title = title.split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
            
            // Add or update in the map (combine exits for duplicate paths)
            const key = cleanPath.toLowerCase();
            if (pageMap.has(key)) {
              const existing = pageMap.get(key)!;
              
              // Combine metrics
              existing.exits += estimatedExits;
              existing.views += pageViews;
              
              // Keep better title (non-generic)
              if (existing.hasGenericTitle && !hasGenericTitle) {
                existing.title = title;
                existing.hasGenericTitle = false;
              }
            } else {
              pageMap.set(key, {
                url: cleanPath,
                title,
                exits: estimatedExits,
                views: pageViews,
                hasGenericTitle
              });
            }
          } catch (e) {
            console.error('[GA Client] Error processing exit page URL:', rawUrl, e);
          }
        });
        
        // Convert map to array and calculate total exits
        const processedPages = Array.from(pageMap.values())
          .filter(page => page.exits > 0) // Remove pages with zero exits
          .map(({ url, title, exits, views }) => ({
            url,
            title,
            exits,
            views
          }));
        
        const totalExits = processedPages.reduce((sum, page) => sum + page.exits, 0);
        
        // Calculate percentages and sort by exits
        // Note: We're creating objects with percentage before exits to match the desired display order
        exitPages = processedPages.map(page => ({
          url: page.url,
          title: page.title,
          percentage: totalExits > 0 ? Math.round((page.exits / totalExits) * 100) : 0,
          exits: page.exits
        }))
        .sort((a, b) => b.exits - a.exits)
        .slice(0, 10); // Take top 10 after filtering and deduplication
      }
      
      console.log(`[GA Client] Processed ${exitPages.length} exit pages after filtering`);
      
      return exitPages;
    } catch (error) {
      console.error('[GA Client] Error fetching exit pages:', error);
      
      // Return empty array on error
      return [];
    }
  }

  /**
   * Get default engagement metrics when data can't be fetched
   */
  private getDefaultEngagementMetrics(): EngagementMetrics {
    return {
      timeOfDay: {
        morning: 25,
        afternoon: 40,
        evening: 25,
        night: 10,
        total: 100
      },
      dayOfWeek: {
        weekdays: 70,
        weekends: 30,
        total: 100
      },
      userType: {
        new: 75,
        returning: 25,
        total: 100
      },
      retention: {
        rate: 25,
        total: 100
      },
      userFlow: {
        entryPages: [], // Empty array for entry pages
        exitPages: []  // Empty array for exit pages
      }
    };
  }

  /**
   * Get lead generation metrics from Google Analytics 4
   */
  getLeadGenerationMetrics = cache(async (
    propertyId: string,
    url: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalVisitors: number;
    totalInteractions: number;
    interactionRate: number;
    formStarts: number;
    formCompletions: number;
    formCompletionRate: number;
  }> => {
    try {
      const now = new Date();
      
      // Ensure we're using the correct time range
      let validStartDate = new Date(startDate);
      let validEndDate = new Date(endDate);

      // If end date is in future, use current time
      if (validEndDate > now) {
        validEndDate = new Date(now);
      }

      // Calculate time difference for logging
      const timeDiff = validEndDate.getTime() - validStartDate.getTime();
      const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
      const hoursDiff = Math.round(timeDiff / (1000 * 60 * 60));

      console.log('\n[GA Client] Processing time range:', {
        originalStartDate: startDate.toISOString(),
        originalEndDate: endDate.toISOString(),
        validStartDate: validStartDate.toISOString(),
        validEndDate: validEndDate.toISOString(),
        daysDiff,
        hoursDiff
      });

      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = validStartDate.toISOString().split('T')[0];
      const formattedEndDate = validEndDate.toISOString().split('T')[0];

      // Get form metrics with the correct time range
      const formMetrics = await this.fetchFormEvents(
        propertyId,
        formattedStartDate,
        formattedEndDate
      );

      return formMetrics;
    } catch (error) {
      console.error('[GA Client] Error fetching lead generation metrics:', error);
      return {
        totalVisitors: 0,
        totalInteractions: 0,
        interactionRate: 0,
        formStarts: 0,
        formCompletions: 0,
        formCompletionRate: 0
      };
    }
  });

  private async fetchFormEvents(propertyId: string, startDate: string, endDate: string) {
    console.log('\n[GA Client] Fetching form events with params:', {
      propertyId,
      startDate,
      endDate
    });

    // Add total visitors params
    const totalVisitorsParams = {
      dateRanges: [{
        startDate,
        endDate
      }],
      metrics: [
        { name: 'totalUsers' }
      ]
    };

    // Parameters for register button clicks
    const registerClickParams = {
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'eventName' }
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            matchType: 'EXACT',
            value: 'register_button_click'
          }
        }
      }
    };

    console.log('\n[GA Client] Register click params:', JSON.stringify(registerClickParams, null, 2));

    const formSubmitParams = {
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'eventName' }
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            matchType: 'EXACT',
            value: 'form_submit'
          }
        }
      }
    };

    try {
      // Fetch all metrics in parallel
      console.log('\n[GA Client] Fetching metrics from GA4...');
      
      const [totalVisitorsData, registerClickData, submitData] = await Promise.all([
        this.fetchGAData(propertyId, totalVisitorsParams),
        this.fetchGAData(propertyId, registerClickParams),
        this.fetchGAData(propertyId, formSubmitParams)
      ]);

      console.log('\n[GA Client] Raw register click data:', JSON.stringify(registerClickData, null, 2));

      // Process the results
      const totalVisitors = parseInt(totalVisitorsData.rows?.[0]?.metricValues?.[0]?.value || '0');
      const registerClicks = parseInt(registerClickData.rows?.[0]?.metricValues?.[0]?.value || '0');
      const formSubmits = parseInt(submitData.rows?.[0]?.metricValues?.[0]?.value || '0');
      const uniqueUsers = parseInt(registerClickData.rows?.[0]?.metricValues?.[1]?.value || '0');

      console.log('\n[GA Client] Parsed metrics:', {
        totalVisitors,
        registerClicks,
        formSubmits,
        uniqueUsers
      });

      // Calculate metrics with proper funnel progression
      const metrics = {
        totalVisitors,
        formStarts: registerClicks,
        formCompletions: formSubmits,
        totalInteractions: registerClicks + formSubmits,
        interactionRate: totalVisitors > 0 ? 
          Math.min(Math.round(((registerClicks + formSubmits) / totalVisitors) * 100), 100) : 0,
        formCompletionRate: registerClicks > 0 ? 
          Math.round((formSubmits / registerClicks) * 100) : 0
      };

      console.log('\n[GA Client] Processed lead generation metrics:', {
        ...metrics,
        timeSpan: `${Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days`,
        conversionRates: {
          clickToSubmit: registerClicks > 0 ? Math.round((formSubmits / registerClicks) * 100) : 0,
          overallConversion: totalVisitors > 0 ? Math.round((formSubmits / totalVisitors) * 100) : 0
        }
      });

      return metrics;
    } catch (error) {
      console.error('[GA Client] Error fetching lead generation events:', error);
      return {
        totalVisitors: 0,
        formStarts: 0,
        formCompletions: 0,
        totalInteractions: 0,
        interactionRate: 0,
        formCompletionRate: 0
      };
    }
  }

  async getRegisterButtonMetrics(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    url: string | null
  ) {
    try {
      console.log('\n[GA Client] Fetching register button metrics:', {
        propertyId,
        startDate,
        endDate,
        url
      });

      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      // Extract path from URL if present
      let sourcePath = null;
      if (url) {
        try {
          const urlObj = new URL(url);
          sourcePath = urlObj.pathname + urlObj.search;
          console.log('[GA Client] Extracted source path:', sourcePath);
        } catch (e) {
          console.error('[GA Client] Error processing URL:', e);
          sourcePath = url; // Fallback to using the original value
        }
      }

      // Note: This assumes you've set up a custom dimension in GA4 for source_path
      // The dimension name should be customEvent:source_path or source_path depending on your setup
      const params = {
        dateRanges: [{
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }],
        dimensions: [
          { name: 'eventName' }
        ],
        metrics: [
          { name: 'eventCount' }
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: {
                    value: 'register_button_click',
                    matchType: 'EXACT'
                  }
                }
              }
            ]
          }
        }
      };

      // Add source_path filter if URL is provided and custom dimension is set up
      if (sourcePath) {
        // Try with the custom dimension name - you'll need to replace 'source_path' 
        // with the exact dimension name you created in GA4
        params.dimensionFilter.andGroup.expressions.push({
          filter: {
            fieldName: 'customEvent:source_path', // This should match your custom dimension name
            stringFilter: {
              value: sourcePath,
              matchType: 'EXACT'
            }
          }
        });
      }

      console.log('[GA Client] Query:', JSON.stringify(params, null, 2));
      const response = await this.fetchGAData(propertyId, params);
      console.log('[GA Client] Response:', JSON.stringify(response, null, 2));

      // Sum up all eventCounts
      const totalClicks = response.rows?.reduce((sum: number, row: GA4Row) => {
        return sum + parseInt(row.metricValues[0].value || '0', 10);
      }, 0) || 0;

      return {
        rows: [{
          dimensionValues: [{ value: sourcePath || '' }],
          metricValues: [{ value: totalClicks.toString() }]
        }]
      };
    } catch (error) {
      console.error('[GA Client] Error fetching register button metrics:', error);
      return {
        rows: [{
          dimensionValues: [{ value: '' }],
          metricValues: [{ value: '0' }]
        }]
      };
    }
  }

  // Add this method to the GoogleAnalyticsClient class
  async getTimelineData(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    url: string
  ): Promise<Array<{ date: string; pageViews: number; uniqueVisitors: number }>> {
    try {
      console.log('\n[GA Client] Fetching timeline data:', {
        propertyId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        url
      });

      // Process URL to extract path
      let path: string;
      try {
        if (url.startsWith('/')) {
          path = url;
        } else {
          const urlObj = new URL(url);
          path = urlObj.pathname;
        }
        console.log('\n[GA Client] Extracted path for timeline:', path);
      } catch (e) {
        console.error('\n[GA Client] Error processing URL:', e);
        path = url;
      }

      const params = {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        dimensions: [
          { name: 'date' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'EXACT',
              value: path
            }
          }
        },
        orderBys: [
          {
            dimension: {
              dimensionName: 'date'
            }
          }
        ]
      };

      console.log('\n[GA Client] Timeline request params:', JSON.stringify(params, null, 2));
      const data = await this.fetchGAData(propertyId, params);
      console.log('\n[GA Client] Timeline raw response:', JSON.stringify(data, null, 2));

      if (!data.rows || data.rows.length === 0) {
        console.warn('\n[GA Client] No timeline data returned for path:', path);
        return this.generateEmptyDailyData(startDate, endDate);
      }

      // Create a map of existing data points
      const dataMap = new Map<string, { pageViews: number; uniqueVisitors: number }>();
      data.rows.forEach((row: GAReportRow) => {
        const dateStr = row.dimensionValues[0].value;
        dataMap.set(dateStr, {
          pageViews: parseInt(row.metricValues[0].value) || 0,
          uniqueVisitors: parseInt(row.metricValues[1].value) || 0
        });
      });

      // Generate complete daily timeline
      const timeline: Array<{ date: string; pageViews: number; uniqueVisitors: number }> = [];
      const currentDate = new Date(startDate);
      const endDateTime = endDate.getTime();

      while (currentDate.getTime() <= endDateTime) {
        // Format date as YYYYMMDD
        const dateKey = currentDate.toISOString().split('T')[0].replace(/-/g, '');
        
        // Get data for this date or use zeros
        const dayData = dataMap.get(dateKey) || { pageViews: 0, uniqueVisitors: 0 };
        
        timeline.push({
          date: dateKey,
          pageViews: dayData.pageViews,
          uniqueVisitors: dayData.uniqueVisitors
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('\n[GA Client] Processed timeline data:', timeline);
      return timeline;

    } catch (error) {
      console.error('Error fetching timeline data:', error);
      return this.generateEmptyDailyData(startDate, endDate);
    }
  }

  // Helper method to generate empty daily data
  private generateEmptyDailyData(
    startDate: Date,
    endDate: Date
  ): TimelineDataPoint[] {
    const timeline: TimelineDataPoint[] = [];
    const currentDate = new Date(startDate);
    const endDateTime = endDate.getTime();

    while (currentDate.getTime() <= endDateTime) {
      timeline.push({
        date: currentDate.toISOString().split('T')[0].replace(/-/g, ''),
        pageViews: 0,
        uniqueVisitors: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return timeline;
  }

  /**
   * Get event data from Google Analytics
   */
  async getEventData(
    propertyId: string,
    eventName: string,
    startDate: Date,
    endDate: Date,
    url: string | null,
    dimensions: string[]
  ) {
    try {
      console.log('\n[GA Client] Fetching event data:', {
        propertyId,
        eventName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        url,
        dimensions
      });

      // Format dates for GA4 (YYYY-MM-DD)
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      // Map custom dimensions to their event parameter names
      const mappedDimensions = dimensions.map(dim => ({
        name: `eventParams.${dim}`
      }));

      const params = {
        dateRanges: [{
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }],
        dimensions: [
          { name: 'eventName' },
          { name: 'pagePath' },
          ...mappedDimensions
        ],
        metrics: [
          { name: 'eventCount' }
        ]
      };

      console.log('[GA Client] Event data request params:', JSON.stringify(params, null, 2));

      const data = await this.fetchGAData(propertyId, params);
      console.log('[GA Client] Event data response:', JSON.stringify(data, null, 2));

      // Filter the results on our side
      if (data && data.rows) {
        data.rows = data.rows.filter((row: any) => {
          const rowEventName = row.dimensionValues[0].value;
          const rowPagePath = row.dimensionValues[1].value;
          
          // Match event name
          if (rowEventName !== eventName) {
            return false;
          }
          
          // Match page path if provided
          if (url) {
            try {
              const urlObj = new URL(url);
              const pagePath = urlObj.pathname;
              if (rowPagePath !== pagePath) {
                return false;
              }
            } catch (e) {
              // If URL parsing fails, try direct comparison
              const path = url.startsWith('/') ? url : `/${url}`;
              if (rowPagePath !== path) {
                return false;
              }
            }
          }
          
          return true;
        });
      }

      return data;
    } catch (error) {
      console.error('[GA Client] Error fetching event data:', error);
      return null;
    }
  }

  // New method to fetch only default pages and screens from GA4
  async getDefaultPageUrls(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 30
  ): Promise<PageUrlData[]> {
    try {
      console.log(`[GA Client] Fetching default page URLs for property ${propertyId}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const params = {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        dimensions: [
          { name: 'eventName' },
          { name: 'pageLocation' },
          { name: 'pageTitle' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'userEngagementDuration' },
          { name: 'bounceRate' },
          { name: 'engagementRate' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: {
              matchType: 'EXACT',
              value: 'page_view'
            }
          }
        },
        orderBys: [
          {
            desc: true,
            metric: { metricName: 'screenPageViews' }
          }
        ],
        limit: limit
      };

      console.log('[GA Client] Fetching default page views from GA4...');
      const data = await this.fetchGAData(propertyId, params);
      
      if (!data.rows || data.rows.length === 0) {
        console.warn('[GA Client] No default page views returned from GA4');
        return [];
      }

      console.log(`[GA Client] Received ${data.rows.length} default page views from GA4`);
      
      // Process the response and filter results
      const defaultPages = data.rows.map((row: any) => {
        const location = row.dimensionValues[1].value; // Get pageLocation
        const title = row.dimensionValues[2].value; // Get pageTitle
        const pageViews = parseInt(row.metricValues[0].value) || 0;
        const uniqueVisitors = parseInt(row.metricValues[1].value) || 0;
        const engagementDuration = parseInt(row.metricValues[2].value) || 0;
        const averageTimeOnPage = pageViews > 0 ? Math.round(engagementDuration / pageViews) : 0;
        
        // Parse bounce rate and engagement rate
        let bounceRate = 0;
        let engagementRate = 0;
        
        if (row.metricValues.length > 3) {
          bounceRate = parseFloat(row.metricValues[3].value) || 0;
        }
        
        if (row.metricValues.length > 4) {
          engagementRate = parseFloat(row.metricValues[4].value) || 0;
        }
        
        // Skip malformed URLs
        if (!location) return null;
        
        try {
          // Parse the URL
          let url = location;
          let path = url;
          
          try {
            const urlObj = new URL(location);
            path = urlObj.pathname + urlObj.search;
          } catch (e) {
            // If not a full URL, use as is
            path = location;
          }
          
          // Extract section from URL if available
          let section = '';
          if (path.includes('section=')) {
            const matches = path.match(/[?&]section=([^&]+)/);
            section = matches ? matches[1] : '';
          }
          
          return {
            url: location,
            path: path,
            title: title || this.capitalizeFirstLetter(section || 'Home'),
            pageViews: pageViews,
            uniqueVisitors: uniqueVisitors,
            averageTimeOnPage: averageTimeOnPage,
            bounceRate: bounceRate,
            engagementRate: engagementRate,
            sessionsPerUser: 0,
            eventCount: 0
          };
        } catch (error) {
          console.error(`[GA Client] Error processing URL ${location}:`, error);
          return null;
        }
      }).filter(Boolean) as PageUrlData[];
      
      return defaultPages;
    } catch (error) {
      console.error('[GA Client] Error fetching default page URLs:', error);
      return [];
    }
  }
}

// Create a singleton instance
export const gaClient = new GoogleAnalyticsClient();
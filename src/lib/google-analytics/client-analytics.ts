import { AnalyticsMetrics, TimelineDataPoint, DeviceData, TrafficSource, GeographicData } from './types/analytics';

/**
 * Client-side analytics service for direct fetching from analytics providers
 */
export class ClientAnalytics {
  private projectId: string;
  
  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Get analytics configuration for the project
   */
  async getConfig() {
    try {
      console.log('\n[Client Analytics] Fetching config for project:', this.projectId);
      const response = await fetch(`/api/projects/${this.projectId}/analytics-config`);
      
      // Check if response is not OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('\n[Client Analytics] Config fetch error status:', response.status, response.statusText);
        console.error('\n[Client Analytics] Response body:', errorText.substring(0, 200) + '...');
        
        // Check if the response is HTML (common for auth redirects)
        if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
          console.error('\n[Client Analytics] Received HTML response instead of JSON - likely an authentication issue');
          throw new Error(`Authentication error: You don't have proper access to this project. Please check your permissions. (Status: ${response.status})`);
        }
        
        // Try to parse as JSON if possible
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(`Failed to fetch analytics configuration: ${errorData.error || response.statusText}`);
        } catch (parseError) {
          // If parsing fails, return a more descriptive error
          throw new Error(`Failed to fetch analytics configuration: ${response.statusText} (${response.status})`);
        }
      }
      
      // Try to parse response as JSON with better error handling
      try {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('\n[Client Analytics] Unexpected content type:', contentType);
          console.error('\n[Client Analytics] Response body:', text.substring(0, 200) + '...');
          
          if (text.includes('sign-in') || text.includes('login') || text.includes('auth')) {
            throw new Error('Authentication required: You need to sign in or check your permissions to access this project');
          }
          
          throw new Error('Received non-JSON response when fetching analytics configuration');
        }
        
        const data = await response.json();
        console.log('\n[Client Analytics] Successfully fetched config for project:', this.projectId);
        return data;
      } catch (jsonError) {
        console.error('\n[Client Analytics] JSON parse error:', jsonError);
        throw new Error('Invalid JSON in analytics configuration response');
      }
    } catch (error) {
      console.error('\n[Client Analytics] Config fetch error:', error);
      
      // Add more context if it's an expected error type
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to analytics service. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Fetch metrics directly from the analytics providers
   * This is the preferred method as it's more reliable
   */
  async getMetricsDirectly(startDate: string, endDate: string): Promise<AnalyticsMetrics> {
    console.log('\n[Direct Analytics] Fetching metrics directly:', { startDate, endDate });
    
    try {
      // Validate dates to ensure they're not in the future
      const now = new Date();
      let validStartDate = new Date(startDate);
      let validEndDate = new Date(endDate);
      
      // Check if start date is in the future
      if (validStartDate > now) {
        console.error(`\n[Direct Analytics] Start date ${validStartDate.toISOString()} is in the future! Using 30 days ago instead.`);
        validStartDate = new Date(now);
        validStartDate.setDate(now.getDate() - 30);
        validStartDate.setHours(0, 0, 0, 0);
      }
      
      // Check if end date is in the future
      if (validEndDate > now) {
        console.error(`\n[Direct Analytics] End date ${validEndDate.toISOString()} is in the future! Using current date instead.`);
        validEndDate = new Date(now);
      }
      
      // Format dates to ISO strings
      const validStartDateStr = validStartDate.toISOString();
      const validEndDateStr = validEndDate.toISOString();
      
      console.log('\n[Direct Analytics] Using validated date range:', {
        originalStartDate: startDate,
        originalEndDate: endDate,
        validatedStartDate: validStartDateStr,
        validatedEndDate: validEndDateStr,
        startYear: validStartDate.getFullYear(),
        startMonth: validStartDate.getMonth() + 1,
        startDay: validStartDate.getDate(),
        endYear: validEndDate.getFullYear(),
        endMonth: validEndDate.getMonth() + 1,
        endDay: validEndDate.getDate(),
        currentDate: now.toISOString()
      });
      
      // First get the analytics config
      const config = await this.getConfig();
      console.log('\n[Direct Analytics] Config:', config);
      
      if (!config.gaEnabled || !config.gaPropertyId) {
        throw new Error('Google Analytics is not enabled or properly configured for this project');
      }
      
      // Create a new endpoint for direct fetching from GA
      const response = await fetch(
        `/api/projects/${this.projectId}/analytics/direct-fetch?` + 
        new URLSearchParams({ 
          startDate: validStartDateStr, 
          endDate: validEndDateStr,
          provider: 'ga'
        })
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Direct fetch error: ${errorData.error || errorData.details || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('\n[Direct Analytics] Direct fetch response:', data);
      
      // Format the response
      const formattedMetrics: AnalyticsMetrics = {
        pageViews: data.pageViews ?? 0,
        uniqueVisitors: data.uniqueVisitors ?? 0,
        totalSessions: data.totalSessions ?? 0,
        bounceRate: data.bounceRate ?? 0,
        averageTimeOnPage: data.averageTimeOnPage ?? 0,
        pagesPerSession: data.pagesPerSession ?? 0,
        newUsers: data.newUsers ?? 0,
        activeUsers: data.activeUsers ?? 0,
        timelineData: data.timelineData || [],
        deviceData: data.deviceData || [],
        trafficSources: data.trafficSources || [],
        geographicData: data.geographicData || []
      };
      
      return formattedMetrics;
    } catch (error) {
      console.error('\n[Direct Analytics] Error:', error);
      throw error;
    }
  }
  
  /**
   * Fetch all metrics in a single request to reduce API calls
   * This is a fallback method if direct fetching fails
   */
  async getAllMetrics(startDate: string, endDate: string): Promise<{
    metrics: AnalyticsMetrics;
    traffic: { sources: TrafficSource[]; total: number };
    devices: { devices: DeviceData[]; total: number };
    geographic: { geographicData: GeographicData[] };
  }> {
    console.log('\n[Client Analytics] Fetching all metrics:', { startDate, endDate });
    
    try {
      // Use direct fetch as the primary method
      const metrics = await this.getMetricsDirectly(startDate, endDate);
      
      // Format the response to match the expected structure
      return {
        metrics: metrics,
        traffic: {
          sources: metrics.trafficSources || [],
          total: metrics.totalSessions || 0
        },
        devices: {
          devices: metrics.deviceData || [],
          total: metrics.totalSessions || 0
        },
        geographic: {
          geographicData: metrics.geographicData || []
        }
      };
    } catch (error) {
      console.error('\n[Client Analytics] Error fetching all metrics:', error);
      throw error;
    }
  }
  
  /**
   * Fetch metrics for a specific page
   */
  async getPageMetrics(url: string, startDate: string, endDate: string): Promise<AnalyticsMetrics> {
    try {
      console.log('\n[Client Analytics] Fetching page metrics for URL:', url, { startDate, endDate });
      
      // Validate dates to ensure they're not in the future
      const now = new Date();
      let validStartDate = new Date(startDate);
      let validEndDate = new Date(endDate);
      
      // Check if start date is in the future
      if (validStartDate > now) {
        console.error(`\n[Client Analytics] Start date ${validStartDate.toISOString()} is in the future! Using 30 days ago instead.`);
        validStartDate = new Date(now);
        validStartDate.setDate(now.getDate() - 30);
        validStartDate.setHours(0, 0, 0, 0);
      }
      
      // Check if end date is in the future
      if (validEndDate > now) {
        console.error(`\n[Client Analytics] End date ${validEndDate.toISOString()} is in the future! Using current date instead.`);
        validEndDate = new Date(now);
      }
      
      // Format dates to ISO strings
      const validStartDateStr = validStartDate.toISOString();
      const validEndDateStr = validEndDate.toISOString();
      
      console.log('\n[Client Analytics] Using validated date range for page metrics:', {
        url,
        originalStartDate: startDate,
        originalEndDate: endDate,
        validatedStartDate: validStartDateStr,
        validatedEndDate: validEndDateStr
      });
      
      // Get the analytics config
      const config = await this.getConfig();
      
      if (!config.gaEnabled || !config.gaPropertyId) {
        throw new Error('Google Analytics is not enabled or properly configured for this project');
      }
      
      // Use direct fetch with URL parameter
      const response = await fetch(
        `/api/projects/${this.projectId}/analytics/direct-fetch?` + 
        new URLSearchParams({ 
          startDate: validStartDateStr, 
          endDate: validEndDateStr,
          url,
          provider: 'ga'
        })
      );
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch page metrics: ${error.error || error.details || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('\n[Client Analytics] Error fetching page metrics:', error);
      throw error;
    }
  }

  /**
   * Fetch URLs from Google Analytics
   */
  async getUrlsFromGA(
    startDate: string, 
    endDate: string, 
    sortBy: 'screenPageViews' | 'totalUsers' | 'averageSessionDuration' | 'bounceRate' = 'screenPageViews',
    fetchAllUrls: boolean = true
  ): Promise<any[]> {
    try {
      console.log('\n[Client Analytics] Fetching URLs from Google Analytics:', { 
        startDate, 
        endDate, 
        sortBy,
        fetchAllUrls 
      });
      
      // Validate dates to ensure they're not in the future
      const now = new Date();
      let validStartDate = new Date(startDate);
      let validEndDate = new Date(endDate);
      
      // Check if start date is in the future
      if (validStartDate > now) {
        console.error(`\n[Client Analytics] Start date ${validStartDate.toISOString()} is in the future! Using 30 days ago instead.`);
        validStartDate = new Date(now);
        validStartDate.setDate(now.getDate() - 30);
        validStartDate.setHours(0, 0, 0, 0);
      }
      
      // Check if end date is in the future
      if (validEndDate > now) {
        console.error(`\n[Client Analytics] End date ${validEndDate.toISOString()} is in the future! Using current date instead.`);
        validEndDate = new Date(now);
      }
      
      // Format dates to ISO strings
      const validStartDateStr = validStartDate.toISOString();
      const validEndDateStr = validEndDate.toISOString();
      
      console.log('\n[Client Analytics] Using validated date range:', {
        originalStartDate: startDate,
        originalEndDate: endDate,
        validatedStartDate: validStartDateStr,
        validatedEndDate: validEndDateStr,
        startYear: validStartDate.getFullYear(),
        startMonth: validStartDate.getMonth() + 1,
        startDay: validStartDate.getDate(),
        endYear: validEndDate.getFullYear(),
        endMonth: validEndDate.getMonth() + 1,
        endDay: validEndDate.getDate(),
        currentDate: now.toISOString(),
        sortBy,
        fetchAllUrls
      });
      
      // Get the analytics config
      const config = await this.getConfig();
      console.log('\n[Client Analytics] Analytics config:', config);
      
      // Check if Google Analytics is enabled
      if (!config.gaEnabled || !config.gaPropertyId) {
        console.warn('\n[Client Analytics] Google Analytics not enabled for this project');
        return [];
      }
      
      console.log('\n[Client Analytics] Making request to GA URLs endpoint with property ID:', config.gaPropertyId);
      
      // Fetch URLs from the GA-specific endpoint
      const response = await fetch(
        `/api/projects/${this.projectId}/analytics/ga-urls?` + 
        new URLSearchParams({ 
          startDate: validStartDateStr, 
          endDate: validEndDateStr,
          sortBy,
          fetchAllUrls: 'true'
        })
      );
      
      // Log the response status
      console.log('\n[Client Analytics] GA URLs response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('\n[Client Analytics] Error response from GA URLs endpoint:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`Failed to fetch URLs from Google Analytics: ${errorJson.error || response.statusText}`);
        } catch (parseError) {
          throw new Error(`Failed to fetch URLs from Google Analytics: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log('\n[Client Analytics] Fetched URLs from Google Analytics:', data.urls?.length || 0);
      
      if (!data.urls || !Array.isArray(data.urls)) {
        console.error('\n[Client Analytics] Invalid response format from GA URLs endpoint:', data);
        return [];
      }
      
      // Filter out localhost URLs
      const productionUrls = data.urls.filter((url: any) => {
        return !(url.url?.includes('localhost') || url.url?.includes('127.0.0.1'));
      });
      
      console.log('\n[Client Analytics] Filtered out localhost URLs:', 
        data.urls.length - productionUrls.length, 'removed,', productionUrls.length, 'remaining');
      
      // Return all URLs without filtering or deduplication
      console.log('\n[Client Analytics] Returning all production URLs without additional filtering');
      return productionUrls;
    } catch (error) {
      console.error('\n[Client Analytics] Error fetching URLs from Google Analytics:', error);
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }

  /**
   * Fetch default pages and screens from Google Analytics 4
   * This method fetches all pages without filtering by section
   */
  async getDefaultPageUrls(
    gaPropertyId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 30
  ): Promise<any[]> {
    try {
      console.log('\n[Client Analytics] Fetching default pages from Google Analytics:', { 
        gaPropertyId,
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString(),
        limit
      });
      
      // Use the existing ga-urls endpoint with fetchAllUrls=true to get all pages
      const response = await fetch(
        `/api/projects/${this.projectId}/analytics/ga-urls?` + 
        new URLSearchParams({ 
          startDate: startDate.toISOString(), 
          endDate: endDate.toISOString(),
          fetchAllUrls: 'true'
        })
      );
      
      // Check for successful response
      if (!response.ok) {
        console.warn(`\n[Client Analytics] GA-urls endpoint returned status ${response.status}`);
        // Instead of throwing, just return empty array and let the component handle it
        return [];
      }
      
      const data = await response.json();
      console.log(`\n[Client Analytics] Fetched ${data.urls?.length || 0} pages from GA-urls endpoint`);
      
      return data.urls || [];
    } catch (error) {
      // Log the error but don't rethrow - just return empty array
      console.error('\n[Client Analytics] Error fetching default pages:', error);
      return [];
    }
  }
}

// Create a singleton instance for reuse
export const createClientAnalytics = (projectId: string) => {
  return new ClientAnalytics(projectId);
}; 
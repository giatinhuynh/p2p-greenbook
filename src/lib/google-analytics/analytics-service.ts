import { gaClient } from '@/lib/google-analytics/ga-client'
import { AnalyticsConfig } from '@/lib/google-analytics/types/analytics-config'
import { AnalyticsMetrics } from '@/lib/google-analytics/types/analytics'
import { EngagementMetrics } from '@/lib/google-analytics/ga-client'

/**
 * Analytics service that works with Google Analytics
 */
class AnalyticsService {
  private readonly CACHE_TTL = 300 // 5 minutes
  private readonly STALE_TTL = 3600 // 1 hour
  private metricsCache = new Map<string, {
    data: AnalyticsMetrics;
    timestamp: number;
    staleTimestamp: number;
  }>();

  private getCacheKey(projectId: string, url: string | null, startDate: Date, endDate: Date, properties: any[] = []): string {
    return `metrics:${projectId}:${url || 'all'}:${startDate.toISOString()}:${endDate.toISOString()}:${JSON.stringify(properties)}`;
  }

  /**
   * Get metrics from Google Analytics
   */
  async getMetrics(
    config: AnalyticsConfig,
    startDate: Date,
    endDate: Date,
    url: string | null = null,
    properties?: any[]
  ): Promise<AnalyticsMetrics> {
    if (config.gaEnabled && config.gaPropertyId) {
      try {
        console.log('Fetching metrics from Google Analytics:', {
          propertyId: config.gaPropertyId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          url: url || 'all'
        });
        
        const metrics = await gaClient.getMetrics(
          config.gaPropertyId,
          url,
          startDate,
          endDate
        );
        
        console.log('Raw GA metrics received:', JSON.stringify(metrics, null, 2));
        
        // Map GA metrics to the expected format with explicit defaults for all fields
        const mappedMetrics: AnalyticsMetrics = {
          pageViews: metrics.pageViews || 0,
          uniqueVisitors: metrics.uniqueVisitors || 0,
          totalSessions: metrics.totalSessions || 0,
          bounceRate: metrics.bounceRate || 0,
          averageTimeOnPage: metrics.averageTimeOnPage || 0,
          pagesPerSession: metrics.pagesPerSession || 0,
          newUsers: metrics.newUsers || 0,
          activeUsers: metrics.activeUsers || 0,
          timelineData: this.mapTimelineData(metrics.timelineData || []),
          deviceData: this.mapDeviceData(metrics.deviceData || []),
          trafficSources: this.mapTrafficSources(metrics.trafficSources || []),
          geographicData: this.mapGeographicData(metrics.geographicData || [])
        };
        
        console.log('Mapped GA metrics:', JSON.stringify(mappedMetrics, null, 2));
        
        return mappedMetrics;
      } catch (error) {
        console.error('Error fetching from Google Analytics:', error);
        throw new Error('Failed to fetch analytics data from Google Analytics');
      }
    }

    // If GA is not configured
    throw new Error('Google Analytics is not configured for this project');
  }

  /**
   * Get engagement metrics from Google Analytics
   */
  async getEngagementMetrics(
    config: AnalyticsConfig,
    startDate: Date,
    endDate: Date,
    url: string | null = null
  ): Promise<EngagementMetrics> {
    if (!config.gaEnabled || !config.gaPropertyId) {
      throw new Error('Google Analytics is not enabled or properly configured');
    }

    console.log('Fetching engagement metrics from Google Analytics:', {
      propertyId: config.gaPropertyId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      url: url || 'all'
    });
    
    return await gaClient.getEngagementMetrics(
      config.gaPropertyId,
      url,
      startDate,
      endDate
    );
  }

  // Helper methods to map GA data to our expected format
  private mapTimelineData(timelineData: any[]): any[] {
    return timelineData.map(point => ({
      date: point.date,
      views: point.views || point.pageViews || 0,
      visitors: point.visitors || point.uniqueVisitors || 0
    }));
  }

  private mapDeviceData(deviceData: any[]): any[] {
    return deviceData.map(device => ({
      type: this.mapDeviceType(device.device),
      percentage: device.percentage || 0,
      visits: device.pageViews || device.visits || 0
    }));
  }

  private mapDeviceType(type: string): string {
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('mobile')) return 'mobile';
    if (lowerType.includes('tablet')) return 'tablet';
    if (lowerType.includes('desktop')) return 'desktop';
    return type || 'other';
  }

  private mapTrafficSources(sources: any[]): any[] {
    return sources.map(source => ({
      type: this.mapTrafficType(source.type),
      source: source.source || source.name || 'Unknown',
      visits: source.visits || source.sessions || 0,
      percentage: source.percentage || 0,
      details: (source.details || []).map((detail: any) => ({
        source: detail.source || detail.name || 'Unknown',
        visits: detail.visits || detail.sessions || 0,
        percentage: detail.percentage || 0
      }))
    }));
  }

  private mapTrafficType(type: string): 'direct' | 'referral' | 'social' | 'search' {
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('search') || lowerType === 'organic') return 'search';
    if (lowerType.includes('social')) return 'social';
    if (lowerType.includes('referral')) return 'referral';
    return 'direct';
  }

  private mapGeographicData(geoData: any[]): any[] {
    return geoData.map(region => ({
      region: region.region || region.country || 'Unknown',
      visits: region.visits || region.sessions || 0,
      percentage: region.percentage || 0
    }));
  }
}

// Export a singleton instance
export const analyticsService = new AnalyticsService(); 
/**
 * Type definitions for analytics configuration
 */

export interface AnalyticsConfig {
  id: string;
  projectId: string;
  
  // Google Analytics Configuration
  gaEnabled: boolean;
  gaPropertyId: string | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
} 
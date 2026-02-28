/**
 * Type definitions for Google Analytics integration
 */

export interface AnalyticsConfig {
  id: string;
  projectId: string;
  
  // Google Analytics Configuration
  gaEnabled: boolean;
  gaPropertyId: string | null;
  gaApiKey: string | null;
  
  // Common Configuration
  environment: string;
  filterInternalTraffic: boolean;
  
  // Sync settings
  syncEnabled: boolean;
  syncInterval: number;
  syncBatchSize: number;
  lastSynced: Date | null;
  
  // Capture settings
  sampleRate: number;
  captureConsoleLog: boolean;
  capturePerformance: boolean;
  
  // Error handling
  errorThreshold: number;
  retryAttempts: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
} 
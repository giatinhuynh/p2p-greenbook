"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface HeatmapClick {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  timestamp: string;
  elementClicked?: string;
  scrollY?: number;
  sessionId?: string;
  isFixedElement?: boolean;
  fixedAncestor?: {
    tag: string;
    position: string;
    rect: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
  };
  relativeX?: number;
  relativeY?: number;
  value?: number;
  pageUrl?: string;
}

export default function StandaloneHeatmap() {
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [clicks, setClicks] = useState<HeatmapClick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pageUrl = searchParams.get('pageUrl');
  const projectId = searchParams.get('projectId');

  // Parse the pageUrl to handle SPA routes correctly
  const parsePageUrl = useCallback(() => {
    if (!pageUrl) return { baseUrl: '', queryParams: {} };
    
    try {
      const url = new URL(pageUrl);
      const baseUrl = `${url.origin}${url.pathname}`;
      
      // Parse query parameters
      const queryParams: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      
      return { baseUrl, queryParams };
    } catch (error) {
      console.error('[Heatmap] Error parsing URL:', error);
      return { baseUrl: pageUrl, queryParams: {} };
    }
  }, [pageUrl]);
  
  // Fetch heatmap data
  const fetchHeatmapData = useCallback(async () => {
    if (!pageUrl || !projectId) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/heatmap/clicks?` + new URLSearchParams({
          pageUrl: encodeURIComponent(pageUrl),
          exactMatch: 'true'
        }),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch heatmap data');
      }

      const data = await response.json();
      console.log(`[Heatmap] Received ${data.clicks?.length || 0} clicks for exact URL: ${pageUrl}`);
      setClicks(data.clicks || []);
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pageUrl, projectId]);

  // Update heatmap data
  const updateHeatmapData = useCallback(() => {
    if (!iframeRef.current || clicks.length === 0) {
      console.log('[Heatmap] No update needed:', { 
        hasIframe: !!iframeRef.current, 
        clickCount: clicks.length 
      });
      return;
    }

    try {
      const iframe = iframeRef.current;
      const messageData = {
        type: 'UPDATE_HEATMAP',
        data: {
          max: 1,
          min: 0,
          data: clicks.map(click => {
            const point = {
              x: Math.round(click.x),
              y: Math.round(click.y + (click.scrollY || 0)),
              value: 1
            };
            return point;
          })
        }
      };
      
      console.log('[Heatmap] Sending data to iframe:', {
        messageType: messageData.type,
        dataPoints: messageData.data.data.length,
        samplePoints: messageData.data.data.slice(0, 3),
        iframeTarget: iframe.src
      });
      
      iframe.contentWindow?.postMessage(messageData, '*');
      console.log('[Heatmap] Data sent to iframe');
    } catch (error) {
      console.error('[Heatmap] Error updating heatmap data:', error);
    }
  }, [clicks]);

  // Initialize heatmap
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const initHeatmap = () => {
      try {
        console.log('[Heatmap] Initializing heatmap...');
        
        // Add a small delay to ensure the iframe is fully loaded
        setTimeout(() => {
          // Send init message to iframe
          const config = {
            type: 'INIT_HEATMAP',
            config: {
              radius: 25,
              maxOpacity: 0.9,
              minOpacity: 0.3,
              blur: 0.85,
              gradient: {
                '.3': '#3b82f6',
                '.65': '#6366f1',
                '.8': '#8b5cf6'
              }
            }
          };
          
          console.log('[Heatmap] Sending init config:', config);
          iframe.contentWindow?.postMessage(config, '*');
          console.log('[Heatmap] Init message sent to iframe');
        }, 1000);
      } catch (error) {
        console.warn('[Heatmap] Error initializing heatmap:', error);
      }
    };

    // Listen for iframe load
    const handleIframeLoad = () => {
      console.log('[Heatmap] Iframe loaded, initializing...');
      initHeatmap();
    };

    iframe.addEventListener('load', handleIframeLoad);
    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, []);

  // Handle HEATMAP_READY message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[Heatmap Platform] Received message:', event);
      
      if (event.data.type === 'HEATMAP_READY') {
        console.log('[Heatmap Platform] Heatmap is ready, updating data...');
        updateHeatmapData();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [updateHeatmapData]);

  // Handle iframe navigation events
  useEffect(() => {
    const handleIframeNavigation = (event: MessageEvent) => {
      if (event.data.type === 'NAVIGATION_CHANGE' && event.data.url) {
        console.log('[Heatmap] Navigation detected in iframe:', event.data.url);
        
        // Update the URL in the parent window to reflect the new page
        const currentUrl = new URL(window.location.href);
        const newPageUrl = event.data.url;
        
        // Update the pageUrl parameter
        currentUrl.searchParams.set('pageUrl', newPageUrl);
        
        // Use history.replaceState to update the URL without reloading the page
        window.history.replaceState({}, '', currentUrl.toString());
        
        // Fetch data for the new URL
        fetchHeatmapData();
      }
    };

    window.addEventListener('message', handleIframeNavigation);
    return () => window.removeEventListener('message', handleIframeNavigation);
  }, [fetchHeatmapData]);

  // Add navigation tracking script to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const injectNavigationTracker = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) return;
        
        // Inject a script to track navigation changes
        const script = document.createElement('script');
        script.textContent = `
          // Track history changes
          (function() {
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            // Override pushState
            history.pushState = function() {
              originalPushState.apply(this, arguments);
              window.parent.postMessage({
                type: 'NAVIGATION_CHANGE',
                url: window.location.href
              }, '*');
            };
            
            // Override replaceState
            history.replaceState = function() {
              originalReplaceState.apply(this, arguments);
              window.parent.postMessage({
                type: 'NAVIGATION_CHANGE',
                url: window.location.href
              }, '*');
            };
            
            // Listen for popstate events (back/forward buttons)
            window.addEventListener('popstate', function() {
              window.parent.postMessage({
                type: 'NAVIGATION_CHANGE',
                url: window.location.href
              }, '*');
            });
            
            console.log('[Heatmap] Navigation tracking initialized');
          })();
        `;
        
        iframeWindow.document.head.appendChild(script);
        console.log('[Heatmap] Injected navigation tracking script');
      } catch (error) {
        console.error('[Heatmap] Error injecting navigation tracker:', error);
      }
    };

    // Wait for iframe to load before injecting the script
    const handleLoad = () => {
      setTimeout(injectNavigationTracker, 1000); // Delay to ensure the page is fully loaded
    };
    
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  // Fetch data initially
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  // Construct iframe URL
  const { baseUrl, queryParams } = parsePageUrl();
  const iframeQueryParams = new URLSearchParams({
    ...queryParams,
    heatmap: 'true'
  });
  const iframeSrc = `${baseUrl}?${iframeQueryParams.toString()}`;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className="w-screen h-screen border-0"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
    />
  );
} 
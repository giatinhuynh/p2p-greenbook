// Heatmap tracking script
export class HeatmapTracker {
  private projectId: string;
  private apiEndpoint: string;
  private sessionId: string;
  private queue: Array<any> = [];
  private isProcessing = false;
  private maxBatchSize = 50;
  private batchTimeout = 2000;
  private retryDelay = 1000;
  private maxRetries = 3;

  constructor(projectId: string, apiEndpoint: string) {
    this.projectId = projectId;
    this.apiEndpoint = apiEndpoint;
    this.sessionId = this.getOrCreateSessionId(); // Ensures consistent session tracking
    this.initializeTracking();
  }

  private getOrCreateSessionId(): string {
    if (typeof window === "undefined") {
      const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.warn("[Heatmap] Running in SSR environment, using temporary session:", tempId);
      return tempId;
    }

    let sessionId = localStorage.getItem("heatmap_session_id");
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("heatmap_session_id", sessionId);
      console.log("[Heatmap] Created new session:", sessionId);
    } else {
      console.log("[Heatmap] Restored existing session:", sessionId);
    }
    return sessionId;
  }

  private initializeTracking() {
    console.log("[Heatmap] Setting up event listeners...");
    document.addEventListener("click", this.handleClick.bind(this));
    window.addEventListener("beforeunload", this.flush.bind(this));

    // Process queue periodically
    setInterval(() => {
      if (this.queue.length > 0 && !this.isProcessing) {
        this.processQueue();
      }
    }, this.batchTimeout);
    console.log("[Heatmap] Event listeners initialized");
  }

  private async handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const x = event.clientX;
    const y = event.clientY;
    
    // Capture relative positions (0-1 scale)
    const relativeX = x / window.innerWidth;
    const relativeY = y / window.innerHeight;

    // Get scroll position
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    const clickData = {
      x,
      y,
      relativeX,
      relativeY,
      pageUrl: window.location.href,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      elementClicked: this.getElementSelector(target),
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      scrollY: Math.round(scrollY)
    };

    this.queue.push(clickData);
    console.log("[Heatmap] Click recorded:", { 
      element: clickData.elementClicked, 
      position: { 
        x, 
        y,
        scrollY: clickData.scrollY,
        relativeX: Math.round(relativeX * 100) + '%', 
        relativeY: Math.round(relativeY * 100) + '%' 
      } 
    });

    if (this.queue.length >= this.maxBatchSize) {
      this.processQueue();
    }
  }

  private getElementSelector(element: HTMLElement): string {
    const id = element.id ? `#${element.id}` : "";
    const classes = Array.from(element.classList).map((c) => `.${c}`).join("");
    const tagName = element.tagName.toLowerCase();
    return id || (classes ? `${tagName}${classes}` : tagName);
  }

  private async processQueue(retryCount = 0) {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const batch = this.queue.splice(0, this.maxBatchSize);
    console.log(`[Heatmap] Processing batch of ${batch.length} clicks...`);

    try {
      const response = await fetch(`${this.apiEndpoint}/api/projects/${this.projectId}/heatmap/clicks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[Heatmap] Successfully sent ${result.stored} clicks`);
    } catch (error) {
      console.error("[Heatmap] Failed to send click data:", error);
      if (retryCount < this.maxRetries) {
        console.log(`[Heatmap] Retrying in ${this.retryDelay}ms... (Attempt ${retryCount + 1}/${this.maxRetries})`);
        this.queue.unshift(...batch);
        setTimeout(() => {
          this.processQueue(retryCount + 1);
        }, this.retryDelay * (retryCount + 1));
        return;
      } else {
        console.error("[Heatmap] Max retries reached, discarding batch");
      }
    } finally {
      this.isProcessing = false;
    }

    if (this.queue.length > 0) {
      setTimeout(() => {
        this.processQueue();
      }, this.batchTimeout);
    }
  }

  public async flush() {
    if (this.queue.length > 0) {
      console.log(`[Heatmap] Flushing ${this.queue.length} remaining clicks...`);
      const batch = this.queue.splice(0, this.maxBatchSize);
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(batch)], { type: "application/json" });
        navigator.sendBeacon(`${this.apiEndpoint}/api/projects/${this.projectId}/heatmap/clicks`, blob);
        console.log("[Heatmap] Sent final batch using sendBeacon");
      } else {
        await this.processQueue();
      }
    }
  }

  public destroy() {
    console.log("[Heatmap] Cleaning up event listeners...");
    document.removeEventListener("click", this.handleClick.bind(this));
    window.removeEventListener("beforeunload", this.flush.bind(this));
    console.log("[Heatmap] Cleanup complete");
  }
}

// Helper function to initialize tracking
export function initHeatmapTracking(projectId: string, apiEndpoint: string) {
  if (typeof window !== "undefined") {
    console.log("[Heatmap] Starting initialization...");
    return new HeatmapTracker(projectId, apiEndpoint);
  }
  console.warn("[Heatmap] Window not available, tracking disabled");
  return null;
} 
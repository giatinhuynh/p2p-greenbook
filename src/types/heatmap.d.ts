declare module 'heatmap.js' {
  interface HeatmapConfiguration {
    container: HTMLElement;
    backgroundColor?: string;
    gradient?: Record<string, string>;
    radius?: number;
    opacity?: number;
    maxOpacity?: number;
    minOpacity?: number;
    blur?: number;
    xField?: string;
    yField?: string;
    valueField?: string;
  }

  interface HeatmapData {
    x: number;
    y: number;
    value: number;
  }

  interface HeatmapDataSet {
    max: number;
    min: number;
    data: HeatmapData[];
  }

  interface HeatmapInstance {
    addData(data: HeatmapData | HeatmapData[]): void;
    setData(data: HeatmapDataSet): void;
    getData(): HeatmapDataSet;
    getDataURL(): string;
    getValueAt(point: { x: number; y: number }): number;
    repaint(): void;
    setDataMax(max: number): void;
    setDataMin(min: number): void;
    configure(config: Partial<HeatmapConfiguration>): void;
  }

  interface Heatmap {
    create(config: HeatmapConfiguration): HeatmapInstance;
    register(pluginKey: string, plugin: any): void;
  }

  const h337: Heatmap;
  export default h337;
}

declare global {
  interface Window {
    h337: Heatmap;
    heatmapInstance?: HeatmapInstance;
  }
} 
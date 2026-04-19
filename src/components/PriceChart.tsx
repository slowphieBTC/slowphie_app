import { useEffect, useRef, memo } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineSeriesOptions,
} from 'lightweight-charts';
import { useAppStore, type PricePoint } from '../store';

interface Props {
  height?: number;
  showTitle?: boolean;
}

function PriceChartInner({ height = 220, showTitle = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const priceHistory = useAppStore((s) => s.priceHistory);
  const btcPrice = useAppStore((s) => s.btcPrice);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#1a1a28', style: LineStyle.Dashed },
        horzLines: { color: '#1a1a28', style: LineStyle.Dashed },
      },
      crosshair: {
        vertLine: { color: '#f97316', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#f97316' },
        horzLine: { color: '#f97316', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#f97316' },
      },
      rightPriceScale: {
        borderColor: '#1a1a28',
        textColor: '#6b7280',
      },
      timeScale: {
        borderColor: '#1a1a28',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: true,
      handleScale: true,
      width: containerRef.current.clientWidth,
      height,
    });

    const series = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: '#f97316',
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#f97316',
      crosshairMarkerBackgroundColor: '#0a0a0f',
    } as Partial<LineSeriesOptions>);

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // Update data when priceHistory changes
  useEffect(() => {
    if (!seriesRef.current || priceHistory.length === 0) return;
    // Deduplicate by time (latest wins) and sort ascending
    const deduped = new Map<number, number>();
    priceHistory.forEach((p) => deduped.set(Math.floor(p.time), p.value));
    const sorted = Array.from(deduped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as import('lightweight-charts').Time, value }));
    try {
      seriesRef.current.setData(sorted);
      chartRef.current?.timeScale().fitContent();
    } catch {
      // ignore stale updates
    }
  }, [priceHistory]);

  const isEmpty = priceHistory.length === 0;

  return (
    <div className="glass rounded-2xl p-5">
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-white">BTC / USD</div>
            <div className="text-xs text-gray-500 mt-0.5">Live price feed · Slowphie Server</div>
          </div>
          {btcPrice && (
            <div className="text-right">
              <div className="text-xl font-bold text-brand-400">
                ${btcPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500">{priceHistory.length} data points</div>
            </div>
          )}
        </div>
      )}
      {isEmpty ? (
        <div
          className="flex items-center justify-center text-gray-600 text-sm"
          style={{ height }}
        >
          <div className="text-center">
            <div className="text-2xl mb-2">📡</div>
            <div>Waiting for live price data…</div>
            <div className="text-xs text-gray-700 mt-1">Connecting to Slowphie Server</div>
          </div>
        </div>
      ) : (
        <div ref={containerRef} style={{ height }} />
      )}
    </div>
  );
}

export const PriceChart = memo(PriceChartInner);

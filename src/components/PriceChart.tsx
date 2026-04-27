import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type CandlestickData, type LineData } from 'lightweight-charts';

interface Props {
  data?: Array<{
    time?: number | string;
    timestamp?: number | string;
    open?: string;
    high?: string;
    low?: string;
    close?: string;
    price?: string;
    bestPriceBtc?: string;
  }>;
  mode: 'line' | 'candle';
  onModeChange: (mode: 'line' | 'candle') => void;
  livePrice?: string;
  color: string;
  source?: 'motoswap' | 'nativeswap';
  onSourceChange?: (source: 'motoswap' | 'nativeswap') => void;
}

function toTimeValue(t: number | string | undefined): number {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return Date.parse(t);
  return Date.now();
}

export default function PriceChart({ data = [], mode, onModeChange, livePrice, color, source, onSourceChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 2 },
        horzLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
        },
      },
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
        },
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Determine if we have OHLC data
    const hasOhlc = data.length > 0 && data[0].open !== undefined;

    if (hasOhlc && mode === 'candle') {
      const series = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      const candleData: CandlestickData[] = data
        .filter((d) => d.open && d.high && d.low && d.close)
        .map((d) => ({
          time: (toTimeValue(d.time ?? d.timestamp) / 1000) as unknown as string,
          open: parseFloat(d.open!),
          high: parseFloat(d.high!),
          low: parseFloat(d.low!),
          close: parseFloat(d.close!),
        }));
      series.setData(candleData);
      chart.timeScale().fitContent();
    } else {
      const series = chart.addLineSeries({
        color,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
      });
      const lineData: LineData[] = data
        .map((d) => ({
          time: (toTimeValue(d.time ?? d.timestamp) / 1000) as unknown as string,
          value: parseFloat(d.close ?? d.price ?? d.bestPriceBtc ?? '0'),
        }))
        .filter((d) => d.value > 0);
      series.setData(lineData);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: 240 });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, color, mode]);

  if (data.length === 0) return null;

  if (data.length < 2) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Price Chart</span>
        </div>
        <div className="flex items-center justify-center h-60 rounded-xl bg-dark-900/40 border border-white/[0.06]">
          <div className="text-center space-y-2 px-4">
            <div className="w-8 h-8 border-2 border-slate-600 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Collecting price data...</p>
            <p className="text-[10px] text-slate-600">Chart appears after a few market refreshes</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Price Chart</span>
        <div className="flex items-center gap-2">
          {/* Source toggle */}
          {onSourceChange && (
            <div className="flex rounded-lg bg-dark-900/60 p-0.5">
              <button
                onClick={() => onSourceChange('motoswap')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                  source === 'motoswap' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                MotoSwap
              </button>
              <button
                onClick={() => onSourceChange('nativeswap')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                  source === 'nativeswap' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                NativeSwap
              </button>
            </div>
          )}
          {/* Chart mode toggle - Line left, Candle right */}
          <div className="flex rounded-lg bg-dark-900/60 p-0.5">
            <button
              onClick={() => onModeChange('line')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                mode === 'line' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => onModeChange('candle')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                mode === 'candle' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Candles
            </button>
          </div>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 240 }} />
    </div>
  );
}

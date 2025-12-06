// src/react-app/App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";

type Market = "BINANCE" | "UPBIT" | "BITHUMB" | "OKX";

interface LiveNewsItem {
  id: string;
  source: string;
  title: string;
  symbol?: string;
  time: string;
}

interface WatchlistItem {
  symbol: string;
  market: Market;
  lastPrice: number;
  change24h: number; // %
  volume24h: number;
}

interface PriceInfo {
  lastPrice: number;
  change24h: number;
  volume24h: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 전역 lightweight-charts (CDN)
declare const LightweightCharts: any;

function App() {
  const [selectedMarket, setSelectedMarket] = useState<Market>("BINANCE");
  const [symbolInput, setSymbolInput] = useState<string>("BTCUSDT");
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSDT");

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    {
      symbol: "BTCUSDT",
      market: "BINANCE",
      lastPrice: 0,
      change24h: 0,
      volume24h: 0,
    },
    {
      symbol: "ETHUSDT",
      market: "BINANCE",
      lastPrice: 0,
      change24h: 0,
      volume24h: 0,
    },
    {
      symbol: "SOLUSDT",
      market: "BINANCE",
      lastPrice: 0,
      change24h: 0,
      volume24h: 0,
    },
  ]);

  // 현재 심볼 영역에 표시할 가격 데이터
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  // 뉴스
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [news, setNews] = useState<LiveNewsItem[]>([]);

  // 차트용
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [klineLoading, setKlineLoading] = useState(false);
  const [klineError, setKlineError] = useState<string | null>(null);

  // ---- 가격 API 호출 함수 ----
  const fetchPrice = async (market: Market, symbol: string) => {
    setPriceLoading(true);
    setPriceError(null);
    try {
      const res = await fetch(
        `/api/price?market=${market}&symbol=${encodeURIComponent(symbol)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: PriceInfo = await res.json();
      setPriceInfo(data);

      // 워치리스트에도 반영
      setWatchlist((prev) =>
        prev.map((item) =>
          item.market === market && item.symbol === symbol
            ? {
                ...item,
                lastPrice: data.lastPrice,
                change24h: data.change24h,
                volume24h: data.volume24h,
              }
            : item
        )
      );
    } catch (err: any) {
      console.error("fetchPrice error:", err);
      setPriceError(err.message ?? String(err));
    } finally {
      setPriceLoading(false);
    }
  };

  // ---- 라이브 뉴스 ----
  useEffect(() => {
    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const res = await fetch("/api/live-news");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: LiveNewsItem[] = await res.json();
        setNews(data);
      } catch (err: any) {
        console.error("live news error:", err);
        setNewsError("라이브 뉴스 불러오기에 실패했습니다.");
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNews();
  }, []);

  // ---- 처음 로딩 시 기본 심볼(BTCUSDT @ BINANCE) 가격 한번 가져오기 ----
  useEffect(() => {
    fetchPrice("BINANCE", "BTCUSDT");
  }, []);

 // ---- 차트: activeSymbol / selectedMarket 바뀔 때마다 캔들 호출 ----
useEffect(() => {
  const container = chartContainerRef.current;
  if (!container || !("LightweightCharts" in window)) return;

  setKlineLoading(true);
  setKlineError(null);

  const chart = LightweightCharts.createChart(container, {
    // ...
  });

  const candleSeries = chart.addCandlestickSeries({
    // ...
  });

  const handleResize = () => {
    chart.applyOptions({ width: container.clientWidth });
  };
  window.addEventListener("resize", handleResize);

  const loadKlines = async () => {
    try {
      const res = await fetch(
        `/api/kline?market=${selectedMarket}&symbol=${encodeURIComponent(
          activeSymbol
        )}&interval=1h&limit=150`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: Candle[] = await res.json();

      const formatted = data.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      candleSeries.setData(formatted);
    } catch (err: any) {
      console.error("kline error:", err);
      setKlineError(err.message ?? String(err));
    } finally {
      setKlineLoading(false);
    }
  };

  loadKlines();

  return () => {
    window.removeEventListener("resize", handleResize);
    chart.remove();
  };
}, [activeSymbol, selectedMarket]);

  // ---- 심볼 적용 버튼 ----
  const handleApplySymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (!trimmed) return;
    setActiveSymbol(trimmed);
    fetchPrice(selectedMarket, trimmed);
  };

  // ---- 워치리스트에 추가 ----
  const handleAddToWatchlist = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (!trimmed) return;

    const exists = watchlist.some(
      (item) => item.symbol === trimmed && item.market === selectedMarket
    );
    if (exists) return;

    const newItem: WatchlistItem = {
      symbol: trimmed,
      market: selectedMarket,
      lastPrice: 0,
      change24h: 0,
      volume24h: 0,
    };

    setWatchlist((prev) => [newItem, ...prev]);
    // 추가하면서 바로 가격 가져오기
    fetchPrice(selectedMarket, trimmed);
  };

  return (
    <div className="app-root">
      {/* 상단 헤더 */}
      <header className="app-header">
        <div>
          <h1 className="app-title">Global Market Radar</h1>
          <p className="app-subtitle">
            실시간 글로벌 시세 · 뉴스 · 워치리스트를 한 화면에서 모니터링
          </p>
        </div>

        <div className="top-controls">
          <select
            className="select"
            value={selectedMarket}
            onChange={(e) => {
              const m = e.target.value as Market;
              setSelectedMarket(m);
            }}
          >
            <option value="BINANCE">Binance</option>
            <option value="UPBIT">Upbit</option>
            <option value="BITHUMB">Bithumb</option>
            <option value="OKX">OKX</option>
          </select>

          <input
            className="input"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="예: BTCUSDT / BTC-KRW / BTC_KRW / BTC-USDT"
          />

          <button className="button primary" onClick={handleApplySymbol}>
            심볼 적용
          </button>
          <button className="button ghost" onClick={handleAddToWatchlist}>
            워치리스트 추가
          </button>
        </div>
      </header>

      {/* 메인 3열 레이아웃 */}
      <main className="app-grid">
        {/* 1. 좌측: 현재 심볼 + 워치리스트 */}
        <section className="panel">
          <h2 className="panel-title">현재 심볼</h2>
          <div className="symbol-card">
            <div className="symbol-header">
              <span className="symbol-tag">{selectedMarket}</span>
              <span className="symbol-name">{activeSymbol}</span>
            </div>

            <div className="symbol-body">
              <div className="symbol-row">
                <span className="label">Last Price</span>
                <span className="value">
                  {priceLoading
                    ? "Loading..."
                    : priceInfo
                    ? priceInfo.lastPrice.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })
                    : "–"}
                </span>
              </div>
              <div className="symbol-row">
                <span className="label">24h Change</span>
                <span
                  className={
                    priceInfo && priceInfo.change24h > 0
                      ? "value positive"
                      : priceInfo && priceInfo.change24h < 0
                      ? "value negative"
                      : "value"
                  }
                >
                  {priceLoading
                    ? "Loading..."
                    : priceInfo
                    ? `${priceInfo.change24h.toFixed(2)}%`
                    : "–"}
                </span>
              </div>
              <div className="symbol-row">
                <span className="label">24h Volume (quote)</span>
                <span className="value">
                  {priceLoading
                    ? "Loading..."
                    : priceInfo
                    ? priceInfo.volume24h.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : "–"}
                </span>
              </div>
            </div>

            {priceError && (
              <div className="error" style={{ marginTop: 8 }}>
                {priceError}
              </div>
            )}
          </div>

          <h2 className="panel-title mt-24">워치리스트</h2>
          <div className="watchlist">
            {watchlist.length === 0 && (
              <div className="empty">워치리스트가 비어 있습니다.</div>
            )}

            {watchlist.map((item) => (
              <button
                key={`${item.market}-${item.symbol}`}
                className="watch-item"
                onClick={() => {
                  setSelectedMarket(item.market);
                  setActiveSymbol(item.symbol);
                  setSymbolInput(item.symbol);
                  fetchPrice(item.market, item.symbol);
                }}
              >
                <div className="watch-symbol-row">
                  <span className="watch-symbol">{item.symbol}</span>
                  <span className="watch-market">{item.market}</span>
                </div>
                <div className="watch-meta-row">
                  <span className="watch-price">
                    {item.lastPrice
                      ? item.lastPrice.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })
                      : "—"}
                  </span>
                  <span
                    className={
                      item.change24h > 0
                        ? "watch-change positive"
                        : item.change24h < 0
                        ? "watch-change negative"
                        : "watch-change"
                    }
                  >
                    {item.change24h
                      ? `${item.change24h.toFixed(2)}%`
                      : "0.00%"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 2. 중앙: 차트 */}
        <section className="panel">
          <h2 className="panel-title">차트 / 오더북</h2>
          <div
            className="chart-placeholder"
            ref={chartContainerRef}
            style={{ padding: 0 }}
          >
            {/* 차트는 JS가 ref 위에 직접 그림 */}
          </div>
          {klineLoading && (
            <div className="info" style={{ marginTop: 8 }}>
              캔들 데이터 불러오는 중…
            </div>
          )}
          {klineError && (
            <div className="error" style={{ marginTop: 8 }}>
              {klineError}
            </div>
          )}
          {!klineLoading && !klineError && selectedMarket !== "BINANCE" && (
            <div className="info" style={{ marginTop: 8 }}>
              현재 캔들 차트는 BINANCE 기준만 지원합니다.
            </div>
          )}
        </section>

        {/* 3. 우측: 라이브 뉴스 */}
        <section className="panel">
          <h2 className="panel-title">라이브 뉴스 (/api/live-news)</h2>

          {newsLoading && <div className="info">뉴스 불러오는 중…</div>}
          {newsError && <div className="error">{newsError}</div>}

          {!newsLoading && !newsError && news.length === 0 && (
            <div className="empty">
              표시할 뉴스가 없습니다. <br />
              Worker에서 반환하는 JSON 구조를 먼저 확인해 주세요.
            </div>
          )}

          <div className="news-list">
            {news.map((item) => (
              <article key={item.id} className="news-item">
                <div className="news-header">
                  <span className="news-source">{item.source}</span>
                  <span className="news-time">{item.time}</span>
                </div>
                <h3 className="news-title">{item.title}</h3>
                {item.symbol && (
                  <div className="news-symbol-badge">{item.symbol}</div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

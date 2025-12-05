// src/App.tsx
import { useEffect, useState } from "react";
import "./App.css";

type Market = "BINANCE" | "UPBIT" | "BITHUMB" | "OKX";

interface LiveNewsItem {
  id: string;
  source: string;
  title: string;
  symbol?: string;
  time: string;
}

interface LiveNewsResponse {
  items: LiveNewsItem[];
}

interface WatchlistItem {
  symbol: string;
  market: Market;
  lastPrice: number;
  change24h: number; // %
  volume24h: number;
}

function App() {
  const [selectedMarket, setSelectedMarket] = useState<Market>("BINANCE");
  const [symbolInput, setSymbolInput] = useState<string>("BTCUSDT");
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSDT");

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    {
      symbol: "BTCUSDT",
      market: "BINANCE",
      lastPrice: 95000,
      change24h: 2.5,
      volume24h: 123456789,
    },
    {
      symbol: "ETHUSDT",
      market: "BINANCE",
      lastPrice: 5200,
      change24h: -1.2,
      volume24h: 45678901,
    },
    {
      symbol: "SOLUSDT",
      market: "BINANCE",
      lastPrice: 320,
      change24h: 8.7,
      volume24h: 9876543,
    },
  ]);

  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [news, setNews] = useState<LiveNewsItem[]>([]);

  // 🔎 /api/live-news 호출 (Cloudflare Worker 연결용 뼈대)
  useEffect(() => {
    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const res = await fetch("/api/live-news");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        // TODO: 실제 Worker 응답 구조에 맞게 타입 맞추기
        const data: LiveNewsResponse | LiveNewsItem[] = await res.json();

        // 응답이 { items: [...] } 형태인지, 그냥 배열인지 둘 다 처리
        if (Array.isArray(data)) {
          setNews(data);
        } else if (Array.isArray(data.items)) {
          setNews(data.items);
        } else {
          setNews([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch live news:", err);
        setNewsError("라이브 뉴스 불러오기에 실패했습니다. Worker 응답을 확인해주세요.");
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNews();
  }, []);

  // ✅ 심볼 적용 버튼
  const handleApplySymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (!trimmed) return;
    setActiveSymbol(trimmed);
  };

  // ✅ 워치리스트에 추가
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
      // TODO: 나중에 실제 가격 / 변동률 / 거래량 API로 채우기
      lastPrice: 0,
      change24h: 0,
      volume24h: 0,
    };

    setWatchlist((prev) => [newItem, ...prev]);
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

        {/* 마켓 선택 + 심볼 입력 */}
        <div className="top-controls">
          <select
            className="select"
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value as Market)}
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
            placeholder="예: BTCUSDT / BTC-KRW"
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
        {/* 1. 좌측: 현재 심볼 요약 · 워치리스트 */}
        <section className="panel">
          <h2 className="panel-title">현재 심볼</h2>
          <div className="symbol-card">
            <div className="symbol-header">
              <span className="symbol-tag">{selectedMarket}</span>
              <span className="symbol-name">{activeSymbol}</span>
            </div>

            {/* TODO: 여기 이후는 실제 시세 API 붙이면서 교체 */}
            <div className="symbol-body">
              <div className="symbol-row">
                <span className="label">Last Price</span>
                <span className="value">–</span>
              </div>
              <div className="symbol-row">
                <span className="label">24h Change</span>
                <span className="value positive">–</span>
              </div>
              <div className="symbol-row">
                <span className="label">24h Volume</span>
                <span className="value">–</span>
              </div>
            </div>
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
                }}
              >
                <div className="watch-symbol-row">
                  <span className="watch-symbol">{item.symbol}</span>
                  <span className="watch-market">{item.market}</span>
                </div>
                <div className="watch-meta-row">
                  <span className="watch-price">
                    {item.lastPrice ? item.lastPrice.toLocaleString() : "—"}
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

        {/* 2. 중앙: 차트 영역 (현재는 placeholder 텍스트) */}
        <section className="panel">
          <h2 className="panel-title">차트 / 오더북 (Placeholder)</h2>
          <div className="chart-placeholder">
            {/* 
              TODO:
              - 나중에 여기에 lightweight-charts, TradingView 위젯, 
                또는 자체 캔들차트 컴포넌트 붙이면 됨.
            */}
            <p className="placeholder-title">
              차트 엔진 아직 연결 전입니다 🔧
            </p>
            <p className="placeholder-text">
              나중에 여기에는{" "}
              <strong>캔들차트 + 거래량 + 오더북/체결창</strong> 구역 들어갈 자리.
              <br />
              먼저 API 구조 완성한 뒤, 필요하면 내가 lightweight-charts 코드까지
              짜줄게.
            </p>
          </div>
        </section>

        {/* 3. 우측: 라이브 뉴스 패널 */}
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

          {/* 디버그용 원시 JSON 보기 (개발 중에만 쓸 것) */}
          {/* <pre className="debug-json">
            {JSON.stringify(news, null, 2)}
          </pre> */}
        </section>
      </main>
    </div>
  );
}

export default App;

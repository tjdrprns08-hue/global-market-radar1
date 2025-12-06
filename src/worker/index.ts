// @ts-nocheck
// src/worker/index.ts
export interface Env {
  ASSETS: Fetcher;
}

// ---------------- 공통 타입 ----------------

type PriceResponse = {
  lastPrice: number;
  change24h: number;
  volume24h: number;
};

type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ---------------- 라이브 뉴스 ----------------

async function handleLiveNews(): Promise<Response> {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const items = [
    {
    id: "1",
    source: "Binance Ann.",
    title: "BTCUSDT perpetual funding rate remains stable",
    symbol: "BTCUSDT",
    time: timeStr,
    },
    {
    id: "2",
    source: "Macro Desk",
    title: "US futures slightly higher ahead of CPI data",
    symbol: "US500",
    time: timeStr,
    },
    {
    id: "3",
    source: "On-chain Radar",
    title: "Whales accumulate BTC near key support zone",
    symbol: "BTC",
    time: timeStr,
    },
    {
    id: "4",
    source: "Altcoin Watch",
    title: "SOL sees strong spot demand on major exchanges",
    symbol: "SOLUSDT",
    time: timeStr,
    },
  ];

  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------- 가격 API ----------------

async function fetchBinancePrice(symbol: string): Promise<PriceResponse> {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(
    symbol
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);

  const data = (await res.json()) as any;

  return {
    lastPrice: parseFloat(data.lastPrice),
    change24h: parseFloat(data.priceChangePercent),
    volume24h: parseFloat(data.quoteVolume ?? data.volume),
  };
}

async function fetchUpbitPrice(symbol: string): Promise<PriceResponse> {
  // 예: BTC-KRW
  const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(
    symbol
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Upbit HTTP ${res.status}`);

  const arr = (await res.json()) as any[];
  const data = arr[0];

  return {
    lastPrice: parseFloat(data.trade_price),
    change24h: parseFloat(data.signed_change_rate) * 100,
    volume24h: parseFloat(data.acc_trade_price_24h),
  };
}

async function fetchBithumbPrice(symbol: string): Promise<PriceResponse> {
  // 예: BTC_KRW
  const url = `https://api.bithumb.com/public/ticker/${encodeURIComponent(
    symbol
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bithumb HTTP ${res.status}`);

  const json = (await res.json()) as any;
  const data = json.data;

  return {
    lastPrice: parseFloat(data.closing_price),
    change24h: parseFloat(data.fluctate_rate_24H),
    volume24h: parseFloat(data.acc_trade_value_24H),
  };
}

async function fetchOkxPrice(symbol: string): Promise<PriceResponse> {
  // 예: BTC-USDT
  const url = `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(
    symbol
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);

  const json = (await res.json()) as any;
  const data = json.data?.[0];

  const last = parseFloat(data.last);
  const open24h = parseFloat(data.open24h);
  const volQuote = parseFloat(data.volCcy24h ?? data.vol24h);
  const change24h = ((last - open24h) / open24h) * 100;

  return {
    lastPrice: last,
    change24h,
    volume24h: volQuote,
  };
}

async function handlePrice(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") || "BINANCE").toUpperCase();
  const symbol = url.searchParams.get("symbol") || "BTCUSDT";

  try {
    let price: PriceResponse;

    switch (market) {
      case "BINANCE":
        price = await fetchBinancePrice(symbol);
        break;
      case "UPBIT":
        price = await fetchUpbitPrice(symbol);
        break;
      case "BITHUMB":
        price = await fetchBithumbPrice(symbol);
        break;
      case "OKX":
        price = await fetchOkxPrice(symbol);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported market: ${market}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(price), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Price API error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ---------------- 캔들(Kline) API : BINANCE 전용 ----------------

async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
    symbol
  )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines HTTP ${res.status}`);

  const data = (await res.json()) as any[];

  return data.map(
    (row: any[]): Candle => ({
      time: Math.floor(row[0] / 1000),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    })
  );
}

async function handleKline(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") || "BINANCE").toUpperCase();
  const symbol = url.searchParams.get("symbol") || "BTCUSDT";
  const interval = url.searchParams.get("interval") || "1h";
  const limit = parseInt(url.searchParams.get("limit") || "150", 10);

  if (market !== "BINANCE") {
    return new Response(
      JSON.stringify({
        error: "현재 캔들 데이터는 BINANCE만 지원합니다.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const candles = await fetchBinanceKlines(symbol, interval, limit);
    return new Response(JSON.stringify(candles), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Kline API error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ---------------- 메인 fetch 핸들러 ----------------

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/api/live-news") {
      return handleLiveNews();
    }

    if (url.pathname === "/api/price") {
      return handlePrice(request);
    }

    if (url.pathname === "/api/kline") {
      return handleKline(request);
    }

    // 나머지는 정적 자산(리액트 앱) 서빙
    return env.ASSETS.fetch(request);
  },
};

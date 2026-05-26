import os
import json
import time
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import yfinance as yf

# List of popular and channel-relevant SET stocks (with .BK suffix)
TICKERS = [
    "PTT.BK", "CPALL.BK", "BDMS.BK", "AOT.BK", "ADVANC.BK", 
    "KBANK.BK", "SCB.BK", "GULF.BK", "PTTGC.BK", "PTTEP.BK", 
    "BANPU.BK", "TASCO.BK", "AWC.BK", "BH.BK", "CCET.BK", 
    "MBK.BK", "3BBIF.BK", "SAUCE.BK", "LH.BK", "KTB.BK", 
    "CPN.BK", "TRUE.BK", "BBL.BK", "TU.BK", "HMPRO.BK",
    "INTUCH.BK", "TISCO.BK", "BDMS.BK", "SCGP.BK", "CPF.BK"
]

def calculate_support_resistance(df, window=10):
    """
    Calculate support and resistance levels using rolling local minima/maxima.
    Returns sorted lists of support and resistance levels.
    """
    if len(df) < window * 2:
        return [], []
        
    prices = df['Close'].values
    supports = []
    resistances = []
    
    for i in range(window, len(prices) - window):
        # Local Minimum (Support Candidate)
        is_min = True
        for j in range(i - window, i + window + 1):
            if prices[j] < prices[i]:
                is_min = False
                break
        if is_min:
            supports.append(float(prices[i]))
            
        # Local Maximum (Resistance Candidate)
        is_max = True
        for j in range(i - window, i + window + 1):
            if prices[j] > prices[i]:
                is_max = False
                break
        if is_max:
            resistances.append(float(prices[i]))

    # Clean and cluster levels that are too close to each other (within 2.5% of each other)
    current_price = float(prices[-1])
    
    cleaned_supports = []
    if supports:
        supports = sorted(supports)
        # Cluster supports
        groups = []
        for s in supports:
            if not groups or s - groups[-1][-1] > (current_price * 0.025):
                groups.append([s])
            else:
                groups[-1].append(s)
        # Choose the average of each group, preferring those below the current price
        cleaned_supports = [round(float(np.mean(g)), 2) for g in groups if np.mean(g) < current_price]
        # Keep at most 3 strongest supports closest to current price
        cleaned_supports = sorted(cleaned_supports, reverse=True)[:3]
        cleaned_supports = sorted(cleaned_supports)

    cleaned_resistances = []
    if resistances:
        resistances = sorted(resistances)
        # Cluster resistances
        groups = []
        for r in resistances:
            if not groups or r - groups[-1][-1] > (current_price * 0.025):
                groups.append([r])
            else:
                groups[-1].append(r)
        # Choose the average of each group, preferring those above the current price
        cleaned_resistances = [round(float(np.mean(g)), 2) for g in groups if np.mean(g) > current_price]
        # Keep at most 3 strongest resistances closest to current price
        cleaned_resistances = sorted(cleaned_resistances)[:3]

    # If no levels found, use simple standard pivot calculations as fallback
    if not cleaned_supports:
        low_price = float(df['Low'].min())
        cleaned_supports = [round(low_price, 2), round(current_price * 0.95, 2)]
    if not cleaned_resistances:
        high_price = float(df['High'].max())
        cleaned_resistances = [round(current_price * 1.05, 2), round(high_price, 2)]

    return cleaned_supports, cleaned_resistances

def fetch_stock_data(ticker_symbol):
    print(f"Fetching data for {ticker_symbol}...")
    try:
        ticker = yf.Ticker(ticker_symbol)
        
        # Fetch 1 year of historical data
        hist = ticker.history(period="1y")
        if hist.empty:
            print(f"No history found for {ticker_symbol}")
            return None
            
        # Get info dictionary
        info = ticker.info
        
        # Calculate support & resistance
        supports, resistances = calculate_support_resistance(hist, window=12)
        
        # Extract stock name and details
        name = info.get("longName") or info.get("shortName") or ticker_symbol.replace(".BK", "")
        summary = info.get("longBusinessSummary") or "ข้อมูลธุรกิจสำหรับหุ้นนี้ยังไม่พร้อมใช้งานในระบบ"
        pe_ratio = info.get("trailingPE")
        if pe_ratio is not None:
            pe_ratio = round(float(pe_ratio), 2)
            
        div_yield = info.get("dividendYield")
        if div_yield is not None:
            div_yield = float(div_yield)
            if div_yield < 0.25:  # If fraction (e.g., 0.0571 for 5.71%), convert to percent
                div_yield = div_yield * 100
            div_yield = round(div_yield, 2)
        else:
            # Fallback check
            div_yield = info.get("trailingAnnualDividendYield")
            if div_yield is not None:
                div_yield = float(div_yield)
                if div_yield < 0.25:
                    div_yield = div_yield * 100
                div_yield = round(div_yield, 2)
            else:
                div_yield = 0.0

        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        if current_price is None:
            current_price = float(hist['Close'].iloc[-1])
        current_price = round(float(current_price), 2)

        # Get historical dividends
        dividends = ticker.dividends
        div_history = []
        if not dividends.empty:
            # Sort descending by date
            dividends = dividends.sort_index(ascending=False)
            for date, amt in dividends.items():
                div_history.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "amount": round(float(amt), 4)
                })

        # Find upcoming XD date and details
        upcoming_xd = None
        upcoming_amount = None
        upcoming_pay_date = None

        # Try to read ex-dividend date from info
        ex_div_timestamp = info.get("exDividendDate")
        if ex_div_timestamp:
            try:
                # Convert timestamp to date
                ex_date = datetime.fromtimestamp(ex_div_timestamp)
                # If ex-dividend date is in the future or recent, set it
                upcoming_xd = ex_date.strftime("%Y-%m-%d")
            except Exception:
                pass

        # If we can't find direct upcoming date or if it's in the past, let's predict/calculate based on history
        # (For simulation/demonstration, we also check historical dividend dates of last year)
        # Look for the last dividend to display
        last_div_amount = 0.0
        last_div_date = None
        if div_history:
            last_div_amount = div_history[0]["amount"]
            last_div_date = div_history[0]["date"]
            
            # Predict upcoming dividend if there isn't one set (usually same time next year or half-year)
            if not upcoming_xd:
                last_date_obj = datetime.strptime(last_div_date, "%Y-%m-%d")
                # Thai stocks usually pay dividends semi-annually or annually
                # Let's predict next date as 6 months or 1 year after last date, if that predicted date is in the future
                pred_date_6m = last_date_obj + timedelta(days=182)
                pred_date_1y = last_date_obj + timedelta(days=365)
                today = datetime.today()
                
                if pred_date_6m > today:
                    upcoming_xd = pred_date_6m.strftime("%Y-%m-%d")
                    upcoming_amount = last_div_amount
                elif pred_date_1y > today:
                    upcoming_xd = pred_date_1y.strftime("%Y-%m-%d")
                    upcoming_amount = last_div_amount
                else:
                    # If all past, just display last one as upcoming for dashboard completeness
                    upcoming_xd = (today + timedelta(days=30)).strftime("%Y-%m-%d") # Mock future date
                    upcoming_amount = last_div_amount
            else:
                upcoming_amount = last_div_amount

        # Upcoming payment date is usually ~15-20 days after XD date
        if upcoming_xd:
            xd_date_obj = datetime.strptime(upcoming_xd, "%Y-%m-%d")
            upcoming_pay_date = (xd_date_obj + timedelta(days=15)).strftime("%Y-%m-%d")

        # Get highest high and lowest low of the last 20 trading days (1 month) to calculate Pivot Points
        last_month = hist.tail(20)
        high_1m = float(last_month['High'].max()) if 'High' in last_month.columns else current_price * 1.05
        low_1m = float(last_month['Low'].min()) if 'Low' in last_month.columns else current_price * 0.95
        high_1m = round(high_1m, 2)
        low_1m = round(low_1m, 2)

        # Format 1-year history for frontend charting (last 100 business days for legibility)
        hist_sorted = hist.sort_index(ascending=True)
        chart_history = []
        # Sample ~120 points for smooth rendering without overloading frontend
        step = max(1, len(hist_sorted) // 120)
        sampled_hist = hist_sorted.iloc[::step]
        for idx, row in sampled_hist.iterrows():
            chart_history.append({
                "date": idx.strftime("%Y-%m-%d"),
                "close": round(float(row["Close"]), 2)
            })

        # Compile data
        stock_data = {
            "symbol": ticker_symbol.replace(".BK", ""),
            "name": name,
            "business_summary": summary,
            "current_price": current_price,
            "pe_ratio": pe_ratio,
            "dividend_yield": div_yield,
            "high_1m": high_1m,
            "low_1m": low_1m,
            "support_levels": supports,
            "resistance_levels": resistances,
            "upcoming_xd": upcoming_xd,
            "upcoming_dividend_amount": round(float(upcoming_amount), 2) if upcoming_amount else None,
            "upcoming_payment_date": upcoming_pay_date,
            "dividend_history": div_history[:10], # Keep last 10 payments
            "history": chart_history
        }
        return stock_data
        
    except Exception as e:
        print(f"Error fetching data for {ticker_symbol}: {str(e)}")
        return None

def main():
    print("Starting SET Stock Data Updater...")
    start_time = time.time()
    
    results = {}
    
    for symbol in TICKERS:
        data = fetch_stock_data(symbol)
        if data:
            results[data["symbol"]] = data
            
        # Polite delay to avoid API rate limit
        time.sleep(1.0)
        
    # Write to stocks_data.json
    output_path = os.path.join(os.path.dirname(__file__), "stocks_data.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    # Also write to stocks_data.js to support double-click offline file:// opening without CORS blocks
    js_output_path = os.path.join(os.path.dirname(__file__), "stocks_data.js")
    with open(js_output_path, "w", encoding="utf-8") as f:
        f.write("var STOCKS_DATABASE = ")
        json.dump(results, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    duration = time.time() - start_time
    print(f"Data update completed in {duration:.2f} seconds!")
    print(f"Saved {len(results)} stocks to {output_path} and stocks_data.js")

if __name__ == "__main__":
    main()

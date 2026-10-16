#!/usr/bin/env python3
"""Fetch BigSeller dashboard data via CDP from InstaBox VM."""
import json
import time
import requests
import websocket
import os
from datetime import datetime, timedelta

CDP_URL = "http://127.0.0.1:9223"
DATA_DIR = "/home/ubuntu/borongshaker-dashboard/data"
REPO_DIR = "/home/ubuntu/borongshaker-dashboard"

def get_ws_url():
    """Find the BigSeller page target via CDP."""
    try:
        targets = requests.get(f"{CDP_URL}/json/list", timeout=5).json()
    except Exception as e:
        print(f"ERROR getting targets: {e}")
        return None, None
    for t in targets:
        if t.get("type") == "page" and "bigseller" in t.get("url", ""):
            return t["webSocketDebuggerUrl"], t["id"]
    # If no bigseller page, use first page
    for t in targets:
        if t.get("type") == "page":
            return t["webSocketDebuggerUrl"], t["id"]
    return None, None

def cdp_call(ws, method, params=None, timeout=60):
    msg_id = int(time.time() * 1000) % 1000000 + id(params or method) % 100000
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    ws.send(json.dumps(msg))
    start = time.time()
    while time.time() - start < timeout:
        try:
            ws.settimeout(min(2, timeout - (time.time() - start)))
            data = ws.recv()
            result = json.loads(data)
            if result.get("id") == msg_id:
                return result
        except websocket.WebSocketTimeoutException:
            continue
    return None

def cdp_eval(ws, expression, timeout=60):
    result = cdp_call(ws, "Runtime.evaluate", {
        "expression": expression,
        "awaitPromise": True,
        "returnByValue": True,
        "timeout": timeout * 1000
    }, timeout=timeout)
    if result and "result" in result:
        r = result["result"].get("result", {})
        if r.get("type") == "object" and r.get("subtype") == "error":
            return f"ERROR: {r.get('description', '')}"
        return r.get("value")
    return None

def fetch_sales_data(ws):
    """Fetch monthly sales data for 2026."""
    print("Fetching sales data...")
    
    # Calculate date range - full year 2026 up to today
    today = datetime.now()
    start_date = "2026-01-01"
    end_date = today.strftime("%Y-%m-%d")
    
    js_code = f"""
    (async () => {{
        try {{
            const body = {{
                "platforms": [],
                "shopType": "SHOP",
                "shopIds": [],
                "shopGroupIds": [],
                "warehouseIds": [],
                "timeType": "ORDER_CREATED_TIME",
                "timeRange": ["{start_date}", "{end_date}"],
                "startTime": "{start_date}",
                "endTime": "{end_date}",
                "currency": "MYR",
                "evaluationOrder": "",
                "categoryList": null,
                "groupType": "0",
                "searchType": "sku",
                "search": "",
                "pageNo": 1,
                "pageSize": 500
            }};
            const resp = await fetch('/api/v1/business/analysis/interval/statistics/page.json', {{
                method: 'POST',
                credentials: 'include',
                headers: {{'Content-Type': 'application/json', 'Accept': 'application/json'}},
                body: JSON.stringify(body)
            }});
            const data = await resp.json();
            return JSON.stringify(data);
        }} catch(e) {{
            return JSON.stringify({{error: e.message}});
        }}
    }})()
    """
    
    result = cdp_eval(ws, js_code, timeout=60)
    if not result:
        print("ERROR: No response from sales API")
        return None
    
    try:
        data = json.loads(result)
    except:
        print(f"ERROR parsing sales response: {result[:200]}")
        return None
    
    if "error" in data:
        print(f"Sales API error: {data['error']}")
        return None
    
    return data

def fetch_stock_data(ws):
    """Fetch current stock/inventory data."""
    print("Fetching stock data...")
    
    js_code = """
    (async () => {
        try {
            const allRows = [];
            let pageNo = 1, totalPages = 1;
            while (pageNo <= totalPages) {
                const body = `pageNo=${pageNo}&pageSize=50&searchType=title&searchContent=&inquireType=0&stockStatus=&isGroup=&orderBy=&desc=&fullCid=&queryDistribution=1&saleState=&zoneId=&openFlag=false&hideZeroInventorySku=0&warehouseIds=`;
                const resp = await fetch('/api/v1/inventory/pageList.json', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'},
                    body
                });
                const data = await resp.json();
                if (!data.data || !data.data.page) {
                    return JSON.stringify({error: 'Invalid response structure', raw: JSON.stringify(data).substring(0, 500)});
                }
                totalPages = data.data.page.totalPage || 1;
                const rows = data.data.page.rows || [];
                allRows.push(...rows);
                pageNo++;
            }
            return JSON.stringify({totalRows: allRows.length, rows: allRows});
        } catch(e) {
            return JSON.stringify({error: e.message});
        }
    })()
    """
    
    result = cdp_eval(ws, js_code, timeout=120)
    if not result:
        print("ERROR: No response from stock API")
        return None
    
    try:
        data = json.loads(result)
    except:
        print(f"ERROR parsing stock response: {result[:200]}")
        return None
    
    if "error" in data:
        print(f"Stock API error: {data['error']}")
        return None
    
    return data

def fetch_kpi_summary(ws):
    """Fetch KPI summary from dashboard."""
    print("Fetching KPI summary...")
    
    js_code = """
    (async () => {
        try {
            const resp = await fetch('/api/v1/dashboard/orderInventoryCount.json', {
                method: 'GET',
                credentials: 'include',
                headers: {'Accept': 'application/json'}
            });
            const data = await resp.json();
            return JSON.stringify(data);
        } catch(e) {
            return JSON.stringify({error: e.message});
        }
    })()
    """
    
    result = cdp_eval(ws, js_code, timeout=30)
    if not result:
        print("ERROR: No response from KPI API")
        return None
    
    try:
        return json.loads(result)
    except:
        print(f"ERROR parsing KPI response: {result[:200]}")
        return None

def aggregate_monthly_sales(sales_data):
    """Aggregate daily sales data into monthly summary."""
    if not sales_data or "data" not in sales_data:
        return None
    
    page_vos = sales_data["data"].get("pageVos", {})
    rows = page_vos.get("rows", [])
    
    if not rows:
        return None
    
    monthly = {}
    for row in rows:
        date_str = row.get("sDate", "")
        if not date_str:
            continue
        month_key = date_str[:7]  # YYYY-MM
        
        metrics = row.get("metrics", {})
        
        if month_key not in monthly:
            monthly[month_key] = {
                "month": month_key,
                "orders": 0,
                "validOrders": 0,
                "qty": 0,
                "sales": 0.0,
                "revenue": 0.0,
                "cost": 0.0,
                "profit": 0.0,
                "shopee": 0.0,
                "tiktok": 0.0,
                "lazada": 0.0,
                "cancels": 0,
                "refunds": 0,
                "days": 0
            }
        
        m = monthly[month_key]
        m["orders"] += int(metrics.get("totalOrderCount", 0) or 0)
        m["validOrders"] += int(metrics.get("validOrderCount", 0) or 0)
        m["qty"] += int(metrics.get("validProductSalesQty", metrics.get("totalProductSalesQty", 0)) or 0)
        m["sales"] += float(metrics.get("validSaleAmount", 0) or 0)
        m["revenue"] += float(metrics.get("validSaleAmount", 0) or 0)
        m["cost"] += float(metrics.get("skuCost", 0) or 0)
        m["shopee"] += float(metrics.get("shopeeSaleAmount", 0) or 0)
        m["tiktok"] += float(metrics.get("tiktokSaleAmount", 0) or 0)
        m["lazada"] += float(metrics.get("lazadaSaleAmount", 0) or 0)
        m["cancels"] += int(metrics.get("cancelOrderCount", 0) or 0)
        m["refunds"] += int(metrics.get("refundOrderCount", 0) or 0)
        m["days"] += 1
    
    # Calculate derived metrics
    for m in monthly.values():
        m["profit"] = m["sales"] - m["cost"]
        m["margin"] = round(m["profit"] / m["sales"] * 100, 2) if m["sales"] > 0 else 0
        m["avgOrder"] = round(m["sales"] / m["validOrders"], 2) if m["validOrders"] > 0 else 0
    
    return list(monthly.values())

def aggregate_daily_sales(sales_data):
    """Extract daily sales data."""
    if not sales_data or "data" not in sales_data:
        return None
    
    page_vos = sales_data["data"].get("pageVos", {})
    rows = page_vos.get("rows", [])
    
    if not rows:
        return None
    
    daily = []
    for row in rows:
        date_str = row.get("sDate", "")
        if not date_str:
            continue
        metrics = row.get("metrics", {})
        sales = float(metrics.get("validSaleAmount", 0) or 0)
        cost = float(metrics.get("skuCost", 0) or 0)
        profit = sales - cost
        valid_orders = int(metrics.get("validOrderCount", 0) or 0)
        
        daily.append({
            "date": date_str,
            "orders": int(metrics.get("totalOrderCount", 0) or 0),
            "validOrders": valid_orders,
            "qty": int(metrics.get("validProductSalesQty", metrics.get("totalProductSalesQty", 0)) or 0),
            "sales": round(sales, 2),
            "revenue": round(sales, 2),
            "cost": round(cost, 2),
            "profit": round(profit, 2),
            "margin": round(profit / sales * 100, 2) if sales > 0 else 0,
            "shopee": round(float(metrics.get("shopeeSaleAmount", 0) or 0), 2),
            "tiktok": round(float(metrics.get("tiktokSaleAmount", 0) or 0), 2),
            "lazada": round(float(metrics.get("lazadaSaleAmount", 0) or 0), 2),
            "cancels": int(metrics.get("cancelOrderCount", 0) or 0),
            "refunds": int(metrics.get("refundOrderCount", 0) or 0),
            "subsidy": round(float(metrics.get("subsidyAmount", 0) or 0), 2),
            "discount": round(float(metrics.get("discountAmount", 0) or 0), 2),
            "avgOrder": round(sales / valid_orders, 2) if valid_orders > 0 else 0
        })
    
    return daily

def process_stock_data(stock_data):
    """Process and clean stock data."""
    if not stock_data or "rows" not in stock_data:
        return None
    
    rows = stock_data["rows"]
    
    processed = []
    for row in rows:
        processed.append({
            "sku": row.get("sku", ""),
            "title": row.get("title", ""),
            "onhand": int(row.get("onhand", 0) or 0),
            "available": int(row.get("available", 0) or 0),
            "allocated": int(row.get("allocated", 0) or 0),
            "reserved": int(row.get("reserved", 0) or 0),
            "cost": float(row.get("cost", 0) or 0),
            "totalCost": float(row.get("totalCost", 0) or 0),
            "threshold": int(row.get("threshold", 0) or 0),
            "avgDailySales": float(row.get("avgDailySales", 0) or 0),
            "recommendQuantity": int(row.get("recommendQuantity", 0) or 0),
            "warehouseName": row.get("warehouseName", ""),
            "saleState": row.get("saleState", ""),
            "fullCid": row.get("fullCid", "")
        })
    
    return processed

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    ws_url, target_id = get_ws_url()
    if not ws_url:
        print("ERROR: No browser target found via CDP")
        return False
    
    print(f"[*] Connecting to CDP target: {target_id}")
    ws = websocket.create_connection(ws_url, timeout=30)
    cdp_call(ws, "Runtime.enable")
    
    # Fetch all data
    print("\n=== Fetching Sales Data ===")
    sales_raw = fetch_sales_data(ws)
    if sales_raw:
        with open("/tmp/sales_raw.json", "w") as f:
            json.dump(sales_raw, f)
        print(f"  Raw sales data saved ({len(json.dumps(sales_raw))} bytes)")
    
    print("\n=== Fetching Stock Data ===")
    stock_raw = fetch_stock_data(ws)
    if stock_raw:
        with open("/tmp/stock_raw.json", "w") as f:
            json.dump(stock_raw, f)
        print(f"  Raw stock data saved ({len(json.dumps(stock_raw))} bytes)")
    
    print("\n=== Fetching KPI Summary ===")
    kpi_raw = fetch_kpi_summary(ws)
    if kpi_raw:
        with open("/tmp/kpi_raw.json", "w") as f:
            json.dump(kpi_raw, f)
        print(f"  Raw KPI data saved")
    
    ws.close()
    
    # Process and save
    print("\n=== Processing Data ===")
    
    # Daily sales
    daily = aggregate_daily_sales(sales_raw)
    if daily:
        with open(f"{DATA_DIR}/daily_sales.json", "w") as f:
            json.dump(daily, f, indent=2)
        print(f"  daily_sales.json: {len(daily)} days")
    
    # Monthly summary
    monthly = aggregate_monthly_sales(sales_raw)
    if monthly:
        with open(f"{DATA_DIR}/monthly_summary.json", "w") as f:
            json.dump(monthly, f, indent=2)
        print(f"  monthly_summary.json: {len(monthly)} months")
    
    # Stock
    stock = process_stock_data(stock_raw)
    if stock:
        with open(f"{DATA_DIR}/stock_current.json", "w") as f:
            json.dump(stock, f, indent=2)
        print(f"  stock_current.json: {len(stock)} items")
        
        # Stock summary
        total_items = len(stock)
        total_value = sum(s["totalCost"] for s in stock)
        out_of_stock = sum(1 for s in stock if s["available"] == 0)
        low_stock = sum(1 for s in stock if 0 < s["available"] <= s["threshold"] and s["threshold"] > 0)
        no_sales = sum(1 for s in stock if s["avgDailySales"] == 0 and s["available"] == 0)
        active_skus = sum(1 for s in stock if s["avgDailySales"] > 0)
        
        stock_summary = {
            "totalItems": total_items,
            "totalStockValue": round(total_value, 2),
            "outOfStock": out_of_stock,
            "lowStock": low_stock,
            "noSalesNoStock": no_sales,
            "activeSKUs": active_skus,
            "updated": datetime.now().strftime("%Y-%m-%d")
        }
        with open(f"{DATA_DIR}/stock_summary.json", "w") as f:
            json.dump(stock_summary, f, indent=2)
        print(f"  stock_summary.json saved")
    
    # KPI summary
    if kpi_raw:
        with open(f"{DATA_DIR}/kpi_raw.json", "w") as f:
            json.dump(kpi_raw, f, indent=2)
        print(f"  kpi_raw.json saved")
    
    # Channel summary (from daily data)
    if daily:
        channels = {}
        for d in daily:
            for ch in ["shopee", "tiktok", "lazada"]:
                channels[ch] = channels.get(ch, 0) + d.get(ch, 0)
        channel_summary = {k: round(v, 2) for k, v in channels.items()}
        channel_summary["updated"] = datetime.now().strftime("%Y-%m-%d")
        with open(f"{DATA_DIR}/channel_summary.json", "w") as f:
            json.dump(channel_summary, f, indent=2)
        print(f"  channel_summary.json saved")
    
    print("\n[*] Data fetch complete")
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

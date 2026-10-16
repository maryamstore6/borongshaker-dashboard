/**
 * data-loader.js — Memuat data JSON dari folder data/
 * Exposed ke window.DASHBOARD_DATA
 */
(function() {
  'use strict';

  const DATA_FILES = {
    salesMonthly: 'data/sales_monthly.json',
    monthlySummary: 'data/monthly_summary.json',
    channelSummary: 'data/channel_summary.json',
    weeklySummary: 'data/weekly_summary.json',
    stockCurrent: 'data/stock_current.json',
    kpiSummary: 'data/kpi_summary.json',
    dailySales: 'data/daily_sales.json'
  };

  window.DASHBOARD_DATA = {
    salesMonthly: null,
    stockCurrent: null,
    kpiSummary: null,
    dailySales: null,
    loaded: false,
    errors: []
  };

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Gagal memuat ' + url + ': ' + res.status);
    return res.json();
  }

  async function loadAll() {
    const entries = Object.entries(DATA_FILES);
    const results = await Promise.allSettled(
      entries.map(([, url]) => fetchJSON(url))
    );

    const keys = Object.keys(DATA_FILES);
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        window.DASHBOARD_DATA[keys[i]] = result.value;
      } else {
        window.DASHBOARD_DATA.errors.push({
          file: keys[i],
          error: result.reason.message
        });
        console.error('Data load error:', keys[i], result.reason);
      }
    });

    window.DASHBOARD_DATA.loaded = true;
    document.dispatchEvent(new CustomEvent('dashboard:data-loaded'));
  }

  // Auto-load on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll);
  } else {
    loadAll();
  }
})();

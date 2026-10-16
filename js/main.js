(function() {
  'use strict';
  const fmtRM = (n) => 'RM' + Number(n || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum = (n) => Number(n || 0).toLocaleString('ms-MY');
  const fmtPct = (n) => (n != null ? Number(n).toFixed(1) + '%' : '-');
  window.DASH = { fmtRM, fmtNum, fmtPct };

  function onDataReady() {
    initOverview();
    initStock();
    initSales();
    initRestock();
  }

  function safeInit() {
    if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.loaded) {
      onDataReady();
    } else {
      document.addEventListener('dashboard:data-loaded', onDataReady, { once: true });
    }
  }
  if (document.readyState === 'complete') { safeInit(); } else { window.addEventListener('load', safeInit); }

  // Sidebar navigation
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const slides = document.querySelectorAll('.slide');
  const scrollContainer = document.querySelector('.scroll-container');
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');

  function scrollToSlide(targetId) {
    const targetSlide = document.getElementById(targetId);
    if (!targetSlide || !scrollContainer) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      scrollContainer.scrollTop = targetSlide.offsetTop;
    } else {
      const slideIndex = Array.from(slides).indexOf(targetSlide);
      const slideWidth = scrollContainer.clientWidth;
      scrollContainer.scrollLeft = slideIndex * slideWidth;
    }
    sidebarLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
    if (window.innerWidth < 768 && sidebar) sidebar.classList.remove('open');
    history.replaceState(null, '', '#' + targetId);
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSlide(link.getAttribute('data-target'));
    });
  });

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Overview
  function initOverview() {
    const kpi = window.DASHBOARD_DATA.kpiSummary;
    const monthly = window.DASHBOARD_DATA.salesMonthly;
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (!kpi || !monthly) return;

    document.getElementById('kpi-sales').textContent = fmtRM(kpi.total_sales);
    document.getElementById('kpi-profit').textContent = fmtRM(kpi.total_profit);
    document.getElementById('kpi-orders').textContent = fmtNum(kpi.total_orders);
    document.getElementById('kpi-margin').textContent = fmtPct(kpi.avg_margin);

    // Trend (compare last month vs previous)
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    const salesTrend = prev ? ((last.sales / prev.sales - 1) * 100).toFixed(1) : 0;
    const profitTrend = prev ? ((last.profit / prev.profit - 1) * 100).toFixed(1) : 0;
    const ordersTrend = prev ? ((last.orders / prev.orders - 1) * 100).toFixed(1) : 0;
    const marginTrend = prev ? (last.margin - prev.margin).toFixed(1) : 0;

    updateTrend('kpi-sales-trend', salesTrend);
    updateTrend('kpi-profit-trend', profitTrend);
    updateTrend('kpi-orders-trend', ordersTrend);
    updateTrend('kpi-margin-trend', marginTrend);

    function updateTrend(id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      const num = parseFloat(val);
      el.textContent = (num >= 0 ? '↑ ' : '↓ ') + Math.abs(num) + '%';
      el.className = 'kpi-trend ' + (num >= 0 ? 'up' : 'down');
    }

    // Chart: Sales trend
    const ctx1 = document.getElementById('chart-sales-trend');
    if (ctx1) {
      new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: monthly.map(m => m.month),
          datasets: [
            { label: 'Jualan (RM)', data: monthly.map(m => m.sales), backgroundColor: 'rgba(39, 77, 12, 0.15)', borderColor: '#274D0C', borderWidth: 2, yAxisID: 'y' },
            { label: 'Untung (RM)', data: monthly.map(m => m.profit), type: 'line', borderColor: '#22C55E', backgroundColor: '#22C55E', borderWidth: 2, pointRadius: 4, yAxisID: 'y1' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } }
      });
    }

    // Chart: Channel pie
    const ctx2 = document.getElementById('chart-channel-pie');
    if (ctx2) {
      new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Shopee', 'TikTok', 'Lazada'],
          datasets: [{ data: [kpi.channels.shopee, kpi.channels.tiktok, kpi.channels.lazada], backgroundColor: ['#FF6B35', '#1DA1F2', '#274D0C'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%' }
      });
    }

    // Critical stock alert
    const critical = stock.critical || [];
    document.getElementById('critical-count').textContent = critical.length + ' produk';
    const list = document.getElementById('critical-list');
    if (list) {
      list.innerHTML = critical.slice(0, 5).map(r => '<div class="alert-item"><span class="alert-sku">' + r.sku + '</span><span class="alert-title">' + r.title + '</span><span class="alert-qty">' + r.available + '</span></div>').join('');
    }
  }

  // Stock
  function initStock() {
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (!stock) return;
    document.getElementById('stock-no-stock').textContent = stock.summary.no_stock_count;
    document.getElementById('stock-low').textContent = stock.summary.low_stock_count;
    document.getElementById('stock-critical').textContent = stock.summary.critical_count;
    document.getElementById('stock-allocated').textContent = stock.summary.no_stock_count - stock.summary.critical_count;

    // Critical table
    const critTbody = document.querySelector('#critical-table tbody');
    if (critTbody) {
      critTbody.innerHTML = (stock.critical || []).map(r => '<tr><td>' + r.sku + '</td><td>' + r.title + '</td><td class="text-right">' + r.available + '</td><td class="text-right">' + r.avgDailySales + '</td><td class="text-right">RM ' + r.cost.toFixed(2) + '</td><td class="text-right">RM ' + (r.cost * 3).toFixed(2) + '</td></tr>').join('');
    }

    // Low stock table
    const lowTbody = document.querySelector('#low-stock-table tbody');
    if (lowTbody) {
      lowTbody.innerHTML = (stock.low_stock || []).slice(0, 20).map(r => '<tr><td>' + r.sku + '</td><td>' + r.title + '</td><td class="text-right">' + r.onhand + '</td><td class="text-right">' + r.available + '</td><td class="text-right">' + r.avgDailySales + '</td><td class="text-right">RM ' + r.cost.toFixed(2) + '</td></tr>').join('');
    }
  }

  // Sales
  function initSales() {
    const monthly = window.DASHBOARD_DATA.salesMonthly;
    const daily = window.DASHBOARD_DATA.dailySales;
    if (!monthly) return;

    const ctx1 = document.getElementById('chart-monthly-sales');
    if (ctx1) {
      new Chart(ctx1, {
        type: 'bar',
        data: { labels: monthly.map(m => m.month), datasets: [{ label: 'Jualan (RM)', data: monthly.map(m => m.sales), backgroundColor: '#274D0C', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    const ctx2 = document.getElementById('chart-channel-bar');
    if (ctx2) {
      const kpi = window.DASHBOARD_DATA.kpiSummary;
      new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['Shopee', 'TikTok', 'Lazada'],
          datasets: [{ label: 'Jualan (RM)', data: [kpi.channels.shopee, kpi.channels.tiktok, kpi.channels.lazada], backgroundColor: ['#FF6B35', '#1DA1F2', '#274D0C'], borderRadius: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
      });
    }

    // Daily table
    const dailyTbody = document.querySelector('#daily-sales-table tbody');
    if (dailyTbody && daily) {
      dailyTbody.innerHTML = daily.slice(0, 100).map(d => '<tr><td>' + d.date + '</td><td class="text-right">' + d.orders + '</td><td class="text-right">RM ' + d.sales.toFixed(2) + '</td><td class="text-right">RM ' + d.profit.toFixed(2) + '</td><td class="text-right">' + d.margin.toFixed(1) + '%</td></tr>').join('');
      if (daily.length > 100) {
        dailyTbody.innerHTML += '<tr><td colspan="5" style="text-align:center;color:#6B7280;">... dan ' + (daily.length - 100) + ' rows lagi</td></tr>';
      }
    }
  }

  // Restock
  function initRestock() {
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (!stock) return;
    const critical = stock.critical || [];
    document.getElementById('restock-total').textContent = critical.length + ' produk';
    const list = document.getElementById('restock-list');
    if (list) {
      list.innerHTML = critical.map(r => {
        const qty = Math.ceil(r.avgDailySales * 30);
        const cost = qty * r.cost;
        return '<div class="restock-item"><span class="restock-sku">' + r.sku + '</span><div class="restock-info"><div class="restock-title">' + r.title + '</div><div class="restock-meta">Purata jualan/hari: ' + r.avgDailySales + ' | Kos unit: RM ' + r.cost.toFixed(2) + '</div></div><div class="restock-qty"><div class="restock-qty-value">' + qty + '</div><div class="restock-qty-label">unit perlu</div><div class="restock-cost tnum">' + fmtRM(cost) + '</div></div></div>';
      }).join('');
    }
    const totalCost = critical.reduce((sum, r) => sum + Math.ceil(r.avgDailySales * 30) * r.cost, 0);
    document.getElementById('restock-cost').textContent = fmtRM(totalCost);

    const btn = document.getElementById('btn-whatsapp');
    if (btn) {
      btn.addEventListener('click', () => {
        const lines = critical.map(r => '• ' + r.title + ' — ' + Math.ceil(r.avgDailySales * 30) + ' unit');
        const text = 'Senarai Restock BigSeller:\n\n' + lines.join('\n') + '\n\nTotal anggaran: ' + fmtRM(totalCost);
        navigator.clipboard.writeText(text).then(() => alert('Disalin! Teka ke WhatsApp.'));
      });
    }
  }
})();

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
    initAnalisis();
    initProducts();
    initReports();
    initOrders();
    initStockAlerts();
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
  const mainContent = document.querySelector('.main-content');
  const desktopToggle = document.getElementById('desktop-toggle');

  // Desktop sidebar collapse toggle
  if (desktopToggle) {
    desktopToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('expanded');
    });
  }

  function scrollToSlide(targetId) {
    const targetSlide = document.getElementById(targetId);
    if (!targetSlide || !scrollContainer) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const slideIndex = Array.from(slides).indexOf(targetSlide);
      const slideWidth = scrollContainer.clientWidth;
      scrollContainer.scrollTo({ left: slideIndex * slideWidth, behavior: 'instant' });
    } else {
      const slideIndex = Array.from(slides).indexOf(targetSlide);
      const slideWidth = scrollContainer.clientWidth;
      scrollContainer.scrollTo({ left: slideIndex * slideWidth, behavior: 'instant' });
    }
    sidebarLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
    if (window.innerWidth < 768) closeSidebar();
    history.replaceState(null, '', '#' + targetId);
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSlide(link.getAttribute('data-target'));
    });
  });

  const backdrop = document.getElementById('sidebar-backdrop');
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    const mc = document.querySelector('.main-content');
    if (mc) mc.style.pointerEvents = '';
  }
  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    const mc = document.querySelector('.main-content');
    if (mc) mc.style.pointerEvents = 'none';
  }
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Close button inside sidebar
  const closeBtn = document.getElementById('sidebar-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSidebar();
    });
  }

  // Swipe gesture: swipe left to close, swipe right to open
  let touchStartX = 0;
  let touchEndX = 0;
  const dashboardLayout = document.querySelector('.dashboard-layout');

  if (dashboardLayout) {
    dashboardLayout.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    dashboardLayout.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50 && window.innerWidth < 768) {
        if (diff > 0 && sidebar && sidebar.classList.contains('open')) {
          closeSidebar(); // swipe left to close
        } else if (diff < 0 && touchStartX < 50) {
          openSidebar(); // swipe right from edge to open
        }
      }
    }, { passive: true });
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
          datasets: [{
            data: [kpi.channels.shopee, kpi.channels.tiktok, kpi.channels.lazada],
            backgroundColor: ['#FF6B35', '#1DA1F2', '#274D0C'],
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 4,
            spacing: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          layout: { padding: 8 },
          minAngle: 5,
          plugins: {
            legend: { position: 'right', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { callbacks: { label: (c) => c.label + ': RM ' + Number(c.raw).toLocaleString() } }
          }
        }
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

  // Analisis
  function initAnalisis() {
    const daily = window.DASHBOARD_DATA.dailySales;
    const monthly = window.DASHBOARD_DATA.salesMonthly;
    if (!daily || !monthly) return;

    // Chart: Daily sales trend (line with fill)
    const ctx1 = document.getElementById('chart-daily-sales');
    if (ctx1) {
      const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
      new Chart(ctx1, {
        type: 'line',
        data: {
          labels: sorted.map(d => d.date),
          datasets: [{
            label: 'Jualan (RM)',
            data: sorted.map(d => d.sales),
            borderColor: '#274D0C',
            backgroundColor: 'rgba(39, 77, 12, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { callback: v => 'RM' + v.toLocaleString() } }
          }
        }
      });
    }

    // Chart: Channel breakdown daily (stacked bar)
    const ctx2 = document.getElementById('chart-channel-daily');
    if (ctx2) {
      const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
      new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: sorted.map(d => d.date),
          datasets: [
            { label: 'Shopee', data: sorted.map(d => d.shopee), backgroundColor: '#FF6B35', stack: 'stack' },
            { label: 'TikTok', data: sorted.map(d => d.tiktok), backgroundColor: '#1DA1F2', stack: 'stack' },
            { label: 'Lazada', data: sorted.map(d => d.lazada), backgroundColor: '#274D0C', stack: 'stack' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { stacked: true, ticks: { maxTicksLimit: 12 }, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { callback: v => 'RM' + v.toLocaleString() } }
          }
        }
      });
    }

    // Chart: Margin trend daily (line)
    const ctx3 = document.getElementById('chart-margin-trend');
    if (ctx3) {
      const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
      new Chart(ctx3, {
        type: 'line',
        data: {
          labels: sorted.map(d => d.date),
          datasets: [{
            label: 'Margin (%)',
            data: sorted.map(d => d.margin),
            borderColor: '#22C55E',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { callback: v => v + '%' } }
          }
        }
      });
    }

    // Chart: Order vs Sales scatter (colored by month)
    const ctx4 = document.getElementById('chart-scatter');
    if (ctx4) {
      const monthColors = ['#FF6B35', '#1DA1F2', '#274D0C', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'];
      const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
      const datasets = [];
      const monthMap = {};
      sorted.forEach(d => {
        const m = d.date.substring(0, 7);
        if (!monthMap[m]) monthMap[m] = Object.keys(monthMap).length;
      });
      Object.keys(monthMap).forEach(m => {
        const monthName = monthly.find(mo => mo.month_key === m);
        datasets.push({
          label: monthName ? monthName.month : m,
          data: sorted.filter(d => d.date.startsWith(m)).map(d => ({ x: d.orders, y: d.sales })),
          backgroundColor: monthColors[monthMap[m] % monthColors.length],
          pointRadius: 4,
          pointHoverRadius: 6
        });
      });
      new Chart(ctx4, {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            x: { title: { display: true, text: 'Jumlah Order' }, beginAtZero: true },
            y: { title: { display: true, text: 'Jualan (RM)' }, beginAtZero: true, ticks: { callback: v => 'RM' + v.toLocaleString() } }
          }
        }
      });
    }

    // Monthly comparison table
    const tbody = document.querySelector('#monthly-compare-table tbody');
    if (tbody) {
      tbody.innerHTML = monthly.map((m, i) => {
        const prev = i > 0 ? monthly[i - 1] : null;
        const trend = prev ? ((m.sales / prev.sales - 1) * 100).toFixed(1) : null;
        const trendHtml = trend !== null
          ? '<span style="color:' + (parseFloat(trend) >= 0 ? '#22C55E' : '#EF4444') + '">' + (parseFloat(trend) >= 0 ? '↑' : '↓') + ' ' + Math.abs(parseFloat(trend)) + '%</span>'
          : '<span style="color:#6B7280;">—</span>';
        return '<tr><td>' + m.month + '</td><td class="text-right">' + fmtNum(m.orders) + '</td><td class="text-right">' + fmtRM(m.sales) + '</td><td class="text-right">' + fmtRM(m.profit) + '</td><td class="text-right">' + fmtPct(m.margin) + '</td><td class="text-right">' + fmtRM(m.shopee) + '</td><td class="text-right">' + fmtRM(m.tiktok) + '</td><td class="text-right">' + fmtRM(m.lazada) + '</td><td>' + trendHtml + '</td></tr>';
      }).join('');
    }
  }
  // Products
  function initProducts() {
    const products = window.DASHBOARD_DATA.productsList;
    if (!products || !products.length) return;

    const tbody = document.querySelector('#products-table tbody');
    const subtitle = document.getElementById('products-subtitle');
    if (subtitle) subtitle.textContent = products.length + ' produk • Data inventori';

    // Stock status distribution
    const statusCounts = { critical: 0, low: 0, healthy: 0 };
    products.forEach(p => {
      if (p.stock === 0) statusCounts.critical++;
      else if ((p.available || 0) < 10) statusCounts.low++;
      else statusCounts.healthy++;
    });

    // Render table
    function renderTable(filterStatus, searchTerm) {
      const filtered = products.filter(p => {
        let matchStatus = true;
        if (filterStatus === 'critical') matchStatus = p.stock === 0;
        else if (filterStatus === 'low') matchStatus = p.stock > 0 && (p.available || 0) < 10;
        else if (filterStatus === 'healthy') matchStatus = (p.available || 0) >= 10;
        const matchSearch = !searchTerm || (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchStatus && matchSearch;
      });
      if (tbody) {
        tbody.innerHTML = filtered.map(p => {
          const stockColor = p.stock === 0 ? '#EF4444' : (p.available < 10 ? '#F59E0B' : '#22C55E');
          const stockLabel = p.stock === 0 ? 'Habis' : p.stock;
          return '<tr><td>' + (p.sku || '-') + '</td><td>' + (p.title || '-') + '</td><td class="text-right">RM ' + Number(p.cost || 0).toFixed(2) + '</td><td class="text-right" style="color:' + stockColor + ';font-weight:600;">' + stockLabel + '</td><td class="text-right">' + (p.avgDailySales || 0).toFixed(1) + '</td><td class="text-right">RM ' + ((p.cost || 0) * 3).toFixed(2) + '</td></tr>';
        }).join('');
      }
    }
    renderTable('all', '');

    // Stock status filter buttons
    const filterBtns = document.querySelectorAll('.platform-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const status = btn.getAttribute('data-filter');
        const searchTerm = document.getElementById('product-search').value;
        renderTable(status, searchTerm);
      });
    });

    // Search
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const activeBtn = document.querySelector('.platform-btn.active');
        const status = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
        renderTable(status, searchInput.value);
      });
    }

    // Stock status distribution chart
    const ctx = document.getElementById('chart-platform-dist');
    if (ctx) {
      const labels = ['Kritikal', 'Low Stock', 'Sihat'];
      const data = [statusCounts.critical, statusCounts.low, statusCounts.healthy];
      const colors = ['#FF6B35', '#1DA1F2', '#274D0C', '#F59E0B', '#8B5CF6', '#EC4899'];
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 4,
            spacing: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          layout: { padding: 8 },
          plugins: {
            legend: { position: 'right', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { callbacks: { label: (c) => c.label + ': ' + c.raw + ' produk' } }
          }
        }
      });
    }
  }

  // Reports
  function initReports() {
    const menu = window.DASHBOARD_DATA.downloadMenu;
    if (!menu || !menu.length) return;

    const container = document.getElementById('report-cards');
    if (!container) return;

    const categoryIcons = {
      'Product': '📦',
      'Marketing': '📢',
      'Data': '📊'
    };

    const categoryDesc = {
      'Product': 'Senarai produk, media, dan data platform',
      'Marketing': 'Laporan iklan dan prestasi pemasaran',
      'Data': 'Analisis perniagaan dan laporan untung'
    };

    // Render category cards
    container.innerHTML = menu.map(cat => {
      const icon = categoryIcons[cat.name] || '📄';
      const desc = categoryDesc[cat.name] || 'Laporan ' + cat.name;
      const count = (cat.children || []).length;
      return '<div class="report-card">' +
        '<div class="report-card-icon">' + icon + '</div>' +
        '<div class="report-card-body">' +
        '<div class="report-card-title">' + cat.name + '</div>' +
        '<div class="report-card-desc">' + desc + '</div>' +
        '<div class="report-card-count">' + count + ' laporan</div>' +
        '</div>' +
        '<button class="btn-download" data-category="' + cat.name + '">Muat Turun</button>' +
        '</div>';
    }).join('');

    // Download button handlers
    const downloadBtns = document.querySelectorAll('.btn-download');
    downloadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-category');
        const cat = menu.find(c => c.name === category);
        if (cat && cat.children) {
          const lines = cat.children.map(c => '• ' + c.name);
          const text = 'Laporan ' + category + ':\n\n' + lines.join('\n');
          navigator.clipboard.writeText(text).then(() => alert('Senarai laporan ' + category + ' disalin!'));
        }
      });
    });

    // Report type breakdown chart
    const ctx = document.getElementById('chart-report-breakdown');
    if (ctx) {
      const labels = menu.map(c => c.name);
      const data = menu.map(c => (c.children || []).length);
      const colors = ['#274D0C', '#FF6B35', '#1DA1F2'];
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Bilangan Laporan',
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }

    // Recent exports table
    const exportsTbody = document.querySelector('#recent-exports-table tbody');
    if (exportsTbody) {
      const recentExports = [];
      menu.forEach(cat => {
        (cat.children || []).slice(0, 2).forEach(child => {
          recentExports.push({
            name: child.name,
            category: cat.name,
            date: '2026-10-17',
            status: 'Siap'
          });
        });
      });
      exportsTbody.innerHTML = recentExports.slice(0, 10).map(e =>
        '<tr><td>' + e.name + '</td><td>' + e.category + '</td><td>' + e.date + '</td><td><span style="color:#22C55E;font-weight:600;">' + e.status + '</span></td></tr>'
      ).join('');
    }
  }

  // Orders
  function initOrders() {
    const ordersData = window.DASHBOARD_DATA.ordersList;
    if (!ordersData) return;

    const orders = ordersData.orders || [];
    const summary = ordersData.summary || {};
    const byStatus = summary.byStatus || {};

    // Status cards
    document.getElementById('order-new').textContent = fmtNum(byStatus.new || 0);
    document.getElementById('order-processing').textContent = fmtNum(byStatus.processing || 0);
    document.getElementById('order-shipped').textContent = fmtNum(byStatus.shipped || 0);
    document.getElementById('order-completed').textContent = fmtNum(byStatus.completed || 0);
    document.getElementById('order-cancelled').textContent = fmtNum(byStatus.cancelled || 0);

    // Platform distribution
    const platformCounts = {};
    orders.forEach(o => {
      const p = o.platform || 'unknown';
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });

    // Render table
    const tbody = document.querySelector('#orders-table tbody');
    if (tbody) {
      tbody.innerHTML = orders.slice(0, 50).map(o => {
        const stateColor = o.state === 'new' ? '#3B82F6' : o.state === 'processing' ? '#F59E0B' : o.state === 'shipped' ? '#22C55E' : o.state === 'completed' ? '#22C55E' : '#EF4444';
        const stateLabel = o.state === 'new' ? 'New' : o.state === 'processing' ? 'Processing' : o.state === 'shipped' ? 'Shipped' : o.state === 'completed' ? 'Completed' : 'Cancelled';
        return '<tr><td>' + o.id + '</td><td>' + o.platform + '</td><td>' + o.shop + '</td><td><span style="color:' + stateColor + ';font-weight:600;">' + stateLabel + '</span></td><td class="text-right">' + fmtRM(o.amount) + '</td><td class="text-right">' + o.items + '</td><td>' + o.buyer + '</td><td>' + o.date + '</td></tr>';
      }).join('');
    }

    // Platform filter
    const filterBtns = document.querySelectorAll('#order-platform-filters .platform-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        const filtered = filter === 'all' ? orders : orders.filter(o => o.platform === filter);
        if (tbody) {
          tbody.innerHTML = filtered.slice(0, 50).map(o => {
            const stateColor = o.state === 'new' ? '#3B82F6' : o.state === 'processing' ? '#F59E0B' : o.state === 'shipped' ? '#22C55E' : o.state === 'completed' ? '#22C55E' : '#EF4444';
            const stateLabel = o.state === 'new' ? 'New' : o.state === 'processing' ? 'Processing' : o.state === 'shipped' ? 'Shipped' : o.state === 'completed' ? 'Completed' : 'Cancelled';
            return '<tr><td>' + o.id + '</td><td>' + o.platform + '</td><td>' + o.shop + '</td><td><span style="color:' + stateColor + ';font-weight:600;">' + stateLabel + '</span></td><td class="text-right">' + fmtRM(o.amount) + '</td><td class="text-right">' + o.items + '</td><td>' + o.buyer + '</td><td>' + o.date + '</td></tr>';
          }).join('');
        }
      });
    });

    // Platform distribution chart
    const ctx = document.getElementById('chart-platform-dist-orders');
    if (ctx) {
      const labels = Object.keys(platformCounts);
      const data = Object.values(platformCounts);
      const colors = ['#FF6B35', '#1DA1F2', '#274D0C', '#F59E0B', '#8B5CF6', '#EC4899'];
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 4,
            spacing: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          layout: { padding: 8 },
          plugins: {
            legend: { position: 'right', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { callbacks: { label: (c) => c.label + ': ' + c.raw + ' orders' } }
          }
        }
      });
    }
  }

  // Stock Alerts
  function initStockAlerts() {
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (!stock) return;

    const critical = stock.critical || [];
    const lowStock = stock.low_stock || [];
    const noStock = stock.no_stock || [];
    const summary = stock.summary || {};

    // Summary cards
    document.getElementById('stock-critical-alerts').textContent = fmtNum(summary.critical_count || critical.length);
    document.getElementById('stock-low-alerts').textContent = fmtNum(summary.low_stock_count || lowStock.length);
    document.getElementById('stock-out-alerts').textContent = fmtNum(summary.no_stock_count || noStock.length);
    const totalProducts = summary.total_products || (critical.length + lowStock.length + noStock.length);
    const healthyCount = totalProducts - critical.length - lowStock.length - noStock.length;
    document.getElementById('stock-healthy-alerts').textContent = fmtNum(Math.max(0, healthyCount));

    // Stock health bar chart
    const ctx = document.getElementById('chart-stock-health');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Kritikal', 'Low Stock', 'Habis', 'Sihat'],
          datasets: [{
            label: 'Bilangan Produk',
            data: [critical.length, lowStock.length, noStock.length, Math.max(0, healthyCount)],
            backgroundColor: ['#EF4444', '#F59E0B', '#7F1D1D', '#22C55E'],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 10 } }
          }
        }
      });
    }

    // Critical stock table
    const critTbody = document.querySelector('#critical-stock-table tbody');
    if (critTbody) {
      critTbody.innerHTML = critical.map(r => {
        const restockQty = Math.ceil((r.avgDailySales || 0) * 30);
        return '<tr><td>' + r.sku + '</td><td>' + r.title + '</td><td class="text-right">' + (r.available || 0) + '</td><td class="text-right">' + (r.avgDailySales || 0).toFixed(1) + '</td><td class="text-right">RM ' + (r.cost || 0).toFixed(2) + '</td><td class="text-right">' + restockQty + '</td></tr>';
      }).join('');
    }

    // Low stock table (top 10)
    const lowTbody = document.querySelector('#low-stock-alerts-table tbody');
    if (lowTbody) {
      lowTbody.innerHTML = lowStock.slice(0, 10).map(r => {
        return '<tr><td>' + r.sku + '</td><td>' + r.title + '</td><td class="text-right">' + (r.onhand || 0) + '</td><td class="text-right">' + (r.available || 0) + '</td><td class="text-right">' + (r.avgDailySales || 0).toFixed(1) + '</td></tr>';
      }).join('');
    }
  }
})();

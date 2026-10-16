/**
 * main.js — Scroll-snap navigation, inisialisasi Chart.js & DataTable
 */
(function() {
  'use strict';

  // ========== Utiliti ==========
  const fmtRM = (n) => 'RM' + Number(n || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum = (n) => Number(n || 0).toLocaleString('ms-MY');
  const fmtPct = (n) => (n != null ? Number(n).toFixed(1) + '%' : '-');

  window.DASH = { fmtRM, fmtNum, fmtPct };

  // ========== Tunggu data dimuat ==========
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

  if (document.readyState === 'complete') {
    safeInit();
  } else {
    window.addEventListener('load', safeInit);
  }

  // ========== Navigasi Dot ==========
  const navDots = document.querySelectorAll('.nav-dot');
  const slides = document.querySelectorAll('.slide');
  const scrollContainer = document.querySelector('.scroll-container');

  navDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const targetId = dot.getAttribute('data-target');
      const targetSlide = document.getElementById(targetId);
      if (targetSlide && scrollContainer) {
        const slideIndex = Array.from(slides).indexOf(targetSlide);
        const slideWidth = scrollContainer.clientWidth;
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          const slideTop = targetSlide.offsetTop;
          scrollContainer.scrollTo({ top: slideTop, behavior: 'smooth' });
        } else {
          const slideLeft = slideIndex * slideWidth;
          scrollContainer.scrollTo({ left: slideLeft, behavior: 'smooth' });
        }
      }
    });
  });

  // IntersectionObserver to update active dot
  if (scrollContainer && slides.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navDots.forEach(dot => {
            if (dot.getAttribute('data-target') === id) {
              dot.classList.add('active');
            } else {
              dot.classList.remove('active');
            }
          });
        }
      });
    }, {
      root: scrollContainer,
      threshold: 0.5
    });

    slides.forEach(slide => observer.observe(slide));
  }

  // ========== OVERVIEW ==========
  function initOverview() {
    const kpi = window.DASHBOARD_DATA.kpiSummary;
    const monthly = window.DASHBOARD_DATA.salesMonthly;
    if (!kpi || !monthly) return;

    // KPI Cards
    document.getElementById('kpi-sales').textContent = fmtRM(kpi.total_sales);
    document.getElementById('kpi-profit').textContent = fmtRM(kpi.total_profit);
    document.getElementById('kpi-orders').textContent = fmtNum(kpi.total_orders);
    document.getElementById('kpi-margin').textContent = fmtPct(kpi.avg_margin);

    // Chart: Bar + Line 9-month trend
    const ctx1 = document.getElementById('chart-sales-trend');
    if (ctx1) {
      const labels = monthly.map(m => m.month);
      const salesData = monthly.map(m => m.sales);
      const profitData = monthly.map(m => m.profit);
      const ordersData = monthly.map(m => m.orders);

      new Chart(ctx1, {
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Jualan (RM)',
              data: salesData,
              backgroundColor: 'rgba(39, 77, 12, 0.15)',
              borderColor: '#274D0C',
              borderWidth: 1.5,
              borderRadius: 4,
              yAxisID: 'y',
              order: 2
            },
            {
              type: 'line',
              label: 'Untung (RM)',
              data: profitData,
              borderColor: '#4A90D9',
              backgroundColor: 'rgba(74, 144, 217, 0.1)',
              borderWidth: 2.5,
              pointRadius: 4,
              pointBackgroundColor: '#4A90D9',
              tension: 0.3,
              fill: true,
              yAxisID: 'y1',
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed.y;
                  return ctx.dataset.label + ': RM' + fmtNum(val);
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
              position: 'left',
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: { font: { size: 11 }, callback: (v) => fmtNum(v) }
            },
            y1: {
              position: 'right',
              grid: { display: false },
              ticks: { font: { size: 11 }, callback: (v) => fmtNum(v) }
            }
          }
        }
      });
    }

    // Chart: Channel pie
    const ctx2 = document.getElementById('chart-channel');
    if (ctx2) {
      const ch = kpi.channels;
      new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Shopee', 'TikTok', 'Lazada'],
          datasets: [{
            data: [ch.shopee, ch.tiktok, ch.lazada],
            backgroundColor: ['#274D0C', '#4A90D9', '#f59e0b'],
            borderWidth: 2,
            borderColor: '#fff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = ((ctx.parsed / total) * 100).toFixed(1);
                  return ctx.label + ': RM' + fmtNum(ctx.parsed) + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    }

    // Critical stock alert
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (stock && stock.critical && stock.critical.length > 0) {
      const alertBox = document.getElementById('alert-critical');
      if (alertBox) {
        alertBox.classList.remove('hidden');
        document.getElementById('alert-count').textContent = stock.critical.length;
        const items = stock.critical.map(c => c.title || c.sku).slice(0, 5).join(', ');
        document.getElementById('alert-items').textContent = items + (stock.critical.length > 5 ? '...' : '');
      }
    }
  }

  // ========== STOCK ==========
  function initStock() {
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (!stock) return;

    // Summary numbers
    document.getElementById('stock-critical-count').textContent = stock.summary.critical_count;
    document.getElementById('stock-no-count').textContent = stock.summary.no_stock_count;
    document.getElementById('stock-low-count').textContent = stock.summary.low_stock_count;
    document.getElementById('stock-total-count').textContent = stock.summary.total_products;

    // Chart: Stock categories
    const ctx = document.getElementById('chart-stock');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Kritikal', 'Stok Rendah', 'Tanpa Stok'],
          datasets: [{
            label: 'Produk',
            data: [stock.summary.critical_count, stock.summary.low_stock_count, stock.summary.no_stock_count],
            backgroundColor: ['#dc2626', '#f59e0b', '#6b7280'],
            borderRadius: 6,
            barThickness: 40
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => fmtNum(ctx.parsed.x) + ' produk'
              }
            }
          },
          scales: {
            x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } }
          }
        }
      });
    }

    // Critical items DataTable
    if (stock.critical && stock.critical.length > 0) {
      const tbody = document.getElementById('critical-table-body');
      if (tbody) {
        tbody.innerHTML = stock.critical.map(item => `
          <tr>
            <td class="tnum">${item.sku}</td>
            <td>${item.title || item.sku}</td>
            <td class="tnum text-danger">${item.onhand}</td>
            <td class="tnum">${item.threshold || '-'}</td>
            <td class="tnum">${item.avgDailySales || 0}</td>
            <td class="tnum">${fmtRM(item.cost)}</td>
            <td class="tnum">${fmtRM(item.totalCost)}</td>
            <td class="tnum">${item.onTheWay || 0}</td>
          </tr>
        `).join('');
      }
    }

    // Low stock DataTable
    if (stock.low_stock && stock.low_stock.length > 0) {
      const tbody = document.getElementById('low-table-body');
      if (tbody) {
        tbody.innerHTML = stock.low_stock.map(item => `
          <tr>
            <td class="tnum">${item.sku}</td>
            <td>${item.title || item.sku}</td>
            <td class="tnum text-warning">${item.onhand}</td>
            <td class="tnum">${item.threshold || '-'}</td>
            <td class="tnum">${item.avgDailySales || 0}</td>
            <td class="tnum">${fmtRM(item.cost)}</td>
            <td class="tnum">${fmtRM(item.totalCost)}</td>
            <td class="tnum">${item.onTheWay || 0}</td>
          </tr>
        `).join('');
      }
      // Initialize DataTable for low stock
      if ($.fn.DataTable) {
        $('#low-stock-table').DataTable({
          pageLength: 10,
          language: {
            search: 'Cari:',
            lengthMenu: 'Papar _MENU_ baris',
            info: 'Paparan _START_-_END_ dari _TOTAL_ baris',
            infoEmpty: 'Tiada data',
            paginate: { first: 'Pertama', last: 'Terakhir', next: 'Seterusnya', previous: 'Sebelumnya' }
          }
        });
      }
    }
  }

  // ========== SALES ==========
  function initSales() {
    const monthly = window.DASHBOARD_DATA.salesMonthly;
    const daily = window.DASHBOARD_DATA.dailySales;
    if (!monthly) return;

    // Monthly bar chart
    const ctx1 = document.getElementById('chart-monthly-sales');
    if (ctx1) {
      new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: monthly.map(m => m.month),
          datasets: [{
            label: 'Jualan (RM)',
            data: monthly.map(m => m.sales),
            backgroundColor: 'rgba(39, 77, 12, 0.7)',
            borderRadius: 4,
            barPercentage: 0.6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => 'Jualan: RM' + fmtNum(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: (v) => fmtNum(v) } }
          }
        }
      });
    }

    // Channel comparison chart
    const ctx2 = document.getElementById('chart-channel-compare');
    if (ctx2) {
      const labels = monthly.map(m => m.month);
      new Chart(ctx2, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Shopee', data: monthly.map(m => m.shopee), borderColor: '#274D0C', backgroundColor: 'rgba(39,77,12,0.05)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
            { label: 'TikTok', data: monthly.map(m => m.tiktok), borderColor: '#4A90D9', backgroundColor: 'rgba(74,144,217,0.05)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
            { label: 'Lazada', data: monthly.map(m => m.lazada), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.05)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ctx.dataset.label + ': RM' + fmtNum(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: (v) => fmtNum(v) } }
          }
        }
      });
    }

    // MoM growth chart
    const ctx3 = document.getElementById('chart-mom-growth');
    if (ctx3) {
      const growth = monthly.map((m, i) => {
        if (i === 0) return null;
        const prev = monthly[i - 1].sales;
        return prev > 0 ? parseFloat((((m.sales - prev) / prev) * 100).toFixed(1)) : null;
      }).filter(v => v !== null);

      const labels = monthly.slice(1).map(m => m.month);
      new Chart(ctx3, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Pertumbuhan MoM (%)',
            data: growth,
            backgroundColor: growth.map(v => v >= 0 ? 'rgba(39, 77, 12, 0.6)' : 'rgba(220, 38, 38, 0.6)'),
            borderRadius: 4,
            barPercentage: 0.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ctx.parsed.y + '%'
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: (v) => v + '%' } }
          }
        }
      });
    }

    // Daily sales DataTable
    if (daily && daily.length > 0 && $.fn.DataTable) {
      // Reverse to chronological order (oldest first)
      const sorted = [...daily].reverse();

      const table = $('#daily-sales-table').DataTable({
        data: sorted,
        columns: [
          { data: 'date' },
          { data: 'orders', render: (d) => fmtNum(d) },
          { data: 'qty', render: (d) => fmtNum(d) },
          { data: 'sales', render: (d) => fmtRM(d) },
          { data: 'revenue', render: (d) => fmtRM(d) },
          { data: 'profit', render: (d) => fmtRM(d) },
          { data: 'margin', render: (d) => fmtPct(d) },
          { data: 'shopee', render: (d) => fmtRM(d) },
          { data: 'tiktok', render: (d) => fmtRM(d) },
          { data: 'lazada', render: (d) => fmtRM(d) }
        ],
        pageLength: 15,
        order: [[0, 'asc']],
        language: {
          search: 'Cari:',
          lengthMenu: 'Papar _MENU_ baris',
          info: 'Paparan _START_-_END_ dari _TOTAL_ baris',
          infoEmpty: 'Tiada data',
          infoFiltered: '(ditapis dari _MAX_ total)',
          paginate: { first: 'Pertama', last: 'Terakhir', next: 'Seterusnya', previous: 'Sebelumnya' }
        },
        responsive: true
      });
    }
  }

  // ========== RESTOCK ==========
  function initRestock() {
    const stock = window.DASHBOARD_DATA.stockCurrent;
    if (!stock || !stock.critical) return;

    const container = document.getElementById('restock-list');
    if (!container) return;

    // Sort by priority: lowest stock, highest daily sales
    const items = [...stock.critical].sort((a, b) => {
      const scoreA = (a.onhand || 0) / (a.avgDailySales || 1);
      const scoreB = (b.onhand || 0) / (b.avgDailySales || 1);
      return scoreA - scoreB;
    });

    let totalCost = 0;

    container.innerHTML = items.map((item, idx) => {
      const orderQty = Math.max((item.threshold || 50) - (item.onhand || 0) - (item.onTheWay || 0), 10);
      const cost = orderQty * (item.cost || 0);
      totalCost += cost;

      const priority = item.onhand === 0 ? 'high' : (item.onhand < 10 ? 'medium' : 'low');
      const priorityLabel = priority === 'high' ? 'Tinggi' : (priority === 'medium' ? 'Sederhana' : 'Rendah');

      return `
        <div class="restock-item">
          <div class="restock-info">
            <div class="restock-sku">${item.sku}</div>
            <div class="restock-title">${item.title || item.sku}</div>
            <div class="restock-meta">
              <span class="priority-badge priority-${priority}">${priorityLabel}</span>
              <span>Stok: ${item.onhand}</span>
              <span>Purata jualan/hari: ${item.avgDailySales}</span>
              <span>Dalam transit: ${item.onTheWay || 0}</span>
              <span>Gudang: ${item.warehouse || '-'}</span>
            </div>
          </div>
          <div class="restock-qty">
            <div class="restock-qty-value">${orderQty}</div>
            <div class="restock-qty-label">unit perlu</div>
            <div class="restock-cost tnum">${fmtRM(cost)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Total cost
    const totalEl = document.getElementById('restock-total-cost');
    if (totalEl) totalEl.textContent = fmtRM(totalCost);

    const countEl = document.getElementById('restock-total-items');
    if (countEl) countEl.textContent = items.length;

    // Copy to WhatsApp button
    const btn = document.getElementById('btn-whatsapp');
    if (btn) {
      btn.addEventListener('click', () => {
        let msg = '*SURATAN PEMBELIANAN — RESTOCK*\\n';
        msg += 'Tarikh: ' + new Date().toLocaleDateString('ms-MY') + '\\n';
        msg += 'Bilangan item: ' + items.length + '\\n';
        msg += 'Anggaran kos: ' + fmtRM(totalCost) + '\\n\\n';
        msg += 'Senarai item:\\n';
        items.forEach((item, idx) => {
          const orderQty = Math.max((item.threshold || 50) - (item.onhand || 0) - (item.onTheWay || 0), 10);
          msg += (idx + 1) + '. ' + item.sku + ' — ' + orderQty + ' unit @ ' + fmtRM(item.cost) + '\\n';
        });
        msg += '\\nSila hantar pengesahan. Terima kasih.';

        const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
        window.open(url, '_blank');
      });
    }
  }
})();

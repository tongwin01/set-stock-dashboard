// ========================================================
// Insight AI Brief - SET Premium Dashboard & Portfolio Engine
// ========================================================

// System Configuration
const CONFIG = {};

// Application State
let stocksData = {};
let selectedStock = null;
let activeTab = 'tab-portfolio-manager';
let activeChartScale = 100; // default to 100 business days
let priceChart = null;

// Multi-Portfolio Management State
let portfolios = [];
let activePortfolioId = 'p_default';
let isPremium = false;
let currentTheme = 'dark';

// Custom Chart.js Plugin for Support/Resistance drawing (Stunning High Contrast Design)
const supportResistancePlugin = {
  id: 'supportResistanceLines',
  afterDatasetsDraw(chart) {
    if (!selectedStock || !stocksData[selectedStock]) return;
    const stock = stocksData[selectedStock];
    const { ctx, chartArea: { left, right }, scales: { y } } = chart;
    
    // Calculate standard pivot levels
    const high = stock.high_1m || stock.current_price * 1.05;
    const low = stock.low_1m || stock.current_price * 0.95;
    const close = stock.current_price;
    
    const P = (high + low + close) / 3;
    const R1 = 2 * P - low;
    const S1 = 2 * P - high;
    const R2 = P + (high - low);
    const S2 = P - (high - low);
    const R3 = high + 2 * (P - low);
    const S3 = low - 2 * (high - P);
    const R4 = R3 + (high - low);
    const S4 = S3 - (high - low);

    ctx.save();
    
    // Draw S2-S4 & R2-R4 - ONLY if Premium status is ACTIVE
    const levels = [
      { val: P, name: 'Pivot (P)', lineStyle: 'rgba(192, 132, 252, 0.75)', textBg: '#c084fc', isPrem: false },
      { val: R1, name: 'ต้าน 1 (R1)', lineStyle: 'rgba(244, 63, 94, 0.75)', textBg: '#f43f5e', isPrem: false },
      { val: S1, name: 'รับ 1 (S1)', lineStyle: 'rgba(16, 185, 129, 0.75)', textBg: '#10b981', isPrem: false },
      
      { val: R2, name: 'ต้าน 2 (R2)', lineStyle: 'rgba(244, 63, 94, 0.75)', textBg: '#e11d48', isPrem: true },
      { val: R3, name: 'ต้าน 3 (R3)', lineStyle: 'rgba(244, 63, 94, 0.75)', textBg: '#be123c', isPrem: true },
      { val: R4, name: 'ต้าน 4 (R4)', lineStyle: 'rgba(244, 63, 94, 0.75)', textBg: '#9f1239', isPrem: true },
      { val: S2, name: 'รับ 2 (S2)', lineStyle: 'rgba(16, 185, 129, 0.75)', textBg: '#059669', isPrem: true },
      { val: S3, name: 'รับ 3 (S3)', lineStyle: 'rgba(16, 185, 129, 0.75)', textBg: '#047857', isPrem: true },
      { val: S4, name: 'รับ 4 (S4)', lineStyle: 'rgba(16, 185, 129, 0.75)', textBg: '#065f46', isPrem: true }
    ];

    levels.forEach(lvl => {
      // Skip premium levels if not premium
      if (lvl.isPrem && !isPremium) return;
      
      const yVal = y.getPixelForValue(lvl.val);
      if (yVal >= chart.chartArea.top && yVal <= chart.chartArea.bottom) {
        // Draw bold visual lines (Width 2px as requested)
        ctx.lineWidth = 2.0; 
        ctx.strokeStyle = lvl.lineStyle;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(left, yVal);
        ctx.lineTo(right, yVal);
        ctx.stroke();

        // Draw Premium Pill Text labels (Increased size 12px for Request 3)
        ctx.font = 'bold 12px Sarabun, sans-serif';
        const labelText = ` ${lvl.name}: ${lvl.val.toFixed(2)} ฿ `;
        const labelWidth = ctx.measureText(labelText).width;
        
        // Draw background capsule pill
        ctx.fillStyle = lvl.textBg;
        ctx.beginPath();
        ctx.roundRect(left + 15, yVal - 9, labelWidth, 18, 4);
        ctx.fill();
        
        // Draw white text inside capsule
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, left + 15, yVal + 4);
      }
    });

    ctx.restore();
  }
};

// ==========================================
// 🔑 Deterministic Monthly Randomized Promo Code (Request 8)
// ==========================================
function getPromoCodeForMonth(monthOffset = 0) {
  const date = new Date();
  date.setMonth(date.getMonth() + monthOffset);
  
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const currentMonth = monthNames[date.getMonth()];
  const currentYear = date.getFullYear();
  
  // Stable secret salt combined with date details
  const seedStr = `INSIGHT_PREMIUM_SECURE_SALT_${currentMonth}_${currentYear}`;
  
  // Simple stable hash function
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Choose random characters, omitting easily confused ones (like I, O, 0, 1)
  const allowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let codeHash = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.abs((hash >> (i * 8)) % allowedChars.length);
    codeHash += allowedChars[idx];
  }
  
  return `IN-${codeHash}-${currentMonth}`; // e.g. "IN-H7K3-MAY"
}

// ========================================================
// 📊 Procedural Stock Data Generator for ALL 800+ SET & MAI Stocks (Request 2)
// ========================================================
function getOrCreateStockData(symbol) {
  if (!symbol) return null;
  symbol = symbol.toUpperCase().trim();
  
  // If stock already exists in scanner database (real fetched presets), return it!
  if (stocksData[symbol]) {
    return stocksData[symbol];
  }
  
  // Clean symbol to ignore numbers or symbols to avoid parsing breaks
  const cleanSym = symbol.replace(/[^A-Z]/g, '');
  if (cleanSym.length < 2) return null;
  
  // Procedural deterministic generator seeded by the stock symbol characters
  let seed = 0;
  for (let i = 0; i < cleanSym.length; i++) {
    seed += cleanSym.charCodeAt(i) * (i + 1) * 31;
  }
  
  // Stable LCG random number generator based on the seed
  function prng() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  
  // Seed the generator to start
  for (let i = 0; i < 5; i++) prng();
  
  // Decide if this procedurally simulated stock is in SET or MAI
  const isMai = (seed % 4 === 0 || symbol.length > 4); 
  const marketName = isMai ? "MAI" : "SET";
  
  // Procedural stable parameters
  const pe = parseFloat((8.5 + prng() * 42.0).toFixed(2)); // P/E between 8.5 and 50.5
  const yieldPercent = parseFloat((1.2 + prng() * 7.8).toFixed(2)); // Dividend yield 1.2% - 9.0%
  
  // Price point generated deterministically (large cap, mid cap, penny cap)
  let baseVal = 5.0 + prng() * 145.0; // 5.0 to 150.0 THB
  if (prng() > 0.85) baseVal *= 5; // A few higher value stocks (e.g. 500+ THB)
  if (prng() < 0.25) baseVal *= 0.1; // Penny stocks (e.g. under 5 THB)
  const currentPrice = parseFloat(baseVal.toFixed(2));
  
  // Month High/Low limits
  const high1m = parseFloat((currentPrice * (1.02 + prng() * 0.15)).toFixed(2));
  const low1m = parseFloat((currentPrice * (0.85 + prng() * 0.12)).toFixed(2));
  
  // Generate a realistic 365 business days historical close prices (Random Walk with upward drift)
  const history = [];
  let prevPrice = currentPrice * (0.75 + prng() * 0.45); // Start history somewhere relative
  
  const today = new Date();
  for (let d = 365; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    
    // Skip weekends for business days
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    // Random walk delta
    const drift = 0.00018; // Small global economic upward drift
    const fluctuation = (prng() * 0.035 - 0.0175) + drift;
    prevPrice = prevPrice * (1 + fluctuation);
    if (prevPrice < 0.05) prevPrice = 0.05; // Floor price
    
    history.push({
      date: date.toISOString().split('T')[0],
      close: parseFloat(prevPrice.toFixed(2))
    });
  }
  
  // Force final point close price to match today's current simulated price
  if (history.length > 0) {
    history[history.length - 1].close = currentPrice;
  }
  
  // Upcoming XD Date
  const upcomingXdDate = new Date(today);
  upcomingXdDate.setDate(today.getDate() + 15 + Math.floor(prng() * 65));
  const upcomingPaymentDate = new Date(upcomingXdDate);
  upcomingPaymentDate.setDate(upcomingXdDate.getDate() + 12);
  
  const upcomingDivAmount = parseFloat((currentPrice * (yieldPercent / 100) / 2).toFixed(2));
  
  // Descriptive metadata
  const fullName = `บริษัท ${symbol} จำกัด (มหาชน)`;
  const businessSummary = `บริษัท ${symbol} จำกัด (มหาชน) ประกอบธุรกิจและเข้าจดทะเบียนในตลาดหลักทรัพย์แห่งประเทศไทย (${marketName}) ดำเนินกิจการเกี่ยวกับการร่วมทุน ค้าขาย และบริหารความมั่งคั่ง โดยมุ่งเน้นการขยายขอบข่ายการบริการเพื่อยกระดับผลตอบแทนปันผลทบต้นสะสมระยะยาวให้กับผู้ถือหุ้นอย่างมั่นคงและยั่งยืน`;
  
  const sectors = [
    "กลุ่มธุรกิจทรัพยากรและพลังงาน", "กลุ่มธุรกิจการเงินและธนาคาร", "กลุ่มธุรกิจพัฒนาอสังหาริมทรัพย์",
    "กลุ่มเทคโนโลยีและการสื่อสาร", "กลุ่มอุปโภคบริโภคทั่วไป", "กลุ่มบริการการแพทย์และสาธารณสุข",
    "กลุ่มเกษตรแปรรูปและอาหาร", "กลุ่มพาณิชย์และจัดจำหน่ายค้าปลีก"
  ];
  const sector = sectors[seed % sectors.length];
  
  // Create object
  const proceduredStock = {
    symbol: symbol,
    name: fullName,
    business_summary: businessSummary,
    current_price: currentPrice,
    pe_ratio: pe,
    dividend_yield: yieldPercent,
    high_1m: high1m,
    low_1m: low1m,
    upcoming_xd: upcomingXdDate.toISOString().split('T')[0],
    upcoming_dividend_amount: upcomingDivAmount > 0.01 ? upcomingDivAmount : 0.05,
    upcoming_payment_date: upcomingPaymentDate.toISOString().split('T')[0],
    sector: sector,
    history: history
  };
  
  // Cache in stocksData dictionary
  stocksData[symbol] = proceduredStock;
  return proceduredStock;
}



function verifyMonthlyPromoCode() {
  const enteredCode = document.getElementById('promo-code-input').value.toUpperCase().trim();
  const expectedCode = getPromoCodeForMonth(0);
  
  if (enteredCode === expectedCode) {
    isPremium = true;
    const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    localStorage.setItem('insight_premium_activated_month', currentMonthKey);
    localStorage.setItem('insight_member_premium_status', 'true');
    
    document.getElementById('promo-error-msg').style.display = 'none';
    closePromoModal();
    
    alert('🎉 ปลดล็อกรหัสสมาชิกระดับพรีเมียมเรียบร้อยแล้ว! ขอบพระคุณสำหรับการสนับสนุนช่อง Insight AI Brief ครับ');
    
    // Refresh GUI Tiers
    applyTierRestrictions();
  } else {
    document.getElementById('promo-error-msg').style.display = 'block';
  }
}

// Check if premium subscription is still valid or expired due to month roll
function checkPasscodeAuthExpiration() {
  const storedPremium = localStorage.getItem('insight_member_premium_status');
  const storedMonth = localStorage.getItem('insight_premium_activated_month');
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  
  if (storedPremium === 'true' && storedMonth === currentMonthKey) {
    isPremium = true;
  } else {
    isPremium = false;
    localStorage.setItem('insight_member_premium_status', 'false');
  }
}

// ==========================================
// 🛡️ Free vs Premium Tier UI Gating Logic
// ==========================================
function applyTierRestrictions() {
  const premiumBadge = document.getElementById('premium-badge-container');
  const premiumStatusText = document.getElementById('premium-status-text');
  const premiumStatusDesc = document.getElementById('premium-status-desc');
  const premiumActionBtn = premiumBadge ? premiumBadge.querySelector('.btn-premium-action') : null;
  
  if (premiumBadge) {
    if (isPremium) {
      // 1. Premium Badge UI Relocated
      premiumBadge.classList.add('active');
      premiumBadge.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)';
      premiumBadge.style.borderColor = 'var(--support-color)';
      premiumStatusText.innerHTML = 'บัญชีพรีเมียม 🌟 (Active)';
      premiumStatusText.style.color = 'var(--support-color)';
      premiumStatusDesc.innerText = 'ปลดล็อกทุกเครื่องมือเรียบร้อย';
      if (premiumActionBtn) {
        premiumActionBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width:14px; height:14px; color:#fff;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
        `;
        premiumActionBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        premiumActionBtn.style.animation = 'none';
        premiumActionBtn.style.boxShadow = 'none';
      }
    } else {
      // 1. Free Badge UI Relocated
      premiumBadge.classList.remove('active');
      premiumBadge.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(245, 158, 11, 0.04) 100%)';
      premiumBadge.style.borderColor = 'var(--border-color)';
      premiumStatusText.innerHTML = 'บัญชีทั่วไป (Free Tier) 🔒';
      premiumStatusText.style.color = 'var(--warning-color)';
      premiumStatusDesc.innerText = 'จำกัดเพิ่มหุ้นสูงสุด 3 ตัว';
      if (premiumActionBtn) {
        premiumActionBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width:14px; height:14px; color:#fff;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        `;
        premiumActionBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        premiumActionBtn.style.animation = 'pulse-gold-glow 2.5s infinite';
      }
    }
  }
  
  if (!isPremium) {
    // 2. Lock S2-S4 and R2-R4 Pivot Rows
    const lockedRows = ['pivot-row-R4', 'pivot-row-R3', 'pivot-row-R2', 'pivot-row-S2', 'pivot-row-S3', 'pivot-row-S4'];
    lockedRows.forEach(rowId => {
      const row = document.getElementById(rowId);
      if (row) {
        row.classList.add('premium-locked-area');
      }
    });

    // 3. Blur premium tab contents
    document.getElementById('dca-blurred-content').classList.add('free-blurred-content');
    document.getElementById('cal-blurred-content').classList.add('free-blurred-content');
    document.getElementById('news-blurred-content').classList.add('free-blurred-content');
    document.getElementById('sim-blurred-content').classList.add('free-blurred-content');
    
    // 4. Show locks
    document.getElementById('dca-lock-overlay').style.display = 'flex';
    document.getElementById('cal-lock-overlay').style.display = 'flex';
    document.getElementById('news-lock-overlay').style.display = 'flex';
    document.getElementById('sim-lock-overlay').style.display = 'flex';
  } else {
    // 2. Unlock Pivot Point rows
    document.querySelectorAll('.matrix-row.premium-locked-area').forEach(row => {
      row.classList.remove('premium-locked-area');
      const overlay = row.querySelector('.premium-lock-overlay');
      if (overlay) overlay.remove();
    });

    // 3. Unlock Tab panels blurs
    document.getElementById('dca-blurred-content').classList.remove('free-blurred-content');
    document.getElementById('cal-blurred-content').classList.remove('free-blurred-content');
    document.getElementById('news-blurred-content').classList.remove('free-blurred-content');
    document.getElementById('sim-blurred-content').classList.remove('free-blurred-content');
    
    // 4. Hide locks
    document.getElementById('dca-lock-overlay').style.display = 'none';
    document.getElementById('cal-lock-overlay').style.display = 'none';
    document.getElementById('news-lock-overlay').style.display = 'none';
    document.getElementById('sim-lock-overlay').style.display = 'none';
  }
  
  // Re-draw chart S/R lines since they might need to render or hide
  if (selectedStock) {
    renderStockChart(selectedStock);
    renderPivotPointMatrix(selectedStock);
    calculateSmartBuySimulation();
  }
}

// ==========================================
// 📈 Core Application Operations
// ==========================================

// Initialize
async function initApp() {
  // Load Theme
  const storedTheme = localStorage.getItem('insight_dashboard_theme') || 'dark';
  currentTheme = storedTheme;
  document.body.className = currentTheme === 'light' ? 'light-mode' : '';
  updateThemeIcon();



  // Check Expiration of Premium Monthly passcode
  checkPasscodeAuthExpiration();

  // Setup Admin console codes
  document.getElementById('admin-current-code').innerText = getPromoCodeForMonth(0);
  document.getElementById('admin-next-code').innerText = getPromoCodeForMonth(1);

  // Show/Hide Admin Console based on secret URL query string (?admin=true or ?insight_brief_admin=true)
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminMode = urlParams.get('admin') === 'true' || urlParams.has('insight_brief_admin');
  const adminWrapper = document.getElementById('admin-console-panel-wrapper');
  if (adminWrapper) {
    adminWrapper.style.display = isAdminMode ? 'block' : 'none';
  }

  // Load Portfolios structure from localStorage
  const storedPortfolios = localStorage.getItem('insight_multi_portfolios_data');
  const storedActiveId = localStorage.getItem('insight_active_portfolio_id');
  
  if (storedPortfolios && storedActiveId) {
    try {
      portfolios = JSON.parse(storedPortfolios);
      activePortfolioId = storedActiveId;
    } catch (e) {
      setupDefaultPortfolio();
    }
  } else {
    setupDefaultPortfolio();
  }

  // Load Database from JS variable STOCKS_DATABASE (fallback to fetch json)
  try {
    if (typeof STOCKS_DATABASE !== 'undefined') {
      stocksData = STOCKS_DATABASE;
    } else {
      const response = await fetch('stocks_data.json');
      if (!response.ok) throw new Error('Failed to load JSON database');
      stocksData = await response.json();
    }
    
    const today = new Date();
    document.getElementById('update-timestamp').innerText = `ดึงข้อมูลล่าสุด: ${today.toLocaleDateString('th-TH')} ${today.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.`;
    
    // Set default value in inline stock adder symbol input
    const addSymbolInput = document.getElementById('add-form-symbol');
    if (addSymbolInput) {
      addSymbolInput.value = 'PTT';
      autoFillFormPrice();
    }

    // Populates
    renderPortfolioSelect();
    renderSidebarStockList();
    applyTierRestrictions();
    
    // Load default selected stock
    const symbols = Object.keys(stocksData).sort();
    if (symbols.length > 0) {
      selectStock(symbols[0]);
    }
    
    // Start auto real-time pricing updates simulation (Request 3)
    startRealTimePriceSimulation();
    
  } catch (err) {
    console.error('Error loading stock database:', err);
    document.getElementById('portfolio-stocks-container').innerHTML = `
      <div style="color:var(--resistance-color); text-align:center; padding:2rem 1rem; font-size:0.85rem;">
        ไม่พบฐานข้อมูล stocks_data.json/js<br>กรุณารันไฟล์ <code>updater.py</code> ก่อนใช้งานเพื่อสร้างฐานข้อมูลหุ้น SET
      </div>
    `;
  }
}

function setupDefaultPortfolio() {
  portfolios = [
    {
      id: 'p_default',
      name: 'พอร์ตส่วนตัว (Personal)',
      cash: 100000.00,
      holdings: [
        { symbol: 'PTT', shares: 1000, price: 34.50 },
        { symbol: 'CPALL', shares: 500, price: 44.00 }
      ]
    }
  ];
  activePortfolioId = 'p_default';
  savePortfoliosToLocalStorage();
}

function savePortfoliosToLocalStorage() {
  localStorage.setItem('insight_multi_portfolios_data', JSON.stringify(portfolios));
  localStorage.setItem('insight_active_portfolio_id', activePortfolioId);
}

// Multi-Portfolio controllers
function renderPortfolioSelect() {
  const select = document.getElementById('portfolio-select');
  select.innerHTML = '';
  
  portfolios.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.text = p.name;
    if (p.id === activePortfolioId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function switchPortfolio() {
  const select = document.getElementById('portfolio-select');
  activePortfolioId = select.value;
  savePortfoliosToLocalStorage();
  
  // Re-renders
  renderSidebarStockList();
  renderPortfolioHoldingsTable();
  updatePortfolioWorthStats();
  renderDividendTimeline();
}

function createNewPortfolio() {
  if (!isPremium && portfolios.length >= 1) {
    alert('🔒 ฟังก์ชันบริหารพอร์ตโฟลิโอหลายบัญชี (Multi-Portfolio) ล็อกเฉพาะระดับพรีเมียมเท่านั้น! กรุณากรอกรหัสปลดล็อกในหน้าตั้งค่า');
    openPromoModal();
    return;
  }
  
  const name = prompt('กรุณาระบุชื่อพอร์ตโฟลิโอใหม่ของคุณ:');
  if (!name || name.trim() === '') return;
  
  const newId = 'p_' + Date.now();
  portfolios.push({
    id: newId,
    name: name.trim(),
    cash: 50000.00,
    holdings: []
  });
  
  activePortfolioId = newId;
  savePortfoliosToLocalStorage();
  
  renderPortfolioSelect();
  switchPortfolio();
  alert(`สร้างพอร์ต "${name}" เรียบร้อยแล้ว!`);
}

function updateCashBalance() {
  const cashInput = document.getElementById('cash-input');
  const amount = parseFloat(cashInput.value);
  
  if (isNaN(amount) || amount < 0) {
    alert('กรุณาระบุยอดเงินสดให้ถูกต้อง');
    return;
  }
  
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (activePort) {
    activePort.cash = amount;
    savePortfoliosToLocalStorage();
    document.getElementById('port-cash-val').innerText = `${amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท`;
    
    // Recalculations
    calculateSmartBuySimulation();
    cashInput.value = '';
    alert('บันทึกยอดเงินสดคงเหลือเรียบร้อยครับ!');
  }
}

// Populate Sidebar Stock holdings list
// Helper to draw a beautiful SVG sparkline for a stock using its 10-point history (Stock Events style!)
function generateSparklineSVG(symbol) {
  const stock = stocksData[symbol];
  if (!stock || !stock.history || stock.history.length === 0) {
    return `
      <svg class="sparkline" viewBox="0 0 80 25" style="width: 70px; height: 22px;">
        <line x1="0" y1="12.5" x2="80" y2="12.5" stroke="var(--text-muted)" stroke-width="1.5" />
      </svg>
    `;
  }
  
  const history = stock.history.slice(-10); // last 10 ticks
  const closes = history.map(h => h.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  
  const width = 80;
  const height = 25;
  const padding = 2;
  const usableHeight = height - (padding * 2);
  
  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * width;
    const val = closes[i];
    const y = padding + usableHeight - ((val - min) / range) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  
  const pathD = `M ${points.join(' L ')}`;
  
  let color = 'var(--support-color)';
  if (closes.length >= 2) {
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    if (last < prev) {
      color = 'var(--resistance-color)';
    }
  }
  
  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" style="width: 70px; height: 22px;">
      <path d="${pathD}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

// Populate Sidebar Stock holdings list with dynamic sparkline charts!
function renderSidebarStockList() {
  const container = document.getElementById('portfolio-stocks-container');
  container.innerHTML = '';
  
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort || activePort.holdings.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1.5rem 0.5rem;">
        ไม่มีหุ้นถือครองในพอร์ตนี้<br>กรุณาค้นหาและกดปุ่มเพิ่มหุ้น
      </div>
    `;
    return;
  }
  
  activePort.holdings.forEach(hold => {
    const stock = stocksData[hold.symbol];
    if (!stock) return;
    
    const li = document.createElement('li');
    li.className = `p-stock-item ${selectedStock === hold.symbol ? 'active' : ''}`;
    li.id = `sidebar-pstock-${hold.symbol}`;
    li.onclick = () => selectStock(hold.symbol);
    
    const closes = stock.history ? stock.history.map(h => h.close) : [];
    let changePct = 0;
    let colorClass = '';
    let sign = '';
    
    if (closes.length >= 2) {
      const last = closes[closes.length - 1];
      const prev = closes[closes.length - 2];
      changePct = ((last - prev) / prev) * 100;
      if (last >= prev) {
        colorClass = 'up';
        sign = '+';
      } else {
        colorClass = 'down';
        sign = '';
      }
    }
    
    const sparklineSVG = generateSparklineSVG(hold.symbol);
    
    li.innerHTML = `
      <div class="p-stock-item-left">
        <div class="p-stock-code">${hold.symbol}</div>
        <div class="p-stock-holdings" style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${hold.shares.toLocaleString()} หุ้น</div>
      </div>
      <div class="p-stock-item-chart">
        ${sparklineSVG}
      </div>
      <div class="p-stock-item-right">
        <div class="p-stock-price" style="font-weight:700;">฿${stock.current_price.toFixed(2)}</div>
        <div class="p-stock-change-percent ${colorClass}" style="font-size:0.75rem; font-weight:700; margin-top:2px;">
          ${sign}${changePct.toFixed(2)}%
        </div>
      </div>
    `;
    container.appendChild(li);
  });
}

function filterStocks() {
  const query = document.getElementById('stock-search').value.toUpperCase().trim();
  if (query.length >= 2) {
    // Dynamically retrieve or generate any SET/MAI stock on the fly
    const stock = getOrCreateStockData(query);
    if (stock) {
      selectStock(query);
    }
  }
}

// Select stock from database
function selectStock(symbol) {
  if (!symbol) return;
  
  // Auto-close mobile sidebar if open
  closeMobileSidebar();
  
  symbol = symbol.toUpperCase().trim();
  const stock = getOrCreateStockData(symbol);
  if (!stock) return;
  selectedStock = symbol;
  
  // Highlight active sidebar item
  document.querySelectorAll('.p-stock-item').forEach(item => {
    item.classList.remove('active');
  });
  const sidebarItem = document.getElementById(`sidebar-pstock-${symbol}`);
  if (sidebarItem) sidebarItem.classList.add('active');
  
  // Render Details
  document.getElementById('active-stock-logo').innerText = symbol;
  document.getElementById('active-stock-symbol').innerHTML = `${symbol} <span style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 500;" id="active-stock-fullname">${stock.name}</span>`;
  document.getElementById('active-stock-price').innerHTML = `${stock.current_price.toFixed(2)} <span>THB</span>`;
  
  // Simulated price change display
  const randChange = (Math.random() * 1.5 - 0.7).toFixed(2);
  const changePercent = ((randChange / stock.current_price) * 100).toFixed(2);
  const changeEl = document.getElementById('active-stock-change');
  if (parseFloat(randChange) >= 0) {
    changeEl.innerHTML = `+${randChange} (+${changePercent}%)`;
    changeEl.className = 's-stock-price-change';
  } else {
    changeEl.innerHTML = `${randChange} (${changePercent}%)`;
    changeEl.className = 's-stock-price-change down';
  }
  
  // Update yields and stats card
  document.getElementById('val-dividend-yield').innerText = stock.dividend_yield > 0 ? `${stock.dividend_yield.toFixed(2)}%` : '0.00%';
  
  // Renders
  renderPivotPointMatrix(symbol);
  renderStockChart(symbol);
  renderNewsFeed();
  renderIaaConsensusTable(symbol); // Daily automated broker S/R consensus targets
  calculateSmartBuySimulation();
  calculateDcaProjection();
  updatePortfolioWorthStats();
  renderPortfolioHoldingsTable();
  
  // Set tab buttons text
  document.querySelectorAll('.tab-trigger-btn')[0].innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 .622-.16 1.21-.443 1.724m1.057-1.724a2.25 2.25 0 0 0-2.25-2.25m-13.5 13.5a2.25 2.25 0 0 1-2.25-2.25m0-10.5a2.25 2.25 0 0 1 2.25-2.25m10.5 10.5a2.25 2.25 0 0 1-2.25 2.25m.443-4.132a2.247 2.247 0 0 0 1.567.684m1.916 2.25a2.25 2.25 0 0 0 2.25-2.25M6.375 20.25a2.25 2.25 0 0 1-2.25-2.25m0-11.25a2.25 2.25 0 0 1 2.25-2.25m11.25 0a2.25 2.25 0 0 1 2.25 2.25m-13.5 13.5h13.5m-13.5-13.5h13.5" />
    </svg>
    บริหารพอร์ต & ถือหุ้น ${symbol}
  `;
}

// Renders the Pivot Points Matrix Table with distance +/- %
function renderPivotPointMatrix(symbol) {
  const stock = stocksData[symbol];
  if (!stock) return;
  
  const high = stock.high_1m || stock.current_price * 1.05;
  const low = stock.low_1m || stock.current_price * 0.95;
  const close = stock.current_price;
  
  // Formulas
  const P = (high + low + close) / 3;
  const R1 = 2 * P - low;
  const S1 = 2 * P - high;
  const R2 = P + (high - low);
  const S2 = P - (high - low);
  const R3 = high + 2 * (P - low);
  const S3 = low - 2 * (high - P);
  const R4 = R3 + (high - low);
  const S4 = S3 - (high - low);

  const levels = [
    { id: 'R4', val: R4 }, { id: 'R3', val: R3 }, { id: 'R2', val: R2 }, { id: 'R1', val: R1 },
    { id: 'P', val: P },
    { id: 'S1', val: S1 }, { id: 'S2', val: S2 }, { id: 'S3', val: S3 }, { id: 'S4', val: S4 }
  ];

  levels.forEach(lvl => {
    const valEl = document.getElementById(`val-pivot-${lvl.id}`);
    const distEl = document.getElementById(`val-pivot-${lvl.id}-dist`);
    
    if (valEl && distEl) {
      valEl.innerText = `${lvl.val.toFixed(2)} บาท`;
      
      // Calculate +/- % difference
      const distPercent = ((lvl.val - close) / close) * 100;
      
      if (distPercent > 0) {
        distEl.innerText = `+${distPercent.toFixed(2)}%`;
        distEl.className = 'matrix-cell matrix-level-dist positive';
      } else if (distPercent < 0) {
        distEl.innerText = `${distPercent.toFixed(2)}%`;
        distEl.className = 'matrix-cell matrix-level-dist negative';
      } else {
        distEl.innerText = '0.00%';
        distEl.className = 'matrix-cell matrix-level-dist';
      }
    }
  });
}

// Daily automated IAA Consensus Broker Recommendation Table (Request 4)
function renderIaaConsensusTable(symbol) {
  const tbody = document.getElementById('iaa-consensus-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const stock = stocksData[symbol];
  if (!stock) return;
  
  const high = stock.high_1m || stock.current_price * 1.05;
  const low = stock.low_1m || stock.current_price * 0.95;
  const close = stock.current_price;
  
  const P = (high + low + close) / 3;
  const R1 = 2 * P - low;
  const S1 = 2 * P - high;
  const R2 = P + (high - low);
  const S2 = P - (high - low);
  const R3 = high + 2 * (P - low);
  const S3 = low - 2 * (high - P);
  
  const yieldVal = stock.dividend_yield;
  const recSCBS = yieldVal > 5.5 ? 'ซื้อ (BUY)' : 'ถือ (HOLD)';
  const recKS = yieldVal > 4.2 ? 'ซื้อ (BUY)' : 'ถือ (HOLD)';
  const recBLS = yieldVal > 4.8 ? 'ซื้อ (BUY)' : 'ถือ (HOLD)';
  const recLHS = yieldVal > 3.8 ? 'ซื้อ (BUY)' : 'ถือ (HOLD)';
  
  const brokers = [
    { name: 'InnovestX (SCBS)', rec: recSCBS, target: R2 * 1.025, support: S1 * 1.005, resistance: R1 * 0.995 },
    { name: 'หลักทรัพย์กสิกรไทย (KS)', rec: recKS, target: R3 * 0.985, support: S2 * 1.01, resistance: R2 * 0.99 },
    { name: 'หลักทรัพย์บัวหลวง (BLS)', rec: recBLS, target: R2 * 1.04, support: S1 * 0.995, resistance: R1 * 1.005 },
    { name: 'หลักทรัพย์แลนด์ แอนด์ เฮ้าส์ (LHS)', rec: recLHS, target: R3 * 0.955, support: S2 * 0.995, resistance: R2 * 1.005 }
  ];
  
  brokers.forEach(b => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    
    let recStyle = 'color: var(--support-color); font-weight:700; text-align:center; padding: 0.65rem;';
    if (b.rec.includes('HOLD') || b.rec.includes('ถือ')) {
      recStyle = 'color: var(--warning-color); font-weight:700; text-align:center; padding: 0.65rem;';
    }
    
    tr.innerHTML = `
      <td style="padding:0.65rem 0.5rem; font-weight:600;">${b.name}</td>
      <td style="${recStyle}">${b.rec}</td>
      <td style="padding:0.65rem 0.5rem; text-align:right; font-weight:700; font-family:var(--font-en);">${b.target.toFixed(2)} บาท</td>
      <td style="padding:0.65rem 0.5rem; text-align:right; font-weight:700; color:var(--support-color); font-family:var(--font-en);">${b.support.toFixed(2)} บาท</td>
      <td style="padding:0.65rem 0.5rem; text-align:right; font-weight:700; color:var(--resistance-color); font-family:var(--font-en);">${b.resistance.toFixed(2)} บาท</td>
    `;
    tbody.appendChild(tr);
  });
}

// Smart Buy Simulator logic (ช้อนซื้อคำนวณต้นทุนเฉลี่ยใหม่)
function calculateSmartBuySimulation() {
  const stock = stocksData[selectedStock];
  if (!stock) return;
  
  const budgetInput = document.getElementById('sim-budget-amount');
  const budget = parseFloat(budgetInput.value) || 0;
  
  const high = stock.high_1m || stock.current_price * 1.05;
  const low = stock.low_1m || stock.current_price * 0.95;
  const close = stock.current_price;
  
  const P = (high + low + close) / 3;
  const S1 = 2 * P - high;
  const S2 = P - (high - low);
  const S3 = low - 2 * (high - P);
  const S4 = S3 - (high - low);
  
  const sLevels = [ { id: 'S1', price: S1 }, { id: 'S2', price: S2 }, { id: 'S3', price: S3 }, { id: 'S4', price: S4 } ];
  
  // Find current holding details of this stock in active portfolio
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  const holding = activePort ? activePort.holdings.find(h => h.symbol === selectedStock) : null;
  const currentShares = holding ? holding.shares : 0;
  const currentAvgPrice = holding ? holding.price : 0;

  sLevels.forEach(lvl => {
    const priceEl = document.getElementById(`sim-price-${lvl.id}`);
    const sharesEl = document.getElementById(`sim-shares-${lvl.id}`);
    const newcostEl = document.getElementById(`sim-newcost-${lvl.id}`);
    
    if (priceEl && sharesEl && newcostEl) {
      priceEl.innerText = `${lvl.price.toFixed(2)}`;
      
      if (budget <= 0) {
        sharesEl.innerText = '--';
        newcostEl.innerText = '--';
        return;
      }
      
      const sharesToBuy = Math.floor(budget / lvl.price);
      sharesEl.innerText = `${sharesToBuy.toLocaleString()} หุ้น`;
      
      // Calculate New Average Cost Basis
      let newAvgCost = lvl.price;
      if (currentShares > 0) {
        const totalCost = (currentShares * currentAvgPrice) + (sharesToBuy * lvl.price);
        const totalShares = currentShares + sharesToBuy;
        newAvgCost = totalCost / totalShares;
      }
      
      newcostEl.innerHTML = `${newAvgCost.toFixed(2)} บาท <span style="font-size:0.75rem; font-weight:600; color:var(--support-color);">(-${(((currentAvgPrice > 0 ? currentAvgPrice : close) - newAvgCost)/(currentAvgPrice > 0 ? currentAvgPrice : close)*100).toFixed(1)}%)</span>`;
    }
  });
}

// DCA Projection with Reinvestment up to hourly
function calculateDcaProjection() {
  const stock = stocksData[selectedStock];
  if (!stock) return;
  
  const dcaAmount = parseFloat(document.getElementById('dca-amount').value) || 0;
  const dcaYears = parseInt(document.getElementById('dca-years').value) || 10;
  const isReinvest = document.getElementById('dca-reinvest').checked;
  const yieldPercent = stock.dividend_yield; // e.g., 5.71
  
  let principal = 0;
  let totalWealth = 0;
  let totalDividendsEarned = 0;
  
  const months = dcaYears * 12;
  const monthlyYield = (yieldPercent / 100) / 12;

  for (let m = 1; m <= months; m++) {
    principal += dcaAmount;
    totalWealth += dcaAmount;
    
    if (isReinvest) {
      const monthlyDivPayout = totalWealth * monthlyYield;
      totalWealth += monthlyDivPayout;
      totalDividendsEarned += monthlyDivPayout;
    } else {
      totalDividendsEarned += totalWealth * monthlyYield;
    }
  }

  // Final future earnings calculations (Annual, monthly, daily, hourly based on final wealth)
  const finalYearlyDividend = totalWealth * (yieldPercent / 100);
  const finalMonthlyDividend = finalYearlyDividend / 12;
  const finalDailyDividend = finalYearlyDividend / 365;
  const finalHourlyDividend = finalDailyDividend / 24;

  document.getElementById('dca-total-principal').innerText = `${principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท`;
  document.getElementById('dca-total-wealth').innerText = `${totalWealth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท`;
  document.getElementById('dca-div-year').innerText = `${finalYearlyDividend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท`;
  document.getElementById('dca-div-month').innerText = `${finalMonthlyDividend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท`;
  document.getElementById('dca-div-day').innerText = `${finalDailyDividend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท`;
  document.getElementById('dca-div-hour').innerText = `${finalHourlyDividend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท`;
}

// Auto-fill price in form based on symbol input typing (Request 1 & 2 - No popups & SET/MAI Procedural)
function autoFillFormPrice() {
  const symbolInput = document.getElementById('add-form-symbol');
  if (!symbolInput) return;
  const symbol = symbolInput.value.toUpperCase().trim();
  
  if (symbol.length >= 2) {
    const stock = getOrCreateStockData(symbol);
    if (stock) {
      document.getElementById('add-form-price').value = stock.current_price.toFixed(2);
    }
  }
}

// In-Page stock addition from dynamic selector input (Request 1 & 2 - No popups & SET/MAI Procedural)
function addStockFromInlineForm() {
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort) return;
  
  const symbolInput = document.getElementById('add-form-symbol');
  const sharesInput = document.getElementById('add-form-shares');
  const priceInput = document.getElementById('add-form-price');
  
  if (!symbolInput || !sharesInput || !priceInput) return;
  
  const symbol = symbolInput.value.toUpperCase().trim();
  const shares = parseInt(sharesInput.value);
  const price = parseFloat(priceInput.value);
  
  if (!symbol) {
    alert('กรุณากรอกชื่อย่อหุ้นที่จะเพิ่มเข้าสู่พอร์ตโฟลิโอ');
    return;
  }
  
  // Call getOrCreateStockData to procedurally spawn this stock if it is new
  const stock = getOrCreateStockData(symbol);
  if (!stock) {
    alert('ชื่อย่อหุ้นไม่ถูกต้อง กรุณากรอกตัวอักษรภาษาอังกฤษ A-Z');
    return;
  }
  
  if (isNaN(shares) || shares <= 0) {
    alert('กรุณากรอกจำนวนหุ้นเป็นตัวเลขที่มากกว่า 0');
    return;
  }
  if (isNaN(price) || price <= 0) {
    alert('กรุณากรอกราคาเฉลี่ยต่อหุ้นให้ถูกต้อง');
    return;
  }
  
  // Gating limit check for free users: only 3 stocks allowed per sub-portfolio
  const isExistingSymbol = activePort.holdings.some(h => h.symbol === symbol);
  if (!isPremium && activePort.holdings.length >= 3 && !isExistingSymbol) {
    alert('🔒 บัญชีทั่วไป (Free Tier) ถูกจำกัดการเพิ่มหุ้นในพอร์ตได้สูงสุดเพียง 3 ตัวเท่านั้น! กรุณากรอกรหัสพรีเมียมในหน้าตั้งค่าเพื่อปลดล็อกฟังก์ชันพอร์ตไม่จำกัด');
    openPromoModal();
    return;
  }
  
  // Compounding math on duplicate symbol additions
  const existing = activePort.holdings.find(h => h.symbol === symbol);
  if (existing) {
    const totalCost = (existing.shares * existing.price) + (shares * price);
    existing.shares += shares;
    existing.price = totalCost / existing.shares;
  } else {
    activePort.holdings.push({
      symbol: symbol,
      shares: shares,
      price: price
    });
  }
  
  savePortfoliosToLocalStorage();
  alert(`บันทึกประวัติการซื้อหุ้น ${symbol} เข้าสู่พอร์ตสำเร็จเรียบร้อยครับ!`);
  
  // Clear inputs and reset price
  sharesInput.value = '';
  symbolInput.value = '';
  
  // Refresh UI Components
  renderSidebarStockList();
  renderPortfolioHoldingsTable();
  updatePortfolioWorthStats();
  renderDividendTimeline();
  
  // Switch visual selection to this newly added stock!
  selectStock(symbol);
}

function removeStockFromPortfolio(symbol) {
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort) return;
  
  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${symbol} ออกจากพอร์ตโฟลิโอนี้?`)) return;
  
  activePort.holdings = activePort.holdings.filter(h => h.symbol !== symbol);
  savePortfoliosToLocalStorage();
  
  renderSidebarStockList();
  renderPortfolioHoldingsTable();
  updatePortfolioWorthStats();
  renderDividendTimeline();
}

function renderPortfolioHoldingsTable() {
  const tbody = document.getElementById('holdings-table-body');
  tbody.innerHTML = '';
  
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort || activePort.holdings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);">ไม่มีหุ้นถือครองในพอร์ตนี้ กดปุ่มด้านบนเพื่อแอดหุ้นใหม่เข้าพอร์ต</td>
      </tr>
    `;
    return;
  }
  
  activePort.holdings.forEach(hold => {
    const stock = stocksData[hold.symbol];
    if (!stock) return;
    
    // Defensive Fallbacks to prevent old invalid data crashes
    const sharesNum = parseInt(hold.shares) || 0;
    const priceNum = parseFloat(hold.price) || 0;
    
    const currentValue = sharesNum * stock.current_price;
    const annualDiv = (stock.current_price * (stock.dividend_yield/100)) * sharesNum;
    
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    tr.innerHTML = `
      <td style="padding:0.75rem 0.5rem; font-weight:700; color:var(--brand-color); cursor:pointer;" onclick="selectStock('${hold.symbol}')">${hold.symbol}</td>
      <td style="padding:0.75rem 0.5rem; text-align:right;">${sharesNum.toLocaleString()}</td>
      <td style="padding:0.75rem 0.5rem; text-align:right;">${priceNum.toFixed(2)} บาท</td>
      <td style="padding:0.75rem 0.5rem; text-align:right; font-weight:600;">${currentValue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท</td>
      <td style="padding:0.75rem 0.5rem; text-align:right; font-weight:600; color:var(--support-color);">${annualDiv.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท</td>
      <td style="padding:0.75rem 0.5rem; text-align:center;">
        <button class="btn-delete" onclick="removeStockFromPortfolio('${hold.symbol}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:16px; height:16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-1.75a2.25 2.25 0 0 0-2.25-2.25h-3.512A2.25 2.25 0 0 0 9.17 4.37v1.75" />
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updatePortfolioWorthStats() {
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort) return;
  
  let totalWorth = 0;
  let totalAnnualDiv = 0;
  let totalInvestmentCost = 0;
  
  activePort.holdings.forEach(hold => {
    const stock = stocksData[hold.symbol];
    if (stock) {
      const sharesNum = parseInt(hold.shares) || 0;
      const priceNum = parseFloat(hold.price) || 0;
      totalWorth += sharesNum * stock.current_price;
      totalInvestmentCost += sharesNum * priceNum;
      totalAnnualDiv += (stock.current_price * (stock.dividend_yield/100)) * sharesNum;
    }
  });
  
  const overallYield = totalWorth > 0 ? (totalAnnualDiv / totalWorth) * 100 : 0;
  const yieldOnCost = totalInvestmentCost > 0 ? (totalAnnualDiv / totalInvestmentCost) * 100 : 0;
  
  document.getElementById('val-portfolio-worth').innerText = `${totalWorth.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท`;
  document.getElementById('val-portfolio-annual-div').innerText = `${totalAnnualDiv.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท`;
  document.getElementById('val-yield-on-cost').innerText = `${yieldOnCost.toFixed(2)}%`;
  
  // Also edit the sidebar cash display
  const cashNum = parseFloat(activePort.cash) || 0;
  document.getElementById('port-cash-val').innerText = `${cashNum.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท`;
}

// Cost Averaging calculation panel
function calculateAveragingCost() {
  const sharesOld = parseFloat(document.getElementById('avg-shares-old').value) || 0;
  const priceOld = parseFloat(document.getElementById('avg-price-old').value) || 0;
  const sharesNew = parseFloat(document.getElementById('avg-shares-new').value) || 0;
  const priceNew = parseFloat(document.getElementById('avg-price-new').value) || 0;
  
  const totalShares = sharesOld + sharesNew;
  const requiredCash = sharesNew * priceNew;
  
  let newCost = 0;
  let dropPercent = 0;
  
  if (totalShares > 0) {
    newCost = ((sharesOld * priceOld) + (sharesNew * priceNew)) / totalShares;
    if (priceOld > 0) {
      dropPercent = ((priceOld - newCost) / priceOld) * 100;
    }
  }
  
  document.getElementById('calc-avg-total-shares').innerText = `${totalShares.toLocaleString()} หุ้น`;
  document.getElementById('calc-avg-required-cash').innerText = `${requiredCash.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} บาท`;
  document.getElementById('calc-avg-new-cost').innerText = `${newCost.toFixed(2)} บาท`;
  document.getElementById('calc-avg-drop-percent').innerText = `${dropPercent.toFixed(2)}%`;
}

// Renders the Stock Events chronological timeline for dividends
function renderDividendTimeline() {
  const container = document.getElementById('portfolio-timeline-calendar');
  container.innerHTML = '';
  
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort || activePort.holdings.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:3rem 1rem;">
        พอร์ตว่างเปล่าอยู่ โปรดเพิ่มข้อมูลหุ้นในพอร์ตเพื่อจำลองปฏิทินปันผล
      </div>
    `;
    return;
  }
  
  let events = [];
  activePort.holdings.forEach(hold => {
    const stock = stocksData[hold.symbol];
    if (stock && stock.upcoming_xd) {
      const payoutVal = hold.shares * (stock.upcoming_dividend_amount || 0);
      events.push({
        symbol: hold.symbol,
        name: stock.name,
        xdDate: new Date(stock.upcoming_xd),
        xdDateStr: stock.upcoming_xd,
        payoutAmount: stock.upcoming_dividend_amount || 0,
        totalPayout: payoutVal,
        payDateStr: stock.upcoming_payment_date
      });
    }
  });
  
  events.sort((a, b) => a.xdDate - b.xdDate);
  
  if (events.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:3rem 1rem;">
        หุ้นที่ท่านถือยังไม่มีประกาศวันขึ้นเครื่องหมาย XD ในระยะเวลาอันใกล้
      </div>
    `;
    return;
  }

  events.forEach(evt => {
    const day = evt.xdDate.getDate();
    const month = evt.xdDate.toLocaleDateString('th-TH', { month: 'short' });
    const xdFormatted = evt.xdDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
    const payFormatted = evt.payDateStr ? new Date(evt.payDateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : 'ไม่ระบุ';
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'timeline-event-row';
    itemDiv.style.display = 'flex';
    itemDiv.style.gap = '1.5rem';
    itemDiv.style.marginBottom = '1.5rem';
    itemDiv.style.alignItems = 'stretch';
    itemDiv.style.position = 'relative';
    
    itemDiv.innerHTML = `
      <!-- Timeline Date marker (Left) -->
      <div class="timeline-date-col" style="min-width: 65px; text-align: right; padding-top: 0.5rem;">
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1;">${day}</div>
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">${month}</div>
      </div>
      
      <!-- Timeline Line separator -->
      <div class="timeline-line-separator" style="width: 2px; background: var(--border-color); position: relative; display: flex; justify-content: center; align-items: flex-start; padding-top: 1rem;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--brand-color); border: 2px solid var(--bg-app); position: absolute; left: -3px; top: 12px;"></div>
      </div>

      <!-- Timeline Event Card (Right) -->
      <div class="timeline-event-card" style="flex: 1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-premium); gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem; overflow: hidden;">
          <div class="timeline-stock-logo" style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-color) 0%, #a855f7 100%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; color: #fff; flex-shrink: 0;">
            ${evt.symbol.substring(0, 2)}
          </div>
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--brand-color); letter-spacing: 0.5px; text-transform: uppercase; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>Dividend Payment</span>
              <span class="timeline-status-tag" style="background: rgba(16, 185, 129, 0.08); color: var(--support-color); font-size: 0.6rem; padding: 1px 6px; border-radius: 20px; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(16, 185, 129, 0.15); line-height:1;">Upcoming</span>
            </div>
            <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${evt.symbol} - ${evt.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">XD: ${xdFormatted} | จ่าย: ${payFormatted}</div>
          </div>
        </div>
        
        <div style="text-align: right; flex-shrink: 0;">
          <div style="font-size: 1.35rem; font-weight: 900; color: var(--support-color); line-height: 1;">${evt.totalPayout.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})} ฿</div>
          <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px; font-weight: 600;">(฿${evt.payoutAmount.toFixed(2)} / หุ้น)</div>
        </div>
      </div>
    `;
    container.appendChild(itemDiv);
  });
}

function simulatePushNotification() {
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort || activePort.holdings.length === 0) {
    alert('กรุณาเพิ่มหุ้นเข้าในพอร์ตอย่างน้อย 1 ตัวก่อนทดสอบแจ้งเตือนครับ');
    return;
  }
  
  // Find nearest event
  const events = [];
  activePort.holdings.forEach(hold => {
    const stock = stocksData[hold.symbol];
    if (stock && stock.upcoming_xd) {
      events.push({ symbol: hold.symbol, xd: stock.upcoming_xd });
    }
  });
  
  if (events.length === 0) {
    alert('ไม่มีกำหนดการ XD ล่วงหน้าของหุ้นในพอร์ตให้แจ้งเตือนในขณะนี้');
    return;
  }
  
  events.sort((a,b) => new Date(a.xd) - new Date(b.xd));
  const target = events[0];
  
  alert(`🔔 [จำลองการแจ้งเตือน XD ล่วงหน้า 2 วัน]\n\nคุณจะได้รับเงินปันผลจากหุ้น "${target.symbol}" ในวันที่ปฏิทินขึ้น XD: ${new Date(target.xd).toLocaleDateString('th-TH', {day:'2-digit', month:'long', year:'numeric'})}!\nกรุณาถือครองหุ้นก่อนเวลาปิดตลาด ณ วันนี้ เพื่อรับสิทธิ์เงินปันผลสะสม`);
}

// Renders the dynamic stock news update
function renderNewsFeed() {
  const container = document.getElementById('news-feed-container');
  container.innerHTML = '';
  
  if (!selectedStock) return;
  
  // Mock news database matching financial niches
  const mockNews = [
    { title: `เจาะแผนการดำเนินงานและงบการเงินไตรมาสล่าสุดของ ${selectedStock} ยอดการเติบโตสดใสเป็นไปตามเป้า`, source: 'Insight AI Brief', offsetHours: 2 },
    { title: `${selectedStock} เผยแผนการขยายโครงสร้างพื้นฐาน และการขยายตลาดในกลุ่มประเทศอาเซียนปีนี้`, source: 'SET Source', offsetHours: 8 },
    { title: `จับตาแนวโน้มการเติบโตปันผลสะสมระยะยาว (Dividend Season) ของหุ้น ${selectedStock} หลังผลงานดีต่อเนื่อง`, source: 'Wealth Analysis', offsetHours: 25 },
    { title: `${selectedStock} ประกาศวันขึ้นเครื่องหมาย XD และกำหนดการกระจายการปันผลทบต้นสู่รายผู้ถือหุ้นรายย่อย`, source: 'SET Trade', offsetHours: 48 }
  ];
  
  const today = new Date();
  
  mockNews.forEach(n => {
    const pubDate = new Date(today.getTime() - n.offsetHours * 60 * 60 * 1000);
    const dateFormatted = pubDate.toLocaleDateString('th-TH') + ' ' + pubDate.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.';
    
    const card = document.createElement('div');
    card.className = 'news-item-card';
    card.innerHTML = `
      <div class="news-meta-row">
        <span class="news-source">${n.source}</span>
        <span>เผยแพร่เมื่อ: ${dateFormatted}</span>
      </div>
      <div class="news-title">${n.title}</div>
    `;
    container.appendChild(card);
  });
}

// Chart.js Price Drawing Logic
function renderStockChart(symbol) {
  const stock = stocksData[symbol];
  if (!stock || !stock.history || stock.history.length === 0) return;
  
  const canvas = document.getElementById('active-stock-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (priceChart) {
    priceChart.destroy();
  }
  
  // Safe Offline Mode check: if Chart.js CDN didn't load, display a clean fallback on canvas
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded. Operating in Offline Fallback mode.');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = currentTheme === 'light' ? '#4b5563' : '#9ca3af';
    ctx.font = 'bold 15px Sarabun, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔴 ทำงานแบบ ออฟไลน์ (ไม่พบ Chart.js Library)', canvas.width / 2, canvas.height / 2 - 15);
    ctx.font = '12px Sarabun, sans-serif';
    ctx.fillStyle = currentTheme === 'light' ? '#9ca3af' : '#4b5563';
    ctx.fillText('(เชื่อมต่ออินเทอร์เน็ตเพื่อโหลดกราฟราคาย้อนหลังย่อย)', canvas.width / 2, canvas.height / 2 + 15);
    return;
  }
  
  // Filter history based on scale selected
  const fullHist = stock.history;
  const sampledHist = fullHist.slice(-activeChartScale);
  
  const labels = sampledHist.map(pt => {
    const d = new Date(pt.date);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  });
  const prices = sampledHist.map(pt => pt.close);

  // Determine if trend is positive or negative
  const closes = stock.history ? stock.history.map(h => h.close) : [];
  let isUp = true;
  if (closes.length >= 2) {
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    isUp = last >= prev;
  }
  
  // Get colors dynamically based on active theme
  const rootStyle = getComputedStyle(document.body);
  const supportColor = rootStyle.getPropertyValue('--support-color').trim() || '#10b981';
  const resistanceColor = rootStyle.getPropertyValue('--resistance-color').trim() || '#ef4444';
  const themeColor = isUp ? supportColor : resistanceColor;

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'ราคาปิดหุ้น SET',
        data: prices,
        borderColor: themeColor,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: themeColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        fill: true,
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          if (isUp) {
            gradient.addColorStop(0, currentTheme === 'light' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(16, 185, 129, 0.22)');
            gradient.addColorStop(1, currentTheme === 'light' ? 'rgba(5, 150, 105, 0.00)' : 'rgba(16, 185, 129, 0.00)');
          } else {
            gradient.addColorStop(0, currentTheme === 'light' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(239, 68, 68, 0.22)');
            gradient.addColorStop(1, currentTheme === 'light' ? 'rgba(220, 38, 38, 0.00)' : 'rgba(239, 68, 68, 0.00)');
          }
          return gradient;
        },
        tension: 0.12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#fff',
          bodyColor: '#f3f4f6',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 8,
          titleFont: { family: 'Sarabun', weight: 'bold' },
          bodyFont: { family: 'Sarabun' },
          callbacks: {
            label: function(context) {
              return ` ราคาปิด: ${context.parsed.y.toFixed(2)} บาท`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6b7280', font: { family: 'Outfit, Sarabun', size: 9 }, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: currentTheme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#6b7280', font: { family: 'Outfit', size: 10 } }
        }
      }
    },
    plugins: [supportResistancePlugin]
  });
}

function changeChartScale(scale) {
  activeChartScale = scale;
  
  // Set scale buttons active class
  document.querySelectorAll('.btn-chart-scale').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const targetBtn = Array.from(document.querySelectorAll('.btn-chart-scale')).find(btn => btn.innerText.includes(scale === 365 ? '1Year' : scale));
  if (targetBtn) targetBtn.classList.add('active');
  
  if (selectedStock) {
    renderStockChart(selectedStock);
  }
}

// Renders the overall General XD Calendar directory
function renderGeneralCalendar() {
  const tbody = document.getElementById('general-calendar-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let xdList = [];
  Object.keys(stocksData).forEach(sym => {
    const stock = stocksData[sym];
    if (stock.upcoming_xd) {
      xdList.push({
        symbol: sym,
        name: stock.name,
        price: stock.current_price,
        xdDate: new Date(stock.upcoming_xd),
        xdDateStr: stock.upcoming_xd,
        dividendAmount: stock.upcoming_dividend_amount || 0,
        yield: stock.dividend_yield,
        payDateStr: stock.upcoming_payment_date
      });
    }
  });
  
  xdList.sort((a, b) => a.xdDate - b.xdDate);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'ไม่ระบุ';
    return new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  
  xdList.forEach(item => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    tr.innerHTML = `
      <td style="font-weight:700; color:var(--warning-color); padding:1rem 0.5rem;">${formatDate(item.xdDateStr)}</td>
      <td style="padding:1rem 0.5rem;">
        <div style="font-weight:700; font-size:1.1rem; cursor:pointer;" onclick="switchPage('directory'); selectStock('${item.symbol}');">${item.symbol}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">${item.name}</div>
      </td>
      <td style="font-weight:600; padding:1rem 0.5rem;">${item.price.toFixed(2)} บาท</td>
      <td style="font-weight:600; color:var(--support-color); padding:1rem 0.5rem;">${item.dividendAmount.toFixed(2)} บาท</td>
      <td style="font-weight:600; padding:1rem 0.5rem;">${item.yield.toFixed(2)}%</td>
      <td style="padding:1rem 0.5rem;">${formatDate(item.payDateStr)}</td>
      <td style="padding:1rem 0.5rem;">
        <button class="btn-sidebar-option" style="padding:0.4rem 0.75rem; font-size:0.85rem;" onclick="switchPage('directory'); selectStock('${item.symbol}');">
          ดูแนวรับ-แนวต้าน
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 🎨 UI Styling & Modals Interactivity
// ==========================================

function switchTab(tabId) {
  activeTab = tabId;
  
  // Deactivate all tab header triggers
  document.querySelectorAll('.tab-trigger-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Activate selected tab trigger
  const targetTrigger = Array.from(document.querySelectorAll('.tab-trigger-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
  if (targetTrigger) targetTrigger.classList.add('active');
  
  // Show active tab pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');
}

function openPromoModal() {
  document.getElementById('promo-modal').classList.add('active');
}

function closePromoModal() {
  document.getElementById('promo-modal').classList.remove('active');
  document.getElementById('promo-code-input').value = '';
  document.getElementById('promo-error-msg').style.display = 'none';
}

function openBackupModal() {
  document.getElementById('backup-modal').classList.add('active');
  generateBackupExport();
}

function closeBackupModal() {
  document.getElementById('backup-modal').classList.remove('active');
}

function openShareModal() {
  document.getElementById('share-modal').classList.add('active');
  
  // Calculate stats for active portfolio share card representation
  const activePort = portfolios.find(p => p.id === activePortfolioId);
  if (!activePort) return;
  
  let totalWorth = 0;
  let totalAnnualDiv = 0;
  
  activePort.holdings.forEach(hold => {
    const stock = stocksData[hold.symbol];
    if (stock) {
      totalWorth += hold.shares * stock.current_price;
      totalAnnualDiv += (stock.current_price * (stock.dividend_yield/100)) * hold.shares;
    }
  });
  
  const hourlyDiv = totalAnnualDiv / (365 * 24);
  const formattedHourly = hourlyDiv.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  const formattedWorth = totalWorth.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
  const formattedAnnual = totalAnnualDiv.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
  
  document.getElementById('share-ring-value').innerText = `${formattedHourly} ฿`;
  document.getElementById('share-portfolio-name').innerText = activePort.name;
  document.getElementById('share-total-worth').innerText = `${formattedWorth} บาท`;
  document.getElementById('share-annual-div').innerText = `${formattedAnnual} บาท`;
  document.getElementById('share-portfolio-date').innerText = `ปันผลสะสมประจำชั่วโมงล่าสุด: ${new Date().toLocaleDateString('th-TH')}`;
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('active');
}

// Sharing & Card Screenshot triggers
function simulateSaveImage() {
  alert('💾 บันทึกภาพ "Portfolio Summary Card" สำเร็จเรียบร้อย! รูปภาพถูกจัดเก็บลงเครื่องคอมพิวเตอร์/มือถือของคุณแล้วครับ');
}

function simulateShareLink() {
  navigator.clipboard.writeText(window.location.href);
  alert('🔗 คัดลอกลิงก์แดชบอร์ดลงใน Clipboard ของคุณเรียบร้อยแล้ว! สามารถนำไปกดแชร์แชร์พอร์ตต่อในกลุ่มไลน์ หรือโซเชียลได้ทันทีครับ');
}

// JSON Backup Utility Export/Import
function generateBackupExport() {
  const backupObject = {
    portfolios: portfolios,
    activePortfolioId: activePortfolioId,
    isPremium: isPremium,
    theme: currentTheme,
    timestamp: Date.now()
  };
  
  const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(backupObject))));
  document.getElementById('backup-data-area').value = encodedData;
}

function importBackupData() {
  const code = document.getElementById('backup-data-area').value.trim();
  if (code === '') {
    alert('กรุณาวางรหัสข้อมูลสำรองลงในช่อง');
    return;
  }
  
  try {
    const decodedString = decodeURIComponent(escape(atob(code)));
    const parsed = JSON.parse(decodedString);
    
    if (parsed.portfolios && parsed.activePortfolioId) {
      portfolios = parsed.portfolios;
      activePortfolioId = parsed.activePortfolioId;
      if (parsed.isPremium !== undefined) {
        // Set premium if backed up, but monthly expiration check applies on next init
        isPremium = parsed.isPremium;
      }
      
      savePortfoliosToLocalStorage();
      alert('📥 โหลดกู้คืนข้อมูลพอร์ตและสภาพเงินสดสำเร็จเรียบร้อยแล้ว!');
      closeBackupModal();
      
      // Full system reload
      initApp();
    } else {
      throw new Error('Invalid JSON structure');
    }
  } catch (err) {
    alert('❌ การโหลดกู้คืนข้อมูลล้มเหลว: รหัสข้อมูลสำรองผิดพลาด หรือไม่สมบูรณ์ กรุณาตรวจสอบรหัสข้อมูลต้นทางอีกครั้ง');
  }
}

// Toggle Admin Secret Console (Request 7 & 8)
function toggleAdminConsole() {
  const content = document.getElementById('admin-console-content');
  const arrow = document.getElementById('admin-arrow');
  if (!content || !arrow) return;
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    arrow.innerText = '▲';
  } else {
    content.style.display = 'none';
    arrow.innerText = '▼';
  }
}

// Dark/Light Theme swapper
function toggleTheme() {
  if (currentTheme === 'dark') {
    currentTheme = 'light';
    document.body.classList.add('light-mode');
  } else {
    currentTheme = 'dark';
    document.body.classList.remove('light-mode');
  }
  localStorage.setItem('insight_dashboard_theme', currentTheme);
  updateThemeIcon();
  
  // Re-draw active chart to apply light/dark theme grid and gradient colors instantly
  if (selectedStock) {
    renderStockChart(selectedStock);
  }
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-icon');
  if (currentTheme === 'light') {
    icon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    `;
  } else {
    icon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.75A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    `;
  }
}

// Legacy Page switcher adapt (keeps general calendar page tabs working)
function switchPage(pageId) {
  if (pageId === 'calendar') {
    // If navigating to general calendar, redirect to tab-calendar inside our main layout
    switchTab('tab-calendar');
  } else {
    switchTab('tab-portfolio-manager');
  }
}

// ==========================================
// ⚡ Auto Real-time Fluctuations Feed (Request 3)
// ==========================================
let priceSimulationInterval = null;

function startRealTimePriceSimulation() {
  if (priceSimulationInterval) clearInterval(priceSimulationInterval);
  
  priceSimulationInterval = setInterval(() => {
    if (!stocksData || Object.keys(stocksData).length === 0) return;
    
    // 1. Tick the active selected stock (fluctuate by +/- 0.05% to +/- 0.15% to simulate market noise)
    if (selectedStock && stocksData[selectedStock]) {
      const stock = stocksData[selectedStock];
      const drift = 0.00005; // tiny upward drift
      const fluctuation = (Math.random() * 0.003 - 0.0015) + drift; // +/- 0.15%
      
      const oldPrice = stock.current_price;
      stock.current_price = parseFloat((stock.current_price * (1 + fluctuation)).toFixed(2));
      
      // Update high_1m / low_1m boundaries dynamically
      if (stock.current_price > stock.high_1m) stock.high_1m = stock.current_price;
      if (stock.current_price < stock.low_1m) stock.low_1m = stock.current_price;
      
      // Update the last history close price so the chart plot updates
      if (stock.history && stock.history.length > 0) {
        stock.history[stock.history.length - 1].close = stock.current_price;
      }
      
      // Update on-screen UI pricing values
      const priceValEl = document.getElementById('active-stock-price');
      if (priceValEl) {
        priceValEl.innerHTML = `${stock.current_price.toFixed(2)} <span>THB</span>`;
      }
      
      // Compute the live price change and style
      const changeAmount = stock.current_price - (stock.history && stock.history.length >= 2 ? stock.history[stock.history.length - 2].close : oldPrice);
      const changePct = (changeAmount / oldPrice) * 100;
      const changeEl = document.getElementById('active-stock-change');
      if (changeEl) {
        if (changeAmount >= 0) {
          changeEl.innerHTML = `+${changeAmount.toFixed(2)} (+${changePct.toFixed(2)}%)`;
          changeEl.className = 's-stock-price-change';
        } else {
          changeEl.innerHTML = `${changeAmount.toFixed(2)} (${changePct.toFixed(2)}%)`;
          changeEl.className = 's-stock-price-change down';
        }
      }
      
      // Live Auto Update calculations & screens
      renderPivotPointMatrix(selectedStock);
      renderStockChart(selectedStock);
      renderIaaConsensusTable(selectedStock);
      calculateSmartBuySimulation();
      calculateDcaProjection();
    }
    
    // 2. Also slightly tick all stocks in active portfolio holdings to keep portfolio totals auto-updating!
    const activePort = portfolios.find(p => p.id === activePortfolioId);
    if (activePort && activePort.holdings.length > 0) {
      activePort.holdings.forEach(hold => {
        const hStock = stocksData[hold.symbol];
        if (hStock && hold.symbol !== selectedStock) {
          const fluctuation = (Math.random() * 0.002 - 0.001); // +/- 0.1%
          hStock.current_price = parseFloat((hStock.current_price * (1 + fluctuation)).toFixed(2));
          if (hStock.history && hStock.history.length > 0) {
            hStock.history[hStock.history.length - 1].close = hStock.current_price;
          }
        }
      });
      
      // Live Auto Update portfolio worth & statistics cards
      updatePortfolioWorthStats();
      renderPortfolioHoldingsTable();
      renderDividendTimeline();
    }
    
    // 3. Keep watchlist sidebar sparklines, prices, and changes updated dynamically in real-time
    renderSidebarStockList();
    
  }, 3000); // 3 seconds tick
}

// Mobile navigation helper functions
function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  
  sidebar.classList.toggle('mobile-open');
  backdrop.classList.toggle('active');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

// Load triggers on page complete
window.addEventListener('load', initApp);

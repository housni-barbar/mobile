/* دفتر درج المحل — vanilla JavaScript, local-only */

const storageKey = 'shop-drawer-ledger-v1';

const fallbackState = {
    openingBalances: { LBP: 0, USD: 0 },
    physicalCash: { LBP: '', USD: '' },
    transactions: [],
};

const state = loadState();
const elements = {};

function toFiniteNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function inputValueOrEmpty(value) {
    return value === '' || value === null || value === undefined || Number.isNaN(Number(value))
        ? ''
        : String(value);
}

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function nowTimeString() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function loadState() {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return structuredState(fallbackState);

        const parsed = JSON.parse(raw);

        /* Keep compatibility with the first scalar shape:
           openingBalance + scalar physicalCash. */
        const hasScalarPhysicalCash = parsed.physicalCash !== undefined
            && (typeof parsed.physicalCash !== 'object' || parsed.physicalCash === null);
        if (parsed.openingBalance !== undefined || hasScalarPhysicalCash) {
            return {
                openingBalances: {
                    LBP: toFiniteNumber(parsed.openingBalance, 0),
                    USD: 0,
                },
                physicalCash: {
                    LBP: parsed.physicalCash === '' || parsed.physicalCash === undefined
                        ? ''
                        : inputValueOrEmpty(parsed.physicalCash),
                    USD: '',
                },
                transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            };
        }

        return {
            openingBalances: {
                ...fallbackState.openingBalances,
                ...(parsed.openingBalances || {}),
            },
            physicalCash: {
                ...fallbackState.physicalCash,
                ...(parsed.physicalCash || {}),
            },
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        };
    } catch {
        return structuredState(fallbackState);
    }
}

function structuredState(source) {
    return {
        openingBalances: { ...source.openingBalances },
        physicalCash: { ...source.physicalCash },
        transactions: [...source.transactions],
    };
}

function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
}

function formatMoney(amount, currency) {
    const safeAmount = Number(amount) || 0;
    const formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    return currency === 'USD'
        ? `${formatter.format(safeAmount)} $`
        : `${formatter.format(safeAmount)} ل.س`;
}

function getTotals() {
    return state.transactions.reduce((totals, transaction) => {
        const signedAmount = Number(transaction.amount) || 0;
        const currency = transaction.currency === 'USD' ? 'USD' : 'LBP';
        if (transaction.type === 'in') totals[currency].totalIn += signedAmount;
        else totals[currency].totalOut += signedAmount;
        return totals;
    }, {
        LBP: { totalIn: 0, totalOut: 0 },
        USD: { totalIn: 0, totalOut: 0 },
    });
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-SA-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
    const dateString = now.toLocaleDateString('ar-SA-u-nu-latn', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    if (elements.liveClock) elements.liveClock.textContent = `${dateString} — ${timeString}`;
    if (elements.timeInput) elements.timeInput.value = nowTimeString();
}

function updateDifferenceCard(valueElement, labelElement, difference, currency) {
    if (!valueElement || !labelElement) return;
    if (difference === null) {
        valueElement.textContent = 'أدخل الرصيد الفعلي';
        valueElement.className = 'big-number';
        labelElement.textContent = `بعد إدخال الرصيد الفعلي ${currency === 'USD' ? 'بالدولار' : 'بالليرة السورية'} يظهر لك الفرق مباشرة.`;
        return;
    }
    if (difference === 0) {
        valueElement.textContent = 'مطابق';
        valueElement.className = 'big-number good';
        labelElement.textContent = 'الرصيد المتوقع يطابق الرصيد الفعلي تماماً.';
        return;
    }
    const isPositive = difference > 0;
    valueElement.textContent = `${isPositive ? 'فائض' : 'عجز'} ${formatMoney(Math.abs(difference), currency)}`;
    valueElement.className = `big-number ${isPositive ? 'good' : 'bad'}`;
    labelElement.textContent = isPositive
        ? 'الموجود الفعلي أقل من المتوقع، راجع العمليات أو الفئات المسجلة.'
        : 'الموجود الفعلي أكثر من المتوقع، راجع أي حركة ناقصة.';
}

function updateValueGroup(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
        element.textContent = value;
    });
}

function updateSummary() {
    const totals = getTotals();
    const openingLbp = Number(state.openingBalances.LBP) || 0;
    const openingUsd = Number(state.openingBalances.USD) || 0;
    const expectedLbp = openingLbp + totals.LBP.totalIn - totals.LBP.totalOut;
    const expectedUsd = openingUsd + totals.USD.totalIn - totals.USD.totalOut;
    const physicalLbp = state.physicalCash.LBP === '' ? null : Number(state.physicalCash.LBP);
    const physicalUsd = state.physicalCash.USD === '' ? null : Number(state.physicalCash.USD);
    const lbpDifference = physicalLbp === null || Number.isNaN(physicalLbp) ? null : expectedLbp - physicalLbp;
    const usdDifference = physicalUsd === null || Number.isNaN(physicalUsd) ? null : expectedUsd - physicalUsd;

    updateValueGroup('[data-value="opening-lbp"]', formatMoney(openingLbp, 'LBP'));
    updateValueGroup('[data-value="opening-usd"]', formatMoney(openingUsd, 'USD'));
    updateValueGroup('[data-value="in-lbp"]', formatMoney(totals.LBP.totalIn, 'LBP'));
    updateValueGroup('[data-value="out-lbp"]', formatMoney(totals.LBP.totalOut, 'LBP'));
    updateValueGroup('[data-value="expected-lbp"]', formatMoney(expectedLbp, 'LBP'));
    updateValueGroup('[data-value="in-usd"]', formatMoney(totals.USD.totalIn, 'USD'));
    updateValueGroup('[data-value="out-usd"]', formatMoney(totals.USD.totalOut, 'USD'));
    updateValueGroup('[data-value="expected-usd"]', formatMoney(expectedUsd, 'USD'));
    updateValueGroup('[data-value="count"]', String(state.transactions.length));

    updateDifferenceCard(elements.lbpDifferenceDisplay, elements.lbpDifferenceLabel, lbpDifference, 'LBP');
    updateDifferenceCard(elements.usdDifferenceDisplay, elements.usdDifferenceLabel, usdDifference, 'USD');
    updateDifferenceCard(elements.lbpDifferenceDisplayBalance, elements.lbpDifferenceLabelBalance, lbpDifference, 'LBP');
    updateDifferenceCard(elements.usdDifferenceDisplayBalance, elements.usdDifferenceLabelBalance, usdDifference, 'USD');

    elements.openingLbpInput.value = inputValueOrEmpty(openingLbp);
    elements.openingUsdInput.value = inputValueOrEmpty(openingUsd);
    elements.physicalLbpInput.value = inputValueOrEmpty(state.physicalCash.LBP);
    elements.physicalUsdInput.value = inputValueOrEmpty(state.physicalCash.USD);
}

function transactionMarkup(transaction, index, includeDelete = true) {
    const deleteCell = includeDelete
        ? `<td class="row-actions"><button type="button" data-delete-index="${index}" aria-label="حذف حركة ${escapeHtml(transaction.category || '')}">حذف</button></td>`
        : '';
    return `
        <tr>
            <td><span class="date">${escapeHtml(transaction.date || '-')}</span><span class="time">${escapeHtml(transaction.time || '-')}</span></td>
            <td><span class="type-pill ${transaction.type === 'in' ? 'type-in' : 'type-out'}">${transaction.type === 'in' ? 'داخل' : 'خارج'}</span></td>
            <td>${escapeHtml(transaction.category || '-')}</td>
            <td class="amount">${formatMoney(transaction.amount, transaction.currency)}</td>
            <td class="note-cell">${escapeHtml(transaction.note || '-')}</td>
            ${deleteCell}
        </tr>
    `;
}

function renderTransactions() {
    if (!elements.transactionsBody) return;
    if (state.transactions.length === 0) {
        elements.transactionsBody.innerHTML = '<tr><td class="empty" colspan="6"><strong>لا توجد عمليات بعد</strong><span>أضف أول حركة من النموذج لتظهر هنا.</span></td></tr>';
    } else {
        elements.transactionsBody.innerHTML = state.transactions.map((transaction, index) => transactionMarkup(transaction, index)).join('');
    }

    if (!elements.recentTransactionsBody) return;
    if (state.transactions.length === 0) {
        elements.recentTransactionsBody.innerHTML = '<tr><td class="empty" colspan="5"><strong>ابدأ بتسجيل أول حركة</strong><span>ستظهر أحدث العمليات هنا.</span></td></tr>';
    } else {
        elements.recentTransactionsBody.innerHTML = state.transactions
            .slice(0, 5)
            .map((transaction, index) => transactionMarkup(transaction, index, false))
            .join('');
    }
}

function syncView() {
    saveState();
    renderTransactions();
    updateSummary();
}

function cacheElements() {
    [
        'transactionForm', 'dateInput', 'timeInput', 'typeInput', 'amountInput',
        'currencyInput', 'categoryInput', 'noteInput', 'openingLbpInput',
        'openingUsdInput', 'physicalLbpInput', 'physicalUsdInput', 'clearDayButton',
        'transactionsBody', 'recentTransactionsBody', 'liveClock',
        'lbpDifferenceDisplay', 'lbpDifferenceLabel', 'usdDifferenceDisplay',
        'usdDifferenceLabel', 'lbpDifferenceDisplayBalance', 'lbpDifferenceLabelBalance',
        'usdDifferenceDisplayBalance', 'usdDifferenceLabelBalance',
    ].forEach((id) => { elements[id] = document.getElementById(id); });
}

function setInitialInputs() {
    elements.dateInput.value = todayString();
    elements.timeInput.value = nowTimeString();
    elements.openingLbpInput.value = inputValueOrEmpty(state.openingBalances.LBP || 0);
    elements.openingUsdInput.value = inputValueOrEmpty(state.openingBalances.USD || 0);
    elements.physicalLbpInput.value = inputValueOrEmpty(state.physicalCash.LBP);
    elements.physicalUsdInput.value = inputValueOrEmpty(state.physicalCash.USD);
}

function navigate(sectionId, closeMobile = true) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    document.querySelectorAll('.page-section').forEach((section) => {
        section.hidden = section.id !== sectionId;
    });
    document.querySelectorAll('[data-section]').forEach((link) => {
        const active = link.dataset.section === sectionId;
        link.classList.toggle('is-active', active);
        link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    const titles = {
        dashboardSection: ['نظرة عامة', 'الصورة الواضحة لدرجك اليوم.'],
        transactionsSection: ['الحركات', 'أضف كل دخول وخروج بسرعة ووضوح.'],
        balancesSection: ['الأرصدة', 'قارن المتوقع بما هو موجود فعلياً.'],
        reportsSection: ['التقارير', 'مساحة مهيأة للخطوة التالية.'],
        settingsSection: ['الإعدادات', 'ستتوفر هنا عند الحاجة.'],
    };
    const title = titles[sectionId] || titles.dashboardSection;
    document.getElementById('pageTitle').textContent = title[0];
    document.getElementById('pageSubtitle').textContent = title[1];
    if (closeMobile) closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebar() {
    document.body.classList.add('sidebar-open');
    elements.sidebarToggle.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (elements.sidebarToggle) elements.sidebarToggle.setAttribute('aria-expanded', 'false');
}

function bindEvents() {
    document.querySelectorAll('[data-section]').forEach((link) => {
        link.addEventListener('click', () => navigate(link.dataset.section));
    });
    elements.sidebarToggle.addEventListener('click', () => {
        if (document.body.classList.contains('sidebar-open')) closeSidebar();
        else openSidebar();
    });
    elements.sidebarClose.addEventListener('click', closeSidebar);
    elements.sidebarBackdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeSidebar();
    });

    elements.transactionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const amount = Number(elements.amountInput.value);
        if (!amount || amount <= 0) {
            elements.amountInput.focus();
            return;
        }
        state.openingBalances.LBP = toFiniteNumber(elements.openingLbpInput.value, 0);
        state.openingBalances.USD = toFiniteNumber(elements.openingUsdInput.value, 0);
        state.physicalCash.LBP = elements.physicalLbpInput.value === '' ? '' : toFiniteNumber(elements.physicalLbpInput.value, 0);
        state.physicalCash.USD = elements.physicalUsdInput.value === '' ? '' : toFiniteNumber(elements.physicalUsdInput.value, 0);
        state.transactions.unshift({
            date: elements.dateInput.value || todayString(),
            time: elements.timeInput.value || nowTimeString(),
            type: elements.typeInput.value,
            amount,
            currency: elements.currencyInput.value,
            category: elements.categoryInput.value.trim(),
            note: elements.noteInput.value.trim(),
        });
        elements.amountInput.value = '';
        elements.categoryInput.value = '';
        elements.noteInput.value = '';
        elements.typeInput.value = 'in';
        elements.currencyInput.value = 'LBP';
        elements.amountInput.focus();
        syncView();
    });

    elements.transactionsBody.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;
        const index = Number(target.dataset.deleteIndex);
        if (Number.isNaN(index)) return;
        state.transactions.splice(index, 1);
        syncView();
    });

    elements.clearDayButton.addEventListener('click', () => {
        const confirmed = confirm('هل تريد تفريغ كل عمليات اليوم؟');
        if (!confirmed) return;
        state.transactions = [];
        state.physicalCash = { LBP: '', USD: '' };
        syncView();
    });

    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            elements.categoryInput.value = chip.dataset.category || '';
            elements.categoryInput.focus();
        });
    });

    elements.openingLbpInput.addEventListener('input', () => {
        state.openingBalances.LBP = toFiniteNumber(elements.openingLbpInput.value, 0);
        syncView();
    });
    elements.openingUsdInput.addEventListener('input', () => {
        state.openingBalances.USD = toFiniteNumber(elements.openingUsdInput.value, 0);
        syncView();
    });
    elements.physicalLbpInput.addEventListener('input', () => {
        state.physicalCash.LBP = elements.physicalLbpInput.value === '' ? '' : toFiniteNumber(elements.physicalLbpInput.value, 0);
        syncView();
    });
    elements.physicalUsdInput.addEventListener('input', () => {
        state.physicalCash.USD = elements.physicalUsdInput.value === '' ? '' : toFiniteNumber(elements.physicalUsdInput.value, 0);
        syncView();
    });
}

function startApp() {
    cacheElements();
    elements.sidebarToggle = document.getElementById('sidebarToggle');
    elements.sidebarClose = document.getElementById('sidebarClose');
    elements.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    elements.pageTitle = document.getElementById('pageTitle');
    elements.pageSubtitle = document.getElementById('pageSubtitle');
    setInitialInputs();
    bindEvents();
    navigate('dashboardSection', false);
    updateClock();
    setInterval(updateClock, 1000);
    syncView();
}

startApp();
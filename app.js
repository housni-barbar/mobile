const storageKey = 'shop-drawer-ledger-v1';

const elements = {
    transactionForm: document.getElementById('transactionForm'),
    dateInput: document.getElementById('dateInput'),
    timeInput: document.getElementById('timeInput'),
    typeInput: document.getElementById('typeInput'),
    amountInput: document.getElementById('amountInput'),
    currencyInput: document.getElementById('currencyInput'),
    categoryInput: document.getElementById('categoryInput'),
    noteInput: document.getElementById('noteInput'),
    openingLbpInput: document.getElementById('openingLbpInput'),
    openingUsdInput: document.getElementById('openingUsdInput'),
    physicalLbpInput: document.getElementById('physicalLbpInput'),
    physicalUsdInput: document.getElementById('physicalUsdInput'),
    clearDayButton: document.getElementById('clearDayButton'),
    transactionsBody: document.getElementById('transactionsBody'),
    openingLbpDisplay: document.getElementById('openingLbpDisplay'),
    openingUsdDisplay: document.getElementById('openingUsdDisplay'),
    lbpDifferenceDisplay: document.getElementById('lbpDifferenceDisplay'),
    lbpDifferenceLabel: document.getElementById('lbpDifferenceLabel'),
    usdDifferenceDisplay: document.getElementById('usdDifferenceDisplay'),
    usdDifferenceLabel: document.getElementById('usdDifferenceLabel'),
    countDisplay: document.getElementById('countDisplay'),
    liveClock: document.getElementById('liveClock'),
    totalInLbpDisplay: document.getElementById('totalInLbpDisplay'),
    totalOutLbpDisplay: document.getElementById('totalOutLbpDisplay'),
    expectedLbpDisplay: document.getElementById('expectedLbpDisplay'),
    totalInUsdDisplay: document.getElementById('totalInUsdDisplay'),
    totalOutUsdDisplay: document.getElementById('totalOutUsdDisplay'),
    expectedUsdDisplay: document.getElementById('expectedUsdDisplay'),
};

const state = loadState();

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

    if (elements.liveClock) {
        elements.liveClock.textContent = `${dateString} — ${timeString}`;
    }

    elements.timeInput.value = nowTimeString();
}

function formatMoney(amount, currency) {
    const safeAmount = Number(amount) || 0;
    const formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });

    return currency === 'USD' ? `${formatter.format(safeAmount)} $` : `${formatter.format(safeAmount)} ل.س`;
}

function loadState() {
    const fallback = {
        openingBalances: { LBP: 0, USD: 0 },
        physicalCash: { LBP: '', USD: '' },
        transactions: [],
    };

    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return fallback;
        }

        const parsed = JSON.parse(raw);

        if (parsed.openingBalance !== undefined || parsed.physicalCash !== undefined) {
            return {
                ...fallback,
                openingBalances: {
                    LBP: toFiniteNumber(parsed.openingBalance, 0),
                    USD: 0,
                },
                physicalCash: {
                    LBP: parsed.physicalCash === '' || parsed.physicalCash === undefined ? '' : inputValueOrEmpty(parsed.physicalCash),
                    USD: '',
                },
                transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            };
        }

        return {
            ...fallback,
            ...parsed,
            openingBalances: {
                ...fallback.openingBalances,
                ...(parsed.openingBalances || {}),
            },
            physicalCash: {
                ...fallback.physicalCash,
                ...(parsed.physicalCash || {}),
            },
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        };
    } catch {
        return fallback;
    }
}

function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
}

function getTotals() {
    return state.transactions.reduce((totals, transaction) => {
        const signedAmount = Number(transaction.amount) || 0;
        const currency = transaction.currency === 'USD' ? 'USD' : 'LBP';

        if (transaction.type === 'in') {
            totals[currency].totalIn += signedAmount;
        } else {
            totals[currency].totalOut += signedAmount;
        }

        return totals;
    }, {
        LBP: { totalIn: 0, totalOut: 0 },
        USD: { totalIn: 0, totalOut: 0 },
    });
}

function updateDifferenceCard(valueElement, labelElement, difference, currency) {
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

function updateSummary() {
    const totals = getTotals();
    const openingLbp = Number(state.openingBalances.LBP) || 0;
    const openingUsd = Number(state.openingBalances.USD) || 0;
    const netLbp = totals.LBP.totalIn - totals.LBP.totalOut;
    const netUsd = totals.USD.totalIn - totals.USD.totalOut;
    const expectedLbp = openingLbp + netLbp;
    const expectedUsd = openingUsd + netUsd;
    const physicalLbp = state.physicalCash.LBP === '' ? null : Number(state.physicalCash.LBP);
    const physicalUsd = state.physicalCash.USD === '' ? null : Number(state.physicalCash.USD);
    const lbpDifference = physicalLbp === null || Number.isNaN(physicalLbp) ? null : expectedLbp - physicalLbp;
    const usdDifference = physicalUsd === null || Number.isNaN(physicalUsd) ? null : expectedUsd - physicalUsd;

    elements.openingLbpDisplay.textContent = formatMoney(openingLbp, 'LBP');
    elements.openingUsdDisplay.textContent = formatMoney(openingUsd, 'USD');
    elements.totalInLbpDisplay.textContent = formatMoney(totals.LBP.totalIn, 'LBP');
    elements.totalOutLbpDisplay.textContent = formatMoney(totals.LBP.totalOut, 'LBP');
    elements.expectedLbpDisplay.textContent = formatMoney(expectedLbp, 'LBP');
    elements.totalInUsdDisplay.textContent = formatMoney(totals.USD.totalIn, 'USD');
    elements.totalOutUsdDisplay.textContent = formatMoney(totals.USD.totalOut, 'USD');
    elements.expectedUsdDisplay.textContent = formatMoney(expectedUsd, 'USD');
    elements.countDisplay.textContent = String(state.transactions.length);

    updateDifferenceCard(elements.lbpDifferenceDisplay, elements.lbpDifferenceLabel, lbpDifference, 'LBP');
    updateDifferenceCard(elements.usdDifferenceDisplay, elements.usdDifferenceLabel, usdDifference, 'USD');

    elements.openingLbpInput.value = inputValueOrEmpty(openingLbp);
    elements.openingUsdInput.value = inputValueOrEmpty(openingUsd);
    elements.physicalLbpInput.value = inputValueOrEmpty(state.physicalCash.LBP);
    elements.physicalUsdInput.value = inputValueOrEmpty(state.physicalCash.USD);
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderTransactions() {
    if (state.transactions.length === 0) {
        elements.transactionsBody.innerHTML = '<tr><td class="empty" colspan="6">لا توجد عمليات بعد. أضف أول حركة من الجهة اليسار.</td></tr>';
        return;
    }

    elements.transactionsBody.innerHTML = state.transactions
        .map((transaction, index) => `
            <tr>
                <td>${transaction.date} ${transaction.time}</td>
                <td><span class="type-pill ${transaction.type === 'in' ? 'type-in' : 'type-out'}">${transaction.type === 'in' ? 'داخل' : 'خارج'}</span></td>
                <td>${escapeHtml(transaction.category || '-')}</td>
                <td>${formatMoney(transaction.amount, transaction.currency)}</td>
                <td>${escapeHtml(transaction.note || '-')}</td>
                <td class="row-actions"><button type="button" data-delete-index="${index}">حذف</button></td>
            </tr>
        `)
        .join('');
}

function syncView() {
    saveState();
    renderTransactions();
    updateSummary();
}

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
    if (!(target instanceof HTMLButtonElement)) {
        return;
    }

    const index = Number(target.dataset.deleteIndex);
    if (Number.isNaN(index)) {
        return;
    }

    state.transactions.splice(index, 1);
    syncView();
});

elements.clearDayButton.addEventListener('click', () => {
    const confirmed = confirm('هل تريد تفريغ كل عمليات اليوم؟');
    if (!confirmed) {
        return;
    }

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

elements.dateInput.value = todayString();
elements.timeInput.value = nowTimeString();
elements.openingLbpInput.value = inputValueOrEmpty(state.openingBalances.LBP || 0);
elements.openingUsdInput.value = inputValueOrEmpty(state.openingBalances.USD || 0);
elements.physicalLbpInput.value = inputValueOrEmpty(state.physicalCash.LBP);
elements.physicalUsdInput.value = inputValueOrEmpty(state.physicalCash.USD);

updateClock();
setInterval(updateClock, 1000);
syncView();

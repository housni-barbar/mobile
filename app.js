/* دفتر راتبي — سجل شخصي محلي للراتب والمصاريف */

const storageKey = 'personal-salary-ledger-v1';
const themeStorageKey = 'shop-drawer-ledger-theme';

const fallbackState = {
    salaryEntries: [],
    expenses: [],
};

const state = loadState();
const elements = {};

function loadState() {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return { ...fallbackState };
        const parsed = JSON.parse(raw);
        return {
            salaryEntries: Array.isArray(parsed.salaryEntries) ? parsed.salaryEntries : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        };
    } catch {
        return { ...fallbackState };
    }
}

function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
}

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
    return todayString().slice(0, 7);
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(amount, currency) {
    const formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    const value = formatter.format(toNumber(amount));
    return currency === 'USD' ? `${value} $` : `${value} ل.س`;
}

function escapeHtml(text) {
    return String(text ?? '')
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
}

function applyTheme(isDark, persist = true) {
    document.body.classList.toggle('dark-mode', isDark);
    if (persist) localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
    if (elements.themeToggleLabel) {
        elements.themeToggleLabel.textContent = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';
    }
    if (elements.themeToggle) {
        elements.themeToggle.setAttribute('aria-label', isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
        elements.themeToggle.setAttribute('aria-pressed', String(isDark));
    }
}

function allEntries() {
    return [
        ...state.salaryEntries.map((entry) => ({ ...entry, kind: 'salary' })),
        ...state.expenses.map((entry) => ({ ...entry, kind: 'expense' })),
    ].sort((first, second) => {
        const firstKey = `${first.date || ''}-${first.createdAt || ''}`;
        const secondKey = `${second.date || ''}-${second.createdAt || ''}`;
        return secondKey.localeCompare(firstKey);
    });
}

function calculate(month = '') {
    const salaries = month
        ? state.salaryEntries.filter((entry) => String(entry.date || '').startsWith(month))
        : state.salaryEntries;
    const expenses = month
        ? state.expenses.filter((entry) => String(entry.date || '').startsWith(month))
        : state.expenses;
    const salary = { LBP: 0, USD: 0 };
    const expense = { LBP: 0, USD: 0 };

    salaries.forEach((entry) => {
        const currency = entry.currency === 'USD' ? 'USD' : 'LBP';
        salary[currency] += toNumber(entry.amount);
    });
    expenses.forEach((entry) => {
        const currency = entry.currency === 'USD' ? 'USD' : 'LBP';
        expense[currency] += toNumber(entry.amount);
    });

    return {
        salary,
        expense,
        remaining: {
            LBP: salary.LBP - expense.LBP,
            USD: salary.USD - expense.USD,
        },
        expenseCount: expenses.length,
    };
}

function setText(id, value) {
    if (elements[id]) elements[id].textContent = value;
}

function setAmount(id, amount, currency) {
    const element = elements[id];
    if (!element) return;
    element.textContent = formatMoney(amount, currency);
    element.classList.toggle('negative-value', toNumber(amount) < 0);
}

function setDual(id, lbp, usd) {
    setText(id, `${formatMoney(lbp, 'LBP')} · ${formatMoney(usd, 'USD')}`);
}

function renderDashboard() {
    const month = elements.dashboardMonthFilter.value || currentMonth();
    const summary = calculate(month);
    const total = calculate();

    setAmount('monthlyRemainingLbp', summary.remaining.LBP, 'LBP');
    setAmount('monthlyRemainingUsd', summary.remaining.USD, 'USD');
    setDual('monthlySalarySummary', summary.salary.LBP, summary.salary.USD);
    setDual('monthlyExpenseSummary', summary.expense.LBP, summary.expense.USD);
    setText('expenseCountSummary', `${summary.expenseCount} مصروف`);
    setAmount('totalNetLbp', total.remaining.LBP, 'LBP');
    setAmount('totalNetUsd', total.remaining.USD, 'USD');

    const recent = allEntries().slice(0, 5);
    elements.recentEntriesBody.innerHTML = recent.length
        ? recent.map((entry) => entryMarkup(entry, false)).join('')
        : emptyRow(5, 'لا توجد عمليات بعد', 'أضف أول راتب أو مصروف ليظهر هنا.');
}

function entryMarkup(entry, includeDelete = true) {
    const isSalary = entry.kind === 'salary';
    const kindLabel = isSalary ? 'راتب' : 'مصروف';
    const category = isSalary ? 'دفعة راتب' : (entry.category || 'أخرى');
    const deleteCell = includeDelete
        ? `<td class="row-actions"><button type="button" data-delete-kind="${entry.kind}" data-delete-id="${escapeHtml(entry.id)}" aria-label="حذف ${kindLabel}">حذف</button></td>`
        : '';
    return `
        <tr>
            <td><span class="date">${escapeHtml(entry.date || '-')}</span></td>
            <td><span class="type-pill ${isSalary ? 'type-in' : 'type-out'}">${kindLabel}</span></td>
            <td>${escapeHtml(category)}</td>
            <td class="amount">${formatMoney(entry.amount, entry.currency)}</td>
            <td class="note-cell">${escapeHtml(entry.note || '-')}</td>
            ${deleteCell}
        </tr>
    `;
}

function emptyRow(colspan, title, description) {
    return `<tr><td class="empty" colspan="${colspan}"><strong>${title}</strong><span>${description}</span></td></tr>`;
}

function renderEntries() {
    const filter = elements.entriesMonthFilter.value;
    const entries = filter
        ? allEntries().filter((entry) => String(entry.date || '').startsWith(filter))
        : allEntries();
    elements.entriesBody.innerHTML = entries.length
        ? entries.map((entry) => entryMarkup(entry)).join('')
        : emptyRow(6, 'لا توجد عمليات في هذا العرض', 'أضف راتبًا أو مصروفًا من النماذج أعلاه.');

    const month = filter || elements.dashboardMonthFilter.value || currentMonth();
    const summary = calculate(month);
    setAmount('entriesSalaryLbp', summary.salary.LBP, 'LBP');
    setAmount('entriesExpenseLbp', summary.expense.LBP, 'LBP');
    setAmount('entriesRemainingLbp', summary.remaining.LBP, 'LBP');
    setAmount('entriesSalaryUsd', summary.salary.USD, 'USD');
    setAmount('entriesExpenseUsd', summary.expense.USD, 'USD');
    setAmount('entriesRemainingUsd', summary.remaining.USD, 'USD');
}

function renderSummary() {
    const month = elements.summaryMonthFilter.value || currentMonth();
    const summary = calculate(month);
    const total = calculate();
    setAmount('summarySalaryLbp', summary.salary.LBP, 'LBP');
    setAmount('summaryExpenseLbp', summary.expense.LBP, 'LBP');
    setAmount('summaryRemainingLbp', summary.remaining.LBP, 'LBP');
    setAmount('summarySalaryUsd', summary.salary.USD, 'USD');
    setAmount('summaryExpenseUsd', summary.expense.USD, 'USD');
    setAmount('summaryRemainingUsd', summary.remaining.USD, 'USD');
    setAmount('summaryNetLbp', total.remaining.LBP, 'LBP');
    setAmount('summaryNetUsd', total.remaining.USD, 'USD');
}

function renderCategoryReport(container, currency, month) {
    const totals = new Map();
    state.expenses
        .filter((entry) => String(entry.date || '').startsWith(month))
        .filter((entry) => (entry.currency === 'USD' ? 'USD' : 'LBP') === currency)
        .forEach((entry) => {
            const category = entry.category || 'أخرى';
            totals.set(category, (totals.get(category) || 0) + toNumber(entry.amount));
        });

    const rows = [...totals.entries()].sort((first, second) => second[1] - first[1]);
    container.innerHTML = rows.length
        ? rows.map(([category, amount]) => `
            <div class="category-row">
                <span>${escapeHtml(category)}</span>
                <strong>${formatMoney(amount, currency)}</strong>
            </div>
        `).join('')
        : '<div class="report-empty">لا توجد مصاريف مسجلة لهذا الشهر.</div>';
}

function renderReports() {
    const month = elements.reportsMonthFilter.value || currentMonth();
    renderCategoryReport(elements.categoryReportLbp, 'LBP', month);
    renderCategoryReport(elements.categoryReportUsd, 'USD', month);
}

function renderAll() {
    renderDashboard();
    renderEntries();
    renderSummary();
    renderReports();
}

function syncMonthFilters(source) {
    if (!source.value) return;
    [elements.dashboardMonthFilter, elements.summaryMonthFilter, elements.reportsMonthFilter]
        .forEach((filter) => { filter.value = source.value; });
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
        dashboardSection: ['نظرة عامة', 'اعرف أين ذهب راتبك وكم بقي معك.'],
        entriesSection: ['الراتب والمصاريف', 'سجّل كل دفعة راتب وكل مبلغ دفعته مع سببه.'],
        balancesSection: ['الملخص', 'قارن راتب الشهر بمصاريفك واعرف الزيادة المتراكمة.'],
        reportsSection: ['تحليل المصاريف', 'اعرف أكثر التصنيفات التي يذهب إليها راتبك.'],
        settingsSection: ['الإعدادات', 'تحكم بالبيانات المحلية الخاصة بدفتر راتبك.'],
    };
    const title = titles[sectionId] || titles.dashboardSection;
    elements.pageTitle.textContent = title[0];
    elements.pageSubtitle.textContent = title[1];
    if (closeMobile) closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebar() {
    document.body.classList.add('sidebar-open');
    elements.sidebarToggle.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    elements.sidebarToggle.setAttribute('aria-expanded', 'false');
}

function addSalary(event) {
    event.preventDefault();
    const amount = toNumber(elements.salaryAmountInput.value);
    if (amount <= 0) {
        elements.salaryAmountInput.focus();
        return;
    }
    state.salaryEntries.unshift({
        id: createId(),
        date: elements.salaryDateInput.value || todayString(),
        amount,
        currency: elements.salaryCurrencyInput.value,
        note: elements.salaryNoteInput.value.trim(),
        createdAt: new Date().toISOString(),
    });
    elements.salaryAmountInput.value = '';
    elements.salaryNoteInput.value = '';
    saveState();
    renderAll();
    elements.salaryAmountInput.focus();
}

function addExpense(event) {
    event.preventDefault();
    const amount = toNumber(elements.expenseAmountInput.value);
    if (amount <= 0) {
        elements.expenseAmountInput.focus();
        return;
    }
    state.expenses.unshift({
        id: createId(),
        date: elements.expenseDateInput.value || todayString(),
        amount,
        currency: elements.expenseCurrencyInput.value,
        category: elements.expenseCategoryInput.value,
        note: elements.expenseNoteInput.value.trim(),
        createdAt: new Date().toISOString(),
    });
    elements.expenseAmountInput.value = '';
    elements.expenseNoteInput.value = '';
    saveState();
    renderAll();
    elements.expenseAmountInput.focus();
}

function deleteEntry(kind, id) {
    const collection = kind === 'salary' ? state.salaryEntries : state.expenses;
    const index = collection.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    collection.splice(index, 1);
    saveState();
    renderAll();
}

function cacheElements() {
    [
        'sidebar', 'sidebarToggle', 'sidebarClose', 'sidebarBackdrop', 'pageTitle', 'pageSubtitle',
        'themeToggle', 'themeToggleLabel', 'liveClock', 'dashboardMonthFilter', 'summaryMonthFilter',
        'reportsMonthFilter', 'entriesMonthFilter', 'showAllEntriesButton', 'salaryForm', 'salaryDateInput',
        'salaryAmountInput', 'salaryCurrencyInput', 'salaryNoteInput', 'expenseForm', 'expenseDateInput',
        'expenseAmountInput', 'expenseCurrencyInput', 'expenseCategoryInput', 'expenseNoteInput',
        'entriesBody', 'recentEntriesBody', 'categoryReportLbp', 'categoryReportUsd', 'clearAllButton',
        'monthlyRemainingLbp', 'monthlyRemainingUsd', 'monthlySalarySummary', 'monthlyExpenseSummary',
        'expenseCountSummary', 'totalNetLbp', 'totalNetUsd', 'entriesSalaryLbp', 'entriesExpenseLbp',
        'entriesRemainingLbp', 'entriesSalaryUsd', 'entriesExpenseUsd', 'entriesRemainingUsd',
        'summarySalaryLbp', 'summaryExpenseLbp', 'summaryRemainingLbp', 'summarySalaryUsd',
        'summaryExpenseUsd', 'summaryRemainingUsd', 'summaryNetLbp', 'summaryNetUsd',
    ].forEach((id) => { elements[id] = document.getElementById(id); });
}

function setInitialInputs() {
    const today = todayString();
    elements.salaryDateInput.value = today;
    elements.expenseDateInput.value = today;
    elements.dashboardMonthFilter.value = currentMonth();
    elements.summaryMonthFilter.value = currentMonth();
    elements.reportsMonthFilter.value = currentMonth();
    elements.entriesMonthFilter.value = currentMonth();
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
    elements.themeToggle.addEventListener('click', () => {
        applyTheme(!document.body.classList.contains('dark-mode'));
    });
    elements.salaryForm.addEventListener('submit', addSalary);
    elements.expenseForm.addEventListener('submit', addExpense);
    elements.entriesBody.addEventListener('click', (event) => {
        const button = event.target.closest('[data-delete-id]');
        if (!button) return;
        deleteEntry(button.dataset.deleteKind, button.dataset.deleteId);
    });
    elements.clearAllButton.addEventListener('click', () => {
        if (!confirm('هل تريد حذف كل الرواتب والمصاريف؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        state.salaryEntries = [];
        state.expenses = [];
        saveState();
        renderAll();
    });
    [elements.dashboardMonthFilter, elements.summaryMonthFilter, elements.reportsMonthFilter]
        .forEach((filter) => filter.addEventListener('change', () => {
            syncMonthFilters(filter);
            renderAll();
        }));
    elements.entriesMonthFilter.addEventListener('change', renderEntries);
    elements.showAllEntriesButton.addEventListener('click', () => {
        elements.entriesMonthFilter.value = '';
        renderEntries();
    });
}

function startApp() {
    cacheElements();
    applyTheme(localStorage.getItem(themeStorageKey) === 'dark', false);
    setInitialInputs();
    bindEvents();
    navigate('dashboardSection', false);
    updateClock();
    setInterval(updateClock, 1000);
    renderAll();
}

startApp();
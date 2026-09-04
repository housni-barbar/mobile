/* دفتر راتبي — سجل شخصي محلي للراتب والمصاريف */
import { db, auth } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

console.log("Firebase connected:", db, "auth:", auth);

let currentUserUid = null;
let unsubscribers = { salary: null, expenses: null };
let localBackupSaved = false;

function ensureLocalBackup() {
    try {
        if (localBackupSaved) return;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            localStorage.setItem(storageKey + '-backup', raw);
        }
    } catch (e) {
        console.warn('Failed to create local backup', e);
    }
    localBackupSaved = true;
}

function stopFirestoreSync() {
    if (unsubscribers.salary) { unsubscribers.salary(); unsubscribers.salary = null; }
    if (unsubscribers.expenses) { unsubscribers.expenses(); unsubscribers.expenses = null; }
    currentUserUid = null;
}

function startFirestoreSync(uid) {
    stopFirestoreSync();
    if (!uid) return;
    currentUserUid = uid;

    const salaryCol = collection(db, 'users', uid, 'salaryEntries');
    const expenseCol = collection(db, 'users', uid, 'expenses');

    // Listen to salaries
    unsubscribers.salary = onSnapshot(query(salaryCol, orderBy('createdAt', 'desc')), (snapshot) => {
        if (snapshot.empty) {
            // don't overwrite local data if Firestore has nothing yet
            return;
        }
        const docs = [];
        snapshot.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        // backup local storage before overwriting
        ensureLocalBackup();
        state.salaryEntries = docs;
        saveState();
        renderAll();
    }, (err) => {
        console.error('Salary snapshot error', err);
    });

    // Listen to expenses
    unsubscribers.expenses = onSnapshot(query(expenseCol, orderBy('createdAt', 'desc')), (snapshot) => {
        if (snapshot.empty) {
            return;
        }
        const docs = [];
        snapshot.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        // backup local storage before overwriting
        ensureLocalBackup();
        state.expenses = docs;
        saveState();
        renderAll();
    }, (err) => {
        console.error('Expenses snapshot error', err);
    });
}

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
    try {
        // Accept numbers with grouping separators (commas) and decimals.
        const str = String(value ?? '').trim();
        if (str === '') return 0;
       // Remove any non-numeric characters except dot and minus
       const cleaned = str.replace(/[^0-9.\-]/g, '');
        const numberValue = Number(cleaned);
        return Number.isFinite(numberValue) ? numberValue : 0;
    } catch (e) {
        return 0;
    }
}

function formatMoney(amount, currency) {
    // Use grouping separators without forcing unnecessary ".00" decimals.
    const formatter = new Intl.NumberFormat('en-US', {
        useGrouping: true,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    const value = formatter.format(toNumber(amount));
    const LRM = '\u200E'; // left-to-right mark to keep number+currency ordered in RTL pages
    return currency === 'USD' ? `${LRM}${value} $` : `${LRM}${value} ل.س`;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// Remove grouping separators and keep only numeric characters, dot and minus
function unformatInputValue(value) {
    return String(value ?? '').replace(/[^0-9.\-]/g, '');
}

// Format an input string using grouping separators for the integer part while preserving any fractional part
function formatInputForDisplay(value) {
    const s = String(value ?? '').trim();
    if (s === '') return '';
    const negative = s.startsWith('-');
    const cleaned = s.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let intPart = parts[0] || '0';
    const fracPart = parts[1];
    // remove leading zeros but keep a single zero when appropriate
    intPart = intPart.replace(/^0+(?=\d)/, '');
    const formattedInt = new Intl.NumberFormat('en-US', { useGrouping: true }).format(Number(intPart) || 0);
    return (negative ? '-' : '') + formattedInt + (typeof fracPart !== 'undefined' ? '.' + fracPart : '');
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
    // Wrap the amount in an LTR container so numbers and currency render correctly in RTL pages
    element.innerHTML = `<span dir="ltr">${escapeHtml(formatMoney(amount, currency))}</span>`;
    element.classList.toggle('negative-value', toNumber(amount) < 0);
}

function renderDashboard() {
    const month = elements.dashboardMonthFilter.value || currentMonth();
    const summary = calculate(month);
    const total = calculate();

    setAmount('monthlyRemainingLbp', summary.remaining.LBP, 'LBP');
    setAmount('monthlyRemainingUsd', summary.remaining.USD, 'USD');
    setAmount('monthlySalaryLbp', summary.salary.LBP, 'LBP');
    setAmount('monthlySalaryUsd', summary.salary.USD, 'USD');
    setAmount('monthlyExpenseLbp', summary.expense.LBP, 'LBP');
    setAmount('monthlyExpenseUsd', summary.expense.USD, 'USD');
    setText('expenseCountSummary', `${summary.expenseCount} مصروف مسجل`);
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
    const entry = {
        id: createId(),
        date: elements.salaryDateInput.value || todayString(),
        amount,
        currency: elements.salaryCurrencyInput.value,
        note: elements.salaryNoteInput.value.trim(),
        createdAt: new Date().toISOString(),
    };
    // local update
    state.salaryEntries.unshift(entry);
    elements.salaryAmountInput.value = '';
    elements.salaryNoteInput.value = '';
    saveState();
    renderAll();
    elements.salaryAmountInput.focus();

    // persist to Firestore (if signed in)
    if (currentUserUid) {
        const ref = doc(db, 'users', currentUserUid, 'salaryEntries', entry.id);
        setDoc(ref, entry).catch((err) => console.error('Failed to save salary to Firestore', err));
    }
}

function addExpense(event) {
    event.preventDefault();
    const amount = toNumber(elements.expenseAmountInput.value);
    if (amount <= 0) {
        elements.expenseAmountInput.focus();
        return;
    }
    const entry = {
        id: createId(),
        date: elements.expenseDateInput.value || todayString(),
        amount,
        currency: elements.expenseCurrencyInput.value,
        category: elements.expenseCategoryInput.value,
        note: elements.expenseNoteInput.value.trim(),
        createdAt: new Date().toISOString(),
    };
    state.expenses.unshift(entry);
    elements.expenseAmountInput.value = '';
    elements.expenseNoteInput.value = '';
    saveState();
    renderAll();
    elements.expenseAmountInput.focus();

    if (currentUserUid) {
        const ref = doc(db, 'users', currentUserUid, 'expenses', entry.id);
        setDoc(ref, entry).catch((err) => console.error('Failed to save expense to Firestore', err));
    }
}

function deleteEntry(kind, id) {
    const collectionArray = kind === 'salary' ? state.salaryEntries : state.expenses;
    const index = collectionArray.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    collectionArray.splice(index, 1);
    saveState();
    renderAll();

    // delete from Firestore if signed in
    if (currentUserUid) {
        const colName = kind === 'salary' ? 'salaryEntries' : 'expenses';
        const ref = doc(db, 'users', currentUserUid, colName, id);
        deleteDoc(ref).catch((err) => console.error('Failed to delete entry from Firestore', err));
    }
}

function cacheElements() {
    [
        'authScreen','loginForm','loginEmailInput','loginPasswordInput','loginError','loginSubmitButton','logoutButton',
        'sidebar', 'sidebarToggle', 'sidebarClose', 'sidebarBackdrop', 'pageTitle', 'pageSubtitle',
        'themeToggle', 'themeToggleLabel', 'liveClock', 'dashboardMonthFilter', 'summaryMonthFilter',
        'reportsMonthFilter', 'entriesMonthFilter', 'showAllEntriesButton', 'salaryForm', 'salaryDateInput',
        'salaryAmountInput', 'salaryCurrencyInput', 'salaryNoteInput', 'expenseForm', 'expenseDateInput',
        'expenseAmountInput', 'expenseCurrencyInput', 'expenseCategoryInput', 'expenseNoteInput',
        'entriesBody', 'recentEntriesBody', 'categoryReportLbp', 'categoryReportUsd', 'clearAllButton',
        'monthlyRemainingLbp', 'monthlyRemainingUsd', 'monthlySalaryLbp', 'monthlySalaryUsd',
        'monthlyExpenseLbp', 'monthlyExpenseUsd',
        'expenseCountSummary', 'totalNetLbp', 'totalNetUsd', 'entriesSalaryLbp', 'entriesExpenseLbp',
        'entriesRemainingLbp', 'entriesSalaryUsd', 'entriesExpenseUsd', 'entriesRemainingUsd',
        'summarySalaryLbp', 'summaryExpenseLbp', 'summaryRemainingLbp', 'summarySalaryUsd',
        'summaryExpenseUsd', 'summaryRemainingUsd', 'summaryNetLbp', 'summaryNetUsd',
        'app'
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

    if (elements.sidebarToggle) {
        elements.sidebarToggle.addEventListener('click', () => {
            if (document.body.classList.contains('sidebar-open')) closeSidebar();
            else openSidebar();
        });
    }
    if (elements.sidebarClose) elements.sidebarClose.addEventListener('click', closeSidebar);
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeSidebar();
    });

    if (elements.themeToggle) elements.themeToggle.addEventListener('click', () => {
        applyTheme(!document.body.classList.contains('dark-mode'));
    });

    if (elements.salaryForm) elements.salaryForm.addEventListener('submit', addSalary);
    if (elements.expenseForm) elements.expenseForm.addEventListener('submit', addExpense);

    // Live-format amount inputs while preserving caret position. Handles composition (IME) safely.
    function isRawChar(ch) { return /[0-9.\-]/.test(ch); }
    function rawIndexFromCaret(value, caret) {
        let count = 0;
        for (let i = 0; i < Math.min(value.length, caret); i++) {
            if (isRawChar(value[i])) count++;
        }
        return count;
    }
    function caretFromRawIndex(formatted, rawIndex) {
        if (rawIndex <= 0) {
            // place caret before first raw char
            for (let i = 0; i < formatted.length; i++) {
                if (isRawChar(formatted[i])) return i;
            }
            return formatted.length;
        }
        let count = 0;
        for (let i = 0; i < formatted.length; i++) {
            if (isRawChar(formatted[i])) count++;
            if (count === rawIndex) return i + 1;
        }
        return formatted.length;
    }

    ['salaryAmountInput', 'expenseAmountInput'].forEach((id) => {
        const el = elements[id];
        if (!el) return;
        // during IME composition, skip formatting
        el.addEventListener('compositionstart', () => { el._composing = true; });
        el.addEventListener('compositionend', () => { el._composing = false; /* trigger a format pass */ el.dispatchEvent(new Event('input')); });

        el.addEventListener('focus', () => {
            el.value = unformatInputValue(el.value);
            // move caret to end
            setTimeout(() => {
                try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
            }, 0);
        });

        el.addEventListener('input', () => {
            if (el._composing) return;
            const original = el.value;
            const sel = el.selectionStart != null ? el.selectionStart : original.length;
            const rawIndex = rawIndexFromCaret(original, sel);
            const raw = unformatInputValue(original);
            const formatted = formatInputForDisplay(raw);
            if (formatted === original) {
                // no change
                el._lastRaw = raw;
                return;
            }
            el.value = formatted;
            const newCaret = caretFromRawIndex(formatted, rawIndex);
            try { el.setSelectionRange(newCaret, newCaret); } catch (e) {}
            el._lastRaw = raw;
        });

        el.addEventListener('blur', () => {
            // final formatting on blur
            el.value = formatInputForDisplay(unformatInputValue(el.value));
        });
    });

    if (elements.entriesBody) {
        elements.entriesBody.addEventListener('click', (event) => {
            const button = event.target.closest('[data-delete-id]');
            if (!button) return;
            deleteEntry(button.dataset.deleteKind, button.dataset.deleteId);
        });
    }

    if (elements.clearAllButton) elements.clearAllButton.addEventListener('click', () => {
        if (!confirm('هل تريد حذف كل الرواتب والمصاريف؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        state.salaryEntries = [];
        state.expenses = [];
        saveState();
        renderAll();
    });

    [elements.dashboardMonthFilter, elements.summaryMonthFilter, elements.reportsMonthFilter]
        .forEach((filter) => { if (filter) filter.addEventListener('change', () => {
            syncMonthFilters(filter);
            renderAll();
        }); });

    if (elements.entriesMonthFilter) elements.entriesMonthFilter.addEventListener('change', renderEntries);
    if (elements.showAllEntriesButton) elements.showAllEntriesButton.addEventListener('click', () => {
        if (elements.entriesMonthFilter) elements.entriesMonthFilter.value = '';
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

// Authentication gating: show login screen if not authenticated. Use onAuthStateChanged to detect status.
let appStarted = false;

function showAuthScreen() {
    const appEl = document.getElementById('app');
    if (appEl) {
        appEl.style.display = 'none';
        appEl.setAttribute('aria-hidden', 'true');
    }
    if (elements.authScreen) {
        elements.authScreen.style.display = 'flex';
        elements.authScreen.setAttribute('aria-hidden', 'false');
        // focus the first input for convenience
        const email = elements.loginEmailInput || document.getElementById('loginEmailInput');
        if (email) email.focus();
    }
}

function showAppUI() {
    const appEl = document.getElementById('app');
    if (elements.authScreen) {
        elements.authScreen.style.display = 'none';
        elements.authScreen.setAttribute('aria-hidden', 'true');
    }
    if (appEl) {
        appEl.style.display = '';
        appEl.setAttribute('aria-hidden', 'false');
    }
}

// Attach login form handler (use direct DOM queries in case cacheElements() not run yet)
function bindAuthUI() {
    // Ensure auth-related elements exist in elements map
    elements.authScreen = elements.authScreen || document.getElementById('authScreen');
    elements.loginForm = elements.loginForm || document.getElementById('loginForm');
    elements.loginEmailInput = elements.loginEmailInput || document.getElementById('loginEmailInput');
    elements.loginPasswordInput = elements.loginPasswordInput || document.getElementById('loginPasswordInput');
    elements.loginError = elements.loginError || document.getElementById('loginError');
    elements.loginSubmitButton = elements.loginSubmitButton || document.getElementById('loginSubmitButton');
    elements.logoutButton = elements.logoutButton || document.getElementById('logoutButton');

    if (elements.loginForm && !elements.loginForm._bound) {
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (elements.loginError) elements.loginError.textContent = '';
            const email = elements.loginEmailInput ? elements.loginEmailInput.value.trim() : '';
            const password = elements.loginPasswordInput ? elements.loginPasswordInput.value : '';
            try {
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged will handle UI transition
            } catch (err) {
                if (elements.loginError) elements.loginError.textContent = err.message || 'فشل تسجيل الدخول';
            }
        });
        elements.loginForm._bound = true;
    }

    if (elements.logoutButton && !elements.logoutButton._bound) {
        elements.logoutButton.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (err) {
                // ignore for now
                console.error('Sign out failed', err);
            }
        });
        elements.logoutButton._bound = true;
    }
}

// Start auth listener
bindAuthUI();

onAuthStateChanged(auth, (user) => {
    if (user) {
        // user is signed in
        showAppUI();
        startFirestoreSync(user.uid);
        if (!appStarted) {
            // Now that user is authenticated, start app (cacheElements + bind events + render)
            startApp();
            appStarted = true;
        }
    } else {
        // no user
        stopFirestoreSync();
        showAuthScreen();
    }
});
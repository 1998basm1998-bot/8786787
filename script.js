function checkPassword() {
    const pass = document.getElementById('passwordInput').value;
    if (pass === '1001') {
        document.getElementById('loginOverlay').style.display = 'none';
        initApp();
    } else {
        document.getElementById('loginError').innerText = 'كلمة المرور غير صحيحة';
    }
}

let db = {
    theme: 'light',
    phase1: { price: 0, date: '', subscribers: [], expenses: [] },
    phase2: { price: 0, date: '', subscribers: [], expenses: [] },
    phase3: { price: 0, date: '', subscribers: [], expenses: [] }
};
let currentPhase = null;
let currentSubscriberId = null;

function initApp() {
    const savedDb = localStorage.getItem('generatorDb');
    if (savedDb) db = JSON.parse(savedDb);
    applyTheme(db.theme);
}

function saveData() {
    localStorage.setItem('generatorDb', JSON.stringify(db));
}

function toggleTheme() {
    db.theme = db.theme === 'light' ? 'dark' : 'light';
    applyTheme(db.theme);
    saveData();
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function openPhase(phaseNum) {
    currentPhase = `phase${phaseNum}`;
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('phaseInterface').classList.remove('hidden');
    document.getElementById('currentPhaseTitle').innerText = `الفيز ${phaseNum}`;
    
    document.getElementById('amperePrice').value = db[currentPhase].price || '';
    document.getElementById('pricingDate').value = db[currentPhase].date || '';
    
    switchTab('pricing');
}

function backToMain() {
    document.getElementById('phaseInterface').classList.add('hidden');
    document.getElementById('mainInterface').classList.remove('hidden');
    currentPhase = null;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');

    if(tabId === 'subscribers') renderSubscribers();
    if(tabId === 'defaulters') renderDefaulters();
    if(tabId === 'expenses') renderExpenses();
}

function savePricing() {
    const price = parseFloat(document.getElementById('amperePrice').value);
    const date = document.getElementById('pricingDate').value;
    
    if (!price || !date) return;
    
    db[currentPhase].price = price;
    db[currentPhase].date = date;
    
    db[currentPhase].subscribers.forEach(sub => {
        sub.totalRequired += sub.amperes * price;
    });
    
    saveData();
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function saveSubscriber() {
    const name = document.getElementById('subName').value;
    const amperes = parseFloat(document.getElementById('subAmperes').value);
    const date = document.getElementById('subDate').value;
    const phone = document.getElementById('subPhone').value;
    const price = db[currentPhase].price;

    if (!name || !amperes || !date || !phone) return;

    const newSub = {
        id: Date.now().toString(),
        name,
        amperes,
        date,
        phone,
        totalRequired: amperes * price,
        paidAmount: 0
    };

    db[currentPhase].subscribers.push(newSub);
    saveData();
    closeModal('addSubscriberModal');
    
    document.getElementById('subName').value = '';
    document.getElementById('subAmperes').value = '';
    document.getElementById('subDate').value = '';
    document.getElementById('subPhone').value = '';
    
    renderSubscribers();
}

function renderSubscribers() {
    const list = document.getElementById('subscribersList');
    list.innerHTML = "";
    db[currentPhase].subscribers.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.onclick = () => openSubscriberDetails(sub.id);
        div.innerHTML = `<div><strong>${sub.name}</strong></div>`;
        list.appendChild(div);
    });
}

function openSubscriberDetails(id) {
    currentSubscriberId = id;
    const sub = db[currentPhase].subscribers.find(s => s.id === id);
    const price = db[currentPhase].price;
    const remainingTotal = sub.totalRequired - sub.paidAmount;
    const currentMonthPrice = sub.amperes * price;

    document.getElementById('detName').innerText = sub.name;
    document.getElementById('detTotalRemaining').innerText = remainingTotal;
    document.getElementById('detAmperes').innerText = sub.amperes;
    document.getElementById('detMonthPrice').innerText = currentMonthPrice;
    
    document.getElementById('paymentFormContainer').classList.add('hidden');
    openModal('subscriberDetailsModal');
}

function togglePaymentForm() {
    document.getElementById('paymentFormContainer').classList.toggle('hidden');
}

function makePayment() {
    const amount = parseFloat(document.getElementById('payAmount').value);
    if (!amount) return;

    const sub = db[currentPhase].subscribers.find(s => s.id === currentSubscriberId);
    sub.paidAmount += amount;
    
    saveData();
    document.getElementById('payAmount').value = '';
    document.getElementById('paymentFormContainer').classList.add('hidden');
    openSubscriberDetails(currentSubscriberId);
}

function renderDefaulters() {
    const list = document.getElementById('defaultersList');
    list.innerHTML = "";
    
    const today = new Date();
    
    const defaulters = db[currentPhase].subscribers.filter(sub => {
        const remaining = sub.totalRequired - sub.paidAmount;
        if (remaining <= 0) return false;
        
        if (sub.date) {
            const subDate = new Date(sub.date);
            const diffTime = Math.abs(today - subDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 30) return true;
        }
        return false;
    });

    defaulters.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `<div><strong>${sub.name}</strong></div>`;
        list.appendChild(div);
    });
}

function toggleExpenseForm() {
    document.getElementById('expenseFormContainer').classList.toggle('hidden');
}

function addExpense() {
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const note = document.getElementById('expenseNote').value;
    
    if (!amount || !note) return;

    db[currentPhase].expenses.push({ amount, note });
    saveData();
    
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseNote').value = '';
    document.getElementById('expenseFormContainer').classList.add('hidden');
    
    renderExpenses();
}

function renderExpenses() {
    const list = document.getElementById('expensesList');
    list.innerHTML = "";
    
    let total = 0;
    db[currentPhase].expenses.forEach(exp => {
        total += exp.amount;
        list.innerHTML += `<div class="list-item"><span>${exp.note}</span> <span>${exp.amount}</span></div>`;
    });
    
    document.getElementById('totalExpensesDisplay').innerText = total;
}

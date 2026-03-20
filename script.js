// --- حماية النظام ---
function checkPassword() {
    const pass = document.getElementById('passwordInput').value;
    if (pass === '1001') {
        document.getElementById('loginOverlay').style.display = 'none';
        initApp();
    } else {
        document.getElementById('loginError').innerText = 'كلمة المرور غير صحيحة';
    }
}

// --- هيكل البيانات ---
let db = {
    theme: 'light',
    phase1: { price: 0, date: '', subscribers: [], expenses: [] },
    phase2: { price: 0, date: '', subscribers: [], expenses: [] },
    phase3: { price: 0, date: '', subscribers: [], expenses: [] }
};
let currentPhase = null;
let currentSubscriberId = null;

// --- التهيئة الأساسية ---
function initApp() {
    const savedDb = localStorage.getItem('generatorDb');
    if (savedDb) db = JSON.parse(savedDb);
    applyTheme(db.theme);
}

function saveData() {
    localStorage.setItem('generatorDb', JSON.stringify(db));
    if(currentPhase) updateDashboard();
}

// --- الوضع الليلي ---
function toggleTheme() {
    db.theme = db.theme === 'light' ? 'dark' : 'light';
    applyTheme(db.theme);
    saveData();
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// --- التنقل بين الواجهات ---
function openPhase(phaseNum) {
    currentPhase = `phase${phaseNum}`;
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('phaseInterface').classList.remove('hidden');
    document.getElementById('currentPhaseTitle').innerText = `الفيز ${phaseNum}`;
    
    // تحميل بيانات التسعير
    document.getElementById('amperePrice').value = db[currentPhase].price || '';
    document.getElementById('pricingDate').value = db[currentPhase].date || '';
    
    switchTab('dashboard');
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
    if(tabId === 'dashboard') updateDashboard();
}

// --- التسعير ---
function savePricing() {
    const price = parseFloat(document.getElementById('amperePrice').value);
    const date = document.getElementById('pricingDate').value;
    
    if (!price || !date) return alert("يرجى إدخال السعر والتاريخ");
    
    db[currentPhase].price = price;
    db[currentPhase].date = date;
    
    // تحديث المطلوب من كل مشترك
    db[currentPhase].subscribers.forEach(sub => {
        sub.totalRequired = sub.amperes * price;
    });
    
    saveData();
    alert("تم حفظ التسعيرة وتحديث ديون المشتركين.");
}

// --- المشتركين ---
function saveSubscriber() {
    const name = document.getElementById('subName').value;
    const phone = document.getElementById('subPhone').value;
    const amperes = parseFloat(document.getElementById('subAmperes').value);
    const price = db[currentPhase].price;

    if (!name || !phone || !amperes) return alert("أكمل جميع الحقول");
    if (price === 0) return alert("يرجى تسعير الأمبير أولاً في تبويبة التسعير");

    const newSub = {
        id: Date.now().toString(),
        name,
        phone,
        amperes,
        totalRequired: amperes * price,
        paidAmount: 0,
        history: []
    };

    db[currentPhase].subscribers.push(newSub);
    saveData();
    closeModal('addSubscriberModal');
    
    // تفريغ الحقول
    document.getElementById('subName').value = '';
    document.getElementById('subPhone').value = '';
    document.getElementById('subAmperes').value = '';
    
    renderSubscribers();
}

function renderSubscribers(filter = "") {
    const list = document.getElementById('subscribersList');
    list.innerHTML = "";
    
    let subs = db[currentPhase].subscribers;
    if (filter) {
        subs = subs.filter(s => s.name.includes(filter) || s.phone.includes(filter));
    }

    subs.forEach(sub => {
        const remaining = sub.totalRequired - sub.paidAmount;
        const div = document.createElement('div');
        div.className = 'list-item';
        div.onclick = () => openSubscriberDetails(sub.id);
        div.innerHTML = `
            <div>
                <strong>${sub.name}</strong><br>
                <small>${sub.amperes} أمبير</small>
            </div>
            <div style="text-align: left;">
                <span class="${remaining > 0 ? 'danger-text' : 'success-text'}">${remaining} دينار</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function searchSubscribers() {
    const val = document.getElementById('searchInput').value;
    renderSubscribers(val);
}

// --- تفاصيل المشترك والتسديد ---
function openSubscriberDetails(id) {
    currentSubscriberId = id;
    const sub = db[currentPhase].subscribers.find(s => s.id === id);
    const remaining = sub.totalRequired - sub.paidAmount;

    document.getElementById('detName').innerText = sub.name;
    document.getElementById('detAmperes').innerText = sub.amperes;
    document.getElementById('detTotal').innerText = sub.totalRequired;
    document.getElementById('detRemaining').innerText = remaining;
    
    // زر الواتساب للمتبقي
    const waBtn = document.getElementById('btnWaDebt');
    if (remaining > 0) {
        waBtn.style.display = 'block';
        waBtn.onclick = () => sendWhatsApp(sub.phone, `مرحباً ${sub.name}، نود تذكيرك بأن المبلغ المتبقي لاشتراك المولدة هو ${remaining} دينار.`);
    } else {
        waBtn.style.display = 'none';
    }

    const historyList = document.getElementById('detHistory');
    historyList.innerHTML = "";
    sub.history.forEach(h => {
        historyList.innerHTML += `<li>${h.date} - سدد: ${h.amount} دينار</li>`;
    });

    openModal('subscriberDetailsModal');
}

function makePayment() {
    const amount = parseFloat(document.getElementById('payAmount').value);
    if (!amount) return;

    const sub = db[currentPhase].subscribers.find(s => s.id === currentSubscriberId);
    sub.paidAmount += amount;
    
    // سجل الدفع
    const dateStr = new Date().toLocaleString('ar-EG');
    sub.history.push({ date: dateStr, amount: amount });

    saveData();
    document.getElementById('payAmount').value = '';
    openSubscriberDetails(currentSubscriberId); // إعادة تحديث النافذة
    renderSubscribers(); // تحديث القائمة في الخلفية
}

// --- المتأخرين ---
function renderDefaulters() {
    const list = document.getElementById('defaultersList');
    list.innerHTML = "";
    
    const defaulters = db[currentPhase].subscribers.filter(s => (s.totalRequired - s.paidAmount) > 0);
    
    if (defaulters.length === 0) {
        list.innerHTML = "<p style='text-align:center;'>لا يوجد متأخرين.</p>";
        return;
    }

    defaulters.forEach(sub => {
        const remaining = sub.totalRequired - sub.paidAmount;
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div><strong>${sub.name}</strong><br><small class="danger-text">مطلوب: ${remaining}</small></div>
            <button class="btn-whatsapp" style="width:auto;" onclick="sendWhatsApp('${sub.phone}', 'تذكير: يرجى تسديد مبلغ الاشتراك البالغ ${remaining} دينار لمولدة الجمعيات.')">
                <i class="fab fa-whatsapp"></i> رسالة
            </button>
        `;
        list.appendChild(div);
    });
}

// --- المصروفات ---
function addExpense() {
    const name = document.getElementById('expenseName').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    if (!name || !amount) return;

    db[currentPhase].expenses.push({ name, amount, date: new Date().toLocaleDateString('ar-EG') });
    saveData();
    document.getElementById('expenseName').value = '';
    document.getElementById('expenseAmount').value = '';
    renderExpenses();
}

function renderExpenses() {
    const list = document.getElementById('expensesList');
    list.innerHTML = "";
    db[currentPhase].expenses.forEach(exp => {
        list.innerHTML += `<div class="list-item"><span>${exp.name} - <small>${exp.date}</small></span> <span class="danger-text">${exp.amount} دينار</span></div>`;
    });
}

// --- الإحصائيات (Dashboard) ---
function updateDashboard() {
    if(!currentPhase) return;
    const subs = db[currentPhase].subscribers;
    const exps = db[currentPhase].expenses;
    
    const totalSubs = subs.length;
    const totalRequired = subs.reduce((sum, s) => sum + s.totalRequired, 0);
    const totalPaid = subs.reduce((sum, s) => sum + s.paidAmount, 0);
    const totalExpenses = exps.reduce((sum, e) => sum + e.amount, 0);
    const totalDebt = totalRequired - totalPaid;
    
    const netIncome = totalPaid - totalExpenses; // الصافي الفعلي بعد المصروفات

    document.getElementById('statTotalSubs').innerText = totalSubs;
    document.getElementById('statTotalMoney').innerText = totalRequired + ' دينار';
    document.getElementById('statTotalDebt').innerText = totalDebt + ' دينار';
}

// --- مساعدات عامة ---
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function sendWhatsApp(phone, message) {
    // تعديل الرقم ليتناسب مع الواتساب (إزالة الصفر الأول وإضافة مفتاح العراق كمثال)
    let formattedPhone = phone;
    if(phone.startsWith('0')) {
        formattedPhone = '964' + phone.substring(1);
    }
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

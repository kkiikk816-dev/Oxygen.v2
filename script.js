// --- 1. إعدادات Supabase (مشروعك الحالي) ---
const SB_URL = 'https://tqjtouxxordmlxvifffg.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxanRvdXh4b3JkbWx4dmlmZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDU4MTMsImV4cCI6MjA4Njk4MTgxM30.A5M_u3lIXIGj099oTNsAg864deu1HHcSLpZUd9MrgjQ';
const sb = supabase.createClient(SB_URL, SB_KEY);

let isLoginMode = true;
let currentUserRole = 'student';

// --- 2. إدارة المصادقة (Auth Logic) ---
async function checkSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        await verifyUserRole(session.user);
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
}

async function verifyUserRole(user) {
    // فحص هل المستخدم أدمن؟
    const { data: admin } = await sb.from('admin_list').select('email').eq('email', user.email).maybeSingle();

    if (admin) {
        currentUserRole = 'admin';
        document.getElementById('adm-btn').style.display = 'flex'; // إظهار زر الأدمن
    } else {
        currentUserRole = 'student';
        document.getElementById('adm-btn').style.display = 'none';
    }

    // حفظ الرتبة للمرجعية السريعة (تجميلي فقط)
    localStorage.setItem('ox_role', currentUserRole);

    // إخفاء شاشة الدخول وبدء التطبيق
    document.getElementById('auth-screen').style.display = 'none';
    loadApp();
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "تسجيل الدخول" : "إنشاء حساب جديد";
    document.getElementById('main-auth-btn').innerText = isLoginMode ? "تسجيل الدخول" : "إنشاء الحساب";
    document.getElementById('toggle-auth-btn').innerText = isLoginMode ? "ليس لديك حساب؟ إنشاء حساب جديد" : "لديك حساب؟ سجل دخولك";
    document.getElementById('auth-msg').style.display = 'none';
}

async function handleAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');
    const btn = document.getElementById('main-auth-btn');

    if (!email || password.length < 6) {
        showMsg("الرجاء إدخال بريد صحيح وكلمة مرور (6 أحرف)", "error");
        return;
    }

    btn.disabled = true;
    btn.innerText = "جاري التحقق...";

    try {
        if (isLoginMode) {
            // تسجيل الدخول
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await verifyUserRole(data.user);
        } else {
            // إنشاء حساب
            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;

            // إضافة الطالب لجدول الطلاب تلقائياً (Secure)
            if (data.user) {
                await sb.from('students').insert([{ id: data.user.id, email: data.user.email }]);
                showMsg("تم إنشاء الحساب! جاري الدخول...", "success");
                await verifyUserRole(data.user);
            }
        }
    } catch (err) {
        console.error(err);
        showMsg("خطأ: " + (err.message === "Invalid login credentials" ? "بيانات الدخول غير صحيحة" : err.message), "error");
        btn.disabled = false;
        btn.innerText = isLoginMode ? "تسجيل الدخول" : "إنشاء الحساب";
    }
}

function showMsg(text, type) {
    const msg = document.getElementById('auth-msg');
    msg.innerText = text;
    msg.className = `status-msg ${type === 'error' ? 'error-msg' : 'success-msg'}`;
    msg.style.display = 'block';
}

async function logoutApp() {
    await sb.auth.signOut();
    localStorage.clear();
    location.reload();
}

// --- 3. منطق التطبيق (Content) ---

// البيانات الثابتة (القاموس، المهارات، النصائح)
const medicalLibrary = [
    { t: "Bradycardia", ar: "بطء نبضات القلب", c: "term" }, { t: "Tachycardia", ar: "تسارع نبضات القلب", c: "term" },
    { t: "Hypertension", ar: "ارتفاع ضغط الدم", c: "term" }, { t: "Hypotension", ar: "انخفاض ضغط الدم", c: "term" },
    { t: "Gastritis", ar: "التهاب المعدة", c: "Suffix-itis" }, { t: "Phlebitis", ar: "التهاب الوريد", c: "Suffix-itis" },
    { t: "Cyanosis", ar: "ازرقاق الجلد", c: "Color" }, { t: "NPO", ar: "لا شيء عن طريق الفم", c: "Abbr" }
];

const masterSkills = [
    { id: 1, name: "المراقبة القلبية (ECG)", desc: "وضع الأقطاب ومراقبة النظم." },
    { id: 2, name: "مقياس غلاسكو (GCS)", desc: "تقييم مستوى الوعي." },
    { id: 3, name: "الإنعاش القلبي (CPR)", desc: "الضغطات الصدرية والتنفس." },
    { id: 4, name: "سحب الدم (Cannula)", desc: "تركيب الكانيولا وسحب الدم." }
];

const tips = [
    { main: "قاعدة الـ 5 rights", full: "المريض، الدواء، الجرعة، الوقت، الطريقة الصحيحة." },
    { main: "علامات الصدمة", full: "هبوط ضغط، تسرع قلب، شحوب، قلة بول." }
];

let store = { ads: [], sch: [], docs: [] };

window.onload = () => {
    checkSession(); // بدء التحقق من الحماية
    setupPWA();
    document.getElementById('today-date').innerText = new Date().toLocaleDateString('ar-EG', {weekday:'long', day:'numeric', month:'long'});
    document.getElementById('user-note').value = localStorage.getItem('ox_note') || "";
    document.getElementById('user-note').oninput = (e) => localStorage.setItem('ox_note', e.target.value);
};

function nav(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navMap = {'p-home':0, 'p-study':1, 'p-tools':2, 'p-skills':3};
    if(navMap[id] !== undefined) document.querySelectorAll('.nav-item')[navMap[id]].classList.add('active');
    toggleMenu(true);
}

function toggleMenu(close=false) {
    const m = document.getElementById('side-menu');
    if(close) m.classList.remove('open'); else m.classList.toggle('open');
}

function toggleBox(id) {
    const x = document.getElementById(id);
    x.style.display = x.style.display === 'none' ? 'block' : 'none';
}

async function loadApp() {
    try {
        const [a, s, d] = await Promise.all([
            sb.from('ads').select('*').order('created_at', {ascending: false}),
            sb.from('schedule').select('*').order('created_at', {ascending: true}),
            sb.from('lectures').select('*').order('created_at', {ascending: false})
        ]);
        store = { ads: a.data||[], sch: s.data||[], docs: d.data||[] };
        renderData();
        initSkills();
        loadDailyQuiz();
        loadStudyRequests();

        const tip = tips[Math.floor(Math.random()*tips.length)];
        document.getElementById('tip-main').innerText = tip.main;
        document.getElementById('tip-details').innerText = tip.full;
    } catch (e) { console.error(e); }
}

function renderData() {
    const days = ["الأحد", "الأثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    document.getElementById('sch-horizontal').innerHTML = days.map(day => {
        const list = store.sch.filter(x => x.day === day);
        return `<div class="day-card">
            <h3 style="margin:0 0 15px; color:var(--accent); border-bottom:1px solid #334155;">${day}</h3>
            ${list.length ? list.map(l => `<div style="margin-bottom:12px;"><b>${l.subject}</b><div style="font-size:0.8rem; opacity:0.7;">⏰ ${l.time} | 📍 ${l.hall}</div></div>`).join('') : '<div style="opacity:0.5;">لا توجد محاضرات</div>'}
        </div>`;
    }).join('');

    document.getElementById('ads-list').innerHTML = store.ads.map(ad => `
        <div class="neu-card" style="border-right:3px solid var(--accent);">
            ${ad.content}
            <div style="font-size:0.6rem; opacity:0.5; margin-top:10px;">${new Date(ad.created_at).toLocaleString('ar-EG')}</div>
            ${currentUserRole === 'admin' ? `<button onclick="delData('ads', ${ad.id})" style="color:var(--danger); background:none; border:none; margin-top:5px;">حذف</button>` : ''}
        </div>`).join('');

    const cats = [...new Set(store.docs.map(x => x.subject_type || 'عام'))];
    document.getElementById('lib-cats').innerHTML = cats.map(c => `<button class="badge" onclick="filterLib('${c}')" style="cursor:pointer; border:none; padding:8px 15px;">${c}</button>`).join('');
    if(cats.length) filterLib(cats[0]);
}

function filterLib(c) {
    const list = store.docs.filter(x => (x.subject_type || 'عام') === c);
    document.getElementById('lib-files').innerHTML = list.map(f => `
        <div class="neu-card" style="display:flex; justify-content:space-between; align-items:center;">
            <b>${f.title}</b>
            <div>
                <a href="${f.link}" target="_blank" style="color:var(--accent); margin-left:10px;"><i class="fas fa-download"></i></a>
                ${currentUserRole === 'admin' ? `<button onclick="delData('lectures', ${f.id})" style="color:var(--danger); background:none; border:none;"><i class="fas fa-trash"></i></button>` : ''}
            </div>
        </div>`).join('');
}

// --- Study Buddy ---
async function submitStudyRequest() {
    const p = {
        subject: document.getElementById('st-subject').value,
        gender: document.getElementById('st-gender').value,
        tele_user: document.getElementById('st-tele').value,
        details: document.getElementById('st-details').value,
        is_approved: false
    };
    if(!p.subject || !p.tele_user) return alert("البيانات ناقصة");
    const { error } = await sb.from('study_requests').insert([p]);
    if(error) alert("خطأ!"); else { alert("تم الإرسال للمراجعة ✅"); toggleBox('study-form-box'); }
}

async function loadStudyRequests() {
    const { data } = await sb.from('study_requests').select('*').eq('is_approved', true).order('created_at', {ascending: false});
    const container = document.getElementById('study-list-container');
    if(data && data.length) {
        container.innerHTML = data.map(req => `
            <div class="neu-card" style="border-right: 4px solid #8b5cf6;">
                <div style="display:flex; justify-content:space-between;"><b style="color:#8b5cf6;">${req.subject}</b><span class="badge">${req.gender}</span></div>
                <p style="font-size:0.9rem;">${req.details}</p>
                <button class="btn-main" style="background:#334155; color:white; font-size:0.8rem;" onclick="offerHelp(${req.id})">مساعدة 🙋‍♂️</button>
            </div>`).join('');
    } else { container.innerHTML = '<p style="text-align:center; opacity:0.5;">لا توجد طلبات حالياً</p>'; }
}

async function offerHelp(reqId) {
    const helper = prompt("يوزرك للتواصل:");
    if(!helper) return;
    await sb.from('study_offers').insert([{ request_id: reqId, helper_tele: helper }]);
    alert("تم إرسال عرضك!");
}

async function approveStudy(id) {
    await sb.from('study_requests').update({ is_approved: true }).eq('id', id);
    alert("تمت الموافقة"); buildAdminForm();
}

// --- Quiz ---
async function loadDailyQuiz() {
    const { data } = await sb.from('daily_quiz').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length) {
        const q = data[0];
        document.getElementById('quiz-container').style.display = 'block';
        document.getElementById('q-text').innerText = q.question;
        document.getElementById('q-options').innerHTML = `
            <button class="btn-main" style="background:#334155; color:#fff;" onclick="checkQ('a','${q.correct_option}','${q.explanation}')">${q.option_a}</button>
            <button class="btn-main" style="background:#334155; color:#fff;" onclick="checkQ('b','${q.correct_option}','${q.explanation}')">${q.option_b}</button>
            <button class="btn-main" style="background:#334155; color:#fff;" onclick="checkQ('c','${q.correct_option}','${q.explanation}')">${q.option_c}</button>
            ${currentUserRole==='admin' ? `<button onclick="delData('daily_quiz',${q.id})" style="color:red; background:none; border:none; margin-top:5px;">حذف</button>` : ''}
        `;
    }
}

function checkQ(ch, cor, exp) {
    const res = document.getElementById('q-res');
    res.style.display = 'block';
    res.innerHTML = (ch === cor) ? `<span style="color:var(--success)">✅ صحيح!</span><br>${exp}` : `<span style="color:var(--danger)">❌ خطأ (الجواب ${cor.toUpperCase()})</span><br>${exp}`;
}

// --- Tools ---
function initSkills() {
    document.getElementById('skills-list').innerHTML = masterSkills.map(s => {
        const isDone = localStorage.getItem(`skill_${s.id}`) === 'true';
        return `<div class="neu-card"><div style="display:flex; align-items:center; gap:10px;">
            <div style="width:24px; height:24px; border:2px solid var(--accent); border-radius:5px; display:flex; align-items:center; justify-content:center; cursor:pointer; background:${isDone? 'var(--success)':'none'}; border-color:${isDone? 'var(--success)':'var(--accent)'}" onclick="checkSkill(${s.id}, this)">${isDone?'✔':''}</div>
            <div><b>${s.name}</b><div style="font-size:0.7rem; opacity:0.7;">${s.desc}</div></div>
        </div></div>`;
    }).join('');
    calcProgress();
}

function checkSkill(id, el) {
    const ch = el.innerText === '';
    el.innerText = ch ? '✔' : '';
    el.style.background = ch ? 'var(--success)' : 'none';
    el.style.borderColor = ch ? 'var(--success)' : 'var(--accent)';
    localStorage.setItem(`skill_${id}`, ch);
    calcProgress();
}

function calcProgress() {
    const done = document.querySelectorAll('#skills-list div[style*="background: var(--success)"]').length;
    const pct = Math.round((done/masterSkills.length)*100);
    document.getElementById('skill-bar').style.width = pct + '%';
    document.getElementById('skill-pct').innerText = pct + '%';
}

function calcOxygen() {
    const val = parseFloat(document.getElementById('mid-theory').value||0) + parseFloat(document.getElementById('mid-prac').value||0) + parseFloat(document.getElementById('mid-daily').value||0);
    document.getElementById('calc-msg').style.display = 'block';
    document.getElementById('calc-msg').innerHTML = `سعيك: <b>${val}/40</b><br>${val < 20 ? 'يحتاج تشد حيلك ⚠' : 'ممتاز استمر ✨'}`;
}

function searchDict() {
    const q = document.getElementById('dict-search').value.toLowerCase();
    const res = document.getElementById('dict-results');
    if(!q) { res.innerHTML = ''; return; }
    const f = medicalLibrary.filter(i => i.t.toLowerCase().includes(q) || i.ar.includes(q));
    res.innerHTML = f.map(i => `<div style="padding:10px; border-bottom:1px solid #334155;"><b>${i.t}</b>: ${i.ar}</div>`).join('');
}

// --- Admin ---
async function buildAdminForm() {
    const t = document.getElementById('adm-choice').value;
    const area = document.getElementById('adm-inputs');
    const pubBtn = document.getElementById('adm-publish-btn');
    pubBtn.style.display = 'block';

    if(t === 'ads') area.innerHTML = `<textarea id="f-ad" class="inset-input" placeholder="النص..."></textarea>`;
    else if(t === 'schedule') area.innerHTML = `<select id="f-day" class="inset-input"><option>الأحد</option><option>الأثنين</option><option>الثلاثاء</option><option>الأربعاء</option><option>الخميس</option></select><input id="f-sub" class="inset-input" placeholder="مادة"><input id="f-time" class="inset-input" placeholder="وقت"><input id="f-hall" class="inset-input" placeholder="قاعة">`;
    else if(t === 'lectures') area.innerHTML = `<input id="f-type" class="inset-input" placeholder="نوع"><input id="f-title" class="inset-input" placeholder="عنوان"><input id="f-link" class="inset-input" placeholder="رابط">`;
    else if(t === 'quiz') area.innerHTML = `<input id="q-quest" class="inset-input" placeholder="سؤال"><input id="q-a" class="inset-input" placeholder="A"><input id="q-b" class="inset-input" placeholder="B"><input id="q-c" class="inset-input" placeholder="C"><select id="q-correct" class="inset-input"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select><textarea id="q-expl" class="inset-input" placeholder="شرح"></textarea>`;

    // --- التعديل الجديد والمطلوب لـ Study Buddy ---
    else if(t === 'study_admin') {
        pubBtn.style.display = 'none';
        const { data: pending } = await sb.from('study_requests').select('*').eq('is_approved', false);
        const { data: offers } = await sb.from('study_offers').select('*, study_requests(subject, gender, tele_user, details)');

        area.innerHTML = `
            <h4 style="color:var(--gold); margin-bottom: 10px;">📥 طلبات قيد الانتظار:</h4>
            ${pending?.length ? pending.map(p => `
                <div class="neu-card" style="border-right:3px solid var(--gold); font-size:0.9rem;">
                    <b>المادة: ${p.subject}</b> <br>
                    <span style="opacity:0.8;">المستخدم: @${p.tele_user}</span>
                    <button class="badge" style="display:block; margin-top:10px; border:none; background:var(--success); color:white; cursor:pointer;" onclick="approveStudy(${p.id})">موافقة ✅</button>
                </div>
            `).join('') : '<p style="opacity:0.5; font-size:0.8rem;">لا توجد طلبات جديدة</p>'}

            <h4 style="color:var(--accent); margin-top:20px; margin-bottom: 10px;">🤝 عروض المساعدة المكتملة:</h4>
            ${offers?.length ? offers.map(o => `
                <div class="neu-card" style="border-right:3px solid var(--accent); background: rgba(56, 189, 248, 0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <b style="color:var(--accent)">تفاصيل المساعدة:</b>
                        <span class="badge">${o.study_requests?.gender || 'غير محدد'}</span>
                    </div>
                    <div style="margin-top:10px; font-size:0.9rem; line-height:1.6;">
                        <div><strong>📚 المادة:</strong> ${o.study_requests?.subject}</div>
                        <div><strong>📝 التفاصيل:</strong> ${o.study_requests?.details}</div>
                        <hr style="border:0; border-top:1px solid var(--border); margin:10px 0;">
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            <div style="color:var(--gold)"><strong>👤 صاحب الطلب:</strong> @${o.study_requests?.tele_user}</div>
                            <div style="color:var(--success)"><strong>🙋‍♂️ مقدم المساعدة:</strong> @${o.helper_tele}</div>
                        </div>
                    </div>
                    <button class="badge" style="margin-top:12px; border:none; background:var(--danger); color:white; width:100%; cursor:pointer; padding:8px;" onclick="delData('study_offers', ${o.id})">حذف العرض 🗑️</button>
                </div>
            `).join('') : '<p style="opacity:0.5; font-size:0.8rem;">لا توجد عروض مساعدة حالياً</p>'}
        `;
    }
}

async function firePublish() {
    const t = document.getElementById('adm-choice').value;
    let p = {};
    if(t === 'ads') p = { content: document.getElementById('f-ad').value };
    else if(t === 'schedule') p = { day: document.getElementById('f-day').value, subject: document.getElementById('f-sub').value, time: document.getElementById('f-time').value, hall: document.getElementById('f-hall').value };
    else if(t === 'lectures') p = { subject_type: document.getElementById('f-type').value, title: document.getElementById('f-title').value, link: document.getElementById('f-link').value };
    else if(t === 'quiz') p = { question: document.getElementById('q-quest').value, option_a: document.getElementById('q-a').value, option_b: document.getElementById('q-b').value, option_c: document.getElementById('q-c').value, correct_option: document.getElementById('q-correct').value, explanation: document.getElementById('q-expl').value };

    const { error } = await sb.from(t === 'quiz' ? 'daily_quiz' : t).insert([p]);
    if(error) alert(error.message); else { alert('تم!'); loadApp(); nav('p-home'); }
}

async function delData(t, id) {
    if(confirm('حذف؟')) { await sb.from(t).delete().eq('id', id); loadApp(); }
}

function setupPWA() {
    const manifest = { "name": "Oxygen Nursing", "display": "standalone", "theme_color": "#0f172a", "icons": [{ "src": "https://i.postimg.cc/CL52rzVc/a2043f1739b2da955eba5a2c1bbd0bb3.jpg", "sizes": "512x512", "type": "image/png" }] };
    const link = document.createElement('link'); link.rel = 'manifest'; link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], {type: 'application/json'}));
    document.head.appendChild(link);
}
// للملاحظات
function addNote() {
    const txt = prompt("اكتب ملاحظتك:");
    if(!txt) return;
    let notes = JSON.parse(localStorage.getItem('ox_notes') || '[]');
    notes.push(txt);
    localStorage.setItem('ox_notes', JSON.stringify(notes));
    renderNotes();
}

function renderNotes() {
    const notes = JSON.parse(localStorage.getItem('ox_notes') || '[]');
    document.getElementById('notes-container').innerHTML = notes.map((n, i) => `
        <div style="background:#0f172a; padding:10px; border-radius:10px; font-size:0.8rem; position:relative;">
            ${n}
            <i class="fas fa-times" onclick="delNote(${i})" style="position:absolute; top:5px; left:5px; color:var(--danger); font-size:0.6rem;"></i>
        </div>
    `).join('');
}



// 1. مصفوفة الاختصارات المحدثة
const medicalData = [
    { short: "S/S", full: "Signs & Symptoms", arabic: "علامات وأعراض" },
    { short: "CBC", full: "Complete Blood Count", arabic: "فحص دم كامل" },
    { short: "Hb", full: "Hemoglobin", arabic: "هيموغلوبين" },
    { short: "ECG / EKG", full: "Electrocardiogram", arabic: "تخطيط القلب" },
    { short: "CXR", full: "Chest X-ray", arabic: "أشعة صدر" },
    { short: "MRI", full: "Magnetic Resonance Imaging", arabic: "رنين مغناطيسي" },
    { short: "ICU", full: "Intensive Care Unit", arabic: "العناية المركزة" },
    { short: "ER", full: "Emergency Room", arabic: "غرفة الطوارئ" },
    { short: "UTI", full: "Urinary Tract Infection", arabic: "التهاب المسالك" },
    { short: "DM", full: "Diabetes Mellitus", arabic: "مرض السكري" },
    { short: "HTN", full: "Hypertension", arabic: "ارتفاع الضغط" },
    { short: "COPD", full: "Chronic Obstructive Pulmonary Disease", arabic: "انسداد رئوي" },
    { short: "SOB", full: "Shortness of Breath", arabic: "ضيق نفس" },
    { short: "N/V", full: "Nausea & Vomiting", arabic: "غثيان وقيء" },
    { short: "I/O", full: "Intake & Output", arabic: "الداخل والخارج" },
    { short: "HR", full: "Heart Rate", arabic: "نبض القلب" },
    { short: "RR", full: "Respiratory Rate", arabic: "معدل التنفس" },
    { short: "BP", full: "Blood Pressure", arabic: "ضغط الدم" },
    { short: "Temp/T", full: "Temperature", arabic: "درجة الحرارة" },
    { short: "SpO2", full: "Oxygen Saturation", arabic: "تشبع الاكسجين في الدم" },
    { short: "IV", full: "Intravenous", arabic: "وريدي" },
    { short: "PO", full: "Per Oral", arabic: "بواسطة الفم" }
];

// 2. مصفوفة الرموز الطبية
const medicalSymbols = [
    { sym: "↑", eng: "Increase", ara: "ارتفاع" },
    { sym: "↓", eng: "Decrease", ara: "انخفاض" },
    { sym: "<", eng: "Less than", ara: "أقل من" },
    { sym: ">", eng: "Greater than", ara: "أكبر من" }
];

// 3. دالة تعبئة البيانات
function loadMedicalAbbrev() {
    // تعبئة الجدول
    const tableBody = document.getElementById('abbrev-table-body');
    if(tableBody) {
        tableBody.innerHTML = medicalData.map(item => `
            <tr>
                <td style="color:var(--accent); font-weight:bold;">${item.short}</td>
                <td style="font-style:italic; opacity:0.7; font-size:0.7rem;">${item.full}</td>
                <td style="font-size:0.8rem;">${item.arabic}</td>
            </tr>
        `).join('');
    }

    // تعبئة الرموز
    const symContainer = document.getElementById('symbols-container');
    if(symContainer) {
        symContainer.innerHTML = medicalSymbols.map(s => `
            <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; text-align:center; border:1px solid rgba(251,191,36,0.2);">
                <div style="font-size:1.5rem; color:#fbbf24; font-weight:bold;">${s.sym}</div>
                <div style="font-size:1rem; opacity:1;">${s.eng}</div>
                <div style="font-size:0.8rem; margin-top:3px;">${s.ara}</div>
            </div>
        `).join('');
    }
}

// 4. ربط الدالة بفتح الصفحة (تأكد من تعديل دالة nav الأصلية)
const oldNav = nav;
nav = function(pageId) {
    oldNav(pageId);
    if(pageId === 'p-abbrev') {
        loadMedicalAbbrev();
    }
};

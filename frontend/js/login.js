let userEmail = "";

// بررسی ورود قبلی (برای جلوگیری از لوپ، فقط اگر واقعاً توکن معتبر بود جابه‌جا شود)
window.onload = () => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    if (token && email) {
        console.log("توکن یافت شد، انتقال به چت...");
        window.location.href = "/chat"; 
    }
};

// تابع تغییر مراحل فرم
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const targetStep = document.getElementById(stepId);
    if (targetStep) targetStep.classList.add('active');
}

// ۱. ارسال کد به ایمیل
async function sendCode() {
    const emailInput = document.getElementById('email');
    userEmail = emailInput.value.trim();
    
    if (!userEmail) return alert("لطفاً ایمیل خود را وارد کنید");

    try {
        const res = await fetch('/api/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await res.json();
        
        if (data.success) {
            showStep('step-otp'); 
        } else {
            alert("خطا در ارسال کد. دوباره تلاش کنید.");
        }
    } catch (err) {
        alert("ارتباط با سرور برقرار نشد. (مطمئن شوید node اجرا شده است)");
    }
}

// ۲. تایید کد وارد شده
async function verifyCode() {
    const otpInput = document.getElementById('otp');
    const code = otpInput.value.trim();
    
    if (!code) return alert("لطفاً کد ۶ رقمی را وارد کنید");

    try {
        const res = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, code: code })
        });
        const data = await res.json();

        if (data.success) {
            // ذخیره موقت ایمیل برای مرحله بعد
            localStorage.setItem("email", userEmail);

            if (data.newUser) {
                showStep('step-name'); // کاربر جدید است، نمایش فرم نام
            } else {
                // کاربر از قبل وجود دارد
                localStorage.setItem("token", data.token);
                window.location.href = "/chat";
            }
        } else {
            alert(data.message || "کد اشتباه است");
        }
    } catch (err) {
        alert("ارتباط با سرور قطع شد");
    }
}

// ۳. تکمیل ثبت‌نام (ذخیره نام و ورود نهایی)
async function completeRegistration() {
    const firstName = document.getElementById('fname').value;
    const lastName = document.getElementById('lname').value;
    const email = localStorage.getItem("email"); // ایمیلی که در مرحله تایید کد ذخیره شده بود

    if (!firstName) return alert("لطفاً نام خود را وارد کنید");

    try {
        const response = await fetch('/api/complete-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, firstName, lastName })
        });

        const data = await response.json();

        if (data.token) {
            // ۱. ذخیره اطلاعات اکانت جدید در حافظه اصلی (برای ورود فعلی)
            localStorage.setItem("token", data.token);
            localStorage.setItem("email", email);
            localStorage.setItem("firstName", firstName);
            
            // ۲. ابطال سیگنال "افزودن حساب جدید" برای جلوگیری از ریدایرکت مجدد
            localStorage.removeItem("is_adding_new"); 

            // ۳. مدیریت لیست تمام اکانت‌ها (allAccounts)
            let all = JSON.parse(localStorage.getItem("allAccounts") || "[]");
            
            // چک می‌کنیم اگر این اکانت از قبل در لیست بود، آپدیت شود، در غیر این صورت اضافه شود
            const existingIndex = all.findIndex(acc => acc.email === email);
            if (existingIndex > -1) {
                all[existingIndex] = { email, name: firstName, token: data.token };
            } else {
                all.push({ email, name: firstName, token: data.token });
            }
            
            localStorage.setItem("allAccounts", JSON.stringify(all));

            // ۴. انتقال به صفحه چت
            window.location.href = "/chat.html";
        } else {
            alert("خطا در ثبت اطلاعات: " + (data.message || "خطای ناشناخته"));
        }
    } catch (err) {
        console.error("Registration Error:", err);
        alert("ارتباط با سرور برقرار نشد. مطمئن شوید سرور روشن است.");
    }
}
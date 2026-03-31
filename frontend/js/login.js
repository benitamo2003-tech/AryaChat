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
    const firstName = document.getElementById('fname').value.trim();
    const lastName = document.getElementById('lname').value.trim();

    if (!firstName) return alert("وارد کردن نام الزامی است");

    try {
        const res = await fetch('/api/auth/complete-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: userEmail, 
                firstName: firstName, 
                lastName: lastName 
            })
        });
        
        const data = await res.json();

        if (data.success) {
            // ذخیره توکن و ایمیل در مرورگر (بسیار حیاتی)
            localStorage.setItem("token", data.token);
            localStorage.setItem("email", userEmail);
            
            console.log("ثبت‌نام تکمیل شد. انتقال به صفحه چت...");
            window.location.href = "/chat";
        } else {
            alert("خطا در ثبت نهایی اطلاعات.");
        }
    } catch (err) {
        console.error("خطای ثبت‌نام:", err);
        alert("ارتباط با سرور در مرحله نهایی قطع شد.");
    }
}
let userEmail = "";

// بررسی اینکه آیا کاربر قبلاً لاگین کرده است؟
window.onload = () => {
    const token = localStorage.getItem("token");
    if (token) {
        window.location.href = "/chat"; // اگر توکن داشت، مستقیم برو به چت
    }
};

// تابع تغییر مراحل (انیمیشن ساده)
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
}

// ۱. ارسال کد به ایمیل
async function sendCode() {
    userEmail = document.getElementById('email').value.trim();
    if (!userEmail) return alert("لطفاً ایمیل خود را وارد کنید");

    try {
        const res = await fetch('/api/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await res.json();
        if (data.success) {
            showStep('step-otp'); // رفتن به مرحله وارد کردن کد
        } else {
            alert("خطا در ارسال کد. دوباره تلاش کنید.");
        }
    } catch (err) {
        alert("ارتباط با سرور برقرار نشد.");
    }
}

// ۲. تایید کد
async function verifyCode() {
    const otpInput = document.getElementById('otp');
    const code = otpInput.value.trim();
    
    console.log("کد ارسالی به سرور:", code); // در کنسول مرورگر (F12) ببین

    if (!code) return alert("لطفاً کد را وارد کنید");

    try {
        const res = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, code: code })
        });
        const data = await res.json();

        if (data.success) {
            if (data.newUser) {
                showStep('step-name'); // نمایش فرم نام و نام خانوادگی
            } else {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                window.location.href = "/chat";
            }
        } else {
            alert(data.message || "کد اشتباه است");
        }
    } catch (err) {
        console.error("خطا:", err);
        alert("ارتباط با سرور قطع شد");
    }
}

// ۳. تکمیل ثبت‌نام (برای کاربران جدید)
async function completeRegistration() {
    const fname = document.getElementById('fname').value.trim();
    const lname = document.getElementById('lname').value.trim();

    if (!fname) return alert("نام الزامی است");

    try {
        const res = await fetch('/api/auth/complete-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, firstName: fname, lastName: lname })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.location.href = "/chat";
        }
    } catch (err) {
        alert("خطا در ثبت اطلاعات.");
    }
}
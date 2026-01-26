(function(){
    // Client-side validation and UX for #contactForm
    function $(selector, ctx){ return (ctx||document).querySelector(selector); }

    function showError(id, message){
        const el = document.getElementById(id);
        if(!el) return;
        el.textContent = message || '';
        el.style.display = message ? 'block' : 'none';
    }

    function validateForm(){
        let ok = true;
        const name = $('#name')?.value.trim() || '';
        const email = $('#email')?.value.trim() || '';
        const phone = $('#phone')?.value.trim() || '';
        const human = $('#humanVerify')?.checked;

        // Name
        if(!name){ showError('name-error', 'Please enter your full name'); ok = false; }
        else showError('name-error', '');

        // Email - use browser validity first
        const emailEl = $('#email');
        if(!email){ showError('email-error', 'Please enter your email address'); ok = false; }
        else if(emailEl && !emailEl.checkValidity()){ showError('email-error', 'Please enter a valid email address'); ok = false; }
        else showError('email-error', '');

        // Phone - allow numbers, spaces, + and -
        if(!phone){ showError('phone-error', 'Please enter your phone number'); ok = false; }
        else if(!/^\+?[0-9 \-]{7,20}$/.test(phone)){ showError('phone-error', 'Please enter a valid phone number'); ok = false; }
        else showError('phone-error', '');

        // Human verify
        if(!human){ showError('verify-error', 'Please confirm you are not a robot'); ok = false; }
        else showError('verify-error', '');

        return ok;
    }

    function notify(message, type){
        const container = document.getElementById('notificationContainer');
        if(!container) return;
        const n = document.createElement('div');
        n.className = 'site-notification ' + (type||'info');
        n.textContent = message;
        container.appendChild(n);
        setTimeout(()=>{ n.classList.add('visible'); }, 10);
        setTimeout(()=>{ n.classList.remove('visible'); setTimeout(()=>n.remove(), 300); }, 4000);
    }

    function init(){
        const form = document.getElementById('contactForm');
        if(!form) return;

        form.addEventListener('submit', function(e){
            e.preventDefault();
            if(!validateForm()){
                notify('Please fix the errors in the form and try again.', 'error');
                return;
            }

            // Form is valid. For now, show a success notification and reset form.
            // If you have a backend endpoint, replace this section with fetch POST.
            notify('Thanks — your message was prepared to be sent. We will respond within 24 hours.', 'success');
            form.reset();
        });

        // Clear inline error messages on input
        ['name','email','phone'].forEach(id => {
            const el = document.getElementById(id);
            if(!el) return;
            el.addEventListener('input', () => {
                const errId = id + '-error';
                showError(errId, '');
            });
        });
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

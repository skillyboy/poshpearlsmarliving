# PoshPearl - Manual Testing Guide

## 🚀 Getting Started

1. **Start the development server:**
```powershell
python manage.py runserver
```

2. **Open your browser** and navigate to: `http://localhost:8000`

---

## 📋 Test Scenarios

### Scenario 1: Guest Checkout → Auto-User Creation ✨

**Goal:** Test the automatic user account creation feature

1. **Browse Products**
   - Navigate to `/shop/`
   - Click on any product
   - Add 2-3 different products to cart

2. **View Cart**
   - Click cart icon or go to `/cart/`
   - Verify products are listed
   - Update quantities if needed

3. **Checkout as Guest**
   - Click "Proceed to Checkout"
   - Fill in the form:
     ```
     Name: John Doe
     Email: john.doe@example.com
     Phone: 08012345678
     Address: 123 Test Street, Ikeja, Lagos
     ```
   - Click "Continue to Payment"

4. **Skip Payment (Test Mode)**
   - Close the Paystack popup if it appears
   - OR use Paystack test card: `4084 0840 8408 4081`
   - CVV: `408`, Expiry: `12/30`, PIN: `0000`, OTP: `123456`

5. **Check Email (Console)**
   - Go back to your terminal/console
   - Look for the welcome email output
   - You should see: "Welcome to PoshPearl" email with password reset link

6. **Set Password**
   - Copy the password reset URL from the email
   - Paste it in browser
   - Set a password (e.g., `TestPass123!`)

7. **Login & View Dashboard**
   - Go to `/accounts/login/`
   - Login with email and password
   - You should be redirected to `/account/`
   - Verify your order appears in recent orders

**✅ Success Criteria:**
- User account created automatically
- Welcome email sent
- Password can be set
- Login works
- Order visible in dashboard

---

### Scenario 2: User Dashboard & Order History

**Goal:** Test the user dashboard features

1. **Login** (if not already logged in)
   - Go to `/accounts/login/`
   - Use credentials from Scenario 1

2. **Dashboard Overview**
   - Should land on `/account/`
   - Verify:
     - Profile information displayed
     - Recent orders shown (max 5)
     - Quick action buttons present

3. **Order History**
   - Click "View All Orders"
   - Should navigate to `/account/orders/`
   - Verify:
     - All orders listed
     - Status badges displayed correctly
     - Date/time shown

4. **Order Details**
   - Click on any order
   - Should navigate to `/account/orders/<id>/`
   - Verify:
     - Full order information
     - Items with images and prices
     - Delivery address
     - Payment status

**✅ Success Criteria:**
- Dashboard loads correctly
- Recent orders displayed
- Full order history accessible
- Order details page shows complete information

---

### Scenario 3: Authentication Flow

**Goal:** Test all password management features

1. **Password Reset Request**
   - Go to `/accounts/password_reset/`
   - Enter your email
   - Click "Send Reset Link"
   - Verify confirmation page loads

2. **Password Reset Email**
   - Check console for email
   - Copy reset URL
   - Navigate to it in browser

3. **Set New Password**
   - Enter new password twice
   - Submit form
   - Verify success page

4. **Login with New Password**
   - Go to `/accounts/login/`
   - Login with new password
   - Should work successfully

5. **Change Password (Logged In)**
   - While logged in, go to `/accounts/password_change/`
   - Enter old password
   - Enter new password twice
   - Submit
   - Verify success page

**✅ Success Criteria:**
- Password reset flow works end-to-end
- Emails sent correctly
- Password change works for logged-in users
- Can login with new passwords

---

### Scenario 4: Wholesale/B2B Inquiry

**Goal:** Test the wholesale partnership application

1. **Navigate to Wholesale Page**
   - Go to `/wholesale/`
   - Scroll through the page
   - Verify:
     - Benefits grid (6 cards with icons)
     - Pricing tiers (10%, 20%, 30%, 40%)
     - Application form visible

2. **Submit Application**
   - Fill in the form:
     ```
     Company Name: Test Corp
     Contact Person: Jane Smith
     Email: jane@testcorp.com
     Phone: 08098765432
     Address: 456 Business Ave, VI, Lagos
     Business Type: Retailer/Shop Owner
     Volume: 100-299 units
     Website: https://testcorp.com
     Message: We're interested in becoming a wholesale partner
     ```
   - Click "Submit Application"

3. **Verify Success**
   - Should see success message
   - Green checkmark icon
   - Confirmation text

4. **Check Admin**
   - Go to `/admin/`
   - Login with superuser credentials
   - Navigate to "Wholesale Inquiries"
   - Verify your submission appears

**✅ Success Criteria:**
- Form submits successfully
- Success message displayed
- Inquiry saved in database
- Visible in admin interface

---

### Scenario 5: Trust & Legal Pages

**Goal:** Verify all trust pages load correctly

1. **About Us** → `/about/`
   - Gradient hero section
   - Values grid with 3 cards
   - "What Sets Us Apart" section
   - CTA buttons

2. **FAQ** → `/faq/`
   - Collapsible accordion sections
   - Click different questions
   - Verify smooth animations
   - 4 categories (Ordering, Shipping, Returns, Account)

3. **Privacy Policy** → `/privacy/`
   - Comprehensive sections
   - Contact information
   - Last updated date

4. **Terms of Service** → `/terms/`
   - All 14 sections present
   - Contact information
   - Acceptance notice at bottom

5. **Footer Navigation**
   - Scroll to bottom on any page
   - Verify footer has 3 columns:
     - Shop (All Products, Cart, Track Order)
     - Company (About, FAQ, Contact)
     - Legal (Privacy, Terms)
   - Test links

**✅ Success Criteria:**
- All pages load without errors
- Modern UI with gradients and icons
- Responsive design
- Footer navigation works

---

### Scenario 6: Payment Result Pages

**Goal:** Test payment success and failure UI

1. **Payment Success**
   - Go to `/payments/success/?order_id=1`
   - (Replace `1` with actual order ID)
   - Verify:
     - Animated green checkmark
     - Order details displayed
     - "What's Next" section
     - Action buttons

2. **Payment Failed**
   - Go to `/payments/failed/?order_id=1`
   - Verify:
     - Red error icon
     - Common reasons listed
     - What to do section
     - Retry button

**✅ Success Criteria:**
- Success page shows order info
- Failed page shows helpful tips
- Call-to-action buttons work
- Professional design

---

## 🔍 Visual Checklist

For each page, verify these UI elements:

- [ ] **Header**: Logo, navigation links, cart icon, user menu
- [ ] **Gradients**: Modern gradient backgrounds on hero sections
- [ ] **Icons**: FontAwesome icons throughout
- [ ] **Cards**: Consistent card design with shadows
- [ ] **Buttons**: Primary, secondary, and ghost button styles
- [ ] **Animations**: Smooth transitions and hover effects
- [ ] **Responsive**: Works on different screen sizes
- [ ] **Footer**: 3-column layout with links

---

## 🐛 Common Issues & Solutions

### Issue: Migration errors
**Solution:**
```powershell
python manage.py makemigrations
python manage.py migrate
```

### Issue: Email not showing in console
**Solution:** Check `settings.py` has:
```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

### Issue: Static files not loading
**Solution:**
```powershell
python manage.py collectstatic --noinput
```

### Issue: 404 on pages
**Solution:** Check URL patterns in `poshapp/urls.py` and `project/urls.py`

---

## 📊 Testing Checklist

Mark each as you test:

**Core E-commerce:**
- [ ] Browse products
- [ ] Add to cart
- [ ] Update cart quantities
- [ ] Checkout process
- [ ] Order tracking

**Auto-User Creation:**
- [ ] Guest checkout creates user
- [ ] Welcome email sent
- [ ] Password reset link works
- [ ] Can login after setting password
- [ ] Order linked to user account

**User Dashboard:**
- [ ] Dashboard loads
- [ ] Recent orders displayed
- [ ] Full order history
- [ ] Order detail page
- [ ] Password change

**Authentication:**
- [ ] Login
- [ ] Logout
- [ ] Password reset
- [ ] Password change
- [ ] All email templates

**Trust Pages:**
- [ ] About Us
- [ ] FAQ (test accordion)
- [ ] Privacy Policy
- [ ] Terms of Service

**Wholesale:**
- [ ] Page loads
- [ ] Form submits
- [ ] Success message
- [ ] Saved in database

**Payment Pages:**
- [ ] Success page
- [ ] Failed page

**Navigation:**
- [ ] Header links
- [ ] Footer links
- [ ] User menu (logged in)
- [ ] Login button (logged out)

---

## ✅ Final Verification

After testing all scenarios:

1. **Check Database**
   ```powershell
   python manage.py shell
   ```
   ```python
   from poshapp.models import User, Order, WholesaleInquiry
   print(f"Users: {User.objects.count()}")
   print(f"Orders: {Order.objects.count()}")
   print(f"Wholesale Inquiries: {WholesaleInquiry.objects.count()}")
   ```

2. **Check Admin**
   - Login to `/admin/`
   - Verify all models visible
   - Check data entries

3. **Console Logs**
   - Review terminal for any errors
   - Verify emails printed correctly

---

## 🎉 Success!

If all scenarios pass, your PoshPearl platform is **fully functional** with:
- ✅ 24 complete pages
- ✅ Auto-user creation
- ✅ Full authentication flow
- ✅ User dashboard
- ✅ Wholesale/B2B system
- ✅ Trust & legal pages
- ✅ Premium UI/UX

**Your e-commerce platform is production-ready!** 🚀

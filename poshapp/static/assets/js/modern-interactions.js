/**
 * Scroll Animation Observer
 * Detects when elements enter viewport and adds 'visible' class
 */
document.addEventListener('DOMContentLoaded', function() {
  // 1. Sticky Navigation with Glass Effect
  const nav = document.querySelector('.site-header');
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  });

  // 2. Scroll Animation Observer
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  // Observe all elements with fade-in-up class
  document.querySelectorAll('.fade-in-up').forEach(el => {
    observer.observe(el);
  });

  // 3. Button Ripple Effect
  document.querySelectorAll('.btn-modern, .btn-gold, .btn-glass').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // 4. Product Card Tilt Effect (3D)
  document.querySelectorAll('.product-card-modern').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // 5. Smooth Scroll for Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href !== '#!') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

  // 6. Add to Cart Animation
  document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const icon = this.querySelector('i');
      if (icon) {
        icon.classList.add('fa-bounce');
        setTimeout(() => icon.classList.remove('fa-bounce'), 500);
      }
      
      // Show notification
      showNotification('Added to cart!', 'success');
    });
  });

  // 7. Notification System
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Make showNotification globally available
  window.showNotification = showNotification;

  // 8. Loading State for Images
  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
    img.addEventListener('load', function() {
      this.classList.add('loaded');
    });
  });

  // 9. Number Counter Animation
  document.querySelectorAll('[data-count]').forEach(counter => {
    const target = parseInt(counter.getAttribute('data-count'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const updateCounter = () => {
      current += step;
      if (current < target) {
        counter.textContent = Math.floor(current);
        requestAnimationFrame(updateCounter);
      } else {
        counter.textContent = target;
      }
    };
    
    observer.observe(counter);
    counter.addEventListener('visible', () => {
      updateCounter();
    }, { once: true });
  });

  // 10. Hero Background Animation
  const heroGradient = document.querySelector('.hero-modern');
  if (heroGradient) {
    let hue = 0;
    setInterval(() => {
      hue = (hue + 0.5) % 360;
      // Subtle hue rotation for dynamic feel
    }, 50);
  }
});

// CSS for Ripple Effect
const style = document.createElement('style');
style.textContent = `
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transform: scale(0);
    animation: ripple-animation 0.6s ease-out;
    pointer-events: none;
  }
  
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  .notification {
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 250px;
  }
  
  .notification i {
    font-size: 1.25rem;
  }
  
  .notification-success {
    color: var(--success, #10b981);
  }
  
  .notification-error {
    color: var(--error, #ef4444);
  }
  
  .notification-info {
    color: var(--info, #3b82f6);
  }
  
  @keyframes slideOutRight {
    to {
      opacity: 0;
      transform: translateX(150%);
    }
  }
  
  img.loaded {
    animation: fadeIn 0.3s ease-in;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);

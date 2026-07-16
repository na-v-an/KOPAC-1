const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.primary-nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    nav.classList.toggle('is-open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -4% 0px' }
);

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

// Quiet parallax: deliberately capped to a few pixels so the site does not feel animated.
const parallaxItems = [...document.querySelectorAll('[data-parallax]')];
let parallaxFrame = null;

function updateParallax() {
  const viewportMiddle = window.innerHeight / 2;

  parallaxItems.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const itemMiddle = rect.top + rect.height / 2;
    const strength = Number(item.dataset.parallax || 8);
    const progress = (itemMiddle - viewportMiddle) / window.innerHeight;
    const shift = Math.max(-Math.abs(strength), Math.min(Math.abs(strength), progress * strength));
    item.style.setProperty('--parallax-shift', `${shift.toFixed(2)}px`);
  });

  parallaxFrame = null;
}

if (!prefersReducedMotion && parallaxItems.length) {
  const requestParallaxUpdate = () => {
    if (parallaxFrame) return;
    parallaxFrame = window.requestAnimationFrame(updateParallax);
  };

  updateParallax();
  window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
  window.addEventListener('resize', requestParallaxUpdate);
}

// Expandable capability panels inside the three practice cards.
document.querySelectorAll('[data-practice-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const card = button.closest('.practice-card');
    const detail = card?.querySelector('.practice-detail');
    if (!card || !detail) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isExpanded));
    button.querySelector('span').textContent = isExpanded ? 'View capability' : 'Hide capability';
    detail.hidden = isExpanded;
    card.classList.toggle('is-expanded', !isExpanded);
  });
});

const form = document.querySelector('.contact-form');
const statusMessage = document.querySelector('.form-status');

if (form && statusMessage) {
  form.addEventListener('submit', (event) => {
    if (!form.checkValidity()) {
      event.preventDefault();
      statusMessage.textContent = 'Please complete the required fields before sending.';
      form.reportValidity();
      return;
    }

    // Netlify will process this form after deployment.
    // While opening the file locally, this prevents a confusing blank navigation.
    if (window.location.protocol === 'file:') {
      event.preventDefault();
      statusMessage.textContent = 'The form is ready. Deploy on Netlify to receive submissions, or connect your preferred form service.';
    }
  });
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// Always return to the true top of the page when the wordmark is selected.
const brandLink = document.querySelector('.brand');
if (brandLink) {
  brandLink.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });

    if (nav && menuButton) {
      nav.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }

    // Keep the URL clean after navigating home.
    if (window.location.hash && window.location.protocol !== 'file:') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });
}

// Insights carousel: three complete cards on desktop, automatic card-by-card
// movement, seamless looping, hover/focus pause and manual arrow controls.
const insightCarousel = document.querySelector('[data-insight-carousel]');
const insightTrack = document.querySelector('[data-insight-track]');
const insightPrev = document.querySelector('[data-insight-prev]');
const insightNext = document.querySelector('[data-insight-next]');

if (insightCarousel && insightTrack && insightPrev && insightNext) {
  const originals = [...insightTrack.querySelectorAll('.insight-card')];
  const cloneCount = Math.min(3, originals.length);
  let currentIndex = cloneCount;
  let step = 0;
  let autoTimer = null;
  let isHovered = false;
  let isFocused = false;
  let isAnimating = false;
  let resizeFrame = null;

  const prepareClone = (card) => {
    const clone = card.cloneNode(true);
    clone.classList.remove('reveal', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3');
    clone.classList.add('is-visible', 'insight-clone');
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
      element.setAttribute('tabindex', '-1');
    });
    return clone;
  };

  originals.slice(-cloneCount).reverse().forEach((card) => {
    insightTrack.prepend(prepareClone(card));
  });

  originals.slice(0, cloneCount).forEach((card) => {
    insightTrack.appendChild(prepareClone(card));
  });

  const visibleCardCount = () => {
    if (window.innerWidth <= 680) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
  };

  const setTrackPosition = (animate = true) => {
    insightTrack.classList.toggle('is-jumping', !animate);
    insightTrack.style.transform = `translate3d(${-currentIndex * step}px, 0, 0)`;

    if (!animate) {
      // Force the no-transition position to commit before transitions resume.
      void insightTrack.offsetWidth;
      insightTrack.classList.remove('is-jumping');
    }
  };

  const measureCarousel = () => {
    const styles = window.getComputedStyle(insightTrack);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0');
    const visible = visibleCardCount();
    const cardWidth = (insightCarousel.clientWidth - gap * (visible - 1)) / visible;

    insightTrack.style.setProperty('--insight-card-width', `${cardWidth}px`);
    step = cardWidth + gap;
    setTrackPosition(false);
  };

  const shouldPause = () => prefersReducedMotion || isHovered || isFocused || document.hidden;

  const stopAutoplay = () => {
    if (autoTimer) window.clearInterval(autoTimer);
    autoTimer = null;
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (shouldPause()) return;
    autoTimer = window.setInterval(() => moveCarousel(1, false), 3600);
  };

  const moveCarousel = (direction, manual = true) => {
    if (!step || isAnimating) return;
    isAnimating = true;
    currentIndex += direction;
    setTrackPosition(true);

    if (manual) {
      stopAutoplay();
      window.setTimeout(startAutoplay, 5000);
    }
  };

  insightTrack.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'transform') return;
    isAnimating = false;

    const firstOriginal = cloneCount;
    const afterLastOriginal = cloneCount + originals.length;

    if (currentIndex >= afterLastOriginal) {
      currentIndex -= originals.length;
      setTrackPosition(false);
    } else if (currentIndex < firstOriginal) {
      currentIndex += originals.length;
      setTrackPosition(false);
    }
  });

  insightPrev.addEventListener('click', () => moveCarousel(-1));
  insightNext.addEventListener('click', () => moveCarousel(1));

  insightCarousel.addEventListener('mouseenter', () => {
    isHovered = true;
    stopAutoplay();
  });

  insightCarousel.addEventListener('mouseleave', () => {
    isHovered = false;
    startAutoplay();
  });

  insightCarousel.addEventListener('focusin', () => {
    isFocused = true;
    stopAutoplay();
  });

  insightCarousel.addEventListener('focusout', (event) => {
    if (!insightCarousel.contains(event.relatedTarget)) {
      isFocused = false;
      startAutoplay();
    }
  });

  insightCarousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveCarousel(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveCarousel(1);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  window.addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      measureCarousel();
      resizeFrame = null;
    });
  });

  measureCarousel();
  startAutoplay();
}

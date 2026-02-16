(() => {
  const form = document.getElementById('url-form');
  const input = document.getElementById('url-input');
  const btn = document.getElementById('submit-btn');
  const errorEl = document.getElementById('error');
  const loadingEl = document.getElementById('loading');
  const cardsEl = document.getElementById('cards');

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '...' : str;
  }

  function imgTag(src, cls, alt) {
    if (!src) return '';
    const escaped = escapeHtml(src);
    return `<img class="${cls}" src="${escaped}" alt="${escapeHtml(alt || '')}" onerror="this.classList.add('no-image')">`;
  }

  // Platform render functions
  function renderGoogle(m) {
    const faviconSrc = m.favicon ? escapeHtml(m.favicon) : '';
    const tabFavicon = faviconSrc
      ? `<img class="tab-favicon" src="${faviconSrc}" onerror="this.style.display='none'">`
      : `<svg class="tab-favicon-fallback" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#ddd"/></svg>`;
    const serpFavicon = faviconSrc
      ? `<img class="google-favicon" src="${faviconSrc}" onerror="this.style.display='none'">`
      : '';
    return `<div class="chrome-tab">
      <div class="tab-bar">
        <div class="tab-dots"><span></span><span></span><span></span></div>
        <div class="tab-active">
          ${tabFavicon}
          <span class="tab-title">${escapeHtml(truncate(m.title, 32))}</span>
          <svg class="tab-close" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="#5f6368" stroke-width="1.2" stroke-linecap="round"/></svg>
        </div>
      </div>
    </div>
    <div class="google-card">
      <div class="google-url">
        ${serpFavicon}
        <span class="google-domain">${escapeHtml(m.domain)}</span>
      </div>
      <div class="google-title">${escapeHtml(truncate(m.title, 70))}</div>
      <div class="google-desc">${escapeHtml(truncate(m.description, 160))}</div>
    </div>`;
  }

  function renderFacebook(m) {
    return `<div class="facebook-card">
      ${imgTag(m.image, 'fb-image', m.title)}
      <div class="fb-info">
        <div class="fb-domain">${escapeHtml(m.domain)}</div>
        <div class="fb-title">${escapeHtml(truncate(m.title, 100))}</div>
        <div class="fb-desc">${escapeHtml(truncate(m.description, 110))}</div>
      </div>
    </div>`;
  }

  function renderX(m) {
    const isLarge = m.twitterCard === 'summary_large_image';
    const variant = isLarge ? 'x-large' : 'x-summary';
    if (isLarge) {
      return `<div class="x-card x-large">
        ${imgTag(m.image, 'x-image', m.title)}
        <div class="x-info">
          <div class="x-domain">${escapeHtml(m.domain)}</div>
          <div class="x-title">${escapeHtml(truncate(m.title, 70))}</div>
          <div class="x-desc">${escapeHtml(truncate(m.description, 100))}</div>
        </div>
      </div>`;
    }
    return `<div class="x-card x-summary">
      ${imgTag(m.image, 'x-image', m.title)}
      <div class="x-info">
        <div class="x-domain">${escapeHtml(m.domain)}</div>
        <div class="x-title">${escapeHtml(truncate(m.title, 70))}</div>
      </div>
    </div>`;
  }

  function renderLinkedIn(m) {
    return `<div class="linkedin-card">
      ${imgTag(m.image, 'li-image', m.title)}
      <div class="li-info">
        <div class="li-title">${escapeHtml(truncate(m.title, 100))}</div>
        <div class="li-domain">${escapeHtml(m.domain)}</div>
      </div>
    </div>`;
  }

  function renderDiscord(m) {
    const borderColor = m.themeColor || '#5865f2';
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `<div class="discord-msg">
      <div class="dc-avatar">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#fff"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#fff"/></svg>
      </div>
      <div class="dc-msg-header">
        <span class="dc-username">User</span>
        <span class="dc-timestamp">Today at ${time}</span>
      </div>
      <div class="dc-msg-domain">${escapeHtml(m.domain)}</div>
      <div class="dc-msg-url">${escapeHtml(m.url)}</div>
      <div class="discord-card" style="border-left-color: ${escapeHtml(borderColor)}">
        ${m.siteName ? `<div class="dc-site">${escapeHtml(m.siteName)}</div>` : ''}
        <div class="dc-title">${escapeHtml(truncate(m.title, 100))}</div>
        ${m.description ? `<div class="dc-desc">${escapeHtml(truncate(m.description, 200))}</div>` : ''}
        ${imgTag(m.image, 'dc-image', m.title)}
      </div>
    </div>`;
  }

  function renderSlack(m) {
    const siteName = m.siteName || m.domain;
    return `<div class="slack-card">
      <div class="sl-site">${escapeHtml(siteName)}</div>
      <div class="sl-title">${escapeHtml(truncate(m.title, 100))}</div>
      ${m.description ? `<div class="sl-desc">${escapeHtml(truncate(m.description, 200))}</div>` : ''}
      ${imgTag(m.image, 'sl-image', m.title)}
    </div>`;
  }

  function renderIMessage(m) {
    return `<div class="imessage-card">
      ${imgTag(m.image, 'im-image', m.title)}
      <div class="im-info">
        <div class="im-title">${escapeHtml(truncate(m.title, 80))}</div>
        <div class="im-domain">${escapeHtml(m.domain)}</div>
      </div>
    </div>`;
  }

  function renderWhatsApp(m) {
    return `<div class="whatsapp-card">
      ${imgTag(m.image, 'wa-image', m.title)}
      <div class="wa-info">
        <div class="wa-title">${escapeHtml(truncate(m.title, 80))}</div>
        ${m.description ? `<div class="wa-desc">${escapeHtml(truncate(m.description, 120))}</div>` : ''}
        <div class="wa-domain">${escapeHtml(m.domain)}</div>
      </div>
    </div>`;
  }

  const renderers = {
    google: renderGoogle,
    facebook: renderFacebook,
    x: renderX,
    linkedin: renderLinkedIn,
    discord: renderDiscord,
    slack: renderSlack,
    imessage: renderIMessage,
    whatsapp: renderWhatsApp,
  };

  function showError(msg, isLocal) {
    const catUrl = `https://cataas.com/cat/says/404?fontSize=50&fontColor=white&t=${Date.now()}`;
    let html = `<img class="error-cat" src="${catUrl}" alt="Sad cat" onerror="this.style.display='none'">`;
    html += `<p class="error-text">${escapeHtml(msg)}</p>`;
    if (isLocal) {
      html += `<p class="error-hint">Trying to preview a local dev server? Use <a href="https://ngrok.com/docs/getting-started/" target="_blank" rel="noopener">ngrok</a> (free) to get a public URL first.</p>`;
    }
    errorEl.innerHTML = html;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.innerHTML = '';
  }

  function setLoading(on) {
    loadingEl.hidden = !on;
    btn.disabled = on;
    btn.textContent = on ? 'Loading...' : 'Preview';
  }

  function renderCards(data) {
    for (const [platform, render] of Object.entries(renderers)) {
      const wrapper = document.getElementById(`card-${platform}`);
      const content = wrapper.querySelector('.card-content');
      content.innerHTML = render(data);
    }
    cardsEl.hidden = false;
  }

  function showHint() {
    let hint = document.getElementById('demo-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'demo-hint';
      hint.innerHTML = 'Example — <strong>try your own URL</strong>';
      form.appendChild(hint);
    }
    hint.hidden = false;
  }

  function hideHint() {
    const hint = document.getElementById('demo-hint');
    if (hint) hint.hidden = true;
  }

  // Restore last preview or load demo for first-time visitors
  try {
    const saved = localStorage.getItem('lastPreview');
    if (saved) {
      const { url, data } = JSON.parse(saved);
      input.value = url;
      renderCards(data);
    } else {
      // First visit: auto-fetch romanslack.com as demo
      (async () => {
        setLoading(true);
        try {
          const demoUrl = 'https://romanslack.com';
          const res = await fetch(`/api/extract?url=${encodeURIComponent(demoUrl)}`);
          const data = await res.json();
          if (res.ok) {
            input.value = demoUrl;
            renderCards(data);
            showHint();
          }
        } catch {} finally {
          setLoading(false);
        }
      })();
    }
  } catch {}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    hideHint();
    cardsEl.hidden = true;

    let url = input.value.trim();
    if (!url) return;

    // Auto-add https:// if no protocol
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
      input.value = url;
    }

    // Detect localhost/private URLs client-side for better UX
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);

    setLoading(true);

    try {
      const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Something went wrong.', isLocal);
        return;
      }

      renderCards(data);

      // Save to localStorage
      try {
        localStorage.setItem('lastPreview', JSON.stringify({ url, data }));
      } catch {}
    } catch (err) {
      showError("Couldn't connect to our server. Check your internet connection and try again.", false);
    } finally {
      setLoading(false);
    }
  });
})();

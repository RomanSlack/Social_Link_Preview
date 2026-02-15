const express = require('express');
const cheerio = require('cheerio');
const { URL } = require('url');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiter: 30 req/min per IP
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const window = 60_000;
  const max = 30;

  if (!rateMap.has(ip)) rateMap.set(ip, []);
  const timestamps = rateMap.get(ip).filter(t => now - t < window);
  if (timestamps.length >= max) {
    return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  }
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  next();
}

// Clean up rate limiter every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateMap) {
    const filtered = timestamps.filter(t => now - t < 60_000);
    if (filtered.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, filtered);
  }
}, 300_000);

function validateUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private/reserved IPs and localhost
  const blocked = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
  ];
  if (blocked.includes(hostname)) {
    throw new Error('Local/private URLs are not allowed');
  }

  // Block private IP ranges
  const parts = hostname.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0 ||
      a === 169 && b === 254
    ) {
      throw new Error('Private IP addresses are not allowed');
    }
  }

  return parsed.href;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SocialLinkPreview/1.0; +https://github.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('URL does not return HTML');
    }

    // Read with 2MB cap
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    const maxSize = 2 * 1024 * 1024;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxSize) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder();
    return chunks.map(c => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  } finally {
    clearTimeout(timeout);
  }
}

function extractMeta(html, url) {
  const $ = cheerio.load(html);

  const get = (selectors) => {
    for (const sel of selectors) {
      const val = $(sel).attr('content') || $(sel).attr('value');
      if (val && val.trim()) return val.trim();
    }
    return '';
  };

  const ogTitle = get([
    'meta[property="og:title"]',
    'meta[name="og:title"]',
    'meta[name="twitter:title"]',
    'meta[property="twitter:title"]',
  ]) || $('title').text().trim();

  const ogDescription = get([
    'meta[property="og:description"]',
    'meta[name="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="twitter:description"]',
    'meta[name="description"]',
  ]);

  const ogImage = get([
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ]);

  const ogUrl = get([
    'meta[property="og:url"]',
    'meta[name="og:url"]',
  ]) || url;

  const siteName = get([
    'meta[property="og:site_name"]',
    'meta[name="og:site_name"]',
  ]);

  const twitterCard = get([
    'meta[name="twitter:card"]',
    'meta[property="twitter:card"]',
  ]) || 'summary';

  const themeColor = get([
    'meta[name="theme-color"]',
    'meta[property="theme-color"]',
  ]);

  // Favicon
  let favicon = '';
  const iconEl = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first();
  if (iconEl.length) {
    favicon = iconEl.attr('href') || '';
  }

  // Resolve relative URLs
  const resolve = (u) => {
    if (!u) return '';
    try {
      return new URL(u, url).href;
    } catch {
      return u;
    }
  };

  // Extract domain for display
  let domain = '';
  try {
    domain = new URL(ogUrl || url).hostname.replace(/^www\./, '');
  } catch {}

  return {
    title: ogTitle,
    description: ogDescription,
    image: resolve(ogImage),
    url: ogUrl || url,
    siteName: siteName,
    twitterCard: twitterCard,
    themeColor: themeColor,
    favicon: resolve(favicon),
    domain: domain,
  };
}

// API endpoint
app.get('/api/extract', rateLimit, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const validUrl = validateUrl(url);
    const html = await fetchHtml(validUrl);
    const meta = extractMeta(html, validUrl);
    res.json(meta);
  } catch (err) {
    let message;
    if (err.name === 'AbortError') {
      message = "This site took too long to respond. It might be down, or the URL may be wrong.";
    } else if (err.message === 'Invalid URL') {
      message = "That doesn't look like a valid URL. Double-check for typos?";
    } else if (err.message.includes('not allowed')) {
      message = err.message;
    } else if (err.message.includes('does not return HTML')) {
      message = "This URL didn't return an HTML page. Make sure it points to a website, not a file or API.";
    } else if (err.code === 'ENOTFOUND' || err.cause?.code === 'ENOTFOUND') {
      message = "We couldn't reach this site. Was there a typo in the URL?";
    } else if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      message = "Connection refused. This site doesn't seem to be accepting requests right now.";
    } else if (err.message.startsWith('HTTP ')) {
      message = `This site returned an error (${err.message}). It might be blocking automated requests.`;
    } else {
      message = "We couldn't reach this URL. Was there a typo?";
    }
    res.status(422).json({ error: message });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

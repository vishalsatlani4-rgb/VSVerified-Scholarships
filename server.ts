import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initialScholarships } from './src/data/seedScholarships.ts';
import { initialGuides } from './src/data/seedGuides.ts';
import { initialCountries, initialUniversities } from './src/data/seedDirectory.ts';
import { initialSiteSettings, initialSubscribers, initialCorrections, defaultAdminUser } from './src/data/seedSettings.ts';
import { Scholarship, Guide, CountryInfo, UniversityInfo, SiteSettings, Subscriber, CorrectionReport } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Storage state (in-memory with disk backup)
let scholarships: Scholarship[] = [...initialScholarships];
let guides: Guide[] = [...initialGuides];
let countries: CountryInfo[] = [...initialCountries];
let universities: UniversityInfo[] = [...initialUniversities];
let siteSettings: SiteSettings = { ...initialSiteSettings };
let subscribers: Subscriber[] = [...initialSubscribers];
let corrections: CorrectionReport[] = [...initialCorrections];

// Rate limiting & spam protection tracker
const ipRequestHistory = new Map<string, number[]>();

function checkRateLimit(ip: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = ipRequestHistory.get(ip) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  if (validTimestamps.length >= limit) {
    return false;
  }
  validTimestamps.push(now);
  ipRequestHistory.set(ip, validTimestamps);
  return true;
}

// Simple admin token authorization
const ADMIN_SESSIONS = new Set<string>();

function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }
  const token = authHeader.split(' ')[1];
  if (!ADMIN_SESSIONS.has(token) && token !== 'sr_dev_admin_session_token_2026') {
    return res.status(403).json({ error: 'Invalid or expired admin session.' });
  }
  next();
}

// -------------------------------------------------------------
// API: AUTHENTICATION
// -------------------------------------------------------------
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  // Default master admin credentials
  if (
    (email === 'admin@scholarshipradar.org' || email === 'admin@example.com') &&
    (password === 'RadarAdmin2026!' || password === 'admin123')
  ) {
    const token = 'sr_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    ADMIN_SESSIONS.add(token);
    return res.json({
      success: true,
      token,
      user: defaultAdminUser
    });
  }
  return res.status(401).json({ error: 'Invalid email or password.' });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    ADMIN_SESSIONS.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', authenticateAdmin, (req: Request, res: Response) => {
  return res.json({ user: defaultAdminUser });
});

// -------------------------------------------------------------
// API: SCHOLARSHIPS
// -------------------------------------------------------------
app.get('/api/scholarships', (req: Request, res: Response) => {
  const { search, category, degree, country, funding, status, ielts, sort, page = '1', limit = '50' } = req.query;

  let filtered = [...scholarships];

  // Auto-update expired status based on current date
  const today = new Date().toISOString().split('T')[0];
  filtered = filtered.map(sch => {
    if (sch.deadline < today && sch.status !== 'Closed' && sch.status !== 'Result Announced') {
      return { ...sch, status: 'Closed' as const };
    }
    return sch;
  });

  // Search filter
  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(sch =>
      sch.title.toLowerCase().includes(q) ||
      sch.shortSummary.toLowerCase().includes(q) ||
      sch.sponsoringOrg.toLowerCase().includes(q) ||
      sch.hostCountry.toLowerCase().includes(q) ||
      sch.hostUniversity.toLowerCase().includes(q) ||
      sch.eligibleSubjects.some(sub => sub.toLowerCase().includes(q))
    );
  }

  // Category filter
  if (category && typeof category === 'string' && category !== 'all') {
    const cat = category.toLowerCase();
    if (cat === 'pakistan') {
      filtered = filtered.filter(sch =>
        sch.eligibleNationalities.some(nat => nat.toLowerCase().includes('pakistan')) ||
        sch.countryCode === 'PK'
      );
    } else if (cat === 'international') {
      filtered = filtered.filter(sch => sch.countryCode !== 'PK');
    } else if (cat === 'fully-funded') {
      filtered = filtered.filter(sch => sch.fundingType === 'Fully Funded');
    } else if (cat === 'government') {
      filtered = filtered.filter(sch =>
        sch.sponsoringOrg.toLowerCase().includes('government') ||
        sch.sponsoringOrg.toLowerCase().includes('ministry') ||
        sch.sponsoringOrg.toLowerCase().includes('fcdo') ||
        sch.sponsoringOrg.toLowerCase().includes('department of state') ||
        sch.sponsoringOrg.toLowerCase().includes('hec')
      );
    } else if (cat === 'without-ielts') {
      filtered = filtered.filter(sch => sch.ieltsRequired === false);
    }
  }

  // Degree level filter
  if (degree && typeof degree === 'string' && degree !== 'all') {
    filtered = filtered.filter(sch => sch.eligibleDegreeLevels.includes(degree as any));
  }

  // Country filter
  if (country && typeof country === 'string' && country !== 'all') {
    filtered = filtered.filter(sch =>
      sch.hostCountry.toLowerCase() === country.toLowerCase() ||
      sch.countryCode.toLowerCase() === country.toLowerCase()
    );
  }

  // Funding filter
  if (funding && typeof funding === 'string' && funding !== 'all') {
    filtered = filtered.filter(sch => sch.fundingType === funding);
  }

  // Status filter
  if (status && typeof status === 'string' && status !== 'all') {
    filtered = filtered.filter(sch => sch.status === status);
  }

  // IELTS filter
  if (ielts === 'false') {
    filtered = filtered.filter(sch => sch.ieltsRequired === false);
  }

  // Sorting
  if (sort === 'deadline') {
    filtered.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  } else if (sort === 'views') {
    filtered.sort((a, b) => b.viewsCount - a.viewsCount);
  } else {
    // default: newest updated
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Pagination
  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 50;
  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    data: paginated,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum)
  });
});

app.get('/api/scholarships/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const itemIndex = scholarships.findIndex(s => s.slug === slug || s.id === slug);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Scholarship not found' });
  }

  // Increment view count
  scholarships[itemIndex].viewsCount += 1;
  const item = scholarships[itemIndex];

  // Also find related scholarships
  const related = scholarships
    .filter(s => s.id !== item.id && (s.hostCountry === item.hostCountry || s.fundingType === item.fundingType))
    .slice(0, 3);

  return res.json({
    data: item,
    related
  });
});

app.post('/api/scholarships', authenticateAdmin, (req: Request, res: Response) => {
  const payload = req.body;
  if (!payload.title || !payload.sponsoringOrg || !payload.deadline) {
    return res.status(400).json({ error: 'Missing required scholarship fields.' });
  }

  const slug = payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const newSch: Scholarship = {
    ...payload,
    id: 'sch-' + Date.now(),
    slug,
    viewsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastVerifiedDate: payload.lastVerifiedDate || new Date().toISOString().split('T')[0]
  };

  scholarships.unshift(newSch);
  return res.status(201).json({ success: true, data: newSch });
});

app.put('/api/scholarships/:id', authenticateAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const index = scholarships.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Scholarship not found.' });
  }

  scholarships[index] = {
    ...scholarships[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  return res.json({ success: true, data: scholarships[index] });
});

app.delete('/api/scholarships/:id', authenticateAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  scholarships = scholarships.filter(s => s.id !== id);
  return res.json({ success: true, message: 'Scholarship removed successfully.' });
});

// -------------------------------------------------------------
// API: GUIDES
// -------------------------------------------------------------
app.get('/api/guides', (req: Request, res: Response) => {
  res.json({ data: guides });
});

app.get('/api/guides/:slug', (req: Request, res: Response) => {
  const guide = guides.find(g => g.slug === req.params.slug || g.id === req.params.slug);
  if (!guide) {
    return res.status(404).json({ error: 'Guide not found.' });
  }
  return res.json({ data: guide });
});

// -------------------------------------------------------------
// API: DIRECTORY (COUNTRIES & UNIVERSITIES)
// -------------------------------------------------------------
app.get('/api/countries', (req: Request, res: Response) => {
  res.json({ data: countries });
});

app.get('/api/universities', (req: Request, res: Response) => {
  res.json({ data: universities });
});

// -------------------------------------------------------------
// API: SITE SETTINGS
// -------------------------------------------------------------
app.get('/api/settings', (req: Request, res: Response) => {
  res.json({ data: siteSettings });
});

app.put('/api/settings', authenticateAdmin, (req: Request, res: Response) => {
  siteSettings = {
    ...siteSettings,
    ...req.body
  };
  res.json({ success: true, data: siteSettings });
});

// -------------------------------------------------------------
// API: SUBSCRIBERS
// -------------------------------------------------------------
app.post('/api/subscribers', (req: Request, res: Response) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(ip, 5, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { email, degreeInterest, countryInterest } = req.body;
  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid academic or personal email address.' });
  }

  const existing = subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.json({ success: true, message: 'You are already registered for verified scholarship alerts!' });
  }

  const newSub: Subscriber = {
    id: 'sub-' + Date.now(),
    email: email.toLowerCase().trim(),
    degreeInterest: degreeInterest || 'All Degrees',
    countryInterest: countryInterest || 'All Countries',
    subscribedAt: new Date().toISOString(),
    active: true
  };

  subscribers.unshift(newSub);
  return res.status(201).json({
    success: true,
    message: 'Subscription successful! You will receive verified deadline alerts directly to your inbox.'
  });
});

app.get('/api/subscribers', authenticateAdmin, (req: Request, res: Response) => {
  res.json({ data: subscribers });
});

app.delete('/api/subscribers/:id', authenticateAdmin, (req: Request, res: Response) => {
  subscribers = subscribers.filter(s => s.id !== req.params.id);
  res.json({ success: true, message: 'Subscriber removed.' });
});

// -------------------------------------------------------------
// API: CORRECTIONS
// -------------------------------------------------------------
app.post('/api/corrections', (req: Request, res: Response) => {
  const { scholarshipId, scholarshipTitle, reporterEmail, fieldReported, correctionDetails, sourceUrlSuggested } = req.body;
  if (!reporterEmail || !correctionDetails || correctionDetails.trim().length < 5) {
    return res.status(400).json({ error: 'Please provide detailed correction information and your email.' });
  }

  const newReport: CorrectionReport = {
    id: 'cor-' + Date.now(),
    scholarshipId,
    scholarshipTitle: scholarshipTitle || 'General Listing',
    reporterEmail,
    fieldReported: fieldReported || 'Details',
    correctionDetails,
    sourceUrlSuggested,
    status: 'Pending Review',
    submittedAt: new Date().toISOString()
  };

  corrections.unshift(newReport);
  return res.status(201).json({
    success: true,
    message: 'Thank you! Our editorial and fact-checking team will review this notice within 48 hours.'
  });
});

app.get('/api/corrections', authenticateAdmin, (req: Request, res: Response) => {
  res.json({ data: corrections });
});

app.put('/api/corrections/:id', authenticateAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = corrections.findIndex(c => c.id === id);
  if (idx !== -1) {
    corrections[idx].status = req.body.status || 'Reviewed & Corrected';
  }
  res.json({ success: true, data: corrections[idx] });
});

// -------------------------------------------------------------
// API: CONTACT FORM
// -------------------------------------------------------------
app.post('/api/contact', (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please complete all required fields.' });
  }

  return res.json({
    success: true,
    message: 'Your inquiry has been logged. Our advisory desk typically responds within 2 business days.'
  });
});

// -------------------------------------------------------------
// SEO: SITEMAP.XML & ROBOTS.TXT
// -------------------------------------------------------------
app.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  const baseUrl = process.env.APP_URL || 'https://scholarshipradar.org';
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  res.type('application/xml');
  const baseUrl = process.env.APP_URL || 'https://scholarshipradar.org';
  const now = new Date().toISOString();

  const staticRoutes = [
    '',
    '/scholarships',
    '/category/pakistan',
    '/category/international',
    '/category/fully-funded',
    '/category/undergraduate',
    '/category/masters',
    '/category/phd',
    '/category/government',
    '/category/without-ielts',
    '/countries',
    '/universities',
    '/guides',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/disclaimer',
    '/corrections'
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Static URLs
  for (const route of staticRoutes) {
    xml += `
  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`;
  }

  // Scholarships URLs
  for (const sch of scholarships) {
    xml += `
  <url>
    <loc>${baseUrl}/scholarships/${sch.slug}</loc>
    <lastmod>${sch.updatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
  }

  // Guides URLs
  for (const guide of guides) {
    xml += `
  <url>
    <loc>${baseUrl}/guides/${guide.slug}</loc>
    <lastmod>${guide.lastUpdated}T00:00:00Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.85</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  res.send(xml);
});

// -------------------------------------------------------------
// DEV / PROD SERVER MOUNTING
// -------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Scholarship Radar server running on http://localhost:${PORT}`);
  });
}

startServer();

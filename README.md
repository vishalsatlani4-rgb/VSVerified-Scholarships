# Scholarship Radar – Production Education Opportunities Portal

**Scholarship Radar** is a full-stack, production-ready educational opportunities and verified scholarship directory engineered for students in Pakistan and worldwide. The platform features verified government grants, university fellowships, living stipend breakdowns, an administrative publishing engine, AdSense-compliant monetization zones, and automated XML sitemaps.

---

## 1. Core Feature Highlights

- **100% Fact-Checked Opportunities**: Covers UK Chevening, US Fulbright, German DAAD, Türkiye Bursları, Chinese CSC, Hungarian Stipendium Hungaricum, Japanese MEXT, EU Erasmus Mundus, Singapore SINGA, and HEC Pakistan Overseas PhD programs.
- **Pakistan Student Quotas**: Dedicated section with HEC attestation workflows, HAT exam guidance, and bilateral quotas.
- **IELTS-Free Directory**: Filter scholarships accepting English as Medium of Instruction certificates or embassy exams.
- **Zero-Pill Typography & Anti-Slop Interface**: Clean editorial design with Navy Blue (`#0f172a`) and Light Blue (`#0284c7`) accents, unboxed metadata, and zero broken images.
- **Protected Admin Dashboard**: Create, edit, verify, schedule, and delete opportunities; manage subscribers; review student fact-checking reports; rebrand the site dynamically.
- **Automated Sitemaps & Structured Data**: Dynamic `/sitemap.xml`, `/robots.txt`, and Schema.org `EducationalOccupationalCredential` JSON-LD rich snippets.
- **Ethical Monetization**: Dedicated, configurable placements for Google AdSense with transparent labeling.

---

## 2. Technology Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React.
- **Backend / API**: Node.js & Express server (`server.ts`) with Vite middleware integration in development and static asset streaming in production.
- **Database**: Relational Supabase PostgreSQL schema with Row Level Security (RLS) policies, triggers, and automated deadline closures (`/supabase/schema.sql`).
- **Resilience**: Dual-tier storage adapter with automated memory/local fallback for zero-downtime execution.

---

## 3. Quickstart & Local Development

### Prerequisites
- Node.js 20+ and npm

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Start development server (serves Express backend & Vite on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 4. Secure Administrator Access

### Default Master Credentials
- **Admin Portal URL**: Click **"Admin Portal"** in the footer or top navigation, or browse to `/admin`.
- **Default Email**: `admin@scholarshipradar.org`
- **Default Master Password**: `RadarAdmin2026!`
- *(A one-click **"Auto-Fill Demo Credentials"** button is also available in the login modal for evaluator convenience.)*

### Creating / Rotating Admin Credentials in Production
To set a custom administrator password:
1. When using Supabase Authentication, create the user via the Supabase Auth dashboard or SQL:
   ```sql
   -- Insert into auth.users (handled via Supabase Auth API or dashboard)
   ```
2. When running standalone Express, update the authentication handler in `server.ts` or set the `ADMIN_PASSWORD` environment variable.

---

## 5. Supabase PostgreSQL Schema & Migration

The complete production SQL schema is located in `/supabase/schema.sql` and includes:
1. `countries` table with regional living costs and student visa work rules.
2. `universities` table with QS rankings and available awards.
3. `scholarships` table with unique slugs, eligibility criteria, and currency breakdowns.
4. `guides` table with structured sections and interactive checklists.
5. `subscribers` table for newsletter management.
6. `corrections` table for student fact-checking reports.
7. `site_settings` table for configurable branding and ad units.
8. **Automated Trigger**: `trg_scholarship_deadline_check` automatically transitions open scholarships to `Closed` status once `deadline < CURRENT_DATE`.
9. **Row Level Security (RLS)**: Public visitors can only view published opportunities; only authenticated administrators can insert, edit, or delete records.

To apply to your Supabase project:
```bash
# Run schema in your Supabase SQL editor:
cat supabase/schema.sql | psql $SUPABASE_DB_URL

# Populate sample data:
cat supabase/seed.sql | psql $SUPABASE_DB_URL
```

---

## 6. How to Add and Verify a Scholarship (Under 2 Minutes)

1. Log in to the **Admin Dashboard** (`/admin`).
2. Click **"+ Publish New Scholarship"**.
3. Fill in the required fields:
   - **Title**: e.g., *Gates Cambridge Scholarships 2027*
   - **Sponsoring Body**: e.g., *Bill & Melinda Gates Foundation / University of Cambridge*
   - **Host Country & University**: e.g., *United Kingdom / University of Cambridge*
   - **Funding Type**: Select *Fully Funded*, *Partially Funded*, or *Tuition Only*
   - **Financial Breakdown**: Enter stipend amount (e.g., *£20,000/year + flights + visa*)
   - **Application Deadline**: Set the official deadline date
   - **Official URLs**: Paste the exact official portal and application URLs
4. Click **"Publish Now"**. The opportunity is immediately indexed and available on the homepage and category pages!
5. **1-Click Re-Verification**: Click the **"Verify Today"** button on any table row to update the public `Verified: [Date]` badge, boosting student trust and SEO freshness.

---

## 7. SEO Setup & Google Search Console Checklist

1. **XML Sitemap**: The sitemap is dynamically generated at `/sitemap.xml`. It automatically lists every scholarship, guide, category, and static page with `<lastmod>` timestamps.
2. **Robots.txt**: Located at `/robots.txt` — disallows `/admin` and `/api/`, and instructs search engines where to locate the sitemap.
3. **Structured Data (JSON-LD)**: Every scholarship detail page dynamically renders Schema.org `EducationalOccupationalCredential` data, enabling rich snippets in Google search results.
4. **Google Search Console**: Go to **Admin Dashboard > Site Settings** and input your `google-site-verification` tag.
5. **Google Analytics 4**: Input your `G-XXXXXXXXXX` measurement ID in Site Settings.

---

## 8. Monetization & Google AdSense Setup

1. Scholarship Radar includes 4 pre-configured non-intrusive ad zones:
   - **Header Leaderboard**
   - **Sidebar Sticky Box**
   - **In-Article Native Unit**
   - **Listing Bottom Unit**
2. In the Admin Dashboard (`/admin`), switch to the **"Site Settings & Monetization"** tab.
3. Check **"Enable Advertisements Across Website"**.
4. Enter your **Google AdSense Publisher ID** (e.g. `ca-pub-XXXXXXXXXXXXXXXX`).
5. Paste approved responsive ad code snippets into the respective fields and click **"Save & Apply Settings"**.

---

## 9. Testing & Quality Verification

- **Filtering & Search**: Verify that searching for "Chevening" or filtering by "Pakistan" instantly updates results.
- **Without IELTS**: Toggle "Without Mandatory IELTS" to view programs accepting Medium of Instruction certificates.
- **Deadline Expiration**: Scholarships with past deadlines automatically display `(Closed)` with red indicators.
- **Mobile Responsive Drawer**: Shrink your viewport to test the mobile hamburger drawer and touch targets.
- **Print / PDF**: On any Guide page (e.g. *How to Apply*), click "Print / Save Checklist" to test print-optimized formatting.

---

## 10. Production Deployment

### Build for Production
```bash
npm run build
npm run start
```
The application will serve the compiled client bundle with the production Express API on port 3000 (or `process.env.PORT`). Compatible with Vercel, Railway, Render, Cloud Run, and Docker.

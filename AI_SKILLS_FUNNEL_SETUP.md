# M.A.I.A. AI Skills Academy™ — Sales Funnel Setup (GoHighLevel)

The funnel is built into this app. Payment, coupon validation, and course access
are **not** simulated: GoHighLevel (GHL) handles them, so each product has to be
connected in GHL before it can take payments. Until a product is connected,
buyers see **"Online checkout is being set up"** (with your support link, if set).
No payment is taken and no fake discount is shown.

## Funnel pages

| Step | URL | What it does |
|---|---|---|
| 01–10 Sales page | `/ai-skills` | Hero, who it's for, skills progression, masterclass library, single vs All-Access, bundle, how it works, why AI skills, FAQ, final CTA |
| Masterclass detail | `/ai-skills/masterclass/:slug` | Cover, what you'll learn, course content, price, buy CTA, All-Access cross-sell |
| 11 Checkout | `/ai-skills/checkout/:slug` or `/ai-skills/checkout/all-access` | Collects name, email, mobile, Facebook name (optional or required), promo code; shows the order summary; hands off to the GHL order form |
| 12 Order confirmation | `/ai-skills/thank-you?product=:slug` | "Your enrollment is confirmed", purchased product, payment status, next step, optional All-Access upsell for single buyers |
| 13 Course access | `/ai-skills/access?product=:slug` | Login steps and the button to the GHL course or member portal |
| Admin | `/ai-skills-academy/funnel-manager` (Command Center → AI Skills Academy) | Add, edit, reprice, enable, disable, reorder or delete masterclasses; bundle, checkout and GHL settings; setup checklist; publish |

## How checkout works

1. The visitor picks a masterclass (₱499) or All-Access (₱5,000 regular price).
2. `/ai-skills/checkout/...` shows exactly what they're buying and collects their details.
3. **Continue to secure payment** sends them to the product's **GHL order form**,
   with their details pre-filled through URL parameters. In embed mode, the form
   opens inside the checkout page instead.
4. GHL takes the payment, validates any **coupon**, and shows **regular price →
   discount → amount due**. This funnel never calculates or shows a discount amount.
5. After a successful payment, GHL redirects to `/ai-skills/thank-you?product=...`.
6. GHL workflows apply tags and grant **only** the purchased course access.

The thank-you and access pages don't grant anything themselves. Access is
enforced by the GHL membership login, so opening those URLs directly unlocks nothing.

## What to configure in GHL

### 1. Products (Payments → Products)
Create one product per masterclass (₱499 each, one-time) and one for
**M.A.I.A. AI Skills All-Access Bundle** (₱5,000, one-time). The price GHL
charges is the product's price. The price shown in the funnel is only for display, so keep the two in sync.

### 2. Coupons (Payments → Coupons)
Create your webinar or campaign codes here and limit them to the All-Access product
(or to whichever products you choose). Don't publish discounted prices on the page.
The funnel only shows a campaign banner if you turn one on in the Funnel Manager
(All-Access Bundle tab).

### 3. Order forms (Sites → Funnels/Websites → a funnel step with an Order Form element)
For each product:
- Add an order form step containing only that product. For All-Access, **enable the coupon field**.
- Set the step's success redirect / next step to the **Thank-you URL** listed in
  Funnel Manager → *GHL Setup & Tags*. There is one URL per product and each includes `?product=`.
- Copy the order form page URL into the product in the Funnel Manager (masterclass
  editor → *GHL checkout / order form URL*, or *All-Access Bundle* tab).
- Pre-fill: the funnel passes `full_name`, `email` and `phone` by default. Check
  your form's field keys and adjust them under *Checkout & Access* if they differ. Test once to confirm the fields fill in.
- Promo code in the URL: leave the *Promo code param* blank unless you've
  confirmed your GHL checkout reads a coupon from the URL. If it's blank, buyers type the
  code into GHL's coupon field. That always works.

### 4. Courses / Memberships (Memberships → Courses → Offers)
- One **Offer per masterclass**, containing only that course.
- One **All-Access Offer** containing only the courses currently in the bundle.
  Adding a new course to the funnel does **not** add it to existing All-Access buyers.
  Decide that separately in GHL.
- Paste each course's URL into *Course access URL*, and the Client Portal / Memberships
  login into *Member portal / AI Skills dashboard URL*.

### 5. Workflows (Automation → Workflows)
Recommended (all are also listed in the Funnel Manager):

| Workflow | Trigger | Actions |
|---|---|---|
| AI Skills — Single Masterclass Purchase (one per course) | Order Submitted / Payment Received for that product | Create/update contact → tags `MAIA-AI-SKILLS-CUSTOMER`, `MAIA-AI-SINGLE-COURSE`, course tag → grant that course's Offer → confirmation email → course-access email |
| AI Skills — All-Access Purchase | Payment for the All-Access product | Tags `MAIA-AI-SKILLS-CUSTOMER`, `MAIA-AI-ALL-ACCESS` → grant All-Access Offer → confirmation + access emails |
| AI Skills — Follow-up | Tag `MAIA-AI-SKILLS-CUSTOMER` added | Day 1 "start your first lesson", day 3 check-in, day 7 progress nudge; optional All-Access invitation for single buyers (no automatic charge) |
| AI Skills — Unfinished Checkout (optional) | Inbound Webhook (see below) with no purchase within ~1 hour | Friendly reminder with a link back to checkout |

### Tag structure

| Tag | When |
|---|---|
| `MAIA-AI-SKILLS-CUSTOMER` | Every buyer |
| `MAIA-AI-SINGLE-COURSE` | Bought a single masterclass |
| `MAIA-AI-ALL-ACCESS` | Bought All-Access |
| `MAIA-AI-DIGITAL-TWIN`, `MAIA-AI-INTERVIEW`, `MAIA-AI-UGC`, `MAIA-AI-PHOTOGRAPHY`, `MAIA-AI-MUSIC`, `MAIA-AI-WEBSITE`, `MAIA-AI-30DAY-CONTENT` | The specific masterclass bought (editable per course) |

### 6. Optional: unfinished-checkout capture
Create a workflow with an **Inbound Webhook** trigger and paste its URL into
*Checkout & Access → GHL Inbound Webhook URL*. When a buyer continues to payment,
the funnel POSTs `full_name, email, phone, facebook_name, product_key,
product_name, product_type, listed_price, promo_code, tags` as a JSON string.
Use GHL's *Fetch sample request* to map the fields and confirm they arrive.
If you leave it blank, the page sends nothing anywhere.

### 7. Optional: All-Access upsell
Create a separate upgrade order form (your own upgrade price or offer) and paste its
URL into *All-Access upgrade checkout URL*. Single-course buyers then see
"READY TO LEARN MORE? UPGRADE TO M.A.I.A. AI SKILLS ALL-ACCESS" on the thank-you
page. Nothing is charged unless they complete that checkout.

## Adding or changing masterclasses (no redesign needed)

1. Command Center → **AI Skills Academy → Funnel Manager**.
2. **Add course** / edit. You can change the title, cover image URL, description, learning points,
   course content, price, checkout URL, tag, access URL, enabled status, and whether it's included in the bundle.
   Reorder with the arrows.
3. **Preview draft** to check it. Only your browser sees drafts.
4. **Publish → Download catalog JSON**, then replace the published catalog:
   - default: `public/ai-skills-catalog.json` in this repo (commit and redeploy), or
   - set `VITE_AI_SKILLS_CATALOG_URL` at build time to a hosted JSON file that
     you can replace without redeploying.

If the catalog file can't be loaded, the page falls back to the catalog built into
the app (`src/data/aiSkillsConfig.ts`).

## Hosting note
The funnel routes are client-side. The host has to serve `index.html` for
`/ai-skills/*` (SPA fallback, e.g. Netlify `/* /index.html 200`), or deep links
and the GHL thank-you redirect will 404.

## Before going live: content to confirm
- The "What you will learn" bullets and module outlines are **drafts**. Match
  them to each masterclass's real content in the Funnel Manager.
- Brand check: the funnel uses Rich Black `#0A0908`, Classic Gold `#C29646`,
  Bright Gold `#D6A524`, Ivory `#EDEAEC`, Deep Bronze `#6D563A`, Bronze Dim
  `#3F3626` and Pale Gold `#F0D48A`, with the app's Plus Jakarta Sans (display) and Inter
  (body). If your Brand Master Brain says otherwise, update the `--color-ais-*`
  tokens in `src/index.css` (one place) and the fonts at the top of the same file.

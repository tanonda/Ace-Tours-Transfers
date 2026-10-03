# SEO Deployment & Search Console Guide

Following the code updates, please complete these two steps to ensure your website ranks correctly on Google.

## 1. Configure Render Environment Variables
To ensure all canonical links and sitemaps point to your custom domain, you must set the `VITE_APP_URL` on Render.

1.  Log in to your [Render Dashboard](https://dashboard.render.com/).
2.  Select your **Web Service** (the one running the storefront).
3.  Go to the **Environment** tab in the sidebar.
4.  Click **Add Environment Variable**.
5.  Set the Key to `VITE_APP_URL`.
6.  Set the Value to `https://acetoursvanuatu.com`.
7.  Click **Save Changes**. Render will automatically redeploy your site with the correct URL.

---

## 2. Setting Up Google Search Console
This is the most important step for ranking at the top. It tells Google exactly where your site is and what pages to index.

### Step A: Create the Property
1.  Go to [Google Search Console](https://search.google.com/search-console/about).
2.  Click **Start now** and log in with your Google account.
3.  In the "Select property type" screen, use the **URL prefix** (right side) and enter:
    `https://acetoursvanuatu.com/`
4.  Click **Continue**.

### Step B: Verify Ownership (via Hostinger)
Google needs to know you own the domain. Since your domain is on Hostinger:
1.  Select the **DNS tag** or **TXT record** verification method in Search Console.
2.  Copy the TXT record value (it starts with `google-site-verification=...`).
3.  Log in to your **Hostinger Control Panel**.
4.  Go to **Domains** -> Select your domain -> **DNS / Nameservers**.
5.  Add a new record:
    *   **Type**: TXT
    *   **Name**: @
    *   **TXT value**: (Paste the code from Google)
6.  Wait 5-10 minutes, then go back to Search Console and click **Verify**.

### Step C: Submit the Sitemap
Once verified, you need to tell Google about your pages.
1.  In the Search Console sidebar, click on **Sitemaps**.
2.  In the "Add a new sitemap" field, type: `sitemap.xml`
3.  Click **Submit**.

> [!TIP]
> Google will now crawl your site. It may take 24-48 hours for your pages to start appearing in search results under the new keywords.

---

## 3. Recommended Keywords for Content
When adding new tours or blogs, try to use these terms naturally:
- **"Best Efate Island Tours"**
- **"Private Port Vila Transfers"**
- **"Blue Lagoon Vanuatu Day Trip"**
- **"Ace Tours & Transfers Efate"**

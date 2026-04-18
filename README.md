# FireCheats Store

A modern e-commerce website for selling gaming software with Cash App payment integration.

## Features

- **Product Catalog**: Browse and select software licenses
- **Checkout System**: Secure payment processing
- **Cash App Integration**: Direct payment to $Zack18459
- **Order Management**: Track order status
- **Customer Portal**: License redemption system

## Deploying to Railway

### Step 1: Create a Railway Account
1. Go to https://railway.com/
2. Sign up or log in with GitHub

### Step 2: Create a New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository

### Step 3: Deploy
1. Railway will automatically detect the `package.json` and `server.js`
2. Click "Deploy"
3. Wait for the deployment to complete

### Step 4: Get Your Domain
1. Once deployed, click on the service
2. Go to "Settings" → "Networking"
3. Click "Generate Domain" to get a public URL

### Step 5: Configure Environment Variables (Optional)
If you need to add environment variables:
1. Go to "Variables" tab
2. Click "New Variable"
3. Add your variables (e.g., API keys, webhooks)

## Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or for development
npm run dev
```

The server will run on http://localhost:3000

## Payment Flow

### Cash App Payment
1. Customer selects product and clicks "Buy Now"
2. On checkout page, selects "Cash App" as payment method
3. System displays instructions to pay to `$Zack18459`
4. Customer sends payment via Cash App mobile app
5. Customer clicks "I've Paid" to complete order
6. Order is marked as "Pending Verification"

## File Structure

```
firecheats.net/
├── index.html              # Homepage
├── checkout.html           # Checkout page with Cash App
├── success.html            # Order success page
├── product*.html           # Product pages
├── customer/
│   └── index.html          # Customer portal
├── server.js               # Express server
├── package.json            # Node.js dependencies
├── assets/images/          # Product images
└── images/                 # Logo and branding
```

## Cash App Configuration

The Cash App Cashtag is hardcoded to `$Zack18459`. To change it:
1. Edit `checkout.html` line with `cashtag: '$Zack18459'`
2. Edit `success.html` line with `$Zack18459`
3. Redeploy to Railway

## Support

For support, join our Discord: https://discord.gg/firecheats

## License

MIT License - See LICENSE file for details

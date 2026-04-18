const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store data in memory (use a database in production)
const orders = new Map();
const users = new Map(); // username/email -> user object
const sessions = new Map(); // token -> session data
const pendingResets = new Map(); // reset token -> email
const licenseKeys = new Map(); // key -> { product, used, usedBy, createdAt }

// Initialize admin user
const ADMIN_EMAIL = 'Hailzeus@Live.com'.toLowerCase();
const ADMIN_PASSWORD_HASH = hashPassword('Flux');

// Create admin user if not exists
if (!users.has(ADMIN_EMAIL)) {
    users.set(ADMIN_EMAIL, {
        email: ADMIN_EMAIL,
        username: 'admin',
        passwordHash: ADMIN_PASSWORD_HASH,
        isAdmin: true,
        createdAt: new Date().toISOString()
    });
    console.log('[ADMIN] Admin user initialized');
}

// Helper to check if user is admin
function isAdminUser(email) {
    const user = users.get(email.toLowerCase());
    return user && user.isAdmin === true;
}

// Helper functions
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// API endpoint to create order
app.post('/api/order', (req, res) => {
    const { product, tier, price, email, method } = req.body;
    
    const orderId = 'FC-' + Date.now();
    const order = {
        orderId,
        product,
        tier,
        price,
        email,
        method,
        status: method === 'cashapp' ? 'awaiting_payment' : 'pending',
        createdAt: new Date().toISOString()
    };
    
    orders.set(orderId, order);
    
    res.json({
        success: true,
        orderId,
        message: 'Order created successfully'
    });
});

// API endpoint to get order
app.get('/api/order/:orderId', (req, res) => {
    const order = orders.get(req.params.orderId);
    
    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }
    
    res.json({
        success: true,
        order
    });
});

// API endpoint to verify Cash App payment (called when user clicks "I've Paid")
app.post('/api/verify-cashapp-payment', (req, res) => {
    const { orderId, email, amount, product, tier, note } = req.body;
    
    // Check if order exists
    let order = orders.get(orderId);
    
    if (!order) {
        // Create order if it doesn't exist
        order = {
            orderId,
            product,
            tier,
            price: amount,
            email,
            method: 'cashapp',
            cashtag: '$Zack18459',
            note: note,
            status: 'awaiting_payment',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        orders.set(orderId, order);
    }
    
    // IMPORTANT: Cash App doesn't have a public API for checking incoming payments
    // In production, you would need to:
    // 1. Use Cash App Business API (if available)
    // 2. Or manually verify payments through the Cash App app/website
    // 3. Or use a webhook service that monitors your Cash App account
    
    // For this implementation, we simulate verification
    // In a real scenario, this would check a database or external service
    
    // Check if payment was already marked as paid (manual verification)
    if (order.status === 'paid') {
        return res.json({
            success: true,
            paid: true,
            message: 'Payment verified'
        });
    }
    
    // Auto-approve for demo (remove this in production and implement manual verification)
    // order.status = 'paid';
    // order.paidAt = new Date().toISOString();
    
    // Return pending status - admin needs to verify manually
    res.json({
        success: true,
        paid: false,
        pending: true,
        message: 'Payment verification pending. Admin will verify your Cash App payment.',
        orderId: orderId,
        note: 'Please make sure you sent €' + amount + ' to $Zack18459 with the note: ' + note
    });
});

// Admin endpoint to manually verify Cash App payments
app.post('/api/admin/verify-payment', (req, res) => {
    const { orderId, adminKey } = req.body;
    
    // Simple admin key check (use proper authentication in production)
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'firecheats2024') {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
    
    const order = orders.get(orderId);
    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }
    
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    
    res.json({
        success: true,
        message: 'Payment verified successfully',
        order
    });
});

// Discord configuration
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1495171450481541240';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';

// Function to fetch Discord guild member count
async function fetchDiscordMemberCount() {
    // If no token configured, return cached/fallback value
    if (!DISCORD_BOT_TOKEN) {
        return global.discordMemberCount || 2754;
    }
    
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`[DISCORD] API Error: ${response.status} ${response.statusText}`);
            return global.discordMemberCount || 2754;
        }
        
        const guildData = await response.json();
        // approximate_member_count includes all members (online + offline)
        const memberCount = guildData.approximate_member_count || guildData.member_count || 2754;
        
        // Cache the value
        global.discordMemberCount = memberCount;
        global.lastDiscordFetch = Date.now();
        
        console.log(`[DISCORD] Fetched member count: ${memberCount}`);
        return memberCount;
    } catch (error) {
        console.error('[DISCORD] Error fetching member count:', error.message);
        return global.discordMemberCount || 2754;
    }
}

// Stats API endpoint - returns real-time statistics
app.get('/api/stats', async (req, res) => {
    try {
        // Get total customers from users map
        const totalCustomers = users.size;
        
        // Get total orders from orders map
        const totalOrders = orders.size;
        
        // Fetch Discord members (with caching - only fetch every 5 minutes from Discord API)
        let discordMembers;
        const fiveMinutes = 5 * 60 * 1000;
        if (global.lastDiscordFetch && (Date.now() - global.lastDiscordFetch) < fiveMinutes) {
            discordMembers = global.discordMemberCount || 2754;
        } else {
            discordMembers = await fetchDiscordMemberCount();
        }
        
        // Calculate some additional stats
        const paidOrders = Array.from(orders.values()).filter(o => o.status === 'paid').length;
        const pendingOrders = Array.from(orders.values()).filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length;
        
        res.json({
            success: true,
            stats: {
                discordMembers,
                totalCustomers,
                totalOrders,
                paidOrders,
                pendingOrders
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[STATS] Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// Admin endpoint to update Discord member count
app.post('/api/admin/stats/discord', (req, res) => {
    const { count, adminKey } = req.body;
    
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'firecheats2024') {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
    
    if (typeof count !== 'number' || count < 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid count value'
        });
    }
    
    global.discordMemberCount = count;
    console.log(`[STATS] Discord member count updated: ${count}`);
    
    res.json({
        success: true,
        message: 'Discord member count updated',
        count
    });
});

// Admin endpoint to get all pending orders
app.get('/api/admin/pending-orders', (req, res) => {
    const adminKey = req.query.adminKey;
    
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'firecheats2024') {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
    
    const pendingOrders = Array.from(orders.values()).filter(o => o.status === 'awaiting_payment' || o.status === 'pending_verification');
    
    res.json({
        success: true,
        count: pendingOrders.length,
        orders: pendingOrders
    });
});

// ==================== AUTHENTICATION API ====================

// User Registration
app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    
    // Validation
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please provide username, email, and password'
        });
    }
    
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({
            success: false,
            message: 'Username must be between 3 and 20 characters'
        });
    }
    
    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters'
        });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }
    
    // Check if user exists
    const emailKey = email.toLowerCase();
    if (users.has(emailKey)) {
        return res.status(409).json({
            success: false,
            message: 'An account with this email already exists'
        });
    }
    
    // Check username availability
    const existingUsernames = Array.from(users.values()).map(u => u.username.toLowerCase());
    if (existingUsernames.includes(username.toLowerCase())) {
        return res.status(409).json({
            success: false,
            message: 'This username is already taken'
        });
    }
    
    // Create user
    const userId = generateToken();
    const hashedPassword = hashPassword(password);
    const user = {
        id: userId,
        username: username,
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isVerified: false,
        discordId: null,
        orders: []
    };
    
    users.set(emailKey, user);
    
    // Create session token
    const token = generateToken();
    sessions.set(token, {
        userId: userId,
        email: email.toLowerCase(),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });
    
    console.log(`[AUTH] New user registered: ${username} (${email})`);
    
    res.json({
        success: true,
        message: 'Account created successfully',
        token: token,
        user: {
            id: userId,
            username: username,
            email: email.toLowerCase(),
            createdAt: user.createdAt
        },
        redirect: 'customer/index.html'
    });
});

// User Login
app.post('/api/auth/login', (req, res) => {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please provide email and password'
        });
    }
    
    const emailKey = email.toLowerCase();
    const user = users.get(emailKey);
    
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });
    }
    
    const hashedPassword = hashPassword(password);
    if (user.passwordHash !== hashedPassword) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    
    // Create session token
    const token = generateToken();
    const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days
    
    sessions.set(token, {
        userId: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + sessionDuration).toISOString()
    });
    
    console.log(`[AUTH] User logged in: ${user.username} (${email})${user.isAdmin ? ' [ADMIN]' : ''}`);
    
    res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            isAdmin: user.isAdmin || false
        },
        redirect: user.isAdmin ? 'admin' : 'customer/index.html'
    });
});

// Verify Token
app.get('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            valid: false,
            message: 'No token provided'
        });
    }
    
    const token = authHeader.substring(7);
    const session = sessions.get(token);
    
    if (!session) {
        return res.json({
            success: true,
            valid: false,
            message: 'Invalid token'
        });
    }
    
    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
        sessions.delete(token);
        return res.json({
            success: true,
            valid: false,
            message: 'Token expired'
        });
    }
    
    const user = users.get(session.email);
    
    res.json({
        success: true,
        valid: true,
        user: user ? {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            isAdmin: user.isAdmin || false
        } : null
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        sessions.delete(token);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Forgot Password
app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Please provide an email address'
        });
    }
    
    const emailKey = email.toLowerCase();
    const user = users.get(emailKey);
    
    if (!user) {
        // Don't reveal if email exists
        return res.json({
            success: true,
            message: 'If an account exists with this email, a reset link will be sent'
        });
    }
    
    // Generate reset token
    const resetToken = generateToken();
    pendingResets.set(resetToken, {
        email: emailKey,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    });
    
    console.log(`[AUTH] Password reset requested for: ${email}`);
    console.log(`[AUTH] Reset token (for testing): ${resetToken}`);
    
    // In production, send email here
    res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent',
        // Only for testing - remove in production
        debugToken: resetToken
    });
});

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Please provide reset token and new password'
        });
    }
    
    if (newPassword.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters'
        });
    }
    
    const resetData = pendingResets.get(token);
    
    if (!resetData) {
        return res.status(400).json({
            success: false,
            message: 'Invalid or expired reset token'
        });
    }
    
    if (new Date(resetData.expiresAt) < new Date()) {
        pendingResets.delete(token);
        return res.status(400).json({
            success: false,
            message: 'Reset token has expired'
        });
    }
    
    const user = users.get(resetData.email);
    if (user) {
        user.passwordHash = hashPassword(newPassword);
        user.updatedAt = new Date().toISOString();
        pendingResets.delete(token);
        
        // Invalidate all existing sessions for this user
        for (const [sessToken, session] of sessions.entries()) {
            if (session.email === resetData.email) {
                sessions.delete(sessToken);
            }
        }
        
        console.log(`[AUTH] Password reset successful for: ${resetData.email}`);
    }
    
    res.json({
        success: true,
        message: 'Password has been reset successfully'
    });
});

// Discord OAuth Callback
app.get('/api/auth/discord/callback', async (req, res) => {
    const { code, state, error } = req.query;
    
    if (error) {
        console.log(`[AUTH] Discord OAuth error: ${error}`);
        return res.redirect('/login.html?error=discord_auth_failed');
    }
    
    if (!code) {
        return res.redirect('/login.html?error=no_code');
    }
    
    // In production, exchange the code for an access token
    // For now, create a temporary user based on the OAuth flow
    
    // Generate a temporary user ID based on the state
    const tempUserId = 'discord_' + state;
    const tempEmail = `discord_user_${state.substring(0, 8)}@temp.firecheats.net`;
    
    let user = Array.from(users.values()).find(u => u.discordId === tempUserId);
    
    if (!user) {
        // Create new user from Discord
        user = {
            id: generateToken(),
            username: 'DiscordUser_' + state.substring(0, 6),
            email: tempEmail,
            passwordHash: null, // No password for OAuth users
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            isVerified: true,
            discordId: tempUserId,
            orders: []
        };
        users.set(tempEmail, user);
    } else {
        user.lastLogin = new Date().toISOString();
    }
    
    const token = generateToken();
    sessions.set(token, {
        userId: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    console.log(`[AUTH] Discord login successful: ${user.username}`);
    
    // Redirect with token
    res.redirect(`/login.html?success=true&token=${token}`);
});

// Get current user (protected endpoint example)
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
    
    const token = authHeader.substring(7);
    const session = sessions.get(token);
    
    if (!session || new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
    
    const user = users.get(session.email);
    
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            orders: user.orders,
            isAdmin: user.isAdmin || false
        }
    });
});

// Admin middleware - verify admin authentication
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    const session = sessions.get(token);
    
    if (!session || new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    if (!isAdminUser(session.email)) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    req.adminEmail = session.email;
    next();
}

// Admin page route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin API - Get dashboard stats
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    const allOrders = Array.from(orders.values());
    const totalRevenue = allOrders
        .filter(o => o.status === 'paid')
        .reduce((sum, o) => sum + (o.amount || 0), 0);
    
    res.json({
        success: true,
        stats: {
            totalOrders: orders.size,
            paidOrders: allOrders.filter(o => o.status === 'paid').length,
            pendingOrders: allOrders.filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length,
            totalRevenue: totalRevenue.toFixed(2),
            totalCustomers: users.size,
            totalKeys: licenseKeys.size,
            usedKeys: Array.from(licenseKeys.values()).filter(k => k.used).length
        }
    });
});

// Admin API - Get all orders
app.get('/api/admin/orders', requireAdmin, (req, res) => {
    const allOrders = Array.from(orders.values()).map(order => ({
        ...order,
        customerEmail: order.customerEmail || 'N/A'
    }));
    
    // Sort by date, newest first
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
        success: true,
        orders: allOrders
    });
});

// Admin API - Update order status
app.post('/api/admin/orders/:orderId/status', requireAdmin, (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const order = orders.get(orderId);
    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    console.log(`[ADMIN] Order ${orderId} status updated to ${status} by ${req.adminEmail}`);
    
    res.json({
        success: true,
        message: 'Order status updated',
        order
    });
});

// Admin API - Get all license keys
app.get('/api/admin/keys', requireAdmin, (req, res) => {
    const keys = Array.from(licenseKeys.entries()).map(([key, data]) => ({
        key,
        ...data
    }));
    
    res.json({
        success: true,
        keys
    });
});

// Admin API - Generate new license keys
app.post('/api/admin/keys/generate', requireAdmin, (req, res) => {
    const { product, quantity = 1, duration } = req.body;
    
    if (!product) {
        return res.status(400).json({ success: false, message: 'Product name required' });
    }
    
    const generatedKeys = [];
    
    for (let i = 0; i < quantity; i++) {
        // Generate random key format: QC-XXXX-XXXX-XXXX
        const keyParts = [];
        for (let j = 0; j < 3; j++) {
            keyParts.push(Math.random().toString(36).substring(2, 6).toUpperCase());
        }
        const key = `QC-${keyParts.join('-')}`;
        
        licenseKeys.set(key, {
            product,
            duration: duration || 'lifetime',
            used: false,
            usedBy: null,
            usedAt: null,
            createdAt: new Date().toISOString(),
            createdBy: req.adminEmail
        });
        
        generatedKeys.push(key);
    }
    
    console.log(`[ADMIN] Generated ${quantity} keys for ${product} by ${req.adminEmail}`);
    
    res.json({
        success: true,
        message: `${quantity} license key(s) generated`,
        keys: generatedKeys
    });
});

// Admin API - Delete license key
app.delete('/api/admin/keys/:key', requireAdmin, (req, res) => {
    const { key } = req.params;
    
    if (!licenseKeys.has(key)) {
        return res.status(404).json({ success: false, message: 'Key not found' });
    }
    
    licenseKeys.delete(key);
    console.log(`[ADMIN] Key ${key} deleted by ${req.adminEmail}`);
    
    res.json({
        success: true,
        message: 'License key deleted'
    });
});

// Catch-all handler for product pages
app.get('/product*.html', (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

// Start server
app.listen(PORT, () => {
    console.log(`QC CHEATS server running on port ${PORT}`);
    console.log(`Cash App Cashtag: $Zack18459`);
});

// Import necessary modules
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser'); // To parse JSON request bodies
const path = require('path'); // To serve frontend static files
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

// --- Configuration ---
const PORT = process.env.PORT || 3000; // Port for the API server
let isClientReady = false;

// --- Express App Initialization ---
const app = express();
app.use(bodyParser.json()); // Middleware to parse JSON bodies
app.use(express.static(path.join(__dirname, 'frontend'))); // Serve frontend static files
// --- Secret Key Middleware ---
const SECRET_KEY = process.env.SECRET_KEY;
function requireSecretKey(req, res, next) {
    // Allow health check and static files without secret
    if (
        req.path === '/health' ||
        req.path === '/qr-code' ||
        req.path === '/' ||
        req.path.startsWith('/static') ||
        req.path.startsWith('/frontend')
    ) {
        return next();
    }
    const key = req.headers['x-api-key'] || req.query.secret || req.body?.secret;
    if (!SECRET_KEY || key !== SECRET_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing secret key.' });
    }
    next();
}
app.use(requireSecretKey);

// Declare qrcode globally to avoid scope issues
let saveQrcode = null;

// --- WhatsApp Client Initialization ---
console.log("Initializing WhatsApp client...");
const client = new Client({
    authStrategy: new LocalAuth(), // Persists session locally
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
            // '--single-process', // Removing for server stability, can cause issues
        ],
    }
});

// --- WhatsApp Event Handlers ---

client.on('qr', (qr) => {
    saveQrcode = qr; // Store QR code globally
    console.log('----------------------------------------------------------------------------------');
    console.log('QR Code Received! Scan this with WhatsApp on your phone:');
    qrcode.generate(qr, { small: true });
    console.log('----------------------------------------------------------------------------------');
    isClientReady = false;
});

client.on('authenticated', () => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Authenticated successfully!');
    console.log('----------------------------------------------------------------------------------');
});

client.on('auth_failure', async (msg) => {
    console.error('----------------------------------------------------------------------------------');
    console.error('AUTHENTICATION FAILURE:', msg);
    console.error('This can happen if session data is corrupt. Try deleting the .wwebjs_auth folder and restarting.');
    console.error('----------------------------------------------------------------------------------');
    isClientReady = false;
    // In a server context, you might want to attempt re-initialization or notify an admin
    // For now, we'll just log it. The server will keep running but WhatsApp functionality will be down.
});

client.on('ready', () => {
    console.log('----------------------------------------------------------------------------------');
    console.log('WhatsApp client is ready!');
    console.log('API is ready to accept requests on /send-message');
    console.log('----------------------------------------------------------------------------------');
    isClientReady = true;
});

client.on('disconnected', (reason) => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Client was logged out / disconnected:', reason);
    console.log('Attempting to re-initialize client...');
    console.log('----------------------------------------------------------------------------------');
    isClientReady = false;
    client.initialize().catch(err => { // Try to re-initialize
        console.error("Failed to re-initialize WhatsApp client after disconnection:", err);
    });
});


// --- API Endpoint to Send Message ---
app.post('/send-message', async (req, res) => {
    
    if (!isClientReady) {
        return res.status(503).json({ success: false, error: "WhatsApp client is not ready. Please try again shortly." });
    }

    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ success: false, error: "Missing 'number' or 'message' in request body." });
    }

    // Basic validation for number format (can be improved)
    if (!/^\d+$/.test(number)) {
        return res.status(400).json({ success: false, error: "Invalid 'number' format. Should be digits only (country code + number)." });
    }

    const chatId = `${number}@c.us`; // WhatsApp chat ID format

    console.log(`API: Attempting to send message to: ${chatId}`);
    console.log(`API: Message: "${message}"`);

    try {
        const sentMessage = await client.sendMessage(chatId, message);
        console.log(`API: Message sent successfully to ${chatId}!`);
        res.status(200).json({ success: true, message: "Message sent successfully!", messageId: sentMessage.id._serialized });
    } catch (error) {
        console.error(`API: Error sending message to ${chatId}:`, error);
        res.status(500).json({ success: false, error: "Failed to send message.", details: error.message });
    }
});

// --- Get QR Code Endpoint ---
app.get('/qr-code', (req, res) => {
    if (!saveQrcode) {
        return res.status(404).json({ success: false, error: "QR code not available. Please initialize the client first." });
    }
    res.status(200).json({ success: true, qrCode: saveQrcode });
});

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
    if (isClientReady) {
        return res.status(200).json({ success: true, message: "WhatsApp client is ready and API is operational." });
    } else {
        return res.status(503).json({ success: false, message: "WhatsApp client is not ready. Please wait." });
    }
});

// --- Start WhatsApp Client and Express Server ---
client.initialize().catch(err => {
    console.error("Initial WhatsApp client initialization failed:", err);
    // The server will still start, but WhatsApp functionality will be unavailable until client is ready.
});

const server = app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
    console.log(`Send POST requests to http://localhost:${PORT}/send-message`);
    console.log('Request body example: { "number": "6281234567890", "message": "Hello from the API!" }');
});


// --- Graceful Shutdown ---
async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    isClientReady = false; // Stop accepting new requests effectively

    // Close HTTP server
    server.close(async () => {
        console.log('HTTP server closed.');
        // Destroy WhatsApp client
        if (client) {
            try {
                console.log("Destroying WhatsApp client...");
                await client.destroy();
                console.log("WhatsApp client destroyed.");
            } catch (e) {
                console.error("Error destroying WhatsApp client:", e);
            }
        }
        process.exit(0);
    });

    // Force shutdown if server doesn't close in time
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 seconds timeout
}

process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Termination signal

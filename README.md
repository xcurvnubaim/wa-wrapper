# WhatsApp Bot API

A simple Node.js API to send WhatsApp messages using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).  
Includes a frontend for sending messages and supports API key authentication.

## Features

- Send WhatsApp messages via REST API
- Secure endpoints with a secret API key
- QR code authentication for WhatsApp Web
- Simple frontend for manual message sending

## Requirements

- Node.js v18+
- npm
- Google Chrome or Chromium (for puppeteer)
- WhatsApp account

## Setup

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd wa-bot
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the project root:
   ```
   SECRET_KEY=your-very-secret-key
   PORT=3000
   ```

   - `SECRET_KEY` is required for API authentication.
   - `PORT` is optional (default: 3000).

4. **Start the server:**
   ```sh
   node main.js
   ```

5. **Scan the QR code:**
   - On first run, a QR code will be shown in the terminal.
   - Scan it with your WhatsApp mobile app (Menu > Linked Devices).

## API Usage

### Send Message

- **Endpoint:** `POST /send-message`
- **Headers:**  
  `Content-Type: application/json`  
  `x-api-key: <your-secret-key>`
- **Body:**
  ```json
  {
    "number": "6281234567890",
    "message": "Hello from the API!"
  }
  ```
- **Response:**
  ```json
  { "success": true, "message": "Message sent successfully!", "messageId": "..." }
  ```

### Get QR Code

- **Endpoint:** `GET /qr-code`
- **Response:**  
  `{ "success": true, "qrCode": "<base64 or string>" }`

### Health Check

- **Endpoint:** `GET /health`

## Frontend

- Open `http://localhost:3000/` in your browser.
- Fill in the phone number, message, and secret key to send a message.

## Security

- All API endpoints (except `/health`, `/qr-code`, and static files) require the correct `SECRET_KEY`.
- Never share your secret key or session files publicly.

## Troubleshooting

- If authentication fails, delete the `.wwebjs_auth` folder and restart the server.
- Make sure your WhatsApp account is active and not banned.


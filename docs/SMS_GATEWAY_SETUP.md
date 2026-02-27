# SMS Gateway Setup Guide

Self-hosted SMS via Android phone + Digicel/Vodafone Vanuatu SIM.  
No third-party SMS account needed. Messages send at local VUV rates.

**Architecture:**
```
Render (Express server)
        ↓ HTTPS POST
localhost.run tunnel (public URL)
        ↓ forwards to local WiFi
Android phone running SMS Gateway app
        ↓ sends via SIM card
Customer's phone (Vanuatu number)
```

---

## What You Need

- Android phone (any model, Android 5.0+) — a spare/old phone is fine
- Digicel or Vodafone Vanuatu SIM with prepaid credit
- The phone permanently plugged into power and on WiFi
- F-Droid app store installed on the phone (free, open source)

---

## Part 1 — Android Phone Setup

### 1.1 Install F-Droid

F-Droid is an open source app store. The Play Store versions of the apps
we need are outdated, so we use F-Droid instead.

1. On the phone, open the browser and go to **f-droid.org**
2. Download and install the F-Droid APK
3. When prompted about installing from unknown sources, tap **Settings**
   and enable it for your browser app, then go back and install

### 1.2 Install Termux

Termux is a Linux terminal that runs on Android — this is where all
scripts run.

1. Open F-Droid
2. Search for **Termux**
3. Install it (the one by Fredrik Fornwall)

### 1.3 Install Termux:Boot

This companion app lets Termux scripts run automatically when the phone
boots up. Without it, you'd have to manually restart everything after
every reboot.

1. In F-Droid, search for **Termux:Boot**
2. Install it
3. Open it once (just open and close — this registers it as a boot service)

### 1.4 Install the Android SMS Gateway app

1. On the phone, go to **github.com/capcom6/android-sms-gateway/releases**
   in the browser
2. Download the latest **release** APK (not the debug build)
3. Tap the downloaded file to install it
4. Grant all requested permissions — SMS sending is required, phone state
   is needed for dual-SIM phones to pick which SIM to use

### 1.5 Configure the SMS Gateway app

1. Open the app
2. Toggle **Local Server** to ON
3. Tap **Offline** to start the server
4. The app will show:
   - Local IP address (e.g. `192.168.1.50:8080`)
   - A generated username and password
5. **Write these down** — you will need them shortly
6. Keep the app open and running

### 1.6 Prevent the phone from sleeping

The phone must stay awake and connected for SMS to work reliably.

1. Go to **Settings → Display → Screen timeout** → set to **Never**
2. Go to **Settings → Battery** → find the SMS Gateway app → set to
   **Unrestricted** or disable battery optimisation for it
3. Also do the same for Termux
4. Plug the phone into power permanently

---

## Part 2 — Termux Setup

Open the Termux app. All of the following commands are typed in Termux.

### 2.1 Install required packages

```bash
pkg update && pkg upgrade -y
pkg install openssh curl cronie -y
```

### 2.2 Create the working directory and scripts

```bash
mkdir -p ~/acetours
```

### 2.3 Create the tunnel startup script

```bash
nano ~/acetours/start-tunnel.sh
```

Paste the following exactly:

```bash
#!/data/data/com.termux/files/usr/bin/bash
# Starts a localhost.run SSH tunnel and saves the public URL to a file.
# The URL is used by update-render.sh to keep Render's env var current.

TUNNEL_URL_FILE="$HOME/acetours/tunnel_url.txt"

# Kill any existing tunnel first
pkill -f "localhost.run" 2>/dev/null
sleep 2

# Start tunnel in background, watch output for the public URL
ssh -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -R 80:localhost:8080 nokey@localhost.run 2>&1 | \
while IFS= read -r line; do
    echo "$line"
    # localhost.run prints a line containing the public URL
    if echo "$line" | grep -q "localhost.run"; then
        URL=$(echo "$line" | grep -oP 'https://[^\s]+')
        if [ -n "$URL" ]; then
            echo "$URL" > "$TUNNEL_URL_FILE"
            echo "[$(date)] Tunnel URL saved: $URL"
        fi
    fi
done &

echo "[$(date)] Tunnel process started in background"
```

Save with **Ctrl+O**, then **Enter**, then exit with **Ctrl+X**.

```bash
chmod +x ~/acetours/start-tunnel.sh
```

### 2.4 Get your Render API credentials

Before creating the next script you need two values from Render:

**Render API Key:**
1. Go to dashboard.render.com
2. Click your profile picture → **Account Settings**
3. Scroll to **API Keys** → **Create API Key**
4. Copy the key (starts with `rnd_`)

**Render Service ID:**
1. Go to your AceTours service in the Render dashboard
2. Look at the URL — it will be something like:
   `https://dashboard.render.com/web/srv-cxxxxxxxxxxxxxxxxx`
3. Copy the `srv-cxxxxxxxxxxxxxxxxx` part

### 2.5 Create the Render update script

```bash
nano ~/acetours/update-render.sh
```

Paste the following, replacing the two placeholder values:

```bash
#!/data/data/com.termux/files/usr/bin/bash
# Checks if the tunnel URL has changed.
# If it has, updates the SMS_GATEWAY_URL environment variable on Render.
# Render's sms.service.ts reads this env var on every SMS send,
# so no server restart is needed — the new URL takes effect immediately.

RENDER_API_KEY="rnd_XXXXXXXXXXXXXXXXXX"    # ← paste your Render API key here
RENDER_SERVICE_ID="srv-XXXXXXXXXX"          # ← paste your Render service ID here

TUNNEL_URL_FILE="$HOME/acetours/tunnel_url.txt"
LAST_URL_FILE="$HOME/acetours/last_deployed_url.txt"
LOG_FILE="$HOME/acetours/update.log"

# Read current tunnel URL
if [ ! -f "$TUNNEL_URL_FILE" ]; then
    echo "[$(date)] No tunnel URL file found — tunnel may not be running" >> "$LOG_FILE"
    exit 1
fi

CURRENT_URL=$(cat "$TUNNEL_URL_FILE" | tr -d '[:space:]')

if [ -z "$CURRENT_URL" ]; then
    echo "[$(date)] Tunnel URL is empty" >> "$LOG_FILE"
    exit 1
fi

# Compare with last deployed URL — skip if unchanged
LAST_URL=""
if [ -f "$LAST_URL_FILE" ]; then
    LAST_URL=$(cat "$LAST_URL_FILE" | tr -d '[:space:]')
fi

if [ "$CURRENT_URL" = "$LAST_URL" ]; then
    # URL unchanged — nothing to do
    exit 0
fi

echo "[$(date)] URL changed: $LAST_URL → $CURRENT_URL" >> "$LOG_FILE"

# Update environment variable on Render via API
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
    "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "[{\"key\": \"SMS_GATEWAY_URL\", \"value\": \"${CURRENT_URL}\"}]")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "[$(date)] Render env var updated — next SMS will use new URL" >> "$LOG_FILE"
    # Save the URL we just deployed so we don't update again unnecessarily
    echo "$CURRENT_URL" > "$LAST_URL_FILE"
else
    echo "[$(date)] Failed to update Render: HTTP $HTTP_CODE — $BODY" >> "$LOG_FILE"
fi
```

Save and exit (Ctrl+O, Enter, Ctrl+X).

```bash
chmod +x ~/acetours/update-render.sh
```

### 2.6 Set up cron jobs

Cron runs the scripts on a schedule automatically.

```bash
# Start the cron daemon
crond

# Open the crontab editor
crontab -e
```

This opens a text editor. Add these lines at the bottom:

```
# Check tunnel URL every 5 minutes, update Render if it changed
*/5 * * * * $HOME/acetours/update-render.sh

# Restart the tunnel if it has died (checks every 10 minutes)
*/10 * * * * pgrep -f "localhost.run" || $HOME/acetours/start-tunnel.sh
```

Save and exit.

### 2.7 Set up auto-start on phone boot

```bash
mkdir -p ~/.termux/boot
nano ~/.termux/boot/start.sh
```

Paste:

```bash
#!/data/data/com.termux/files/usr/bin/bash
# This file runs automatically when the phone boots.
# Requires Termux:Boot to be installed from F-Droid.

# Wait 30 seconds for WiFi to connect before starting
sleep 30

# Start the cron daemon
crond

# Start the SSH tunnel
$HOME/acetours/start-tunnel.sh
```

Save and exit.

```bash
chmod +x ~/.termux/boot/start.sh
```

---

## Part 3 — Environment Variables on Render

In your Render dashboard, go to your AceTours service →
**Environment** → add the following variables:

| Variable | Value |
|----------|-------|
| `SMS_ENABLED` | `true` |
| `SMS_GATEWAY_URL` | *(leave blank for now — the cron job will fill this in)* |
| `SMS_GATEWAY_USER` | *(username shown in the SMS Gateway app)* |
| `SMS_GATEWAY_PASS` | *(password shown in the SMS Gateway app)* |
| `SMS_FROM_NAME` | `AceTours` |
| `SMS_ADMIN_PHONE` | `+6781234567` *(your admin phone number for notifications)* |

---

## Part 4 — Server Code

### 4.1 File location

The SMS service is already implemented at:
```
server/infrastructure/sms/sms.service.ts
```

### 4.2 Using it in booking confirmations

In `server/application/events/BookingEventHandler.ts`, import and call
the service after a booking is confirmed:

```typescript
import { smsService } from '../infrastructure/sms/sms.service.js';

// Inside onPaymentConfirmed, after sessionService.confirmSessionAtomically:
if (booking.customerPhone) {
  await smsService.sendBookingConfirmation(booking.customerPhone, {
    customerName: booking.customerName,
    tourName:     booking.tourName,
    date:         booking.date,
    bookingRef:   booking.paymentReference || booking.id.slice(0, 8).toUpperCase(),
    guests:       booking.guests,
  });
}

// Notify admin of new booking
const adminPhone = process.env.SMS_ADMIN_PHONE;
if (adminPhone) {
  await smsService.sendAdminNewBooking(adminPhone, {
    customerName: booking.customerName,
    tourName:     booking.tourName,
    date:         booking.date,
    guests:       booking.guests,
    amountVUV:    Math.round(booking.totalAmountCents / 100),
    paymentRef:   booking.paymentReference || booking.id.slice(0, 8).toUpperCase(),
  });
}
```

### 4.3 Sending a pending payment SMS

In `server/application/payment.application-service.ts`, after creating
the payment record for an offline/bank transfer gateway:

```typescript
if (booking.customerPhone) {
  await smsService.sendBookingPending(booking.customerPhone, {
    customerName: booking.customerName,
    tourName:     booking.tourName,
    date:         booking.date,
    paymentRef:   toPaymentRef(booking.id), // ACT-XXXXXXXX format
    amountVUV:    Math.round(booking.totalAmountCents / 100),
  });
}
```

---

## Part 5 — Testing

### 5.1 Test the tunnel manually

In Termux on the phone:

```bash
~/acetours/start-tunnel.sh
sleep 5
cat ~/acetours/tunnel_url.txt
```

You should see a URL like `https://abc123.localhost.run`.

### 5.2 Test the SMS gateway directly

From any computer on the same WiFi as the phone:

```bash
curl -X POST http://192.168.1.50:8080/message \
  -u "username:password" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test from AceTours", "phoneNumbers": ["+6781234567"]}'
```

Replace IP, username, password, and phone number with your actual values.

### 5.3 Test through the tunnel

```bash
TUNNEL_URL=$(cat ~/acetours/tunnel_url.txt)
curl -X POST "${TUNNEL_URL}/message" \
  -u "username:password" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tunnel test", "phoneNumbers": ["+6781234567"]}'
```

### 5.4 Test the Render update script

```bash
~/acetours/update-render.sh
cat ~/acetours/update.log
```

Check the log shows `Render env var updated` with HTTP 200.

### 5.5 Test end-to-end from Render

SSH into your Render shell (or use the Render Shell feature) and run:

```bash
curl -X POST http://localhost:3000/api/admin/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+6781234567", "message": "End-to-end test"}'
```

*(You may need to add a temporary test endpoint for this, or just
trigger a test booking and check the customer gets an SMS.)*

---

## Part 6 — Monitoring & Troubleshooting

### View the update log

```bash
cat ~/acetours/update.log
```

### Check the tunnel is running

```bash
pgrep -fa "localhost.run" && echo "RUNNING" || echo "NOT RUNNING"
```

### Check the current tunnel URL

```bash
cat ~/acetours/tunnel_url.txt
```

### Manually restart everything

```bash
pkill -f "localhost.run"
~/acetours/start-tunnel.sh
sleep 5
~/acetours/update-render.sh
```

### Common issues

**No URL in tunnel_url.txt**
The SSH connection to localhost.run may have failed. Check internet
connectivity on the phone. Try running `start-tunnel.sh` manually and
watch the output.

**Render update returns HTTP 401**
Your API key is wrong or expired. Generate a new one in Render →
Account Settings → API Keys.

**Render update returns HTTP 404**
Your service ID is wrong. Check the URL in the Render dashboard —
it should be `srv-` followed by letters and numbers.

**SMS sends from curl but not from the server**
The `SMS_GATEWAY_USER` or `SMS_GATEWAY_PASS` env var on Render doesn't
match what the SMS Gateway app shows. Check the app — credentials can
be regenerated by toggling the server off and on.

**Phone went offline overnight**
Check battery optimisation — Android may have killed Termux. Go to
Settings → Battery → Termux → set to Unrestricted. Also check the
SMS Gateway app has the same setting.

---

## Part 7 — How the URL Update Works (No Restart Needed)

Unlike most services that read environment variables once at startup,
`sms.service.ts` reads `process.env.SMS_GATEWAY_URL` on **every SMS
send**. This means:

1. localhost.run restarts → new URL written to `tunnel_url.txt`
2. Cron runs within 5 minutes → calls Render API to update env var
3. Next SMS sent by the server → reads the updated env var → works

No Render redeploy is needed. The window where SMS might fail is at
most 5 minutes after a tunnel restart.

---

## Summary of Files

| File | Location |
|------|----------|
| SMS service | `server/infrastructure/sms/sms.service.ts` |
| Tunnel script | `~/acetours/start-tunnel.sh` on the phone |
| Render updater | `~/acetours/update-render.sh` on the phone |
| Boot script | `~/.termux/boot/start.sh` on the phone |
| Update log | `~/acetours/update.log` on the phone |

## Summary of Environment Variables

| Variable | Description |
|----------|-------------|
| `SMS_ENABLED` | Set to `true` to enable SMS |
| `SMS_GATEWAY_URL` | Auto-updated by cron — the tunnel public URL |
| `SMS_GATEWAY_USER` | Username from the SMS Gateway app |
| `SMS_GATEWAY_PASS` | Password from the SMS Gateway app |
| `SMS_FROM_NAME` | Label prepended to messages e.g. `AceTours` |
| `SMS_ADMIN_PHONE` | Admin phone for new booking notifications |

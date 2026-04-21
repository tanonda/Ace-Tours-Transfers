# SMS Gateway Setup Guide (Cloud Server Mode)

This guide shows how to set up an Android phone as an SMS Gateway for Ace Tours & Transfers using CapCom6's Cloud Server. 

By using the Cloud Server, you avoid complex reverse proxy tunnels like `localhost.run`, termux scripting, and cron tasks. The phone simply connects to the cloud, and your Render app pushes messages to the cloud API which relays them to the phone.

---

## What You Need

- An Android phone with a Digicel or Vodafone Vanuatu SIM (with prepaid SMS credit).
- The phone connected permanently to power and WiFi/Data.

---

## Part 1 — Android Phone Setup

### 1.1 Install the SMS Gateway App
1. On your phone, go to **https://github.com/capcom6/android-sms-gateway/releases**
2. Download the latest `.apk` file (the standard release, not debug).
3. Install the app, granting all necessary permissions (SMS sending, battery usage, etc.).
4. **Important**: Go to Android settings and ensure Battery Optimization is turned **OFF** for this app so it stays alive in the background.

### 1.2 Configure the App
1. Open the "SMS Gateway" app.
2. At the top, ensure it says "Internet connection: available".
3. Toggle on **Cloud server**.
4. The screen will automatically populate with your Cloud Server settings, including:
   - Server address (usually `api.sms-gate.app:443`)
   - Username
   - Password
   - Device ID
5. Toggle on **Start on boot** at the bottom.
6. The connection status at the very bottom should read **ONLINE**.

---

## Part 2 — Server Configuration

Once your phone is ONLINE, you need to plug the credentials into the Ace Tours server environment.

### Production (Render Dashboard)
Go to your AceTours service on Render → **Environment** and set/update these variables:

| Variable | Value |
|----------|-------|
| `SMS_ENABLED` | `true` |
| `SMS_PROVIDER` | `android_gateway` |
| `SMS_CLOUD_URL` | `https://api.sms-gate.app` (The app shows it with :443, ignore the :443 part) |
| `SMS_CLOUD_LOGIN` | *(The Username shown in the app)* |
| `SMS_CLOUD_PASSWORD` | *(The Password shown in the app)* |
| `SMS_FROM_NAME` | `AceTours` |
| `SMS_ADMIN_PHONE` | `+6781234567` *(Admin notification number)* |

**That's it!** You don't need any local tunnel or background workers. The official backend `android-sms-gateway` npm package handles the secure connection with the cloud server seamlessly.

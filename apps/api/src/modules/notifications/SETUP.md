# Notifications Module Setup

## 1. Install Dependencies

```bash
npm install resend twilio web-push @nestjs/schedule
npm install -D @types/web-push
```

## 2. Environment Variables

Add to `.env` (development) and production environment:

```bash
# Email Provider (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=Kamaia <alerts@kamaia.ao>

# SMS Provider (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+244xxxxxxxxx

# Push Notifications (Web Push VAPID)
VAPID_PUBLIC_KEY=BPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:alerts@kamaia.ao

# Frontend URL (for email links)
FRONTEND_URL=https://kamaia.ao
```

### Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Copy the output to your `.env`:
- Public Key → `VAPID_PUBLIC_KEY`
- Private Key → `VAPID_PRIVATE_KEY`

## 3. Database Seed

Seed data includes notification preferences for test users:

```bash
npm run prisma:seed
```

## 4. Test the Module

### a) Start the API

```bash
npm run dev
```

### b) Send a test notification

```bash
curl -X POST http://localhost:3001/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response (DRY_RUN mode if providers not configured):

```json
{
  "data": {
    "email": { "status": "DRY_RUN", "id": "notification-id" },
    "sms": null,
    "push": null
  }
}
```

### c) Manually trigger alerts job

```bash
curl -X POST http://localhost:3001/notifications/trigger-alerts \
  -H "Authorization: Bearer SOCIO_JWT_TOKEN"
```

Expected response:

```json
{
  "data": {
    "gabinetes": 1,
    "prazos": 3,
    "notifications": 3
  }
}
```

## 5. Production Setup

### Resend (Email)

1. Sign up at https://resend.com
2. Verify your domain (e.g., kamaia.ao)
3. Create API key
4. Add `RESEND_API_KEY` to production env

### Twilio (SMS)

1. Sign up at https://www.twilio.com
2. Get a phone number (Angola: +244)
3. Copy Account SID, Auth Token, Phone Number
4. Add to production env

### VAPID (Push)

1. Generate keys: `npx web-push generate-vapid-keys`
2. Add keys to production env
3. Frontend must register service worker and subscribe using the public key

## 6. Monitoring

Check logs for provider status on startup:

```
[EmailProvider] Email provider enabled (Resend)
[SmsProvider] SMS provider in DRY_RUN mode (Twilio not configured)
[PushProvider] Push provider enabled (VAPID)
```

Check scheduler execution:

```
[AlertsSchedulerService] Running scheduled alerts job
[AlertsSchedulerService] Alerts job complete: 1 gabinetes, 3 prazos, 3 notifications sent
```

## 7. Frontend Integration

### a) Subscribe to Push Notifications

```typescript
// Get VAPID public key
const { publicKey } = await fetch('/notifications/vapid-public-key').then(r => r.json());

// Register service worker
const registration = await navigator.serviceWorker.register('/sw.js');

// Subscribe
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(publicKey),
});

// Send to backend
await fetch('/notifications/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(subscription),
});
```

### b) Manage Preferences

```typescript
// Get preferences
const { data } = await fetch('/notifications/preferences').then(r => r.json());

// Update preferences
await fetch('/notifications/preferences', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    smsOnlyUrgent: true,
  }),
});
```

## 8. Troubleshooting

### Notifications not being sent

1. Check provider status in logs
2. Verify environment variables
3. Check user preferences: `GET /notifications/preferences`
4. Check prazo alert window: `dueDate - alertHoursBefore`
5. Check deduplication: only 1 notification per prazo per user per 24h

### Push notifications fail with 410 Gone

- Subscription expired, frontend needs to re-subscribe
- Backend automatically deactivates expired subscriptions

### SMS only sent for urgent prazos

- Check user preferences: `smsOnlyUrgent: true`
- Only prazos with `isUrgent: true` will trigger SMS

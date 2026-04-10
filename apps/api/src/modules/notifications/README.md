# Notifications Module

Multi-channel notification system for Kamaia with support for Email, SMS, and Push notifications.

## Features

- **Multi-channel**: Email (Resend), SMS (Twilio), Push (Web Push VAPID)
- **User preferences**: Granular control per user
- **Graceful degradation**: DRY_RUN mode when providers not configured
- **Automated alerts**: Scheduled cron job for prazo alerts
- **Deduplication**: Prevents duplicate notifications within 24h window

## Environment Variables

```bash
# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=Kamaia <alerts@kamaia.ao>

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+244xxx

# Push (VAPID)
VAPID_PUBLIC_KEY=BPxxx
VAPID_PRIVATE_KEY=xxx
VAPID_SUBJECT=mailto:alerts@kamaia.ao

# Frontend
FRONTEND_URL=https://kamaia.ao
```

## Endpoints

| Method | Path | Description | Guards |
|--------|------|-------------|--------|
| GET | `/notifications` | List notifications (paginated) | JwtAuthGuard, GabineteGuard |
| GET | `/notifications/unread-count` | Get unread count | JwtAuthGuard, GabineteGuard |
| GET | `/notifications/preferences` | Get user preferences | JwtAuthGuard, GabineteGuard |
| PUT | `/notifications/preferences` | Update preferences | JwtAuthGuard, GabineteGuard |
| POST | `/notifications/push/subscribe` | Subscribe to push | JwtAuthGuard, GabineteGuard |
| DELETE | `/notifications/push/:id` | Unsubscribe | JwtAuthGuard, GabineteGuard |
| POST | `/notifications/test` | Send test notification | JwtAuthGuard, GabineteGuard |
| POST | `/notifications/trigger-alerts` | Manually trigger alerts job | JwtAuthGuard, GabineteGuard, RolesGuard (SOCIO_GESTOR) |
| GET | `/notifications/vapid-public-key` | Get VAPID public key | JwtAuthGuard, GabineteGuard |
| PATCH | `/notifications/:id/read` | Mark as read | JwtAuthGuard, GabineteGuard |

## Notification Types

- `PRAZO_UPCOMING`: Alert sent when prazo alert window is reached
- `PRAZO_TODAY`: Alert for prazos due within 24 hours
- `PRAZO_CRITICAL`: Alert for urgent prazos
- `TEST`: Test notification

## Scheduler

Runs every hour (`@Cron(CronExpression.EVERY_HOUR)`):

1. Get all active gabinetes
2. For each gabinete, find prazos needing alerts:
   - Status = PENDENTE
   - dueDate > now
   - dueDate - alertHoursBefore <= now
   - No notification sent in last 24h
3. Send notifications via enabled channels
4. Respect user preferences (smsOnlyUrgent, etc.)

## Testing

```bash
npm run test -- notifications.spec.ts
```

## Provider Status

Providers gracefully degrade to DRY_RUN mode when environment variables are missing. Check logs:

```
[EmailProvider] Email provider in DRY_RUN mode (RESEND_API_KEY not set)
[SmsProvider] SMS provider in DRY_RUN mode (Twilio not configured)
[PushProvider] Push provider in DRY_RUN mode
```

## Dependencies

```json
{
  "resend": "^3.0.0",
  "twilio": "^5.0.0",
  "web-push": "^3.6.0",
  "@nestjs/schedule": "^4.0.0"
}
```

Install with:

```bash
npm install resend twilio web-push
```

## Architecture

```
notifications.controller.ts    ← HTTP endpoints
notifications.service.ts        ← Business logic
notifications.repository.ts     ← Data access
alerts-scheduler.service.ts     ← Cron job
providers/
  email.provider.ts             ← Resend integration
  sms.provider.ts               ← Twilio integration
  push.provider.ts              ← Web Push VAPID
```

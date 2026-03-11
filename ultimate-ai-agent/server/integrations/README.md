# Integration Guides

## mamama.pro + Slack Integration

This integration allows you to receive webhooks from mamama.pro and automatically send notifications to a Slack channel.

### Setup Instructions

#### 1. Create a Slack Webhook

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app or select an existing one
3. Go to **Incoming Webhooks** section
4. Click **Add New Webhook to Workspace**
5. Select the channel where you want notifications
6. Copy the webhook URL (looks like: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`)

#### 2. Configure Environment Variable

Add the webhook URL to your `.env` file:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

#### 3. Configure mamama.pro Webhook

In your mamama.pro settings, configure the webhook URL to:

```
http://your-domain/api/integrations/mamama
```

Replace `your-domain` with your actual domain or localhost URL.

### Webhook Payload Format

mamama.pro should send a JSON payload with the following structure:

```json
{
  "event": "notification_type",
  "title": "Notification Title",
  "message": "Notification message",
  "description": "Detailed description",
  "status": "active",
  "priority": "high",
  "user": "username",
  "url": "https://example.com/details",
  "data": {
    "custom_field": "value"
  }
}
```

All fields are optional. The integration will format them nicely for Slack display.

### API Endpoints

#### Send mamama.pro Notification to Slack

**POST** `/api/integrations/mamama`

```bash
curl -X POST http://localhost:3000/api/integrations/mamama \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order_created",
    "title": "New Order",
    "message": "Order #12345 has been created",
    "status": "pending",
    "url": "https://mamama.pro/orders/12345"
  }'
```

Response:
```json
{
  "success": true
}
```

### Example Slack Message

The notification will appear in Slack with:
- Header: "🔔 mamama.pro 通知"
- Event type, timestamp
- All relevant details from the webhook
- Link to view more details

### Testing

You can test the integration using curl or Postman:

```bash
# Test with sample payload
curl -X POST http://localhost:3000/api/integrations/mamama \
  -H "Content-Type: application/json" \
  -d '{
    "event": "test",
    "title": "Test Notification",
    "message": "This is a test notification from mamama.pro"
  }'
```

Check that the message appears in your Slack channel.

### Troubleshooting

1. **No message in Slack**
   - Verify `SLACK_WEBHOOK_URL` is set correctly
   - Check server logs for errors
   - Ensure the webhook URL is valid and hasn't expired

2. **Server returns 500 error**
   - Check if all required dependencies are installed
   - Verify the payload format is valid JSON

3. **Wrong channel receives message**
   - Regenerate the Slack webhook URL from the correct channel
   - Update `SLACK_WEBHOOK_URL` environment variable

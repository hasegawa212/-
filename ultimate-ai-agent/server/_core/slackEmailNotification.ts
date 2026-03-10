/**
 * Slack Email Notification Handler
 * Sends properly encoded email notifications to Slack
 */

import { parseEmail, decodeEmailHeader, ensureValidUtf8 } from "./emailEncoding.js";

export interface EmailNotificationConfig {
  webhookUrl: string;
  includeRawEmail?: boolean;
  formatAsThread?: boolean;
}

export interface EmailMessage {
  headers: Record<string, string>;
  subject: string;
  from: string;
  to: string;
  body: string;
  rawEmail?: string;
}

/**
 * Format email for Slack message blocks
 */
function formatEmailForSlack(
  email: EmailMessage,
  compact: boolean = false
): Record<string, unknown> {
  const subject = ensureValidUtf8(email.subject);
  const from = ensureValidUtf8(email.from);
  const body = ensureValidUtf8(email.body);

  if (compact) {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*New Email*\n*From:* ${from}\n*Subject:* ${subject}\n\`\`\`\n${body.substring(0, 300)}${body.length > 300 ? "..." : ""}\n\`\`\``,
      },
    };
  }

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📧 New Email Notification",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*From:*\n${from}`,
          },
          {
            type: "mrkdwn",
            text: `*To:*\n${email.to}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Subject:*\n${subject}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Body:*\n\`\`\`\n${body}\n\`\`\``,
        },
      },
    ],
  };
}

/**
 * Send email notification to Slack
 */
export async function sendEmailToSlack(
  emailContent: string | EmailMessage,
  config: EmailNotificationConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.webhookUrl) {
      return { success: false, error: "Webhook URL is required" };
    }

    // Parse email if it's raw content
    let email: EmailMessage;
    if (typeof emailContent === "string") {
      const parsed = parseEmail(emailContent);
      email = {
        headers: parsed.headers,
        subject: parsed.subject,
        from: parsed.from,
        to: parsed.to,
        body: parsed.body,
        rawEmail: emailContent,
      };
    } else {
      email = emailContent;
    }

    // Format for Slack
    const slackMessage = formatEmailForSlack(email);

    // Send to Slack
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "charset": "utf-8",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Slack API error: ${response.status} - ${error}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process incoming email from webhook and send to Slack
 */
export async function handleEmailWebhook(
  emailContent: string,
  config: EmailNotificationConfig
): Promise<{ success: boolean; email?: EmailMessage; error?: string }> {
  try {
    const parsed = parseEmail(emailContent);
    const email: EmailMessage = {
      headers: parsed.headers,
      subject: parsed.subject,
      from: parsed.from,
      to: parsed.to,
      body: parsed.body,
    };

    const result = await sendEmailToSlack(email, config);

    if (result.success) {
      return { success: true, email };
    } else {
      return { success: false, error: result.error, email };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process email",
    };
  }
}

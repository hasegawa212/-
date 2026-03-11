/**
 * Slack integration utilities for sending notifications
 */

export interface SlackMessage {
  text?: string;
  blocks?: Array<Record<string, any>>;
  attachments?: Array<Record<string, any>>;
  channel?: string;
  thread_ts?: string;
}

export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage | string
): Promise<boolean> {
  if (!webhookUrl) {
    console.error("[Slack] Webhook URL is required");
    return false;
  }

  try {
    const payload = typeof message === "string" ? { text: message } : message;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Slack] Failed to send notification: ${response.status}`);
      return false;
    }

    console.log("[Slack] Notification sent successfully");
    return true;
  } catch (error) {
    console.error("[Slack] Error sending notification:", error);
    return false;
  }
}

/**
 * Format mamama.pro notification for Slack
 */
export function formatMamamaNotificationForSlack(data: any): SlackMessage {
  const timestamp = new Date().toLocaleString("ja-JP");

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔔 mamama.pro 通知",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*イベント:*\n${data.event || data.type || "不明"}`,
          },
          {
            type: "mrkdwn",
            text: `*時刻:*\n${timestamp}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: formatDataContent(data),
        },
      },
      {
        type: "divider",
      },
    ],
  };
}

function formatDataContent(data: any): string {
  let content = "";

  if (data.title) content += `*タイトル:* ${data.title}\n`;
  if (data.message) content += `*メッセージ:* ${data.message}\n`;
  if (data.description) content += `*説明:* ${data.description}\n`;
  if (data.status) content += `*ステータス:* ${data.status}\n`;
  if (data.priority) content += `*優先度:* ${data.priority}\n`;
  if (data.user) content += `*ユーザー:* ${data.user}\n`;
  if (data.url) content += `*リンク:* <${data.url}|詳細を見る>`;

  return content || `\`\`\`${JSON.stringify(data, null, 2)}\`\`\``;
}

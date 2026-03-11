/**
 * mamama.pro webhook integration
 * Handles incoming webhooks from mamama.pro and forwards notifications to Slack
 */

import { sendSlackNotification, formatMamamaNotificationForSlack } from "./slack.js";

export interface MamamaWebhookPayload {
  event?: string;
  type?: string;
  title?: string;
  message?: string;
  description?: string;
  status?: string;
  priority?: string;
  user?: string;
  url?: string;
  data?: Record<string, any>;
  timestamp?: string;
}

/**
 * Process incoming mamama.pro webhook and send to Slack
 */
export async function processMamamaWebhook(
  payload: MamamaWebhookPayload,
  slackWebhookUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate webhook payload
    if (!payload) {
      return { success: false, error: "Invalid payload" };
    }

    // Get Slack webhook URL from environment or parameter
    const webhookUrl = slackWebhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn(
        "[mamama] No Slack webhook URL configured. Webhook received but not forwarded."
      );
      console.log("[mamama] Received webhook:", payload);
      return { success: true };
    }

    // Format and send to Slack
    const slackMessage = formatMamamaNotificationForSlack(payload);
    const success = await sendSlackNotification(webhookUrl, slackMessage);

    if (!success) {
      return { success: false, error: "Failed to send Slack notification" };
    }

    console.log("[mamama] Webhook processed and sent to Slack");
    return { success: true };
  } catch (error) {
    console.error("[mamama] Error processing webhook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate mamama.pro webhook signature (if needed)
 */
export function validateMamamaWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Implement signature validation if mamama.pro provides it
  // This is a placeholder for future implementation
  try {
    // Example: HMAC-SHA256 validation
    // const crypto = require("crypto");
    // const hash = crypto
    //   .createHmac("sha256", secret)
    //   .update(payload)
    //   .digest("hex");
    // return hash === signature;

    return true; // For now, accept all webhooks
  } catch (error) {
    console.error("[mamama] Signature validation error:", error);
    return false;
  }
}

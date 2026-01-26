// SendGrid Service for RankedCEO CRM
import { MailDataRequired } from '@sendgrid/mail';
import sgMail from '@sendgrid/mail';

interface SendGridEmailOptions {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  html: string;
  text?: string;
  customArgs?: Record<string, any>;
  trackingSettings?: {
    clickTracking?: { enable: boolean };
    openTracking?: { enable: boolean };
    subscriptionTracking?: { enable: boolean };
  };
}

interface SendGridResponse {
  success: boolean;
  messageId?: string;
  errors?: string[];
}

interface SendGridWebhookEvent {
  email: string;
  event: string;
  message_id: string;
  timestamp: number;
  campaign_id?: string;
  campaign_email_id?: string;
  url?: string;
  reason?: string;
  response?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  useragent?: string;
  ip?: string;
  category?: string[];
}

export class SendGridService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    sgMail.setApiKey(apiKey);
  }

  /**
   * Send a single email using SendGrid
   */
  async sendEmail(options: SendGridEmailOptions): Promise<SendGridResponse> {
    try {
      const mailData: MailDataRequired = {
        to: options.to,
        from: {
          email: options.from,
          name: options.fromName || '',
        },
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        customArgs: {
          ...options.customArgs,
          sentAt: new Date().toISOString(),
        },
        trackingSettings: options.trackingSettings || {
          clickTracking: { enable: true },
          openTracking: { enable: true },
          subscriptionTracking: { enable: true },
        },
      };

      const [response] = await sgMail.send(mailData);
      
      // Extract message ID from response headers
      const messageId = response?.headers?.['x-message-id'] || '';

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      console.error('[SendGrid Service] Error sending email:', error);
      
      const errors: string[] = [];
      if (error.response?.body?.errors) {
        errors.push(...error.response.body.errors.map((e: any) => e.message));
      } else {
        errors.push(error.message || 'Unknown error sending email');
      }

      return {
        success: false,
        errors,
      };
    }
  }

  /**
   * Send bulk emails using SendGrid
   */
  async sendBulkEmails(
    emails: SendGridEmailOptions[],
    batchSize: number = 100
  ): Promise<SendGridResponse[]> {
    const results: SendGridResponse[] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Send emails in parallel within each batch
      const batchResults = await Promise.all(
        batch.map(email => this.sendEmail(email))
      );
      
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Parse SendGrid webhook events
   */
  static parseWebhookEvents(events: any[]): SendGridWebhookEvent[] {
    return events.map((event: any) => ({
      email: event.email,
      event: event.event,
      message_id: event.message_id || event.sg_message_id,
      timestamp: event.timestamp || Date.now(),
      campaign_id: event.campaign_id || event['campaign-id'],
      campaign_email_id: event.campaign_email_id || event['campaign-email-id'],
      url: event.url,
      reason: event.reason,
      response: event.response,
      sg_event_id: event.sg_event_id,
      sg_message_id: event.sg_message_id,
      useragent: event.useragent,
      ip: event.ip,
      category: event.category,
    }));
  }

  /**
   * Validate SendGrid webhook signature
   * Note: This requires crypto operations on the server side
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
    publicKey: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const decodedSignature = Buffer.from(signature, 'base64').toString('utf-8');
      const expectedSignature = crypto
        .createHmac('sha256', publicKey)
        .update(timestamp + payload)
        .digest('base64');
      
      return crypto.timingSafeEqual(
        Buffer.from(decodedSignature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[SendGrid Service] Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Extract campaign ID from SendGrid custom args
   */
  static extractCampaignData(customArgs: Record<string, any>): {
    campaignId?: string;
    campaignEmailId?: string;
  } {
    return {
      campaignId: customArgs.campaign_id || customArgs.campaignId,
      campaignEmailId: customArgs.campaign_email_id || customArgs.campaignEmailId,
    };
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Validate email address format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get email template variables from content
   * Finds variables like {{name}}, {{company}}, etc.
   */
  static extractTemplateVariables(content: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Replace template variables with actual values
   */
  static replaceTemplateVariables(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(html: string): string {
    // Remove dangerous tags and attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Generate unsubscribe link
   */
  static generateUnsubscribeLink(
    baseUrl: string,
    campaignEmailId: string
  ): string {
    return `${baseUrl}/api/unsubscribe?email_id=${campaignEmailId}`;
  }

  /**
   * Generate tracking pixel for open tracking
   * Note: This is an alternative to SendGrid's built-in tracking
   */
  static generateTrackingPixel(
    baseUrl: string,
    campaignEmailId: string
  ): string {
    return `<img src="${baseUrl}/api/track/open?email_id=${campaignEmailId}" width="1" height="1" border="0" alt="">`;
  }

  /**
   * Generate click tracking link
   * Note: This is an alternative to SendGrid's built-in tracking
   */
  static generateClickTrackingLink(
    baseUrl: string,
    originalUrl: string,
    campaignEmailId: string
  ): string {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${baseUrl}/api/track/click?email_id=${campaignEmailId}&url=${encodedUrl}`;
  }
}

// Factory function to create SendGrid service instance
export function createSendGridService(): SendGridService {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }
  
  return new SendGridService(apiKey);
}

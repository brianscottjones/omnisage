/**
 * Webhook Channel Adapter
 * 
 * Generic webhook adapter for custom integrations.
 * Sends messages via HTTP POST, optionally receives via webhook endpoint.
 * TODO: Full implementation - this is a stub for config wiring.
 */

import { BaseChannel, BaseChannelAdapter } from '../base-adapter.js';
import type { ChannelConfig, WebhookChannelConfig, Message, Channel } from '../types.js';

class WebhookChannel extends BaseChannel {
  private config: WebhookChannelConfig;

  constructor(config: WebhookChannelConfig, name?: string) {
    super({ type: 'webhook', id: config.url, name });
    this.config = config;
  }

  async send(message: Message): Promise<void> {
    // TODO: Implement HTTP POST to webhook URL
    console.log(`[Webhook] Sending to ${this.config.url}:`, message.text);
    
    // Stub implementation - would call:
    // await fetch(this.config.url, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     ...this.config.headers,
    //   },
    //   body: JSON.stringify({
    //     text: message.text,
    //     attachments: message.attachments,
    //     metadata: message.metadata,
    //   }),
    // });
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
    console.log(`[Webhook] Disconnected from ${this.config.url}`);
  }
}

export class WebhookAdapter extends BaseChannelAdapter {
  readonly type = 'webhook' as const;

  async connect(config: ChannelConfig): Promise<Channel> {
    const webhookConfig = config.config as WebhookChannelConfig;
    
    // TODO: If listenPath is provided, set up HTTP endpoint to receive webhooks
    // Express/Fastify route that handles incoming POSTs
    // Verify signature using webhookConfig.secret if provided
    
    const channel = new WebhookChannel(webhookConfig, config.name);

    // Mark as connected
    (channel as any).setConnected(true);
    
    console.log(`[Webhook] Connected to ${webhookConfig.url}`);
    
    return channel;
  }

  protected async validateTypeSpecificConfig(config: ChannelConfig): Promise<boolean> {
    const webhookConfig = config.config as WebhookChannelConfig;
    
    if (!webhookConfig.url) {
      return false;
    }
    
    // TODO: Validate URL format
    // TODO: Optionally test webhook URL with a ping message
    
    return true;
  }
}

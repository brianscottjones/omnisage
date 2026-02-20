/**
 * Email Channel Adapter
 * 
 * Connects to email via IMAP (receive) and SMTP (send).
 * TODO: Full implementation - this is a stub for config wiring.
 */

import { BaseChannel, BaseChannelAdapter } from '../base-adapter.js';
import type { ChannelConfig, EmailChannelConfig, Message, Channel } from '../types.js';

class EmailChannel extends BaseChannel {
  private config: EmailChannelConfig;

  constructor(config: EmailChannelConfig, name?: string) {
    super({ type: 'email', id: config.address, name });
    this.config = config;
  }

  async send(message: Message): Promise<void> {
    // TODO: Implement SMTP sending
    // Use nodemailer package
    console.log(`[Email] Sending from ${this.identifier.id}:`, message.text);
    
    // Stub implementation - would call:
    // const transporter = nodemailer.createTransport({
    //   host: this.config.smtp.host,
    //   port: this.config.smtp.port,
    //   secure: this.config.smtp.tls,
    //   auth: { user: this.config.smtp.user, pass: this.config.smtp.password },
    // });
    // 
    // await transporter.sendMail({
    //   from: this.config.address,
    //   to: message.platformOptions?.to,
    //   subject: message.platformOptions?.subject,
    //   text: message.text,
    //   inReplyTo: message.replyTo,
    // });
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
    console.log(`[Email] Disconnected from ${this.identifier.id}`);
  }
}

export class EmailAdapter extends BaseChannelAdapter {
  readonly type = 'email' as const;

  async connect(config: ChannelConfig): Promise<Channel> {
    const emailConfig = config.config as EmailChannelConfig;
    
    // TODO: Initialize IMAP connection for receiving
    // const imapClient = new ImapFlow({
    //   host: emailConfig.imap.host,
    //   port: emailConfig.imap.port,
    //   secure: emailConfig.imap.tls,
    //   auth: { user: emailConfig.imap.user, pass: emailConfig.imap.password },
    // });
    // await imapClient.connect();
    // 
    // Set up mailbox monitoring for incoming messages
    
    const channel = new EmailChannel(emailConfig, config.name);

    // Mark as connected
    (channel as any).setConnected(true);
    
    console.log(`[Email] Connected to ${emailConfig.address}`);
    
    return channel;
  }

  protected async validateTypeSpecificConfig(config: ChannelConfig): Promise<boolean> {
    const emailConfig = config.config as EmailChannelConfig;
    
    if (!emailConfig.address || !emailConfig.imap || !emailConfig.smtp) {
      return false;
    }
    
    if (!emailConfig.imap.host || !emailConfig.imap.user || !emailConfig.imap.password) {
      return false;
    }
    
    if (!emailConfig.smtp.host || !emailConfig.smtp.user || !emailConfig.smtp.password) {
      return false;
    }
    
    // TODO: Validate email address format
    // TODO: Optionally test IMAP/SMTP connections
    
    return true;
  }
}

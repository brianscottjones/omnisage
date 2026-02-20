/**
 * OmniSage Channel Abstraction Layer
 * 
 * Provides a unified interface for all communication channels.
 * Business admins configure channels via omnisage.config.yaml,
 * and the system handles the platform-specific implementation.
 */

export type ChannelType = 'slack' | 'teams' | 'discord' | 'email' | 'telegram' | 'webhook';

/**
 * Unified message structure that works across all channel types.
 */
export interface Message {
  /** Message text content (markdown-formatted when supported) */
  text: string;
  
  /** Optional attachments (files, images, etc.) */
  attachments?: MessageAttachment[];
  
  /** Message to reply to (thread support) */
  replyTo?: string;
  
  /** Metadata for tracking and context */
  metadata?: Record<string, unknown>;
  
  /** Platform-specific overrides if needed */
  platformOptions?: Record<string, unknown>;
}

export interface MessageAttachment {
  /** File path or URL */
  url: string;
  
  /** MIME type */
  contentType?: string;
  
  /** Filename */
  filename?: string;
  
  /** Alternative text description */
  alt?: string;
}

/**
 * Incoming message from any channel.
 */
export interface IncomingMessage {
  /** Unique message ID */
  id: string;
  
  /** Message text */
  text: string;
  
  /** Sender information */
  sender: MessageSender;
  
  /** Channel this came from */
  channel: ChannelIdentifier;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Thread/conversation ID (if threaded) */
  threadId?: string;
  
  /** Attachments */
  attachments?: MessageAttachment[];
  
  /** Platform-specific raw data */
  raw?: unknown;
}

export interface MessageSender {
  /** User ID on the platform */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Email if available */
  email?: string;
  
  /** Avatar URL */
  avatar?: string;
}

export interface ChannelIdentifier {
  /** Channel type */
  type: ChannelType;
  
  /** Platform-specific channel ID */
  id: string;
  
  /** Human-readable name */
  name?: string;
}

/**
 * Message handler callback.
 */
export type MessageHandler = (message: IncomingMessage) => Promise<void> | void;

/**
 * Unified channel interface.
 * All channel adapters must implement this.
 */
export interface Channel {
  /** Channel identifier */
  readonly identifier: ChannelIdentifier;
  
  /** Send a message to this channel */
  send(message: Message): Promise<void>;
  
  /** Register a handler for incoming messages */
  onMessage(handler: MessageHandler): void;
  
  /** Disconnect/cleanup */
  disconnect(): Promise<void>;
  
  /** Check if channel is currently connected */
  isConnected(): boolean;
}

/**
 * Configuration for a specific channel.
 */
export interface ChannelConfig {
  /** Channel type */
  type: ChannelType;
  
  /** Platform-specific config (tokens, IDs, etc.) */
  config: ChannelTypeConfig;
  
  /** Optional display name */
  name?: string;
}

/**
 * Type-specific configuration unions.
 */
export type ChannelTypeConfig =
  | SlackChannelConfig
  | TeamsChannelConfig
  | DiscordChannelConfig
  | EmailChannelConfig
  | TelegramChannelConfig
  | WebhookChannelConfig;

export interface SlackChannelConfig {
  type: 'slack';
  /** Slack bot token */
  token: string;
  /** Channel ID (e.g., C01234567) or name (e.g., #sales) */
  channelId: string;
  /** Optional signing secret for verification */
  signingSecret?: string;
}

export interface TeamsChannelConfig {
  type: 'teams';
  /** Microsoft Bot Framework App ID */
  appId: string;
  /** App password */
  appPassword: string;
  /** Teams channel ID */
  channelId: string;
  /** Service URL */
  serviceUrl?: string;
}

export interface DiscordChannelConfig {
  type: 'discord';
  /** Discord bot token */
  token: string;
  /** Channel ID */
  channelId: string;
  /** Optional guild/server ID */
  guildId?: string;
}

export interface EmailChannelConfig {
  type: 'email';
  /** Email address to monitor */
  address: string;
  /** IMAP settings for receiving */
  imap: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls?: boolean;
  };
  /** SMTP settings for sending */
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls?: boolean;
  };
}

export interface TelegramChannelConfig {
  type: 'telegram';
  /** Telegram bot token */
  token: string;
  /** Optional: specific chat ID to listen to */
  chatId?: string | number;
}

export interface WebhookChannelConfig {
  type: 'webhook';
  /** Webhook URL to POST messages to */
  url: string;
  /** Optional auth headers */
  headers?: Record<string, string>;
  /** Incoming webhook endpoint (if bidirectional) */
  listenPath?: string;
  /** Secret for webhook signature verification */
  secret?: string;
}

/**
 * Channel adapter interface.
 * Implementations connect to specific platforms and return Channel instances.
 */
export interface ChannelAdapter {
  /** Channel type this adapter handles */
  readonly type: ChannelType;
  
  /** Connect and return a Channel instance */
  connect(config: ChannelConfig): Promise<Channel>;
  
  /** Validate config before connecting */
  validateConfig(config: ChannelConfig): Promise<boolean>;
}

/**
 * Channel adapter factory.
 */
export interface ChannelAdapterFactory {
  /** Register an adapter */
  register(adapter: ChannelAdapter): void;
  
  /** Get adapter for a channel type */
  getAdapter(type: ChannelType): ChannelAdapter | undefined;
  
  /** Create and connect a channel */
  createChannel(config: ChannelConfig): Promise<Channel>;
}

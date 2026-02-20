/**
 * Base Channel Adapter
 * 
 * Provides common functionality for all channel adapters.
 * Platform-specific adapters extend this class.
 */

import type { Channel, ChannelAdapter, ChannelConfig, ChannelType, IncomingMessage, Message, MessageHandler } from './types.js';

/**
 * Base implementation of Channel interface.
 * Subclasses override platform-specific methods.
 */
export abstract class BaseChannel implements Channel {
  protected messageHandlers: MessageHandler[] = [];
  protected connected = false;

  constructor(public readonly identifier: { type: ChannelType; id: string; name?: string }) {}

  abstract send(message: Message): Promise<void>;
  
  abstract disconnect(): Promise<void>;

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Call this from subclasses when a message is received.
   */
  protected async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }
  }

  /**
   * Mark channel as connected.
   */
  protected setConnected(connected: boolean): void {
    this.connected = connected;
  }
}

/**
 * Base implementation of ChannelAdapter interface.
 */
export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract readonly type: ChannelType;
  
  abstract connect(config: ChannelConfig): Promise<Channel>;

  async validateConfig(config: ChannelConfig): Promise<boolean> {
    // Basic validation - check that config matches expected type
    if (config.type !== this.type) {
      return false;
    }
    
    // Subclasses can override for more specific validation
    return this.validateTypeSpecificConfig(config);
  }

  /**
   * Override this in subclasses for type-specific validation.
   */
  protected abstract validateTypeSpecificConfig(config: ChannelConfig): Promise<boolean>;
}

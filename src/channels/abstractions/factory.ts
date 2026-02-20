/**
 * Channel Adapter Factory
 * 
 * Registry for channel adapters. Automatically discovers and registers
 * available adapters at runtime.
 */

import type { ChannelAdapter, ChannelAdapterFactory, ChannelConfig, Channel, ChannelType } from './types.js';

class ChannelAdapterFactoryImpl implements ChannelAdapterFactory {
  private adapters = new Map<ChannelType, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  getAdapter(type: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(type);
  }

  async createChannel(config: ChannelConfig): Promise<Channel> {
    const adapter = this.getAdapter(config.type);
    
    if (!adapter) {
      throw new Error(`No adapter registered for channel type: ${config.type}`);
    }

    // Validate config before attempting connection
    const isValid = await adapter.validateConfig(config);
    if (!isValid) {
      throw new Error(`Invalid configuration for channel type: ${config.type}`);
    }

    return adapter.connect(config);
  }

  /** Get all registered adapter types */
  getAvailableTypes(): ChannelType[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Global channel adapter factory singleton.
 */
export const channelAdapterFactory = new ChannelAdapterFactoryImpl();

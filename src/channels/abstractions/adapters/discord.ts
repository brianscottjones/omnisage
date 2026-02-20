/**
 * Discord Channel Adapter
 * 
 * Connects to Discord via Discord.js.
 * TODO: Full implementation - this is a stub for config wiring.
 */

import { BaseChannel, BaseChannelAdapter } from '../base-adapter.js';
import type { ChannelConfig, DiscordChannelConfig, Message, Channel } from '../types.js';

class DiscordChannel extends BaseChannel {
  private config: DiscordChannelConfig;

  constructor(config: DiscordChannelConfig, channelId: string, name?: string) {
    super({ type: 'discord', id: channelId, name });
    this.config = config;
  }

  async send(message: Message): Promise<void> {
    // TODO: Implement Discord API message sending
    // Use discord.js package
    console.log(`[Discord] Sending to ${this.identifier.id}:`, message.text);
    
    // Stub implementation - would call:
    // const channel = await discordClient.channels.fetch(this.config.channelId);
    // if (channel.isTextBased()) {
    //   await channel.send({
    //     content: message.text,
    //     reply: message.replyTo ? { messageReference: message.replyTo } : undefined,
    //   });
    // }
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
    console.log(`[Discord] Disconnected from ${this.identifier.id}`);
  }
}

export class DiscordAdapter extends BaseChannelAdapter {
  readonly type = 'discord' as const;

  async connect(config: ChannelConfig): Promise<Channel> {
    const discordConfig = config.config as DiscordChannelConfig;
    
    // TODO: Initialize Discord client
    // const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    // await discordClient.login(discordConfig.token);
    
    const channel = new DiscordChannel(
      discordConfig,
      discordConfig.channelId,
      config.name
    );

    // Mark as connected
    (channel as any).setConnected(true);
    
    console.log(`[Discord] Connected to channel ${discordConfig.channelId}`);
    
    return channel;
  }

  protected async validateTypeSpecificConfig(config: ChannelConfig): Promise<boolean> {
    const discordConfig = config.config as DiscordChannelConfig;
    
    if (!discordConfig.token || !discordConfig.channelId) {
      return false;
    }
    
    // TODO: Validate token format
    // TODO: Validate channel ID is numeric string (snowflake)
    // TODO: Optionally test auth with Discord API
    
    return true;
  }
}

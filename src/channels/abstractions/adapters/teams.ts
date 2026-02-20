/**
 * Microsoft Teams Channel Adapter
 * 
 * Connects to Teams via Bot Framework.
 * TODO: Full implementation - this is a stub for config wiring.
 */

import { BaseChannel, BaseChannelAdapter } from '../base-adapter.js';
import type { ChannelConfig, TeamsChannelConfig, Message, Channel } from '../types.js';

class TeamsChannel extends BaseChannel {
  private config: TeamsChannelConfig;

  constructor(config: TeamsChannelConfig, channelId: string, name?: string) {
    super({ type: 'teams', id: channelId, name });
    this.config = config;
  }

  async send(message: Message): Promise<void> {
    // TODO: Implement Teams Bot Framework message sending
    // Use botbuilder package
    console.log(`[Teams] Sending to ${this.identifier.id}:`, message.text);
    
    // Stub implementation - would call:
    // await turnContext.sendActivity({
    //   type: 'message',
    //   text: message.text,
    //   channelId: this.config.channelId,
    // });
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
    console.log(`[Teams] Disconnected from ${this.identifier.id}`);
  }
}

export class TeamsAdapter extends BaseChannelAdapter {
  readonly type = 'teams' as const;

  async connect(config: ChannelConfig): Promise<Channel> {
    const teamsConfig = config.config as TeamsChannelConfig;
    
    // TODO: Initialize Bot Framework adapter
    // const adapter = new BotFrameworkAdapter({
    //   appId: teamsConfig.appId,
    //   appPassword: teamsConfig.appPassword,
    // });
    
    const channel = new TeamsChannel(
      teamsConfig,
      teamsConfig.channelId,
      config.name
    );

    // Mark as connected
    (channel as any).setConnected(true);
    
    console.log(`[Teams] Connected to channel ${teamsConfig.channelId}`);
    
    return channel;
  }

  protected async validateTypeSpecificConfig(config: ChannelConfig): Promise<boolean> {
    const teamsConfig = config.config as TeamsChannelConfig;
    
    if (!teamsConfig.appId || !teamsConfig.appPassword || !teamsConfig.channelId) {
      return false;
    }
    
    // TODO: Validate GUID format for appId
    // TODO: Optionally test auth with Bot Framework
    
    return true;
  }
}

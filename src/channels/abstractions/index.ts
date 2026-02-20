/**
 * OmniSage Channel Abstraction Layer
 * 
 * Entry point for channel adapters and factory.
 */

export * from './types.js';
export * from './factory.js';
export * from './base-adapter.js';

// Import and register all adapters
import { channelAdapterFactory } from './factory.js';
import { SlackAdapter } from './adapters/slack.js';
import { TeamsAdapter } from './adapters/teams.js';
import { DiscordAdapter } from './adapters/discord.js';
import { EmailAdapter } from './adapters/email.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { WebhookAdapter } from './adapters/webhook.js';

// Auto-register all adapters
channelAdapterFactory.register(new SlackAdapter());
channelAdapterFactory.register(new TeamsAdapter());
channelAdapterFactory.register(new DiscordAdapter());
channelAdapterFactory.register(new EmailAdapter());
channelAdapterFactory.register(new TelegramAdapter());
channelAdapterFactory.register(new WebhookAdapter());

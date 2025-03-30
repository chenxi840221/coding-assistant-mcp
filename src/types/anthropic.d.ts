// src/types/anthropic.d.ts
import { Anthropic } from '@anthropic-ai/sdk';

// Extend the existing MessageCreateParams interface
declare module '@anthropic-ai/sdk/resources/messages.mjs' {
  interface MessageCreateParams {
    // Add optional system parameter
    system?: string;

    // You can add more extensions if needed
    context?: Record<string, unknown>;
  }
}

declare module '@anthropic-ai/sdk' {
  export class Anthropic {
    constructor(options: { apiKey: string });

    messages: {
      create(params: {
        model: string;
        max_tokens: number;
        messages: Array<{
          role: 'user' | 'assistant' | 'system';
          content: string | any[];
        }>;
        tools?: any[];
      }): Promise<{
        id: string;
        type: string;
        role: string;
        content: Array<{
          type: string;
          text?: string;
          [key: string]: any;
        }>;
        model: string;
        stop_reason: string | null;
        stop_sequence: string | null;
        usage: {
          input_tokens: number;
          output_tokens: number;
        };
      }>;
    };
  }
}
// src/types/anthropic.d.ts
import { Anthropic } from '@anthropic-ai/sdk';

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
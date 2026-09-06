import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env';

let esClient: Client | null = null;
const INDEX_NAME = 'emails';

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({ node: config.ELASTICSEARCH_URL });
  }
  return esClient;
}

export async function initElasticsearch(): Promise<void> {
  try {
    const client = getElasticsearchClient();
    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              senderId: { type: 'keyword' },
              recipient: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index '${INDEX_NAME}' created successfully`);
    } else {
      console.log(`[Elasticsearch] Index '${INDEX_NAME}' already exists`);
    }
  } catch (error) {
    console.warn('[Elasticsearch] Could not initialize index (ES might be starting):', (error as Error).message);
  }
}

export interface EmailDocument {
  id: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

export async function indexEmail(email: EmailDocument): Promise<void> {
  try {
    const client = getElasticsearchClient();
    await client.index({
      index: INDEX_NAME,
      id: email.id,
      document: email,
      refresh: 'wait_for',
    });
    console.log(`[Elasticsearch] Indexed email ${email.id}`);
  } catch (error) {
    console.warn(`[Elasticsearch] Failed to index email ${email.id}:`, (error as Error).message);
  }
}

export async function searchEmailsInES(query: string, senderId?: string): Promise<any[]> {
  try {
    const client = getElasticsearchClient();
    const mustQueries: any[] = [];

    if (query && query.trim().length > 0) {
      mustQueries.push({
        multi_match: {
          query,
          fields: ['subject^3', 'body^1', 'recipient^2'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (senderId) {
      mustQueries.push({ term: { senderId } });
    }

    const response = await client.search({
      index: INDEX_NAME,
      body: {
        query: mustQueries.length > 0 ? { bool: { must: mustQueries } } : { match_all: {} },
        sort: [{ scheduledAt: { order: 'desc' } }],
        size: 50,
      },
    });

    return response.hits.hits.map((hit) => hit._source);
  } catch (error) {
    console.warn('[Elasticsearch] Search query failed, caller will use fallback:', (error as Error).message);
    throw error;
  }
}

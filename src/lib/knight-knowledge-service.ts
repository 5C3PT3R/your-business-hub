/**
 * Knight Knowledge Base Service
 * Manages the RAG knowledge base for The Knight
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface KnowledgeEntry {
  id: string;
  workspace_id: string;
  content: string;
  category: 'pricing' | 'technical' | 'policy' | 'faq' | 'product' | 'troubleshooting';
  title?: string;
  source_url?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeSearchResult {
  id: string;
  content: string;
  category: string;
  title?: string;
  similarity: number;
}

export interface CreateKnowledgeParams {
  workspaceId: string;
  content: string;
  category: KnowledgeEntry['category'];
  title?: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Add a new knowledge entry
 */
export async function addKnowledgeEntry(params: CreateKnowledgeParams): Promise<KnowledgeEntry | null> {
  try {
    // First, get embedding for the content
    const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('knight-analyze', {
      body: {
        action: 'get_embedding',
        text: params.content,
      },
    });

    if (embeddingError) {
      console.error('[Knight] Embedding generation error:', embeddingError);
      return null;
    }

    // Insert the knowledge entry with embedding
    const { data, error } = await (supabase as any)
      .from('knowledge_base')
      .insert({
        workspace_id: params.workspaceId,
        content: params.content,
        category: params.category,
        title: params.title,
        source_url: params.sourceUrl,
        embedding: embeddingData?.embedding,
        metadata: params.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      console.error('[Knight] Insert knowledge error:', error);
      return null;
    }

    return data as KnowledgeEntry;
  } catch (err) {
    console.error('[Knight] Unexpected add knowledge error:', err);
    return null;
  }
}

/**
 * Update a knowledge entry
 */
export async function updateKnowledgeEntry(
  id: string,
  updates: Partial<CreateKnowledgeParams>
): Promise<KnowledgeEntry | null> {
  try {
    let embedding = undefined;

    // Re-generate embedding if content changed
    if (updates.content) {
      const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('knight-analyze', {
        body: {
          action: 'get_embedding',
          text: updates.content,
        },
      });

      if (!embeddingError && embeddingData?.embedding) {
        embedding = embeddingData.embedding;
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.content) updateData.content = updates.content;
    if (updates.category) updateData.category = updates.category;
    if (updates.title) updateData.title = updates.title;
    if (updates.sourceUrl) updateData.source_url = updates.sourceUrl;
    if (updates.metadata) updateData.metadata = updates.metadata;
    if (embedding) updateData.embedding = embedding;

    const { data, error } = await (supabase as any)
      .from('knowledge_base')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Knight] Update knowledge error:', error);
      return null;
    }

    return data as KnowledgeEntry;
  } catch (err) {
    console.error('[Knight] Unexpected update knowledge error:', err);
    return null;
  }
}

/**
 * Delete a knowledge entry
 */
export async function deleteKnowledgeEntry(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Knight] Delete knowledge error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Knight] Unexpected delete knowledge error:', err);
    return false;
  }
}

/**
 * Get all knowledge entries for a workspace
 */
export async function getKnowledgeEntries(
  workspaceId: string,
  filters?: {
    category?: KnowledgeEntry['category'];
    limit?: number;
    offset?: number;
  }
): Promise<KnowledgeEntry[]> {
  try {
    let query = (supabase as any)
      .from('knowledge_base')
      .select('id, workspace_id, content, category, title, source_url, created_at, updated_at, metadata')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Knight] Get knowledge entries error:', error);
      return [];
    }

    return (data || []) as KnowledgeEntry[];
  } catch (err) {
    console.error('[Knight] Unexpected get entries error:', err);
    return [];
  }
}

/**
 * Search knowledge base with semantic search
 */
export async function searchKnowledge(
  workspaceId: string,
  query: string,
  options?: {
    threshold?: number;
    limit?: number;
    category?: KnowledgeEntry['category'];
  }
): Promise<KnowledgeSearchResult[]> {
  try {
    // Get embedding for the query
    const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('knight-analyze', {
      body: {
        action: 'get_embedding',
        text: query,
      },
    });

    if (embeddingError || !embeddingData?.embedding) {
      console.error('[Knight] Search embedding error:', embeddingError);
      return [];
    }

    // Search with the embedding
    const { data, error } = await supabase.rpc('search_knowledge_base', {
      p_workspace_id: workspaceId,
      p_query_embedding: embeddingData.embedding,
      p_match_threshold: options?.threshold ?? 0.7,
      p_match_count: options?.limit ?? 5,
    });

    if (error) {
      console.error('[Knight] Knowledge search error:', error);
      return [];
    }

    let results = (data || []) as KnowledgeSearchResult[];

    // Filter by category if specified
    if (options?.category) {
      results = results.filter((r) => r.category === options.category);
    }

    return results;
  } catch (err) {
    console.error('[Knight] Unexpected search error:', err);
    return [];
  }
}

/**
 * Bulk import knowledge entries
 */
export async function bulkImportKnowledge(
  workspaceId: string,
  entries: Array<{
    content: string;
    category: KnowledgeEntry['category'];
    title?: string;
    sourceUrl?: string;
  }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    const result = await addKnowledgeEntry({
      workspaceId,
      content: entry.content,
      category: entry.category,
      title: entry.title,
      sourceUrl: entry.sourceUrl,
    });

    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get knowledge base stats
 */
export async function getKnowledgeStats(workspaceId: string): Promise<{
  total: number;
  byCategory: Record<string, number>;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from('knowledge_base')
      .select('category')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[Knight] Get knowledge stats error:', error);
      return { total: 0, byCategory: {} };
    }

    const entries = data || [];
    const byCategory: Record<string, number> = {};

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    }

    return {
      total: entries.length,
      byCategory,
    };
  } catch (err) {
    console.error('[Knight] Unexpected stats error:', err);
    return { total: 0, byCategory: {} };
  }
}

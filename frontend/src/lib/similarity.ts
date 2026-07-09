/**
 * Calculates TF-IDF based cosine similarity between a query (hook tags) and multiple documents (clip tags).
 *
 * @param queryTags The tags from the hook.
 * @param docsTags An array of tag arrays, each representing a clip's tags.
 * @returns An array of scores corresponding to each document in docsTags.
 */
export function calculateTfIdfCosineSimilarity(queryTags: string[], docsTags: string[][]): number[] {
  // Tokenize and normalize
  const normalize = (tags: string[]) =>
    tags.flatMap((tag) => tag.toLowerCase().split(/[\s_-]+/)).filter(Boolean);

  const queryTokens = normalize(queryTags);
  const docsTokens = docsTags.map(normalize);

  if (queryTokens.length === 0) return docsTokens.map(() => 0);

  // Build vocabulary and calculate document frequencies
  const df: Record<string, number> = {};
  const allDocs = [queryTokens, ...docsTokens];

  const uniqueTokensPerDoc = allDocs.map((tokens) => Array.from(new Set(tokens)));

  for (const uniqueTokens of uniqueTokensPerDoc) {
    for (const token of uniqueTokens) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  const numDocs = allDocs.length;

  // Calculate IDF
  const idf: Record<string, number> = {};
  for (const token in df) {
    // Basic IDF formula: log(N / (1 + df))
    idf[token] = Math.log(numDocs / (1 + df[token])) + 1;
  }

  // Calculate TF-IDF vectors
  const getTfIdfVector = (tokens: string[]) => {
    const tf: Record<string, number> = {};
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    const vector: Record<string, number> = {};
    for (const token in tf) {
      vector[token] = (tf[token] / tokens.length) * (idf[token] || 0);
    }
    return vector;
  };

  const queryVector = getTfIdfVector(queryTokens);

  // Compute Cosine Similarity
  const computeSimilarity = (vecA: Record<string, number>, vecB: Record<string, number>) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    for (const key of allKeys) {
      const a = vecA[key] || 0;
      const b = vecB[key] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  return docsTokens.map((docTokens) => computeSimilarity(queryVector, getTfIdfVector(docTokens)));
}

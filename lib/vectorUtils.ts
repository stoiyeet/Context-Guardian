// PHASE 2: LLM INTEGRATION POINT
// Vector retrieval currently runs in-process with cosine similarity.
// PHASE 3 SWAP POINT: replace searchVectorIndex() with pgvector/Pinecone query calls.

export interface VectorRecord<T> {
  id: string;
  vector: number[];
  payload: T;
}

export interface VectorSearchResult<T> {
  id: string;
  score: number;
  payload: T;
}

function dot(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function magnitude(vector: number[]): number {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const aMag = magnitude(a);
  const bMag = magnitude(b);
  if (aMag === 0 || bMag === 0) {
    return 0;
  }
  return dot(a, b) / (aMag * bMag);
}

export function normalizeVector(vector: number[]): number[] {
  const mag = magnitude(vector);
  if (mag === 0) {
    return vector;
  }
  return vector.map((value) => value / mag);
}

export function searchVectorIndex<T>(
  queryVector: number[],
  records: VectorRecord<T>[],
  options?: {
    topK?: number;
    threshold?: number;
  },
): VectorSearchResult<T>[] {
  const topK = options?.topK ?? 8;
  const threshold = options?.threshold ?? 0.2;

  const scored = records
    .map<VectorSearchResult<T>>((record) => ({
      id: record.id,
      score: cosineSimilarity(queryVector, record.vector),
      payload: record.payload,
    }))
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

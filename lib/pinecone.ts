import { Pinecone, Index, RecordMetadata } from "@pinecone-database/pinecone";

type GlobalPinecone = typeof globalThis & { __pinecone?: Pinecone };

export type ProfileVectorMetadata = RecordMetadata & {
  profile_id: string;
  vector_type: "intro" | "work" | "hobby";
};

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX;
export const pineconeNamespace = process.env.PINECONE_NAMESPACE || "";

const globalForPinecone = globalThis as GlobalPinecone;

function getPineconeClient(): Pinecone {
  if (globalForPinecone.__pinecone) {
    return globalForPinecone.__pinecone;
  }
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  const client = new Pinecone({ apiKey });
  if (process.env.NODE_ENV !== "production") {
    globalForPinecone.__pinecone = client;
  }
  return client;
}

/**
 * Pinecone 인덱스 핸들을 반환합니다.
 * 서버리스/팟 타입 모두 동일하게 사용할 수 있습니다.
 */
export function getPineconeIndex(): Index<ProfileVectorMetadata> {
  const client = getPineconeClient();
  if (!indexName) {
    throw new Error("PINECONE_INDEX 환경 변수가 설정되지 않았습니다.");
  }
  const baseIndex = client.index<ProfileVectorMetadata>(indexName);
  return pineconeNamespace ? baseIndex.namespace(pineconeNamespace) : baseIndex;
}

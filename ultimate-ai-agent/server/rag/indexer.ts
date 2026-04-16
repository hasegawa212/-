import { db } from "../db";
import { ragDocuments } from "../schema";

export async function indexDocument(
  title: string,
  content: string,
  source?: string
) {
  const [doc] = await db
    .insert(ragDocuments)
    .values({
      title,
      content,
      source: source || null,
    })
    .returning();
  return doc;
}

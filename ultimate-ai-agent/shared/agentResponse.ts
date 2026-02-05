import { z } from "zod";

// Structured content blocks for rich agent responses
export const TextBlockSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
});

export const CodeBlockSchema = z.object({
  type: z.literal("code"),
  language: z.string(),
  content: z.string(),
});

export const ListBlockSchema = z.object({
  type: z.literal("list"),
  items: z.array(z.string()),
  ordered: z.boolean().default(false),
});

export const TableBlockSchema = z.object({
  type: z.literal("table"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  url: z.string(),
  alt: z.string().optional(),
});

export const MapBlockSchema = z.object({
  type: z.literal("map"),
  latitude: z.number(),
  longitude: z.number(),
  zoom: z.number().default(13),
  markers: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number(),
        label: z.string().optional(),
      })
    )
    .default([]),
});

export const ContentBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  CodeBlockSchema,
  ListBlockSchema,
  TableBlockSchema,
  ImageBlockSchema,
  MapBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

// Full agent response with structured blocks
export const AgentResponseSchema = z.object({
  blocks: z.array(ContentBlockSchema),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.record(z.unknown()),
        result: z.unknown().optional(),
      })
    )
    .default([]),
  thinking: z.string().optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

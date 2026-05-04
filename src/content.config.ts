import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const interview = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/interview' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    updatedDate: z.coerce.date().optional(),
    order: z.number().optional(),
    draft: z.boolean().default(false)
  })
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    group: z.string().optional(),
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false)
  })
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['项目复盘', '阅读笔记']),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    difficulty: z.enum(['入门', '进阶', '高频', '硬核']).optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false)
  })
});

export const collections = { interview, notes, posts };

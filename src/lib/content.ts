import type { CollectionEntry } from 'astro:content';

export type InterviewTopic = CollectionEntry<'interview'>;
export type Note = CollectionEntry<'notes'>;
export type Post = CollectionEntry<'posts'>;

export type EntryLike = {
  id: string;
  body?: string;
  data: {
    title?: string;
    description?: string;
    pubDate?: Date;
    updatedDate?: Date;
    category?: string;
    tags?: string[];
    featured?: boolean;
    draft?: boolean;
    order?: number;
  };
};

export function isPublished(entry: EntryLike) {
  return !entry.data.draft;
}

export function sortPosts(posts: Post[]) {
  return [...posts].sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
}

export function sortEntriesByDate<T extends EntryLike>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const aTime = (a.data.pubDate ?? a.data.updatedDate ?? new Date(0)).getTime();
    const bTime = (b.data.pubDate ?? b.data.updatedDate ?? new Date(0)).getTime();
    return bTime - aTime;
  });
}

export function sortInterviewTopics(topics: InterviewTopic[]) {
  return [...topics].sort((a, b) => {
    const orderA = a.data.order ?? 999;
    const orderB = b.data.order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return getTopicTitle(a).localeCompare(getTopicTitle(b), 'zh-CN');
  });
}

export function getPostUrl(post: Post) {
  return `/blog/${post.id}/`;
}

export function getTopicUrl(topic: InterviewTopic) {
  return `/interview/${encodeURIComponent(topic.id)}/`;
}

export function getTopicFullUrl(topic: InterviewTopic) {
  return `/interview/${encodeURIComponent(topic.id)}/full/`;
}

export function getNoteUrl(note: Note) {
  const parts = note.id.split('/');
  const slug = parts.pop()!;
  const group = parts.join('/') || slug;
  return `/notes/${encodeURIComponent(group)}/${encodeURIComponent(slug)}/`;
}

export function getEntryUrl(entry: EntryLike & { collection?: string }) {
  if (entry.collection === 'interview') {
    return `/interview/${encodeURIComponent(entry.id)}/full/`;
  }

  if (entry.collection === 'notes') {
    return getNoteUrl(entry as Note);
  }

  return getPostUrl(entry as Post);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getReadingMinutes(entry: EntryLike) {
  const body = entry.body ?? '';
  const latinWords = body.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const cjkChars = body.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  const weightedWords = latinWords + cjkChars / 2;

  return Math.max(1, Math.ceil(weightedWords / 220));
}

export function getAllTags(entries: EntryLike[]) {
  return Array.from(new Set(entries.flatMap((entry) => entry.data.tags ?? []))).sort(
    (a, b) => a.localeCompare(b, 'zh-CN')
  );
}

export function tagUrl(tag: string) {
  return `/tags/${encodeURIComponent(tag)}/`;
}

export function groupPostsByYear(posts: Post[]) {
  return sortPosts(posts).reduce<Record<string, Post[]>>((groups, post) => {
    const year = String(post.data.pubDate.getFullYear());
    groups[year] = groups[year] ?? [];
    groups[year].push(post);
    return groups;
  }, {});
}

export function getCategoryCount(entries: EntryLike[]) {
  return entries.reduce<Record<string, number>>((counts, entry) => {
    const category = entry.data.category ?? '未分类';
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
}

const KNOWN_ACRONYMS = [
  'JVM', 'JDK', 'JRE', 'GC',
  'MySQL', 'SQL', 'NoSQL', 'ACID',
  'MQ', 'RPC', 'REST', 'API', 'SPI', 'SDK',
  'AI', 'CAP', 'BASE', 'HTTP', 'HTTPS', 'TCP', 'UDP', 'DNS', 'IP', 'IO', 'NIO',
  'CPU', 'OS', 'RAM', 'SSD',
  'AOP', 'IOC', 'AQS', 'CAS',
  'AWS', 'GCP', 'CICD', 'CI', 'CD',
  'CSS', 'HTML', 'DOM', 'JSON', 'XML', 'YAML',
  'JWT', 'OAuth', 'CSRF', 'XSS',
];

function restoreAcronyms(text: string): string {
  let result = text;
  for (const acronym of KNOWN_ACRONYMS) {
    const lower = acronym.toLowerCase();
    const regex = new RegExp(`(?<![a-z])${lower}(?![a-z])`, 'gi');
    result = result.replace(regex, acronym);
  }
  // Title-case each word (capitalize first letter, preserve rest)
  result = result.replace(/\b\w/g, (c) => c.toUpperCase());
  // Re-run acronym restore to fix any double-capitalization like "Jvm" -> "JVM"
  for (const acronym of KNOWN_ACRONYMS) {
    const titleCased = acronym.charAt(0) + acronym.slice(1).toLowerCase();
    const regex = new RegExp(`(?<![a-z])${titleCased}(?![a-z])`, 'g');
    result = result.replace(regex, acronym);
  }
  return result;
}

export function titleFromId(id: string) {
  const filename = id.split('/').at(-1) ?? id;
  const raw = decodeURIComponent(filename)
    .replace(/\.(md|mdx)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return restoreAcronyms(raw);
}

export function getTopicTitle(topic: InterviewTopic) {
  return topic.data.title ?? titleFromId(topic.id);
}

export function getTopicDescription(topic: InterviewTopic) {
  return topic.data.description ?? `${getTopicTitle(topic)} 专题下的所有面试题。`;
}

export function getNoteGroup(note: Note) {
  return note.data.group ?? formatFolderName(getNoteGroupSlug(note));
}

export function getNoteGroupSlug(note: Note) {
  return note.id.split('/')[0] ?? 'ungrouped';
}

export function formatFolderName(folder: string) {
  const normalized = folder.toLowerCase();
  const knownNames: Record<string, string> = {
    aqs: 'AQS',
    css: 'CSS',
    html: 'HTML',
    http: 'HTTP',
    java: 'Java',
    javascript: 'JavaScript',
    js: 'JavaScript',
    jvm: 'JVM',
    mq: 'MQ',
    mysql: 'MySQL',
    redis: 'Redis',
    spring: 'Spring',
    sql: 'SQL',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    vue: 'Vue'
  };

  if (knownNames[normalized]) return knownNames[normalized];
  if (/[\u4e00-\u9fa5]/.test(folder)) return folder;

  return folder
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getNoteTitle(note: Note) {
  return note.data.title ?? titleFromId(note.id);
}

export function getNoteDescription(note: Note) {
  return note.data.description ?? `${getNoteTitle(note)} 的学习笔记。`;
}

export function groupNotesByFolder(notes: Note[]) {
  return sortEntriesByDate(notes).reduce<Record<string, Note[]>>((groups, note) => {
    const group = getNoteGroupSlug(note);
    groups[group] = groups[group] ?? [];
    groups[group].push(note);
    return groups;
  }, {});
}

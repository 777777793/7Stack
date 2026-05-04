import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import {
  getEntryUrl,
  isPublished,
  sortEntriesByDate,
  titleFromId,
  withBase
} from '../lib/content';

export async function GET(context) {
  const posts = await getCollection('posts', isPublished);
  const notes = await getCollection('notes', isPublished);
  const entries = sortEntriesByDate([...posts, ...notes]);

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: new URL(withBase('/'), context.site),
    items: entries.map((entry) => ({
      title: entry.data.title ?? titleFromId(entry.id),
      description: entry.data.description ?? '',
      pubDate: entry.data.pubDate ?? entry.data.updatedDate ?? new Date(),
      link: getEntryUrl(entry)
    })),
    customData: '<language>zh-CN</language>'
  });
}

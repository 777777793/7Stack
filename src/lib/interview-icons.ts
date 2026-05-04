const topicIcon = (paths: string) =>
  `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

const topicIcons: Array<[string, string]> = [
  [
    'Java并发',
    topicIcon(
      '<path d="M4 7h5.5c1.4 0 2.5 1.1 2.5 2.5V12" />' +
        '<path d="M4 17h5.5c1.4 0 2.5-1.1 2.5-2.5V12" />' +
        '<path d="M12 12h8" />' +
        '<path d="M17 9l3 3-3 3" />' +
        '<path d="M6 5v4" />' +
        '<path d="M6 15v4" />'
    )
  ],
  [
    'Java基础',
    topicIcon(
      '<path d="M7 10h9.5a2.5 2.5 0 0 1 0 5H16" />' +
        '<path d="M5 10h11v5.5A3.5 3.5 0 0 1 12.5 19h-4A3.5 3.5 0 0 1 5 15.5V10Z" />' +
        '<path d="M8 6.5c1-1 .1-1.9 1.1-2.9" />' +
        '<path d="M12 6.5c1-1 .1-1.9 1.1-2.9" />' +
        '<path d="M5 21h13" />'
    )
  ],
  [
    'JVM',
    topicIcon(
      '<rect x="6" y="5" width="12" height="14" rx="2" />' +
        '<path d="M9 9h6" />' +
        '<path d="M9 12h6" />' +
        '<path d="M9 15h3" />' +
        '<path d="M3.5 8h2.5" />' +
        '<path d="M3.5 12h2.5" />' +
        '<path d="M3.5 16h2.5" />' +
        '<path d="M18 8h2.5" />' +
        '<path d="M18 12h2.5" />' +
        '<path d="M18 16h2.5" />'
    )
  ],
  [
    'MySQL',
    topicIcon(
      '<ellipse cx="12" cy="6" rx="7" ry="3.2" />' +
        '<path d="M5 6v6c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V6" />' +
        '<path d="M5 12v5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2v-5" />' +
        '<path d="M9 10.7c.9.3 1.9.5 3 .5s2.1-.2 3-.5" />'
    )
  ],
  [
    'Redis',
    topicIcon(
      '<path d="M12 3.5 20 7l-8 3.5L4 7l8-3.5Z" />' +
        '<path d="m4 11 8 3.5 8-3.5" />' +
        '<path d="m4 15 8 3.5 8-3.5" />' +
        '<path d="M4 7v3.8" />' +
        '<path d="M20 7v3.8" />'
    )
  ],
  [
    'Spring',
    topicIcon(
      '<path d="M19.5 4.5c-6.8.3-11.7 3.9-13.1 8.7-.8 2.8.8 5.3 3.4 5.9 4.9 1.1 8.7-3.4 9.7-14.6Z" />' +
        '<path d="M5 20c2.3-5.1 6-8.2 11.2-9.3" />' +
        '<path d="M8.6 14.7c1.6.5 3 .4 4.2-.2" />'
    )
  ],
  [
    '分布式',
    topicIcon(
      '<rect x="4" y="4" width="6" height="5" rx="1.4" />' +
        '<rect x="14" y="4" width="6" height="5" rx="1.4" />' +
        '<rect x="9" y="15" width="6" height="5" rx="1.4" />' +
        '<path d="M10 6.5h4" />' +
        '<path d="m8.7 9 2.6 6" />' +
        '<path d="m15.3 9-2.6 6" />'
    )
  ],
  [
    '消息队列',
    topicIcon(
      '<path d="M4 7h8" />' +
        '<path d="M4 12h12" />' +
        '<path d="M4 17h8" />' +
        '<circle cx="17" cy="7" r="2" />' +
        '<circle cx="20" cy="12" r="2" />' +
        '<circle cx="17" cy="17" r="2" />'
    )
  ],
  [
    '网络操作系统',
    topicIcon(
      '<rect x="4" y="4" width="16" height="11" rx="2" />' +
        '<path d="M8 19h8" />' +
        '<path d="M12 15v4" />' +
        '<path d="M8 9h8" />' +
        '<path d="M8 12h5" />' +
        '<path d="M17 9.5h.01" />'
    )
  ],
  [
    'Agent',
    topicIcon(
      '<rect x="6" y="7" width="12" height="10" rx="3" />' +
        '<path d="M9 11h.01" />' +
        '<path d="M15 11h.01" />' +
        '<path d="M10 15h4" />' +
        '<path d="M12 4v3" />' +
        '<path d="m9 4 3 3 3-3" />' +
        '<path d="M4 12H2.5" />' +
        '<path d="M21.5 12H20" />'
    )
  ],
  [
    '场景设计',
    topicIcon(
      '<path d="M5 18.5V9l7-4 7 4v9.5" />' +
        '<path d="M8 18.5v-6h8v6" />' +
        '<path d="M8 12.5 5 11" />' +
        '<path d="m16 12.5 3-1.5" />' +
        '<path d="M12 5v7.5" />' +
        '<path d="M4 20h16" />'
    )
  ],
  [
    '实操排查',
    topicIcon(
      '<path d="M14.5 14.5 20 20" />' +
        '<circle cx="10.5" cy="10.5" r="5.5" />' +
        '<path d="M8.5 9a2.5 2.5 0 0 1 4 2.8c-.7 1-2 1.1-2 2.2" />' +
        '<path d="M10.5 16.5h.01" />'
    )
  ],
  [
    'Java',
    topicIcon(
      '<path d="M17 18H7a4 4 0 0 1-4-4v-3h13v3a4 4 0 0 1-4 4" />' +
        '<path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />' +
        '<path d="M8 7c1-1 .2-2 1.2-3" />' +
        '<path d="M12 7c1-1 .2-2 1.2-3" />'
    )
  ]
];

export function getInterviewTopicIcon(topicId: string): string | undefined {
  const normalizedTopicId = topicId.toLowerCase();
  return topicIcons.find(([key]) => normalizedTopicId.includes(key.toLowerCase()))?.[1];
}

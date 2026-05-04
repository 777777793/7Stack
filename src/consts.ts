export const SITE = {
  title: '7Stack',
  description: '面试题、随笔与知识库——技术答案与学习轨迹的结构化沉淀。',
  author: '7Stack',
  locale: 'zh-CN'
};

export const NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '随笔', href: '/writing/' },
  { label: '面试题', href: '/interview/' },
  { label: '知识库', href: '/notes/' },
  { label: '标签', href: '/tags/' }
];

export const CATEGORY_META = {
  项目复盘: {
    label: '项目复盘',
    href: '/writing/',
    description: '沉淀项目里的设计取舍、问题排查和上线经验。'
  },
  阅读笔记: {
    label: '阅读笔记',
    href: '/writing/',
    description: '书籍、论文、文档和优秀文章的结构化摘记。'
  }
} as const;

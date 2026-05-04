export const SITE = {
  title: '7Stack',
  description: '技术面试题、工程学习笔记与项目复盘的结构化知识库。',
  author: '7Stack',
  locale: 'zh-CN'
};

export const NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '文章', href: '/blog/' },
  { label: '面试题', href: '/interview/' },
  { label: '学习笔记', href: '/notes/' },
  { label: '标签', href: '/tags/' },
  { label: '归档', href: '/archive/' }
];

export const CATEGORY_META = {
  面试题: {
    label: '面试题',
    href: '/interview/',
    description: '把高频问题整理成核心答案、底层原理、追问链路和项目场景。'
  },
  学习笔记: {
    label: '学习笔记',
    href: '/notes/',
    description: '记录课程、源码阅读、工具实践和阶段性理解。'
  },
  项目复盘: {
    label: '项目复盘',
    href: '/blog/',
    description: '沉淀项目里的设计取舍、问题排查和上线经验。'
  },
  阅读笔记: {
    label: '阅读笔记',
    href: '/blog/',
    description: '书籍、论文、文档和优秀文章的结构化摘记。'
  }
} as const;

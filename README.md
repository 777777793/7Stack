# 7Stack

一个基于 Astro 的个人技术博客骨架，适合写八股文、学习笔记、项目复盘和阅读笔记。

## 本地启动

```bash
npm install
npm run dev
```

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 构建静态站点并生成 Pagefind 搜索索引
npm run preview  # 预览构建产物
```

## 写文章

文章放在 `src/content/posts` 下，支持 Markdown 和 MDX。

```md
---
title: Redis 为什么这么快？
description: 一句话描述这篇文章。
pubDate: 2026-05-05
category: 八股文
tags: [Redis, 缓存]
featured: true
draft: false
---
```

## 自定义站点信息

先改这几个地方：

- `src/consts.ts`：站点标题、描述、作者。
- `astro.config.mjs`：默认 `SITE_URL`。
- `public/og.svg`：社交分享图。
- `src/styles/global.css`：视觉风格。

## 部署到 GitHub Pages

仓库推送到 GitHub 后，在仓库设置里启用 GitHub Pages，并选择 GitHub Actions 作为发布来源。

如果使用自己的域名，建议在仓库 Variables 里添加：

```text
SITE_URL=https://blog.yourdomain.com
BASE_PATH=/
```

然后在 GitHub Pages 的 Custom domain 中填入你的域名，并在 DNS 服务商处配置 CNAME 或 A 记录。

如果暂时不用自定义域名，而是部署到 `https://username.github.io/repo-name/`，把 `BASE_PATH` 设置成：

```text
BASE_PATH=/repo-name/
```

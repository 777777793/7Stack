import { Search, Folder, Braces, Network, Activity, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="flex flex-col items-center w-full gap-xxl">
      {/* Hero Section */}
      <section className="w-full flex flex-col items-center text-center gap-lg pt-xl">
        <div className="flex flex-col items-center gap-xs">
          <h1 className="text-headline-xxl font-semibold text-primary tracking-tight">TechJournal</h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl">
            A curated repository of technical insights, interview preparation, and personal study notes. Designed for clarity and focus.
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full max-w-xl relative mt-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-full py-3 pl-[3rem] pr-4 text-body-md text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          />
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {["Interview", "Notes", "Articles"].map((tag) => (
            <Link
              key={tag}
              to={`/${tag.toLowerCase()}`}
              className="px-6 py-2 bg-surface-container-low text-on-surface rounded-full text-label-md font-medium hover:bg-surface-container-high transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Dashboard */}
      <section className="w-full max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
          {[
            { value: "124", label: "Topics" },
            { value: "16", label: "Categories" },
            { value: "892", label: "Content" },
            { value: "450+", label: "Questions" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-md flex flex-col items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
            >
              <span className="text-headline-lg font-semibold text-primary">{stat.value}</span>
              <span className="text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Interview Prep */}
      <section className="w-full flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-semibold text-primary">Interview Prep</h2>
          <Link to="/interview" className="text-label-md font-medium text-secondary hover:underline">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[
            {
              title: "Data Structures",
              desc: "45 concepts • 120 questions",
              icon: Braces,
              bg: "bg-secondary-fixed text-on-secondary-fixed",
            },
            {
              title: "System Design",
              desc: "12 architectures • 30 cases",
              icon: Network,
              bg: "bg-tertiary-fixed text-on-tertiary-fixed",
            },
            {
              title: "Algorithms",
              desc: "Sorting, searching, graphs",
              icon: Activity,
              bg: "bg-surface-container-high text-on-surface",
            },
            {
              title: "Language Specifics",
              desc: "Go, Python, JavaScript",
              icon: Terminal,
              bg: "bg-primary-fixed text-on-primary-fixed",
            },
          ].map((item) => (
            <Link
              key={item.title}
              to="/interview"
              className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-md hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all flex flex-col gap-4"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-body-md font-semibold text-primary">{item.title}</h3>
                <p className="text-label-sm text-on-surface-variant mt-1">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Study Notes */}
      <section className="w-full flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-semibold text-primary">Study Notes</h2>
          <Link to="/notes" className="text-label-md font-medium text-secondary hover:underline">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-gutter">
          {[
            "React Patterns",
            "Docker Configs",
            "Kubernetes Setup",
            "AWS Certified",
            "GraphQL API",
            "Design Systems",
          ].map((note) => (
            <Link
              key={note}
              to="/notes"
              className="flex flex-col items-center gap-3 group"
            >
              <div className="w-full aspect-square bg-surface-container-low rounded-xl flex items-center justify-center group-hover:bg-surface-container-high transition-colors">
                <Folder className="w-12 h-12 text-secondary stroke-[1.5]" />
              </div>
              <span className="text-label-md font-medium text-on-surface text-center line-clamp-1">{note}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Updates */}
      <section className="w-full flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-semibold text-primary">Recent Updates</h2>
          <Link to="/articles" className="text-label-md font-medium text-secondary hover:underline">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[
            {
              tag: "Architecture",
              tagBg: "bg-secondary-fixed text-on-secondary-fixed",
              title: "Micro-Frontends: A Practical Guide",
              desc: "Exploring the implementation details and trade-offs of micro-frontend architecture in large-scale applications.",
              date: "Oct 24, 2023",
              link: "/article"
            },
            {
              tag: "Performance",
              tagBg: "bg-tertiary-fixed text-on-tertiary-fixed",
              title: "Optimizing Core Web Vitals",
              desc: "Strategies for improving LCP, FID, and CLS scores on modern web applications using advanced caching techniques.",
              date: "Oct 18, 2023",
              link: "/article"
            },
            {
              tag: "Security",
              tagBg: "bg-primary-fixed text-on-primary-fixed",
              title: "Implementing OAuth 2.0 Securely",
              desc: "A deep dive into common pitfalls when implementing OAuth 2.0 flows and how to secure token storage.",
              date: "Oct 12, 2023",
              link: "/article"
            },
          ].map((update) => (
            <Link
              key={update.title}
              to={update.link}
              className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all flex flex-col gap-4 h-full"
            >
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${update.tagBg}`}>
                  {update.tag}
                </span>
              </div>
              <h3 className="text-[20px] leading-tight font-semibold text-primary">
                {update.title}
              </h3>
              <p className="text-[14px] text-on-surface-variant line-clamp-2">
                {update.desc}
              </p>
              <span className="text-[12px] text-outline mt-auto pt-4">
                {update.date}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

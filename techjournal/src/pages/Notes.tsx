import { Folder, ChevronRight, FileText, ArrowLeft, ArrowDownUp } from "lucide-react";
import { Link } from "react-router-dom";

export function Notes() {
  const categories = [
    {
      title: "System Design",
      items: "24 items",
      updated: "Updated 2 hrs ago",
    },
    {
      title: "Data Structures",
      items: "18 items",
      updated: "Updated yesterday",
    },
  ];

  const recentNotes = [
    {
      title: "CAP Theorem Nuances in Microservices",
      size: "2.4 KB",
      date: "Oct 24, 2023",
      type: "MD",
    },
    {
      title: "Optimizing React Re-renders with Memoization",
      size: "4.1 KB",
      date: "Oct 22, 2023",
      type: "MD",
    },
    {
      title: "Distributed Tracing Fundamentals",
      size: "1.8 KB",
      date: "Oct 20, 2023",
      type: "MD",
    },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="mb-lg">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-label-md font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>
      </div>

      <header className="mb-xl">
        <h1 className="text-headline-xxl font-semibold text-primary mb-2 tracking-tight">Study Notes</h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
          A collection of deeply researched technical notes, algorithms, and system design patterns organized for rapid retrieval.
        </p>
      </header>

      <section className="mb-xxl">
        <div className="flex items-center justify-between mb-md border-b border-surface-variant pb-2">
          <h2 className="text-headline-md font-semibold text-primary tracking-tight">Categories</h2>
          <button className="text-label-md font-medium text-secondary hover:text-on-secondary-fixed-variant transition-colors">
            View All
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {categories.map((cat) => (
            <Link
              key={cat.title}
              to="#"
              className="group block p-lg bg-surface-container-lowest rounded-xl border border-surface-variant hover:border-outline-variant transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.05)] shadow-[0_4px_24px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="p-2 bg-surface-container rounded-lg group-hover:bg-tertiary-fixed transition-colors">
                  <Folder className="w-6 h-6 text-secondary fill-secondary/10" />
                </div>
                <ChevronRight className="w-5 h-5 text-outline-variant group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-headline-md font-semibold text-primary mb-2 tracking-tight">
                {cat.title}
              </h3>
              <div className="flex items-center gap-2 text-label-sm font-medium text-on-surface-variant">
                <span>{cat.items}</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span>{cat.updated}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-md border-b border-surface-variant pb-2">
          <h2 className="text-headline-md font-semibold text-primary tracking-tight">Recent Notes</h2>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <ArrowDownUp className="w-4 h-4" />
            <span className="text-label-md font-medium">Last Modified</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {recentNotes.map((note) => (
            <Link
              key={note.title}
              to="/article"
              className="group flex flex-col p-6 bg-surface-container-lowest rounded-lg border border-surface-variant hover:border-secondary transition-colors min-h-[160px]"
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-secondary" />
                <span className="text-label-sm font-medium text-on-surface-variant uppercase tracking-widest">
                  {note.type}
                </span>
              </div>
              <h3 className="text-body-md font-semibold text-primary mb-2 line-clamp-2 group-hover:text-secondary transition-colors leading-relaxed">
                {note.title}
              </h3>
              <div className="mt-auto pt-4 flex items-center justify-between text-label-sm font-medium text-on-surface-variant">
                <span>{note.size}</span>
                <span>{note.date}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

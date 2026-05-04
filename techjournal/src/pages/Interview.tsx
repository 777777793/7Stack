import { Search, Code, Leaf, Network, Database, GitBranch, Cloud, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Interview() {
  const domains = [
    {
      title: "Java Core",
      desc: "JVM architecture, concurrency, collections framework, and memory management deep dives.",
      count: "124 Questions",
      icon: Code,
    },
    {
      title: "Spring Boot",
      desc: "Dependency injection, AOP, auto-configuration, security, and microservices integration.",
      count: "86 Questions",
      icon: Leaf,
    },
    {
      title: "Distributed Systems",
      desc: "CAP theorem, consensus algorithms, event-driven architectures, and scalability patterns.",
      count: "45 Scenarios",
      icon: Network,
    },
    {
      title: "Database Design",
      desc: "Normalization, indexing strategies, transaction isolation levels, and NoSQL trade-offs.",
      count: "92 Questions",
      icon: Database,
    },
    {
      title: "Algorithms & DSA",
      desc: "Dynamic programming, graph traversals, tree balancing, and complex time complexities.",
      count: "150 Questions",
      icon: GitBranch,
    },
    {
      title: "Cloud Native",
      desc: "Containerization, Kubernetes orchestration, serverless patterns, and AWS/GCP basics.",
      count: "60 Questions",
      icon: Cloud,
    },
  ];

  return (
    <div className="flex flex-col w-full">
      <header className="mb-xl text-center max-w-3xl mx-auto pt-lg">
        <h1 className="text-headline-xxl font-semibold text-on-surface mb-sm tracking-tight">Interview Preparation</h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          Master technical interviews with curated topics, deeply analyzed core concepts, and real-world system design challenges.
        </p>
      </header>

      <div className="max-w-2xl mx-auto mb-xxl relative w-full">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
        <input
          type="text"
          placeholder="Search topics, questions, or concepts..."
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-4 pl-14 pr-6 text-body-md text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all shadow-[0_2px_10px_rgba(0,0,0,0.03)] placeholder:text-outline"
        />
      </div>

      <section>
        <h2 className="text-headline-md font-semibold text-on-surface mb-lg tracking-tight">Core Domains</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {domains.map((domain) => (
            <Link
              key={domain.title}
              to="#"
              className="group flex flex-col bg-surface-container-lowest rounded-xl p-lg border border-surface-variant hover:border-secondary/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest to-surface-container-low opacity-50 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-md">
                  <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed-variant">
                    <domain.icon className="w-5 h-5" />
                  </div>
                  <span className="text-label-sm font-medium text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
                    {domain.count}
                  </span>
                </div>
                <h3 className="text-headline-md font-semibold text-on-surface mb-2 group-hover:text-secondary transition-colors tracking-tight">
                  {domain.title}
                </h3>
                <p className="text-body-md text-on-surface-variant flex-grow mb-6 leading-relaxed">
                  {domain.desc}
                </p>
                <div className="flex items-center text-secondary text-label-md font-medium mt-auto">
                  Start Practice
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

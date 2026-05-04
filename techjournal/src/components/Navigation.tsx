import { CircleUser, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function Navigation() {
  const location = useLocation();

  const links = [
    { name: "Library", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: "Interview", path: "/interview" },
    { name: "Notes", path: "/notes" },
    { name: "Community", path: "/community" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border-b border-zinc-200/50 dark:border-zinc-800/50 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between px-8 h-12 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tighter text-zinc-900 dark:text-zinc-50 active:opacity-60 transition-opacity"
          >
            KnowledgeBase
          </Link>

          <div className="hidden md:flex space-x-md">
            {links.map((link) => {
              const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`font-sans text-sm tracking-tight font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300 active:opacity-60 transition-opacity ${
                    isActive
                      ? "text-zinc-900 dark:text-zinc-50 font-semibold"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 text-blue-600 dark:text-blue-400">
           <button className="hidden md:flex hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300 active:opacity-60 transition-opacity items-center justify-center p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Search className="w-5 h-5" />
           </button>
          <button className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300 active:opacity-60 transition-opacity flex items-center justify-center">
            <CircleUser className="w-6 h-6 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </nav>
  );
}

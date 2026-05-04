import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="w-full py-12 mt-auto bg-zinc-50 dark:bg-black border-t border-zinc-200 dark:border-zinc-800 flat no-shadows">
      <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="font-sans text-sm font-bold text-zinc-900 dark:text-zinc-50 tracking-normal opacity-100">
          © 2024 KnowledgeBase. All rights reserved.
        </div>
        <div className="flex gap-4 font-sans text-xs tracking-normal">
          <Link
            to="/privacy"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors opacity-100"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors opacity-100"
          >
            Terms of Service
          </Link>
          <Link
            to="/docs"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors opacity-100"
          >
            Documentation
          </Link>
          <Link
            to="/support"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors opacity-100"
          >
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}

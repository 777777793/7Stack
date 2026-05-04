import { ArrowLeft, Layers, Share2 } from "lucide-react";
import { Link } from "react-router-dom";

export function Article() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-gutter">
      {/* Main Article Content */}
      <div className="lg:col-span-8 lg:col-start-1">
        {/* Back Link & Meta */}
        <div className="mb-xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-label-md font-medium text-secondary hover:text-on-secondary-fixed-variant transition-colors mb-lg group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Articles
          </Link>
          <div className="flex items-center gap-4 mb-6">
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-label-sm font-medium text-on-surface-variant">
              Architecture
            </span>
            <span className="text-label-md font-medium text-outline">Oct 24, 2024</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span className="text-label-md font-medium text-outline">12 min read</span>
          </div>
          <h1 className="text-headline-xxl font-semibold text-on-surface mb-6 tracking-tight leading-tight">
            Understanding Distributed Systems
          </h1>
          <p className="text-body-lg text-on-surface-variant leading-relaxed">
            A foundational guide to building scalable, fault-tolerant architectures in modern cloud environments.
          </p>
        </div>

        {/* Article Body */}
        <article className="space-y-12 text-body-md text-on-surface leading-relaxed">
          <p>
            In modern software engineering, the shift from monolithic architectures to distributed systems is driven by the need for unprecedented scale, resilience, and agility. A distributed system consists of multiple software components that are on multiple computers, but run as a single system. The computers that are in a distributed system can be physically close together and connected by a local network, or they can be geographically distant and connected by a wide area network.
          </p>

          <div>
            <h2 id="core-concepts" className="text-headline-lg font-semibold text-on-surface mb-4 mt-12 tracking-tight">
              1. Core Concepts
            </h2>
            <p className="mb-6">
              At its heart, distributed computing attempts to solve problems that are too large for a single machine. This introduces a unique set of challenges, commonly referred to as the{' '}
              <a href="#" className="text-secondary hover:underline underline-offset-4 decoration-secondary/30">
                Fallacies of Distributed Computing
              </a>
              . Assuming the network is reliable or that latency is zero are classic pitfalls.
            </p>
            <p>
              To build robust systems, engineers must design for failure. Components will crash, networks will partition, and data will become inconsistent. Embracing eventual consistency and implementing robust retry mechanisms are non-negotiable patterns.
            </p>
          </div>

          <div>
            <h2 id="consensus-algorithms" className="text-headline-md font-semibold text-on-surface mb-4 mt-12 tracking-tight">
              Consensus Algorithms
            </h2>
            <p className="mb-6">
              When multiple nodes need to agree on a single data value or a sequence of actions, consensus algorithms are employed. Raft and Paxos are the industry standards. Below is a simplified conceptual representation of a node participating in a Raft consensus process.
            </p>
            
            <div className="rounded-lg bg-[#fafafa] border border-surface-variant p-6 my-6 overflow-x-auto shadow-sm">
              <pre className="font-mono text-[14px] leading-relaxed">
                <code>{`type Node struct {
    State       NodeState
    CurrentTerm uint64
    VotedFor    string
    Log         []LogEntry
    
    // Volatile state
    CommitIndex uint64
    LastApplied uint64
}

func (n *Node) RequestVote(req VoteRequest) VoteResponse {
    if req.Term < n.CurrentTerm {
        return VoteResponse{Term: n.CurrentTerm, Granted: false}
    }
    
    // Logic to grant vote based on log freshness
    return VoteResponse{Term: n.CurrentTerm, Granted: true}
}`}</code>
              </pre>
            </div>
            <p className="text-label-sm font-medium text-outline mt-2 text-center">Snippet 1: Simplified Raft Node Structure in Go</p>
          </div>

          <div>
            <h2 id="data-partitioning" className="text-headline-lg font-semibold text-on-surface mb-4 mt-12 tracking-tight">
              2. Data Partitioning & Replication
            </h2>
            <p className="mb-6">
              To handle massive datasets, databases employ sharding (partitioning). However, partitioning alone doesn't guarantee availability. Replication is necessary to ensure that if a node holding a specific partition goes down, another node can serve the data.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
              <div className="bg-surface-container-low p-6 rounded-lg border border-surface-variant">
                <h3 className="text-label-md font-semibold text-on-surface mb-2 flex items-center gap-2">
                  <Layers className="text-secondary w-5 h-5" />
                  Leader-Based
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  All writes go through a single leader node, which then streams changes to followers. Excellent for read-heavy workloads but the leader can become a bottleneck.
                </p>
              </div>
              <div className="bg-surface-container-low p-6 rounded-lg border border-surface-variant">
                <h3 className="text-label-md font-semibold text-on-surface mb-2 flex items-center gap-2">
                  <Share2 className="text-secondary w-5 h-5" />
                  Leaderless
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Clients write to multiple nodes concurrently (e.g., Dynamo, Cassandra). Requires sophisticated conflict resolution mechanisms like vector clocks.
                </p>
              </div>
            </div>
          </div>

          {/* Author Card */}
          <div className="pt-10 border-t border-surface-variant flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjZtIJx_RFEMxrx6zJ3OYbQqJzMZ-kTsVrOg6fnEq0X5gLkXwSroOrGgTTPVhg4tGGPe_UAD7qhSGLZYE6O599lThpCZEjZIP8o9Cs-qcCaWFC0j-TB2_4xY7FTqJhgviyg58lWFyE54UqRfJkmBxltZLlUdawwhfjoeCSv18FY1YEtthTP_l4UlUwkHkG3ZAUpLJC3a4L82E9AzE3hkzB_4c2i-aAZ54sCU8hMkXkCFIdD9l5pUNupooi3PZUE42qilGSlhnvhas"
                alt="Author"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="text-label-md font-semibold text-on-surface">Written by David Chen</p>
                <p className="text-label-sm font-medium text-on-surface-variant mt-1">Principal Systems Architect</p>
              </div>
            </div>
            <button className="px-5 py-2 rounded-full border border-outline-variant text-label-md font-medium text-on-surface hover:bg-surface-container-low transition-colors">
              Follow
            </button>
          </div>
        </article>
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:block lg:col-span-3 lg:col-start-10 relative">
        <div className="sticky top-32">
          <h4 className="text-label-md font-semibold text-on-surface uppercase tracking-wider mb-4">On this page</h4>
          <nav className="flex flex-col space-y-3 border-l-2 border-surface-variant pl-4">
            <a href="#core-concepts" className="text-label-md font-medium text-secondary -ml-[18px] pl-4 border-l-2 border-secondary transition-all">
              Core Concepts
            </a>
            <a href="#consensus-algorithms" className="text-label-md font-medium text-on-surface-variant hover:text-on-surface transition-colors">
              Consensus Algorithms
            </a>
            <a href="#data-partitioning" className="text-label-md font-medium text-on-surface-variant hover:text-on-surface transition-colors">
              Data Partitioning & Replication
            </a>
          </nav>

          <div className="mt-10 p-6 bg-surface-container-low rounded-xl border border-surface-variant">
            <h5 className="text-label-md font-semibold text-on-surface mb-3">Related Reading</h5>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-on-surface-variant hover:text-secondary transition-colors line-clamp-2 leading-relaxed">
                  Designing Data-Intensive Applications
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-on-surface-variant hover:text-secondary transition-colors line-clamp-2 leading-relaxed">
                  The CAP Theorem Explained
                </a>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

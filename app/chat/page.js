"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const [allCollections, setAllCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load all available collections on mount
  useEffect(() => {
    async function loadCollections() {
      try {
        const res = await fetch("/api/collections");
        const data = await res.json();
        setAllCollections(data.collections);

        // Pre-select collections passed via URL ?c=col1,col2
        const param = searchParams.get("c");
        if (param) {
          const preSelected = param.split(",").filter(Boolean);
          setSelectedCollections(preSelected);
        } else {
          setSelectedCollections(data.collections.map((c) => c.name));
        }
      } catch {
        setAllCollections([]);
      } finally {
        setCollectionsLoading(false);
      }
    }
    loadCollections();
  }, [searchParams]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const toggleCollection = (name) => {
    setSelectedCollections((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || chatLoading || selectedCollections.length === 0) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, collectionNames: selectedCollections }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Friendly label from collection name: resume_john_cv_a3f9b2 → john cv
  const labelFromName = (name) =>
    name
      .replace(/^resume_/, "")
      .replace(/_[a-z0-9]{6}$/, "")
      .replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="bg-white/5 backdrop-blur-lg border-b border-white/10 shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-lg opacity-70"></div>
                <div className="relative h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div>
                <span className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  SkillScan AI
                </span>
                <span className="ml-2 text-xs text-gray-400 hidden sm:inline">/ Resume Chat</span>
              </div>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-gray-300 transition-all duration-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Analyser
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Sidebar — collection selector */}
        <aside className="w-60 shrink-0 flex flex-col gap-4">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Resume Collections</span>
              <span className="text-xs text-gray-500">
                {selectedCollections.length}/{allCollections.length}
              </span>
            </div>
            <div className="p-3 flex flex-col gap-2 overflow-y-auto flex-1">
              {collectionsLoading && (
                <p className="text-xs text-gray-500 text-center py-4">Loading…</p>
              )}
              {!collectionsLoading && allCollections.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  No collections found.{" "}
                  <Link href="/" className="text-blue-400 hover:underline">
                    Analyse a resume first.
                  </Link>
                </p>
              )}
              {allCollections.map((col) => {
                const active = selectedCollections.includes(col.name);
                return (
                  <button
                    key={col.name}
                    onClick={() => toggleCollection(col.name)}
                    className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border text-xs transition-all duration-200 ${
                      active
                        ? "bg-blue-600/25 border-blue-500/50 text-blue-200"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${active ? "bg-blue-400" : "bg-gray-600"}`}
                    ></span>
                    <span className="truncate capitalize">{labelFromName(col.name)}</span>
                  </button>
                );
              })}
            </div>
            {/* Select all / none */}
            {allCollections.length > 1 && (
              <div className="px-3 py-2 border-t border-white/10 flex gap-2">
                <button
                  onClick={() => setSelectedCollections(allCollections.map((c) => c.name))}
                  className="flex-1 text-xs py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-all"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedCollections([])}
                  className="flex-1 text-xs py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-all"
                >
                  None
                </button>
              </div>
            )}
          </div>

          {/* Context badge */}
          <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">
              {selectedCollections.length === 0
                ? "No resume selected"
                : selectedCollections.length === 1
                ? "1 resume in context"
                : `${selectedCollections.length} resumes in context`}
            </p>
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-h-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2 shrink-0">
            <span className="text-base">💬</span>
            <h1 className="text-sm font-semibold text-gray-200">Ask About the Resume</h1>
            {selectedCollections.length > 0 && (
              <span className="ml-auto text-xs text-gray-500">
                Searching {selectedCollections.length} collection{selectedCollections.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto   px-6 py-4 space-y-4">
            {messages.length === 0 && !chatLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                  <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-300 font-medium text-sm">Ask anything about the selected resume(s)</p>
                  <p className="text-gray-500 text-xs mt-1">e.g. "What is their strongest skill?" or "Summarise their work experience"</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {[
                    "Summarise this resume",
                    "What technologies do they know?",
                    "Years of experience?",
                    "Highest qualification?",
                    "List all past companies",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-gray-200 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600/40 text-blue-100 rounded-br-sm"
                      : "bg-white/10 text-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="bg-white/10 px-4 py-3 rounded-xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-white/10 shrink-0">
            {selectedCollections.length === 0 && (
              <p className="text-xs text-yellow-400/80 mb-2">Select at least one resume from the sidebar to ask a question.</p>
            )}
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedCollections.length === 0
                    ? "Select a resume collection first…"
                    : "Ask anything about the resume…"
                }
                disabled={chatLoading || selectedCollections.length === 0}
                className="flex-1 rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatLoading || selectedCollections.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-all duration-200 flex items-center gap-2"
              >
                {chatLoading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
                Ask
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

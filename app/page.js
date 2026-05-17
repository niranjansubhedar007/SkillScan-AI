"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Toast from "./Toast";

// Friendly display name from collection name
// e.g. user_john_doe_a3f9b2c4 → "John Doe"  |  resume_jane_cv_1234abcd → "Jane Cv"
const labelFromName = (name) =>
  name
    .replace(/^(user_|resume_)/, "")
    .replace(/_[a-z0-9]{8}$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const Home = () => {
  const FIXED_QUERY = "Extract all skills, technologies, and competencies from this resume";

  // Collections state (replaces upload state)
  const [allCollections, setAllCollections] = useState([]);
  const [collectionProfiles, setCollectionProfiles] = useState({}); // colName → profile
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [resumeSearch, setResumeSearch] = useState("");
  const [expFilter, setExpFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [jobDescs, setJobDescs] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [matchLoading, setMatchLoading] = useState(false);

  // Chat state
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Resume preview modal state
  const [previewCollection, setPreviewCollection] = useState(null);
  const [previewData, setPreviewData] = useState(null); // { profile, pdfBase64, fileName, text }
  const [previewLoading, setPreviewLoading] = useState(false);

  const showToast = (message, type) => setToast({ message, type });
  const hideToast = () => setToast(null);

  const openPreview = async (colName) => {
    setPreviewCollection(colName);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/resume?collection=${encodeURIComponent(colName)}`);
      const data = await res.json();
      setPreviewData(data);
    } catch {
      setPreviewData({ error: "Failed to load resume." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewCollection(null);
    setPreviewData(null);
  };

  // Load collections from Qdrant + fetch each collection's profile point for real names
  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      const cols = data.collections || [];
      setAllCollections(cols);

      // Fetch profile for each collection in parallel (uses the fixed metadata point)
      const profileEntries = await Promise.all(
        cols.map(async (col) => {
          try {
            const r = await fetch(`/api/resume?collection=${encodeURIComponent(col.name)}`);
            const d = await r.json();
            return [col.name, d.profile ?? null];
          } catch {
            return [col.name, null];
          }
        })
      );
      setCollectionProfiles(Object.fromEntries(profileEntries));
    } catch {
      setAllCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
    fetch("/api/jobdescs")
      .then((r) => r.json())
      .then((data) => { if (data.jobDescs?.length) setJobDescs(data.jobDescs); })
      .catch(() => {});
  }, [loadCollections]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const toggleCollection = (name) => {
    setSelectedCollections((prev) => (prev.includes(name) ? [] : [name]));
    setMessages([]);
    setMatchScores({});
  };

  const selectAll = () => setSelectedCollections(allCollections.map((c) => c.name));
  const deselectAll = () => setSelectedCollections([]);

  // Analyse selected collections — extract skills via /api/ask, then match against JDs
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedCollections.length === 0) {
      showToast("⚠️ Please select at least one resume", "warning");
      return;
    }
    setLoading(true);
    setMatchScores({});
    setMessages([]);
    showToast("🔄 Analysing selected resumes...", "info");

    try {
      // Extract skills from the selected Qdrant collections
      const skillRes = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "List every technical skill, programming language, framework, tool, and soft skill mentioned in this resume. Return as a comma-separated list only, no extra text.",
          collectionNames: selectedCollections,
        }),
      });
      const skillData = await skillRes.json();
      const resumeSkills = skillData.answer || "";

      if (resumeSkills && jobDescs.length > 0) {
        setMatchLoading(true);
        try {
          const matchRes = await fetch("/api/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userQuery: FIXED_QUERY, resumeSkills, jobDescs }),
          });
          const matchData = await matchRes.json();
          const scores = {};
          for (const { id, score } of matchData.matches) scores[id] = score;
          setMatchScores(scores);
        } catch {
          // ignore match errors
        } finally {
          setMatchLoading(false);
        }
      } else if (jobDescs.length > 0) {
        const zeroScores = {};
        for (const job of jobDescs) zeroScores[job.id] = 0;
        setMatchScores(zeroScores);
      }
    } catch {
      showToast("❌ Failed to analyse resumes. Try again.", "error");
      setLoading(false);
      return;
    }

    showToast("✨ Analysis complete! Resume chat is ready.", "success");
    setLoading(false);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    const question = chatInput.trim();
    if (!question || chatLoading || selectedCollections.length === 0) return;
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, collectionNames: selectedCollections }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, toolCallEvents: data.toolCallEvents || [] }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again.", toolCallEvents: [] }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen lg:h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-auto lg:overflow-hidden flex flex-col">
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        {/* Nav */}
        <nav className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10 shrink-0">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-blue-500 to-purple-600 rounded-xl blur-lg opacity-70"></div>
                  <div className="relative h-8 w-8 bg-linear-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Turtlenut AI</h1>
                  <p className="text-xs text-gray-400">Enterprise Resume Intelligence</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-300">
                <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span>AI Ready</span>
              </div>
            </div>
          </div>
        </nav>

        {/* 3-Column Layout */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 gap-4 lg:min-h-0">

          {/* LEFT — Saved Resumes */}
          <div className="w-full lg:w-72 lg:shrink-0 flex flex-col gap-3 lg:overflow-y-auto">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col">

              {/* Card header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">👥</span>
                  <h2 className="text-sm font-semibold text-gray-200">Saved Resumes</h2>
                </div>
                <div className="flex items-center gap-2">
                 
                  <button
                    onClick={loadCollections}
                    title="Refresh"
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-all"
                  >
                    <svg className={`h-3.5 w-3.5 ${collectionsLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search bar */}
              {allCollections.length > 0 && (
                <div className="px-3 pt-3 shrink-0">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                      type="text"
                      value={resumeSearch}
                      onChange={(e) => setResumeSearch(e.target.value)}
                      placeholder="Search resumes…"
                      className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
                    />
                    {resumeSearch && (
                      <button
                        onClick={() => setResumeSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Experience filter */}
              {allCollections.length > 0 && (
                <div className="px-3 pt-2 pb-1 shrink-0">
                  <select
                    value={expFilter}
                    onChange={(e) => setExpFilter(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Experience</option>
                    <option value="0-2">0 – 2 yrs</option>
                    <option value="3-5">3 – 5 yrs</option>
                    <option value="6-10">6 – 10 yrs</option>
                    <option value="10+">10+ yrs</option>
                  </select>
                </div>
              )}

              {/* Collections list */}
              <div className="p-3 flex flex-col gap-2 overflow-y-auto max-h-[500px]">
            

                {!collectionsLoading && allCollections.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                      <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">No resumes yet</p>
                    <p className="text-xs text-gray-600 mt-1">Candidates submit via the Career Portal</p>
                  </div>
                )}

                {!collectionsLoading && allCollections.length > 0 &&
                  (resumeSearch.trim() !== "" || expFilter !== "all") &&
                  !allCollections.some((col) => {
                    const profile = collectionProfiles[col.name];
                    if (resumeSearch.trim()) {
                      const label = profile?.name || labelFromName(col.name);
                      if (!label.toLowerCase().includes(resumeSearch.toLowerCase())) return false;
                    }
                    if (expFilter !== "all") {
                      const yrs = profile?.experience_years;
                      if (yrs == null) return false;
                      if (expFilter === "0-2" && !(yrs >= 0 && yrs <= 2)) return false;
                      if (expFilter === "3-5" && !(yrs >= 3 && yrs <= 5)) return false;
                      if (expFilter === "6-10" && !(yrs >= 6 && yrs <= 10)) return false;
                      if (expFilter === "10+" && !(yrs > 10)) return false;
                    }
                    return true;
                  }) && (
                  <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                    <svg className="h-5 w-5 text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <p className="text-xs text-gray-500">Not found</p>
                  </div>
                )}

                {allCollections.filter((col) => {
                  const profile = collectionProfiles[col.name];
                  // Name search
                  if (resumeSearch.trim()) {
                    const label = profile?.name || labelFromName(col.name);
                    if (!label.toLowerCase().includes(resumeSearch.toLowerCase())) return false;
                  }
                  // Experience filter
                  if (expFilter !== "all") {
                    const yrs = profile?.experience_years;
                    if (yrs == null) return false;
                    if (expFilter === "0-2" && !(yrs >= 0 && yrs <= 2)) return false;
                    if (expFilter === "3-5" && !(yrs >= 3 && yrs <= 5)) return false;
                    if (expFilter === "6-10" && !(yrs >= 6 && yrs <= 10)) return false;
                    if (expFilter === "10+" && !(yrs > 10)) return false;
                  }
                  return true;
                }).map((col) => {
                  const active = selectedCollections.includes(col.name);
                  const profile = collectionProfiles[col.name];
                  // Use real name from profile if available, else fallback to collection label
                  const label = profile?.name || labelFromName(col.name);
                  const initial = label.charAt(0).toUpperCase();
                  return (
                    <div key={col.name} className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                      active
                        ? "bg-blue-600/25 border-blue-500/50 text-blue-200"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300"
                    }`}>
                      {/* Clickable area to toggle selection */}
                      <button
                        onClick={() => toggleCollection(col.name)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        {/* Avatar initial */}
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                          active ? "bg-blue-500/40 text-blue-200" : "bg-white/10 text-gray-400"
                        }`}>
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{label}</p>
                          {profile?.experience_years != null && (
                            <p className="text-gray-500 text-xs">{profile.experience_years} yrs exp</p>
                          )}
                        </div>
                        {/* Checkmark */}
                        {active && (
                          <svg className="h-4 w-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      {/* Eye icon — preview resume */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openPreview(col.name); }}
                        title="Preview resume"
                        className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-300 hover:bg-blue-500/20 transition-all shrink-0"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Analyse button */}
              <div className="p-3 pt-0 shrink-0">
                <form onSubmit={handleSubmit}>
                  <button
                    type="submit"
                    disabled={loading || selectedCollections.length === 0}
                    className={`w-full flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-all ${
                      loading || selectedCollections.length === 0
                        ? "bg-gray-600 cursor-not-allowed opacity-50"
                        : "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg"
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analysing…
                      </>
                    ) : (
                      <>
                        <span>Analyse &amp; Match</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

           
          </div>

          {/* CENTER — Chat */}
          <div className="w-full lg:flex-1 flex flex-col bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-h-120 lg:min-h-0">
            <div className="px-4 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">💬</span>
                <h2 className="text-sm font-semibold text-gray-200">Resume Chat</h2>
                {selectedCollections.length === 0 && (
                  <span className="text-xs text-gray-500">No resume loaded</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMessages([])}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-gray-200 transition-all"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Chat
                    </button>
                  )}
                </div>
              </div>
            </div>
 {selectedCollections.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-2 px-2">
                  {["Summarise this resume", "What technologies do they know?", "Years of experience?", "Highest qualification?", "What projects have they worked on?", "Good fit for the role?", "Send mail"].map((s) => (
                    <button key={s} type="button" onClick={() => setChatInput(s)}
                      className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-gray-200 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {messages.length === 0 && !chatLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                  <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-300 font-medium text-sm">
                      {selectedCollections.length === 0 ? "Select & analyse a resume first" : "Ask anything about the resume(s)"}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {selectedCollections.length === 0 ? "Chat unlocks after analysis" : 'e.g. "What is their strongest skill?"'}
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="h-7 w-7 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user" ? "bg-blue-600/40 text-blue-100 rounded-br-sm" : "bg-white/10 text-gray-200 rounded-bl-sm"
                    }`}>
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
                  {msg.role === "assistant" && msg.toolCallEvents?.length > 0 && (
                    <div className="ml-10 flex flex-col gap-1.5">
                      {msg.toolCallEvents.map((evt, j) => (
                        <div key={j} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                          <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <span className="font-semibold capitalize">{evt.tool.replace(/_/g, " ")}</span>
                            {evt.tool === "send_email" && evt.args?.to && <span className="ml-1 text-emerald-400">→ {evt.args.to}</span>}
                            <p className="text-emerald-400/80 mt-0.5">{evt.result}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-7 w-7 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
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

            <div className="px-4 py-3 border-t border-white/10 shrink-0">
              {selectedCollections.length === 0 && (
                <p className="text-xs text-yellow-400/80 mb-2">Select and analyse a resume to start chatting.</p>
              )}
             
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={selectedCollections.length === 0 ? "Analyse a resume first…" : "Ask anything about the resume…"}
                  disabled={chatLoading || selectedCollections.length === 0}
                  className="flex-1 rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 outline-none transition-all disabled:opacity-50"
                />
                <button type="submit" disabled={!chatInput.trim() || chatLoading || selectedCollections.length === 0}
                  className="px-4 py-2.5 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-all flex items-center gap-2">
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

          {/* RIGHT — Top 5 Job Matches */}
          <div className="w-full lg:w-80 lg:shrink-0 flex flex-col">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col min-h-75 lg:h-full">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
                <span className="text-sm">🎯</span>
                <h2 className="text-sm font-semibold text-gray-200">Top 5 Job Matches</h2>
                {matchLoading && (
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-blue-400">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Computing…
                  </span>
                )}
                {!matchLoading && Object.keys(matchScores).length > 0 && (
                  <span className="ml-auto text-xs text-gray-500">{jobDescs.length} JDs scanned</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {Object.keys(matchScores).length === 0 && !matchLoading ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                      <svg className="h-7 w-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-gray-300 text-xs font-medium">No matches yet</p>
                    <p className="text-gray-500 text-xs mt-1">Upload &amp; select a resume to see job matches</p>
                  </div>
                ) : (
                  [...jobDescs]
                    .sort((a, b) => (matchScores[b.id] ?? 0) - (matchScores[a.id] ?? 0))
                    .slice(0, 5)
                    .map((job, idx) => {
                      const score = matchScores[job.id] ?? 0;
                      const medals = ["🥇", "🥈", "🥉"];
                      const medal = medals[idx] ?? null;
                      const isHigh = score >= 80;
                      const isMid = score >= 30 && score < 80;
                      const cardBorder = isHigh ? "border-green-500/40" : isMid ? "border-yellow-500/30" : "border-white/10";
                      const cardBg = isHigh ? "bg-green-500/5" : isMid ? "bg-yellow-500/5" : "bg-white/5";
                      const barColor = isHigh ? "bg-green-500" : isMid ? "bg-yellow-500" : "bg-red-500";
                      const scoreColor = isHigh ? "text-green-400" : isMid ? "text-yellow-400" : "text-red-400";
                      const label = isHigh ? "Excellent" : isMid ? "Good" : "Low";
                      const labelBg = isHigh ? "bg-green-500/20 text-green-300" : isMid ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300";
                      return (
                        <div key={job.id} className={`rounded-xl border ${cardBorder} ${cardBg} p-3 transition-all`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base shrink-0">{medal ?? <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>}</span>
                            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${labelBg}`}>{label}</span>
                            <span className={`text-base font-extrabold ${scoreColor}`}>{score}%</span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed mb-2 line-clamp-3">{job.text}</p>
                          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Resume Preview Modal ── */}
      {previewCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closePreview} />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeInUp">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-100">
                    {previewData?.profile?.name || labelFromName(previewCollection)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {previewData?.fileName || "Resume Preview"}
                    {previewData?.profile?.appliedAt && (
                      <span className="ml-2">· Applied {new Date(previewData.profile.appliedAt).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={closePreview}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">

              {previewLoading ? (
                <div className="flex-1 flex items-center justify-center py-16 gap-3 text-gray-400">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Loading resume…</span>
                </div>
              ) : (
                <>
                  {/* LEFT: Profile card */}
                  {previewData?.profile && (
                    <div className="w-full lg:w-64 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 p-4 overflow-y-auto flex flex-col gap-4">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {(previewData.profile.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-100">{previewData.profile.name || "Unknown"}</p>
                          {previewData.profile.experience_years != null && (
                            <p className="text-xs text-blue-400">{previewData.profile.experience_years}+ yrs exp</p>
                          )}
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="flex flex-col gap-1.5">
                        {previewData.profile.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{previewData.profile.email}</span>
                          </div>
                        )}
                        {previewData.profile.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{previewData.profile.phone}</span>
                          </div>
                        )}
                        {previewData.profile.location && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{previewData.profile.location}</span>
                          </div>
                        )}
                        {previewData.profile.education && (
                          <div className="flex items-start gap-2 text-xs text-gray-400">
                            <svg className="h-3.5 w-3.5 shrink-0 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                            <span className="leading-relaxed">{previewData.profile.education}</span>
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      {previewData.profile.summary && (
                        <p className="text-xs text-gray-400 leading-relaxed border-t border-white/10 pt-3 italic">
                          {previewData.profile.summary}
                        </p>
                      )}

                      {/* Skills */}
                      {previewData.profile.skills?.length > 0 && (
                        <div className="border-t border-white/10 pt-3">
                          <p className="text-xs text-gray-500 mb-2 font-medium">Skills ({previewData.profile.skills.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {previewData.profile.skills.map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/25">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RIGHT: PDF viewer or plain text fallback */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {previewData?.pdfBase64 ? (
                      <iframe
                        src={`data:application/pdf;base64,${previewData.pdfBase64}`}
                        className="w-full h-full min-h-125"
                        title="Resume PDF"
                      />
                    ) : (
                      <div className="h-full overflow-y-auto p-5">
                        <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                          {previewData?.text || previewData?.error || "No content available."}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;

"use client";
import { useState, useEffect, useRef } from "react";
import Toast from "./Toast";

const Home = () => {
  const FIXED_QUERY = "Extract all skills, technologies, and competencies from this resume";

  // Upload & match state
  const [resumes, setResumes] = useState([{ id: 1, file: null, name: "" }]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [jobDescs, setJobDescs] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [matchLoading, setMatchLoading] = useState(false);

  // Chat state
  const [resumeContextList, setResumeContextList] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch("/api/jobdescs")
      .then((r) => r.json())
      .then((data) => { if (data.jobDescs?.length) setJobDescs(data.jobDescs); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const showToast = (message, type) => setToast({ message, type });
  const hideToast = () => setToast(null);

  const handleFileChange = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" && file.type !== "text/plain") {
      showToast("❌ Please upload a PDF or TXT file only.", "error");
      return;
    }
    setResumes((prev) => prev.map((r) => (r.id === id ? { ...r, file, name: file.name } : r)));
    setMessages([]);
    setMatchScores({});
    setResumeContextList([]);
    setSelectedCollections([]);
    showToast(`✅ "${file.name}" uploaded successfully!`, "success");
  };

  const addResumeSlot = () => setResumes((prev) => [...prev, { id: Date.now(), file: null, name: "" }]);

  const removeResume = (id) => {
    setResumes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      return updated.length === 0 ? [{ id: Date.now(), file: null, name: "" }] : updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validResumes = resumes.filter((r) => r.file);
    if (validResumes.length === 0) {
      showToast("⚠️ Please upload at least one resume file", "warning");
      return;
    }
    setLoading(true);
    setMatchScores({});
    setMessages([]);
    showToast("🔄 Analyzing resumes...", "info");

    const allResults = [];
    for (const resume of validResumes) {
      const formData = new FormData();
      formData.append("resume", resume.file);
      formData.append("message", FIXED_QUERY);
      try {
        const res = await fetch("/api/chat", { method: "POST", body: formData });
        const data = await res.json();
        allResults.push({ fileName: resume.name, ...data });
      } catch {
        allResults.push({ fileName: resume.name, skillFound: false, contact: null });
      }
    }

    const contextList = allResults.filter((r) => r.collectionName).map((r) => ({ fileName: r.fileName, collectionName: r.collectionName }));
    setResumeContextList(contextList);
    const collections = contextList.map((r) => r.collectionName);
    setSelectedCollections(collections);

    const allSkills = allResults
      .filter((r) => r.skillFound && r.contact?.Skills?.length)
      .flatMap((r) => r.contact.Skills);

    if (allSkills.length > 0 && jobDescs.length > 0) {
      setMatchLoading(true);
      try {
        const matchRes = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userQuery: FIXED_QUERY, resumeSkills: allSkills.join(", "), jobDescs }),
        });
        const matchData = await matchRes.json();
        const scores = {};
        for (const { id, score } of matchData.matches) scores[id] = score;
        setMatchScores(scores);
      } catch {
        // ignore
      } finally {
        setMatchLoading(false);
      }
    } else if (jobDescs.length > 0) {
      const zeroScores = {};
      for (const job of jobDescs) zeroScores[job.id] = 0;
      setMatchScores(zeroScores);
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
      <div className="h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex flex-col">
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
        <div className="relative z-10 flex-1 flex overflow-hidden max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 gap-4 min-h-0">

          {/* LEFT — Upload */}
          <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <span className="text-sm">📄</span>
                <h2 className="text-sm font-semibold text-gray-200">Upload Resumes</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  {resumes.map((r, index) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <div className="flex-1 relative border border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition-all overflow-hidden">
                        {r.file ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <div className="h-6 w-6 bg-linear-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shrink-0">
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-200 truncate">{r.name}</p>
                              <p className="text-xs text-gray-500">{(r.file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer shrink-0">
                              Change
                              <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileChange(r.id, e)} />
                            </label>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                            <div className="h-6 w-6 border border-dashed border-white/30 rounded-lg flex items-center justify-center shrink-0">
                              <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <span className="text-xs text-gray-400 truncate">
                              <span className="text-blue-400 font-medium">Resume {index + 1}</span> — PDF or TXT
                            </span>
                            <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileChange(r.id, e)} />
                          </label>
                        )}
                      </div>
                      {resumes.length > 1 && (
                        <button type="button" onClick={() => removeResume(r.id)}
                          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {/* <button type="button" onClick={addResumeSlot}
                    className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-xl text-blue-300 transition-all">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Resume
                  </button> */}
                </div>

                <button type="submit" disabled={loading || resumes.every((r) => !r.file)}
                  className={`w-full flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-all ${
                    loading || resumes.every((r) => !r.file)
                      ? "bg-gray-600 cursor-not-allowed opacity-50"
                      : "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg"
                  }`}>
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
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

            {selectedCollections.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs text-emerald-300">
                  ✅ {selectedCollections.length} resume{selectedCollections.length > 1 ? "s" : ""} ready for chat
                </p>
              </div>
            )}
          </div>

          {/* CENTER — Chat */}
          <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-h-0">
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
                  {["Summarise this resume", "What technologies do they know?", "Years of experience?", "Highest qualification?", "What projects have they worked on?", "Good fit for the role?"].map((s) => (
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
                      {selectedCollections.length === 0 ? "Upload and analyse a resume first" : "Ask anything about the resume(s)"}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {selectedCollections.length === 0 ? "Chat will be unlocked after analysis" : 'e.g. "What is their strongest skill?"'}
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
                <p className="text-xs text-yellow-400/80 mb-2">Upload and analyse a resume to start chatting.</p>
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
          <div className="w-80 shrink-0 flex flex-col">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col h-full">
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
                    <p className="text-gray-500 text-xs mt-1">Upload &amp; analyse a resume to see job matches</p>
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
    </>
  );
};

export default Home;

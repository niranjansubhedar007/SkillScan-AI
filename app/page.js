"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "./Toast";


const Home = () => {
  const [resumes, setResumes] = useState([{ id: 1, file: null, name: '' }]);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [jobDescs, setJobDescs] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [matchLoading, setMatchLoading] = useState(false);
  const [resumeCollections, setResumeCollections] = useState([]);
  const router = useRouter();

  // Fetch job descriptions from Google Doc via API on mount
  useEffect(() => {
    fetch('/api/jobdescs')
      .then(r => r.json())
      .then(data => { if (data.jobDescs?.length) setJobDescs(data.jobDescs); })
      .catch(() => {});
  }, []);

  // Toast helper functions
  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

  const handleFileChange = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      showToast('❌ Please upload a PDF or TXT file only.', 'error');
      return;
    }
    setResumes(prev => prev.map(r => r.id === id ? { ...r, file, name: file.name } : r));
    showToast(`✅ "${file.name}" uploaded successfully!`, 'success');
  };

  const addResumeSlot = () => {
    setResumes(prev => [...prev, { id: Date.now(), file: null, name: '' }]);
  };

  const removeResume = (id) => {
    setResumes(prev => {
      const updated = prev.filter(r => r.id !== id);
      return updated.length === 0 ? [{ id: Date.now(), file: null, name: '' }] : updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validResumes = resumes.filter(r => r.file);
    if (validResumes.length === 0) {
      showToast('⚠️ Please upload at least one resume file', 'warning');
      return;
    }
    if (!message) {
      showToast('💡 Please enter a skill to search for', 'info');
      return;
    }

    setLoading(true);
    setResults([]);
    setMatchScores({});
    showToast('🔄 Analyzing resumes...', 'info');

    const allResults = [];
    for (const resume of validResumes) {
      const formData = new FormData();
      formData.append("resume", resume.file);
      formData.append("message", message);
      try {
        const res = await fetch("/api/chat", { method: "POST", body: formData });
        const data = await res.json();
        allResults.push({ fileName: resume.name, ...data });
      } catch {
        allResults.push({ fileName: resume.name, skillFound: false, contact: null });
      }
    }

    setResults(allResults);
    const collections = allResults
      .filter(r => r.collectionName)
      .map(r => ({ fileName: r.fileName, collectionName: r.collectionName }));
    setResumeCollections(collections);
    const found = allResults.filter(r => r.skillFound).length;

    // Compute embedding match scores against job descriptions
    const allSkills = allResults
      .filter(r => r.skillFound && r.contact?.Skills?.length)
      .flatMap(r => r.contact.Skills);

    if (allSkills.length > 0 && jobDescs.length > 0) {
      setMatchLoading(true);
      try {
        const matchRes = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userQuery: message,
            resumeSkills: allSkills.join(', '),
            jobDescs,
          }),
        });
        const matchData = await matchRes.json();
        const scores = {};
        for (const { id, score } of matchData.matches) {
          scores[id] = score;
        }
        setMatchScores(scores);
      } catch {
        // silently ignore match errors
      } finally {
        setMatchLoading(false);
      }
    } else if (jobDescs.length > 0) {
      // Skill not found — show 0% for all JDs
      const zeroScores = {};
      for (const job of jobDescs) {
        zeroScores[job.id] = 0;
      }
      setMatchScores(zeroScores);
    }

    if (found > 0) {
      showToast(`✨ Skill found in ${found} of ${allResults.length} resume(s)!`, 'success');
    } else {
      showToast('🔍 Skill not found in any resume.', 'warning');
    }
    setLoading(false);
  };
  const examplePrompts = [
    "Frontend development",
    "Devops development",
    "Backend development",
    "Fullstack development",
    "Data Science",
    "Machine Learning",
    "Project Management",
    "UI/UX Design",
    "Cloud Computing",
    "React.js / Next.js",
    "Node.js / Express",
    "TypeScript",
    "Python Django",
    "REST API design",
    "CI/CD pipelines",
    "Algorithm & Data Structures",
    "SQL & NoSQL databases",
  ];



  const handleInputChange = (e) => {
    setMessage(e.target.value);
  };

  const openChat = () => {
    const names = resumeCollections.map(c => c.collectionName).join(',');
    router.push(`/chat?c=${encodeURIComponent(names)}`);
  };

  const setExamplePrompt = (prompt) => {
    setMessage(prompt);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Toast Container */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}

        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-lg opacity-70"></div>
                  <div className="relative h-9 w-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    SkillScan AI
                  </h1>
                  <p className="text-xs text-gray-400">Enterprise Resume Intelligence</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  href="/chat"
                  className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-gray-300 transition-all duration-200"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Resume Chat
                </Link>
                <Link
                  href="/email"
                  className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-gray-300 transition-all duration-200"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Email
                </Link>
                <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-300">
                  <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span>AI Ready</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                Extract Skills  
              <span className="text-white ml-4">in Seconds</span>

              </span>
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-300">
              Upload your resume and let our advanced AI identify every skill, technology,
              and competency with 99% accuracy.
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start ">

            {/* LEFT — Form */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="px-6 py-8 sm:p-10">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* File Upload Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-200">
                        Upload Resumes
                      </label>
                      <button
                        type="button"
                        onClick={addResumeSlot}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-blue-300 transition-all duration-200"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Resume
                      </button>
                    </div>
                    <div className="space-y-3">
                      {resumes.map((r, index) => (
                        <div key={r.id} className="flex items-center gap-3">
                          <div className="flex-1 relative border border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 overflow-hidden">
                            {r.file ? (
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-200 truncate">{r.name}</p>
                                  <p className="text-xs text-gray-400">{(r.file.size / 1024).toFixed(2)} KB • Ready</p>
                                </div>
                                <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
                                  Change
                                  <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileChange(r.id, e)} />
                                </label>
                              </div>
                            ) : (
                              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                                <div className="h-8 w-8 border border-dashed border-white/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                </div>
                                <span className="text-sm text-gray-400">
                                  <span className="text-blue-400 font-medium">Resume {index + 1}</span> — click to upload PDF or TXT
                                </span>
                                <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileChange(r.id, e)} />
                              </label>
                            )}
                          </div>
                          {resumes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeResume(r.id)}
                              className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Message Input Section */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-200 mb-3">
                      Analysis Instructions
                    </label>
                    <div className={`relative transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
                      <textarea
                        value={message}
                        onChange={handleInputChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        rows="4"
                        placeholder="Describe what skills you want to extract... (e.g., 'List all programming languages, frameworks, and tools from my resume')"
                        className="block w-full rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 p-4 text-gray-200 placeholder-gray-400 resize-none transition-all duration-200"
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {charCount}/500
                      </div>
                    </div>

                    {/* Example Prompts */}
                    <div className="mt-4 ">
                      <p className="text-xs text-gray-400 mb-2">Try these examples:</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {examplePrompts.map((prompt, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setExamplePrompt(prompt)}
                            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 transition-all duration-200 hover:scale-105"
                          >
                            {prompt.substring(0, 40)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={loading || resumes.every(r => !r.file) || !message}
                      className={`group relative w-full flex justify-center items-center px-6 py-3 text-base font-semibold rounded-xl text-white transition-all duration-300 ${loading || resumes.every(r => !r.file) || !message
                          ? "bg-gray-600 cursor-not-allowed opacity-50"
                          : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-xl transform "
                        }`}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing Resume...
                        </>
                      ) : (
                        <>
                          <span>Analyze Skills</span>
                          <svg className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* RIGHT — Results */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="px-6 py-8 sm:p-10">
                {results.length > 0 ? (
                  <div className="space-y-4 animate-fadeInUp">
                    <h3 className="text-lg font-semibold text-white">Results — {results.filter(r => r.skillFound).length} of {results.length} matched</h3>
                    {results.map((result, index) => (
                      <div key={index} className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
                        <div className="relative bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
                          <div className="px-5 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/20 flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full animate-pulse ${result.skillFound ? 'bg-green-400' : 'bg-red-400'}`}></div>
                            <span className="text-sm font-medium text-gray-200 truncate flex-1">{result.fileName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${result.skillFound ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                              }`}>
                              {result.skillFound ? 'Skill Found' : 'Not Found'}
                            </span>
                          </div>
                          <div className="px-5 py-4">
                            {result.skillFound && result.contact ? (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {result.contact.name && (
                                    <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10">
                                      <span className="text-base">👤</span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-400">Name</p>
                                        <p className="text-white text-sm font-medium truncate">{result.contact.name}</p>
                                      </div>
                                    </div>
                                  )}
                                  {result.contact.email && (
                                    <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10">
                                      <span className="text-base">📧</span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-400">Email</p>
                                        <a href={`mailto:${result.contact.email}`} className="text-blue-400 hover:underline text-sm font-medium truncate block">{result.contact.email}</a>
                                      </div>
                                    </div>
                                  )}
                                  {result.contact.phone && (
                                    <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10">
                                      <span className="text-base">📞</span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-400">Phone</p>
                                        <p className="text-white text-sm font-medium truncate">{result.contact.phone}</p>
                                      </div>
                                    </div>
                                  )}
                                  {result.contact.linkedin && (
                                    <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10">
                                      <span className="text-base">🔗</span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-400">LinkedIn</p>
                                        <a href={result.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm font-medium truncate block">{result.contact.linkedin}</a>
                                      </div>
                                    </div>
                                  )}
                                  {result.contact.location && (
                                    <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10">
                                      <span className="text-base">📍</span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-400">Location</p>
                                        <p className="text-white text-sm font-medium truncate">{result.contact.location}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div>

                                  {result.contact.Skills && result.contact.Skills.length > 0 && (
                                    <div className="mt-2 h-full flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10">
                                      <span className="text-base">💡</span>
                                      <div className="min-w-0">
                                        <p className="text-xs text-gray-400">Skills</p>
                                        <p className="text-white text-sm font-medium truncate">{result.contact.Skills.join(", ")}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-gray-400 py-2">The skill &quot;{message}&quot; was not found in this resume.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                      <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm">Results will appear here after analysis</p>
                  </div>
                )}
              </div>
            </div>

          </div>{/* end grid */}

          {/* Open Chat CTA */}
          {resumeCollections.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={openChat}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Open Resume Chat
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          )}

          {/* Job Descriptions Database */}
          {jobDescs.length > 0 && results.length > 0 && (
            <div className="mt-10 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2">
                <span className="text-base">🗄️</span>
                <h3 className="text-sm font-semibold text-gray-200">Job Descriptions — Skill Match</h3>
                <span className="ml-auto text-xs text-gray-500">Top 5 of {jobDescs.length}</span>
                {matchLoading && (
                  <span className="ml-3 flex items-center gap-1.5 text-xs text-blue-400">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Computing embeddings…
                  </span>
                )}
              </div>
              <div className="divide-y divide-white/10">
                {[...jobDescs]
                  .sort((a, b) => (matchScores[b.id] ?? 0) - (matchScores[a.id] ?? 0))
                  .slice(0, 5)
                  .map((job) => {
                  const score = matchScores[job.id];
                  const hasScore = score !== undefined;
                  const scoreColor =
                    score >= 80 ? 'bg-green-500' :
                    score >= 30 ? 'bg-yellow-500' :
                    'bg-red-500';
                  const scoreTextColor =
                    score >= 80 ? 'text-green-400' :
                    score >= 30 ? 'text-yellow-400' :
                    'text-red-400';

                  return (
                    <div key={job.id} className="px-6 py-4">
                      <div className="flex items-start gap-3 mb-2">
                        <p className="text-sm text-gray-300 flex-1">{job.text}</p>
                        {hasScore && (
                          <span className={`ml-3 shrink-0 text-sm font-bold ${scoreTextColor}`}>
                            {score}%
                          </span>
                        )}
                      </div>
                      {hasScore && (
                        <div className=" h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${scoreColor}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      )}
                      {!hasScore && Object.keys(matchScores).length === 0 && !matchLoading && (
                        <p className="ml-8 text-xs text-gray-600 italic">Run an analysis to see match score</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Section */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { icon: "⚡", label: "Average Analysis Time", value: "< 3 seconds", color: "from-blue-500/20 to-blue-600/20" },
              { icon: "🎯", label: "Detection Accuracy", value: "99.2%", color: "from-purple-500/20 to-purple-600/20" },
              { icon: "🔒", label: "Data Privacy", value: "End-to-end encrypted", color: "from-pink-500/20 to-pink-600/20" }
            ].map((stat, index) => (
              <div key={index} className={`bg-gradient-to-br ${stat.color} backdrop-blur-sm rounded-xl border border-white/20 p-6 text-center hover:scale-105 transition-all duration-300`}>
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-gray-300 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

   
      </div>
    </>
  );
};

export default Home;
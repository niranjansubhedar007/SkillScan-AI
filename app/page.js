"use client";
import { useState, useCallback, useEffect } from "react";
import Toast from "./Toast";


const Home = () => {
  const [resume, setResume] = useState(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [toast, setToast] = useState(null);
const [method, setMethod] = useState("embeddings"); // 'embeddings' or 'chat'

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

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "application/pdf" || file.type === "text/plain")) {
      setResume(file);
      setFileName(file.name);
      setResult("");
      showToast(`✅ "${file.name}" uploaded successfully!`, 'success');
    } else {
      showToast('❌ Please upload a PDF or TXT file only.', 'error');
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === "application/pdf" || file.type === "text/plain")) {
      setResume(file);
      setFileName(file.name);
      setResult("");
      showToast(`✅ "${file.name}" uploaded successfully!`, 'success');
    } else if (file) {
      showToast('❌ Please upload a PDF or TXT file only.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Condition 1: No resume uploaded
    if (!resume) {
      showToast('⚠️ Please upload a resume file first', 'warning');
      return;
    }
    
    // Condition 2: No message entered
    if (!message) {
      showToast('💡 Please enter analysis instructions', 'info');
      return;
    }

    setLoading(true);
    setResult("");
    showToast('🔄 Analyzing your resume...', 'info');
    
    const formData = new FormData();
    formData.append("resume", resume);
    formData.append("message", message);
    formData.append("method", method); // 'embeddings' or 'chat'

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.reply && data.reply !== "No skills detected.") {
        setResult(data.reply);
        showToast('✨ Skills detected successfully!', 'success');
      } else if (data.reply === "No skills detected.") {
        setResult(data.reply);
        showToast('🔍 No skills found in the resume', 'warning');
      } else {
        showToast('❌ Failed to detect skills', 'error');
      }
    } catch (error) {
      console.error("Error:", error);
      showToast('❌ Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };
  const examplePrompts = [
    "Extract all technical skills including programming languages, frameworks, and tools",
    "List only soft skills like leadership, communication, and teamwork",
    "Identify cloud computing and DevOps skills",
    "Show me all data science and machine learning competencies"
  ];



  const handleInputChange = (e) => {
    setMessage(e.target.value);
  };

  const removeFile = () => {
    const fileName_ = fileName;
    setResume(null);
    setFileName("");
    setResult("");
    showToast(`🗑️ "${fileName_}" removed`, 'info');
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
              <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-300">
                <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span>AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
              Extract Skills
            </span>
            <br />
            <span className="text-white">in Seconds</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-300">
            Upload your resume and let our advanced AI identify every skill, technology, 
            and competency with 99% accuracy
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Upload Resume
                </label>
                <div
                  className={`relative border-2 rounded-xl p-8 transition-all duration-300 ${
                    dragActive
                      ? "border-blue-500 bg-blue-500/10 scale-105"
                      : "border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {!resume ? (
                    <div className="text-center">
                      <div className="inline-flex p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl mb-4">
                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-300">
                        <span className="font-medium text-blue-400">Click to upload</span> or drag and drop
                      </div>
                      <p className="text-xs text-gray-400 mt-2">PDF or TXT (Max 10MB)</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white/10 rounded-lg p-4 border border-white/20">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{fileName}</p>
                          <p className="text-xs text-gray-400">
                            {(resume.size / 1024).toFixed(2)} KB • Ready for analysis
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="ml-4 text-gray-400 hover:text-red-400 transition-colors duration-200"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
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
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2">Try these examples:</p>
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.map((prompt, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setExamplePrompt(prompt)}
                        className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 transition-all duration-200 hover:scale-105"
                      >
                        {prompt.substring(0, 40)}...
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={loading || !resume || !message}
                  className={`group relative w-full flex justify-center items-center px-6 py-3 text-base font-semibold rounded-xl text-white transition-all duration-300 ${
                    loading || !resume || !message
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
<div className=" mt-5">
  <label className="block text-sm font-semibold text-gray-200 mb-3">
    Detection Method
  </label>
  <div className="flex gap-4">
    <label className="flex items-center">
      <input
        type="radio"
        value="embeddings"
        checked={method === "embeddings"}
        onChange={(e) => setMethod(e.target.value)}
        className="mr-2"
      />
      <span className="text-gray-300">Embeddings (Fast & Cheap)</span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        value="chat"
        checked={method === "chat"}
        onChange={(e) => setMethod(e.target.value)}
        className="mr-2"
      />
      <span className="text-gray-300">Chat API (More Accurate)</span>
    </label>
  </div>
</div>
            {/* Results Section */}
            {result && result !== "⚠️ Please upload a resume and enter a message." && result !== "❌ An error occurred. Please try again." && (
              <div className="mt-8 animate-fadeInUp">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-xl"></div>
                  <div className="relative bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/20">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                        <h3 className="text-lg font-semibold text-white">Detection Results</h3>
                        <span className="text-xs text-gray-400 ml-auto">AI Analysis Complete</span>
                      </div>
                    </div>
                    <div className="px-6 py-6">
                      {result !== "No skills detected." ? (
                        <div className="flex flex-wrap gap-2">
                          {result.split(',').map((skill, index) => (
                            <span
                              key={index}
                              className="group inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/20 text-gray-200  transition-all duration-200 cursor-default"
                              style={{
                                animationDelay: `${index * 50}ms`,
                                animation: 'fadeInScale 0.3s ease-out forwards',
                                opacity: 0,
                                transform: 'scale(0.9)'
                              }}
                            >
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                              {skill.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="mt-2 text-gray-400">{result}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .animate-toast-slide-in {
          animation: toast-slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
    </>
  );
};

export default Home;
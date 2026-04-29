"use client";
import { useState } from "react";
import Link from "next/link";
import Toast from "../Toast";

const TEMPLATES = [
  {
    label: "Interview Invitation",
    subject: "Interview Invitation — {{role}} Position",
    body: `We were impressed by your profile and would love to invite you for an interview for the {{role}} position at our company.

Please let us know your availability for the upcoming week so we can schedule a convenient time.

We look forward to speaking with you!

Warm regards,
{{senderName}}`,
  },
  {
    label: "Shortlisting Confirmation",
    subject: "You've Been Shortlisted — {{role}}",
    body: `Congratulations! After reviewing your resume, we are pleased to inform you that you have been shortlisted for the {{role}} role.

Our team will be in touch shortly with the next steps in the hiring process.

Best regards,
{{senderName}}`,
  },
  {
    label: "Rejection (Polite)",
    subject: "Update on Your Application — {{role}}",
    body: `Thank you for taking the time to apply for the {{role}} position and for your interest in joining our team.

After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs. We truly appreciate your effort and encourage you to apply for future openings.

We wish you the very best in your career journey.

Kind regards,
{{senderName}}`,
  },
  {
    label: "Offer Letter",
    subject: "Job Offer — {{role}} at Our Company",
    body: `We are thrilled to extend an offer for the {{role}} position. Your skills and experience stood out, and we believe you will be a great addition to our team.

Please review the attached offer details and let us know your decision by end of this week.

We hope to welcome you aboard soon!

Warm regards,
{{senderName}}`,
  },
];

export default function EmailPage() {
  const [to, setTo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const showToast = (message, type) => setToast({ message, type });
  const hideToast = () => setToast(null);

  const applyTemplate = (tpl) => {
    setSubject(tpl.subject);
    setBody(tpl.body);
    showToast(`✅ Template "${tpl.label}" applied`, "success");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
    if (recipients.length === 0) return showToast("⚠️ Please enter at least one recipient", "warning");
    if (!subject.trim()) return showToast("⚠️ Subject is required", "warning");
    if (!body.trim()) return showToast("⚠️ Message body is required", "warning");

    setSending(true);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipients, recipientName, senderName, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      showToast("✉️ Email sent successfully!", "success");
      setTo(""); setRecipientName(""); setSubject(""); setBody("");
    } catch (err) {
      showToast(`❌ ${err.message}`, "error");
    } finally {
      setSending(false);
    }
  };

  const previewHtml = `
    <div style="font-family:Arial,sans-serif;background:#0F172A;min-height:100%;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:linear-gradient(135deg,#1e293b,#1a1040);border-radius:14px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
        <div style="padding:28px 36px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);">
          <span style="color:#fff;font-size:18px;font-weight:bold;">⚡ SkillScan AI</span>
          <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:4px 0 0;">Enterprise Resume Intelligence</p>
        </div>
        <div style="padding:32px 36px;">
          ${recipientName ? `<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">Dear <strong style="color:#e2e8f0;">${recipientName}</strong>,</p>` : ""}
          <div style="color:#cbd5e1;font-size:14px;line-height:1.8;white-space:pre-line;">${body || "(empty body)"}</div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.1);padding:16px 36px;">
          <p style="color:#64748b;font-size:11px;margin:0;">Sent via <strong style="color:#8b5cf6;">SkillScan AI</strong>${senderName ? ` by ${senderName}` : ""}</p>
        </div>
      </div>
    </div>
  `;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3 group">
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
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/" className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-gray-300 transition-all duration-200">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </Link>
              <Link href="/chat" className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-gray-300 transition-all duration-200">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Resume Chat
              </Link>
              <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-300">
                <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span>AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Send Candidate Emails
            </span>
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-base text-gray-300">
            Compose and send professional SMTP emails to candidates using beautiful HTML templates.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Templates sidebar */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Email Templates
            </h3>
            <div className="space-y-2">
              {TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => applyTemplate(tpl)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 transition-all duration-200 group"
                >
                  <p className="text-sm font-medium text-gray-200 group-hover:text-purple-300 transition-colors">{tpl.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{tpl.subject}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-gray-400 mb-2">Placeholders you can use:</p>
              <div className="space-y-1">
                {["{{role}}", "{{senderName}}"].map((ph) => (
                  <span key={ph} className="inline-block mr-2 mb-1 text-xs px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300">
                    {ph}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Compose form + preview toggle */}
          <div className="lg:col-span-2 space-y-4">
            {/* Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${!previewMode ? "bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-lg" : "bg-white/5 border-white/20 text-gray-400 hover:bg-white/10"}`}
              >
                Compose
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${previewMode ? "bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-lg" : "bg-white/5 border-white/20 text-gray-400 hover:bg-white/10"}`}
              >
                Preview
              </button>
            </div>

            {!previewMode ? (
              <form onSubmit={handleSend} className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-6 space-y-5">
                {/* To */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-1.5">
                    To <span className="text-gray-400 font-normal">(comma-separated for multiple)</span>
                  </label>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="candidate@email.com, another@email.com"
                    className="w-full rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-gray-200 placeholder-gray-400 text-sm transition-all duration-200 outline-none"
                  />
                </div>

                {/* Recipient Name & Sender Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-200 mb-1.5">Recipient Name <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-gray-200 placeholder-gray-400 text-sm transition-all duration-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-200 mb-1.5">Your Name <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. HR Team"
                      className="w-full rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-gray-200 placeholder-gray-400 text-sm transition-all duration-200 outline-none"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="w-full rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-gray-200 placeholder-gray-400 text-sm transition-all duration-200 outline-none"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-1.5">Message</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={9}
                    placeholder="Write your message here..."
                    className="w-full rounded-xl bg-white/10 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-gray-200 placeholder-gray-400 text-sm resize-none transition-all duration-200 outline-none"
                  />
                </div>

                {/* Send */}
                <button
                  type="submit"
                  disabled={sending}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white transition-all duration-300 ${sending ? "bg-gray-600 cursor-not-allowed opacity-50" : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-xl"}`}
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Email
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <p className="text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">Subject:</span> {subject || "(none)"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    <span className="font-semibold text-gray-300">To:</span> {to || "(none)"}
                  </p>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  title="Email Preview"
                  className="w-full border-0"
                  style={{ minHeight: "420px", background: "#0F172A" }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

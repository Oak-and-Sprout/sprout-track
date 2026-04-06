import { useState, useRef, useEffect } from "react";

const THREADS = [
  {
    id: "1",
    subject: "Dark mode contrast on activity tiles",
    lastActivity: "Mar 28",
    hasUnread: true,
    family: "Thompson Family",
    userName: "Sarah Thompson",
    userEmail: "sarah@example.com",
    messages: [
      { id: "m1", from: "you", name: "Sarah Thompson", date: "Mar 26, 10:14 AM", text: "The activity tile text in dark mode is really hard to read — especially the outdoor play and tummy time labels. The gray text on the dark card background doesn't have enough contrast. Using v1.2.2 on Docker, latest pull." },
      { id: "m2", from: "admin", name: "Sprout Track Team", date: "Mar 27, 9:30 AM", text: "Thanks for flagging this, Sarah. Can you confirm which tiles specifically? We want to catch all of them." },
      { id: "m3", from: "you", name: "Sarah Thompson", date: "Mar 27, 11:02 AM", text: "Outdoor play, tummy time, and the walk tiles are the worst. Bath and feeding seem fine." },
      { id: "m4", from: "admin", name: "Sprout Track Team", date: "Mar 28, 2:41 PM", text: "Fixed in v1.2.3 — we bumped the contrast on all activity tile labels in dark mode. Pull the latest and let us know if anything else looks off!" },
    ],
  },
  {
    id: "2",
    subject: "Export monthly report as PDF",
    lastActivity: "Mar 22",
    hasUnread: false,
    family: "Thompson Family",
    userName: "Sarah Thompson",
    userEmail: "sarah@example.com",
    messages: [
      { id: "m5", from: "you", name: "Sarah Thompson", date: "Mar 22, 3:15 PM", text: "It would be great to have a one-click PDF export for the monthly report card so I can share it with our pediatrician. Right now I screenshot each section which is tedious." },
    ],
  },
  {
    id: "3",
    subject: "Nursery mode is fantastic",
    lastActivity: "Mar 15",
    hasUnread: false,
    family: "Thompson Family",
    userName: "Sarah Thompson",
    userEmail: "sarah@example.com",
    messages: [
      { id: "m6", from: "you", name: "Sarah Thompson", date: "Mar 15, 8:22 AM", text: "Just wanted to say nursery mode is fantastic. The wake lock feature is exactly what we needed for overnight tracking. Our nanny loves it too!" },
      { id: "m7", from: "admin", name: "Sprout Track Team", date: "Mar 15, 11:05 AM", text: "That's wonderful to hear! We put a lot of thought into making it practical for real overnight use. Thanks for the kind words!" },
    ],
  },
];

const SendArrow = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
);

function ThreadList({ threads, selectedId, onSelect, onNewThread, showNew, isMobile, isAdmin }) {
  return (
    <div style={{
      width: isMobile ? "100%" : 260,
      flexShrink: 0,
      borderRight: isMobile ? "none" : "1px solid #e5e3de",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#f7f7f5",
    }}>
      {/* List Header */}
      <div style={{
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #e5e3de",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Messages</span>
        <button
          onClick={onNewThread}
          title="New feedback"
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: showNew ? "#e5e3de" : "transparent",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#10b981", transition: "all 0.12s",
          }}
        >
          {showNew ? <XIcon /> : <PlusIcon />}
        </button>
      </div>

      {/* Thread Items */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {threads.map(t => {
          const active = t.id === selectedId && !showNew;
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: "1px solid #edecea",
                background: active ? "#fff" : "transparent",
                borderLeft: active ? "3px solid #10b981" : "3px solid transparent",
                transition: "all 0.1s",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: t.hasUnread ? 600 : 400,
                  color: "#1a1a1a",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  flex: 1,
                }}>
                  {t.subject}
                </span>
                {t.hasUnread && (
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontSize: 11, color: "#8a8a82",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {isAdmin
                    ? (t.messages[t.messages.length - 1].from === "admin"
                      ? "You replied"
                      : (t.userName || "User"))
                    : (t.messages[t.messages.length - 1].from === "admin"
                      ? "Admin replied"
                      : "You")}
                  {isAdmin && t.family ? ` · ${t.family}` : ""}
                  {" · "}{t.messages.length} msg{t.messages.length > 1 ? "s" : ""}
                </span>
                <span style={{ fontSize: 11, color: "#a3a39b", flexShrink: 0 }}>{t.lastActivity}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConversationPane({ thread, replyText, setReplyText, onSend, isMobile, onBack, isAdmin }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.id, thread?.messages?.length]);

  if (!thread) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "#a3a39b", fontSize: 13, flexDirection: "column", gap: 8,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d2cc" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Select a conversation
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* Conversation Header */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid #e5e3de",
        display: "flex", alignItems: "center", gap: 10,
        background: "#fff",
        flexShrink: 0,
      }}>
        {isMobile && (
          <button onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "#10b981", display: "flex", alignItems: "center",
          }}>
            <ChevronLeft />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {thread.subject}
          </div>
          <div style={{ fontSize: 11, color: "#a3a39b", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{thread.messages.length} message{thread.messages.length > 1 ? "s" : ""}</span>
            {isAdmin && thread.userName && (
              <>
                <span style={{ color: "#d4d2cc" }}>·</span>
                <span style={{ color: "#6b6b63", fontWeight: 500 }}>{thread.userName}</span>
                {thread.family && (
                  <>
                    <span style={{ color: "#d4d2cc" }}>·</span>
                    <span>{thread.family}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px 20px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        background: "#fafaf8",
      }}>
        {thread.messages.map((msg, idx) => {
          const isFromUser = msg.from === "you";
          const isFromAdmin = msg.from === "admin";
          // "isMine" = the current viewer sent this message
          const isMine = isAdmin ? isFromAdmin : isFromUser;
          const showDateBreak = idx === 0 || thread.messages[idx - 1].date.split(",")[0] !== msg.date.split(",")[0];
          const sameSenderAsPrev = idx > 0 && thread.messages[idx - 1].from === msg.from && !showDateBreak;

          // Determine display name and initials
          let displayName, initials, avatarBg, avatarColor, nameColor;
          if (isMine) {
            displayName = isAdmin ? "You (Admin)" : (msg.name || "You");
            initials = isAdmin ? "A" : (msg.name || "You").split(" ").map(w => w[0]).join("").slice(0, 2);
            avatarBg = "#d1fae5"; avatarColor = "#065f46"; nameColor = "#065f46";
          } else if (isFromUser) {
            // Admin viewing a user message — show user name + family
            displayName = msg.name || thread.userName || "User";
            initials = (displayName).split(" ").map(w => w[0]).join("").slice(0, 2);
            avatarBg = "#fef3c7"; avatarColor = "#92400e"; nameColor = "#6b6b63";
          } else {
            // User viewing an admin message
            displayName = "Sprout Track Team";
            initials = "ST";
            avatarBg = "#dbeafe"; avatarColor = "#1e40af"; nameColor = "#6b6b63";
          }

          return (
            <div key={msg.id}>
              {showDateBreak && (
                <div style={{
                  textAlign: "center", fontSize: 10, color: "#a3a39b",
                  padding: "8px 0 12px", fontWeight: 500, letterSpacing: "0.03em",
                }}>
                  {msg.date.split(",")[0]}
                </div>
              )}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMine ? "flex-end" : "flex-start",
                marginBottom: 4,
              }}>
                {/* Sender label — collapse consecutive same-sender */}
                {!sameSenderAsPrev && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
                    flexDirection: isMine ? "row-reverse" : "row",
                    paddingLeft: isMine ? 0 : 2,
                    paddingRight: isMine ? 2 : 0,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: avatarBg, color: avatarColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 600,
                    }}>
                      {initials}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5,
                      flexDirection: isMine ? "row-reverse" : "row",
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: nameColor }}>
                        {displayName}
                      </span>
                      {/* Show family tag for user messages when viewed by admin */}
                      {isAdmin && isFromUser && thread.family && (
                        <span style={{
                          fontSize: 10, color: "#92400e", background: "#fef9c3",
                          padding: "1px 6px", borderRadius: 4, fontWeight: 500,
                        }}>
                          {thread.family}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div style={{
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: isMine ? "#10b981" : "#fff",
                  color: isMine ? "#fff" : "#1a1a1a",
                  fontSize: 13,
                  lineHeight: 1.6,
                  border: isMine ? "none" : "1px solid #e5e3de",
                  boxShadow: isMine ? "none" : "0 1px 2px rgba(0,0,0,0.03)",
                }}>
                  {msg.text}
                </div>
                <span style={{
                  fontSize: 10, color: "#a3a39b", marginTop: 3,
                  paddingLeft: isMine ? 0 : 2,
                  paddingRight: isMine ? 2 : 0,
                }}>
                  {msg.date.includes(",") ? msg.date.split(", ").slice(1).join(", ") : msg.date}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Always-visible Reply */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid #e5e3de",
        background: "#fff",
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        flexShrink: 0,
      }}>
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Type a reply..."
          rows={1}
          style={{
            flex: 1, padding: "9px 12px", border: "1px solid #dddbd6",
            borderRadius: 20, fontSize: 13, color: "#1a1a1a",
            background: "#f7f7f5", fontFamily: "inherit", resize: "none",
            outline: "none", lineHeight: 1.5, maxHeight: 120, overflow: "auto",
            boxSizing: "border-box",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.background = "#fff"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "#dddbd6"; e.currentTarget.style.background = "#f7f7f5"; }}
          onInput={e => {
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={onSend}
          disabled={!replyText.trim()}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: replyText.trim() ? "#10b981" : "#e5e3de",
            border: "none", cursor: replyText.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s", flexShrink: 0,
          }}
        >
          <SendArrow size={15} color={replyText.trim() ? "#fff" : "#a3a39b"} />
        </button>
      </div>
    </div>
  );
}

function NewFeedbackPane({ onSubmit, onCancel, isMobile, onBack }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) return;
    setSent(true);
    setTimeout(() => {
      onSubmit({ subject, message });
      setSent(false);
      setSubject("");
      setMessage("");
    }, 1800);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid #e5e3de",
        display: "flex", alignItems: "center", gap: 10,
        background: "#fff", flexShrink: 0,
      }}>
        {isMobile && (
          <button onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "#10b981", display: "flex", alignItems: "center",
          }}>
            <ChevronLeft />
          </button>
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>New feedback</div>
          <div style={{ fontSize: 11, color: "#a3a39b" }}>Send a message to the Sprout Track team</div>
        </div>
      </div>

      {/* Form Body */}
      <div style={{ flex: 1, padding: "20px", background: "#fafaf8", overflowY: "auto" }}>
        {sent && (
          <div style={{
            padding: "14px 16px", borderRadius: 10, marginBottom: 20,
            background: "#ecfdf5", border: "1px solid #a7f3d0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="#10b981">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#065f46" }}>Sent! We'll get back to you soon.</span>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#6b6b63", display: "block", marginBottom: 6 }}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="What's on your mind?"
            style={{
              width: "100%", padding: "10px 12px",
              border: "1px solid #dddbd6", borderRadius: 10,
              fontSize: 13, color: "#1a1a1a", background: "#fff",
              fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#10b981"}
            onBlur={e => e.currentTarget.style.borderColor = "#dddbd6"}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#6b6b63", display: "block", marginBottom: 6 }}>Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Share your feedback, suggestions, or report any issues..."
            rows={8}
            style={{
              width: "100%", padding: "10px 12px",
              border: "1px solid #dddbd6", borderRadius: 10,
              fontSize: 13, lineHeight: 1.6, color: "#1a1a1a",
              background: "#fff", fontFamily: "inherit", resize: "vertical",
              outline: "none", boxSizing: "border-box", minHeight: 160,
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#10b981"}
            onBlur={e => e.currentTarget.style.borderColor = "#dddbd6"}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid #e5e3de",
        background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <button
          onClick={handleSend}
          disabled={!subject.trim() || !message.trim() || sent}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 8,
            background: (subject.trim() && message.trim() && !sent) ? "#10b981" : "#e5e3de",
            color: (subject.trim() && message.trim() && !sent) ? "#fff" : "#a3a39b",
            border: "none", fontSize: 13, fontWeight: 500,
            cursor: (subject.trim() && message.trim() && !sent) ? "pointer" : "default",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          <SendArrow size={14} color={(subject.trim() && message.trim() && !sent) ? "#fff" : "#a3a39b"} />
          {sent ? "Sending..." : "Send feedback"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 14px", background: "transparent",
            color: "#8a8a82", border: "1px solid #dddbd6", borderRadius: 8,
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function FeedbackMessages() {
  const [threads, setThreads] = useState(THREADS);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const selectedThread = threads.find(t => t.id === selectedId) || null;

  const handleSelectThread = (id) => {
    setSelectedId(id);
    setShowNew(false);
    setReplyText("");
    setMobileShowDetail(true);
    setThreads(prev => prev.map(t => t.id === id ? { ...t, hasUnread: false } : t));
  };

  const handleNewToggle = () => {
    setShowNew(!showNew);
    if (!showNew) {
      setSelectedId(null);
      setMobileShowDetail(true);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedId) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      ", " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    setThreads(prev => prev.map(t =>
      t.id === selectedId
        ? { ...t, messages: [...t.messages, { id: "r" + Date.now(), from: "you", name: "Sarah Thompson", date: dateStr, text: replyText.trim() }], lastActivity: "Just now" }
        : t
    ));
    setReplyText("");
  };

  const handleNewSubmit = ({ subject, message }) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      ", " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const newThread = {
      id: "new" + Date.now(),
      subject,
      lastActivity: "Just now",
      hasUnread: false,
      messages: [{ id: "nm" + Date.now(), from: "you", name: "Sarah Thompson", date: dateStr, text: message }],
    };
    setThreads(prev => [newThread, ...prev]);
    setSelectedId(newThread.id);
    setShowNew(false);
  };

  const handleMobileBack = () => {
    setMobileShowDetail(false);
    setShowNew(false);
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 580;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />

      {/* Perspective Toggle */}
      <div style={{
        maxWidth: 740, margin: "0 auto 10px", display: "flex", alignItems: "center", gap: 8,
        justifyContent: "flex-end",
      }}>
        <span style={{ fontSize: 11, color: "#a3a39b" }}>Viewing as:</span>
        <button
          onClick={() => setIsAdmin(false)}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
            background: !isAdmin ? "#d1fae5" : "transparent",
            color: !isAdmin ? "#065f46" : "#8a8a82",
            border: !isAdmin ? "1px solid #a7f3d0" : "1px solid #e5e3de",
          }}
        >
          User
        </button>
        <button
          onClick={() => setIsAdmin(true)}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
            background: isAdmin ? "#dbeafe" : "transparent",
            color: isAdmin ? "#1e40af" : "#8a8a82",
            border: isAdmin ? "1px solid #93c5fd" : "1px solid #e5e3de",
          }}
        >
          Admin
        </button>
      </div>

      <div style={{
        maxWidth: 740,
        margin: "0 auto",
        height: 540,
        border: "1px solid #e5e3de",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        background: "#fff",
      }}>
        {/* Left: Thread List (hide on mobile when detail showing) */}
        {(!isMobile || !mobileShowDetail) && (
          <ThreadList
            threads={threads}
            selectedId={selectedId}
            onSelect={handleSelectThread}
            onNewThread={handleNewToggle}
            showNew={showNew}
            isMobile={isMobile}
            isAdmin={isAdmin}
          />
        )}

        {/* Right: Conversation or New Feedback */}
        {(!isMobile || mobileShowDetail) && (
          showNew ? (
            <NewFeedbackPane
              onSubmit={handleNewSubmit}
              onCancel={() => { setShowNew(false); setMobileShowDetail(false); }}
              isMobile={isMobile}
              onBack={handleMobileBack}
            />
          ) : (
            <ConversationPane
              thread={selectedThread}
              replyText={replyText}
              setReplyText={setReplyText}
              onSend={handleSendReply}
              isMobile={isMobile}
              onBack={handleMobileBack}
              isAdmin={isAdmin}
            />
          )
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
  Play, Trash2, Plus, Terminal, Cpu, Bot, X, Send, Sparkles, 
  FileText, Check, Edit2, File as FileIcon, Download, Eraser, PlayCircle, HelpCircle,
  FolderOpen, Upload, Lock, Wrench
} from 'lucide-react';
import './index.css';

// Use relative path on HuggingFace, but hardcoded port 8000 if running locally via Vite (port 5173)
const API_BASE = window.location.port === '5173' ? 'http://127.0.0.1:8000' : '';

// Helper to parse text containing [[IMAGE:base64...]]
const OutputRenderer = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\[\[IMAGE:.*?\]\])/s);
  
  return (
    <div>
      {parts.map((part, i) => {
        if (part.startsWith('[[IMAGE:') && part.endsWith(']]')) {
          const b64 = part.substring(8, part.length - 2);
          return <img key={i} src={`data:image/png;base64,${b64}`} alt="Plot output" className="output-image" />;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

function App() {
  const [cells, setCells] = useState([
    { id: 1, type: 'markdown', content: '# Welcome to DarkAIs Pro 🚀\nWe now feature **VS Code IntelliSense**, **Persistent Memory**, and **AI Auto-Fix**!', isEditing: false },
    { id: 2, type: 'code', content: 'x = 10\nprint(f"X is {x}")', output: null, error: null, isRunning: false },
    { id: 3, type: 'code', content: '# Testing persistent memory!\nprint(f"I still remember x: {x}")', output: null, error: null, isRunning: false }
  ]);
  
  const [hardware, setHardware] = useState([{ id: 'cpu', name: 'CPU (Intel/AMD)' }]);
  const [selectedHardware, setSelectedHardware] = useState('cpu');
  const [activeMenu, setActiveMenu] = useState(null);
  
  // Security
  const [sessionPassword, setSessionPassword] = useState('');
  
  // Sidebar / File Browser State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // AI State
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([{ sender: 'bot', text: 'Hi! I am the DarkAIs Assistant. How can I help you with your code today?' }]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Initial Fetch
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    
    axios.get(`${API_BASE}/hardware`).then(res => {
      if (res.data.hardware) setHardware(res.data.hardware);
    }).catch(err => console.error(err));
    
    fetchFiles();

    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, isAIChatOpen]);

  // --- File Browser Actions ---
  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/files`);
      setFiles(res.data.files);
    } catch (err) { console.error("Error fetching files", err); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API_BASE}/upload`, formData, { headers: { "Content-Type": "multipart/form-data" }});
      fetchFiles();
    } catch (err) { alert("Upload failed"); }
    e.target.value = null; // reset
  };

  const deleteFile = async (filename) => {
    try {
      await axios.delete(`${API_BASE}/files/${filename}`);
      fetchFiles();
    } catch (err) { alert("Delete failed"); }
  };

  // --- Menu Actions ---
  const handleNewNotebook = () => {
    if (window.confirm("Are you sure you want to clear all cells?")) {
      setCells([{ id: Date.now(), type: 'code', content: '', output: null, error: null, isRunning: false }]);
      axios.post(`${API_BASE}/restart_runtime`, { password: sessionPassword }).catch(() => {});
    }
  };

  const handleRestartRuntime = async () => {
    try {
      const res = await axios.post(`${API_BASE}/restart_runtime`, { password: sessionPassword });
      if (res.data.error) {
        alert(res.data.error);
        return;
      }
      setCells(cells.map(c => ({ ...c, output: null, error: null })));
      alert("Runtime restarted! Variables cleared.");
    } catch(err) { alert("Failed to restart. Incorrect password?"); }
  };

  const handleDownloadPy = () => {
    const code = cells.filter(c => c.type === 'code').map(c => c.content).join('\n\n');
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notebook.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadIpynb = () => {
    const notebook = {
      metadata: {}, 
      nbformat: 4, 
      nbformat_minor: 5,
      cells: cells.map(c => ({
        cell_type: c.type,
        metadata: {},
        source: c.content.split('\n').map(line => line + '\n'),
        outputs: c.type === 'code' && c.output ? [{ output_type: "stream", name: "stdout", text: c.output.split('\n').map(l => l + '\n') }] : [],
        execution_count: c.type === 'code' ? 1 : null
      }))
    };
    const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notebook.ipynb';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunAll = async () => {
    const codeCells = cells.filter(c => c.type === 'code');
    for (const cell of codeCells) {
      await runCell(cell.id);
    }
  };

  // --- Cell Actions ---
  const addCell = (type) => {
    setCells([...cells, { 
      id: Date.now(), type, 
      content: type === 'markdown' ? 'Double click to edit markdown...' : '', 
      output: null, error: null, isRunning: false, isEditing: type === 'markdown'
    }]);
  };

  const deleteCell = (id) => setCells(cells.filter(c => c.id !== id));
  const updateCellContent = (id, newContent) => setCells(cells.map(c => c.id === id ? { ...c, content: newContent } : c));
  const toggleMarkdownEdit = (id, forceState = null) => setCells(cells.map(c => c.id === id ? { ...c, isEditing: forceState !== null ? forceState : !c.isEditing } : c));

  const runCell = async (id) => {
    const cell = cells.find(c => c.id === id);
    if (!cell || !cell.content.trim() || cell.type !== 'code') return;

    setCells(cells.map(c => c.id === id ? { ...c, isRunning: true, output: null, error: null } : c));

    try {
      const res = await axios.post(`${API_BASE}/execute`, { code: cell.content, password: sessionPassword });
      setCells(cells.map(c => c.id === id ? { ...c, isRunning: false, output: res.data.output, error: res.data.error } : c));
    } catch (err) {
      setCells(cells.map(c => c.id === id ? { ...c, isRunning: false, error: 'Connection Error to Backend' } : c));
    }
  };

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    const userText = aiInput;
    setAiInput('');
    setAiMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsAiLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/ai_assist`, { prompt: userText });
      const botReply = res.data.response || res.data.error || "No response received.";
      setAiMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { sender: 'bot', text: 'Error connecting to AI API.' }]);
    }
    setIsAiLoading(false);
  };

  const handleAutoFix = async (cellCode, errorMsg) => {
    setIsAIChatOpen(true);
    const prompt = `My Python code threw an error.\n\nCode:\n\`\`\`python\n${cellCode}\n\`\`\`\n\nError:\n${errorMsg}\n\nPlease provide ONLY the fixed code so I can copy it easily.`;
    
    setAiMessages(prev => [...prev, { sender: 'user', text: `Please fix the error in my code.` }]);
    setIsAiLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/ai_assist`, { prompt });
      const botReply = res.data.response || res.data.error || "No response received.";
      setAiMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { sender: 'bot', text: 'Error connecting to AI API.' }]);
    }
    setIsAiLoading(false);
  };

  return (
    <div>
      {/* Header & Colab Menu */}
      <header className="header-container">
        <div className="header-top">
          <div className="logo-section">
            <button className={`toggle-sidebar-btn ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <FolderOpen size={20} />
            </button>
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo.png" alt="Logo" width="28" height="28" style={{ borderRadius: '4px' }} />
              <span>Dark<span className="text-gradient">AIs</span></span>
            </div>
            <div className="filename">
              <FileIcon size={12} /> Untitled0.ipynb
            </div>
          </div>
          
          <div className="hardware-selector">
            <Lock size={18} color="var(--accent-orange)" title="Execution Password" />
            <input 
              type="password" 
              placeholder="Server Password" 
              value={sessionPassword} 
              onChange={(e) => setSessionPassword(e.target.value)}
              style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', width: '120px' }}
            />
            <Cpu size={18} color="var(--accent-blue)" style={{ marginLeft: '10px' }} />
            <select value={selectedHardware} onChange={(e) => setSelectedHardware(e.target.value)}>
              {hardware.map(hw => (
                <option key={hw.id} value={hw.id}>{hw.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Top Menu Bar */}
        <div className="top-menu">
          <div className={`menu-wrapper ${activeMenu === 'file' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'file' ? null : 'file'); }}>
            <span className="menu-item">File</span>
            {activeMenu === 'file' && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={handleNewNotebook}><FileIcon size={14}/> New Notebook</div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-item" onClick={handleDownloadIpynb}><Download size={14}/> Download .ipynb</div>
                <div className="dropdown-item" onClick={handleDownloadPy}><Download size={14}/> Download .py</div>
              </div>
            )}
          </div>
          <div className={`menu-wrapper ${activeMenu === 'edit' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'edit' ? null : 'edit'); }}>
            <span className="menu-item">Edit</span>
            {activeMenu === 'edit' && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => setCells(cells.map(c => ({ ...c, output: null, error: null })))}><Eraser size={14}/> Clear all outputs</div>
                <div className="dropdown-item" onClick={() => setCells([])}><Trash2 size={14}/> Delete all cells</div>
              </div>
            )}
          </div>
          <div className={`menu-wrapper ${activeMenu === 'insert' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'insert' ? null : 'insert'); }}>
            <span className="menu-item">Insert</span>
            {activeMenu === 'insert' && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => addCell('code')}><Plus size={14}/> Code Cell</div>
                <div className="dropdown-item" onClick={() => addCell('markdown')}><Plus size={14}/> Text Cell</div>
              </div>
            )}
          </div>
          <div className={`menu-wrapper ${activeMenu === 'runtime' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'runtime' ? null : 'runtime'); }}>
            <span className="menu-item">Runtime</span>
            {activeMenu === 'runtime' && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={handleRunAll}><PlayCircle size={14}/> Run all</div>
                <div className="dropdown-item" onClick={handleRestartRuntime}><Cpu size={14}/> Restart runtime</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout (Sidebar + Notebook) */}
      <div className="main-layout">
        
        {/* File Browser Sidebar */}
        {isSidebarOpen && (
          <aside className="sidebar">
            <h3>Workspace Files</h3>
            <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
              <Upload size={16} /> Upload File
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            
            <div className="file-list">
              {files.map(f => (
                <div key={f} className="file-item">
                  <span className="file-name"><FileText size={14}/> {f}</span>
                  <button className="file-delete" onClick={() => deleteFile(f)}><Trash2 size={14}/></button>
                </div>
              ))}
              {files.length === 0 && <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>No files uploaded yet.</span>}
            </div>
          </aside>
        )}

        {/* Notebook Container */}
        <main className="notebook-container">
          <div className="container-inner">
            {cells.map((cell) => (
              <div key={cell.id} className={`cell-container ${cell.type}`}>
                {cell.type === 'code' ? (
                  <>
                    <div className="cell-header">
                      <span className="cell-type-badge"><Terminal size={14}/> Code</span>
                      <div className="cell-actions">
                        <button className="icon-btn play" onClick={() => runCell(cell.id)} disabled={cell.isRunning}>
                          <Play size={18} fill={cell.isRunning ? "currentColor" : "none"} />
                        </button>
                        <button className="icon-btn delete" onClick={() => deleteCell(cell.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="editor-wrapper" style={{ padding: '8px 0', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                      <Editor
                        height="150px"
                        language="python"
                        theme="vs-dark"
                        value={cell.content}
                        onChange={content => updateCellContent(cell.id, content || '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          fontFamily: 'monospace',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          padding: { top: 10, bottom: 10 },
                          scrollbar: { alwaysConsumeMouseWheel: false }
                        }}
                      />
                    </div>
                    
                    {(cell.output || cell.error || cell.isRunning) && (
                      <div className="output-container">
                        {cell.isRunning && <div style={{ color: 'var(--accent-blue)' }}>Executing...</div>}
                        {cell.output && <OutputRenderer text={cell.output} />}
                        {cell.error && (
                          <div className="error-text">
                            <div style={{ marginBottom: '10px' }}>{cell.error}</div>
                            <button className="ai-fix-btn" onClick={() => handleAutoFix(cell.content, cell.error)}>
                              <Wrench size={16} /> 🤖 Fix with AI
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {cell.isEditing ? (
                      <>
                        <div className="cell-header">
                          <span className="cell-type-badge"><FileText size={14}/> Markdown (Edit Mode)</span>
                          <div className="cell-actions">
                            <button className="icon-btn play" onClick={() => toggleMarkdownEdit(cell.id, false)}><Check size={18} /></button>
                            <button className="icon-btn delete" onClick={() => deleteCell(cell.id)}><Trash2 size={18} /></button>
                          </div>
                        </div>
                        <div className="editor-wrapper">
                          <textarea
                            value={cell.content}
                            onChange={(e) => updateCellContent(cell.id, e.target.value)}
                            style={{ width: '100%', minHeight: '100px', background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontFamily: 'monospace', resize: 'vertical' }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="markdown-preview" onDoubleClick={() => toggleMarkdownEdit(cell.id, true)}>
                        <div className="cell-actions" style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.3 }}>
                          <button className="icon-btn edit" onClick={() => toggleMarkdownEdit(cell.id, true)}><Edit2 size={16} /></button>
                          <button className="icon-btn delete" onClick={() => deleteCell(cell.id)}><Trash2 size={16} /></button>
                        </div>
                        <ReactMarkdown>{cell.content}</ReactMarkdown>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            <div className="add-cell-group">
              <button className="add-cell-btn" onClick={() => addCell('code')}><Plus size={18} /> Code</button>
              <button className="add-cell-btn" onClick={() => addCell('markdown')}><Plus size={18} /> Text</button>
            </div>
          </div>
        </main>
      </div>

      {/* AI Assistant */}
      <div className="ai-assistant-wrapper">
        <button className="ai-toggle" onClick={() => setIsAIChatOpen(!isAIChatOpen)}>
          {isAIChatOpen ? <X size={24} /> : <Sparkles size={24} />}
        </button>

        {isAIChatOpen && (
          <div className="ai-chat-window">
            <div className="ai-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bot size={18} color="var(--accent-orange)" /> HuggingFace Copilot</span>
            </div>
            
            <div className="ai-messages">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.sender}`}>{msg.text}</div>
              ))}
              {isAiLoading && <div className="message bot">Thinking...</div>}
              <div ref={messagesEndRef} />
            </div>

            <form className="ai-input-area" onSubmit={handleAiSubmit}>
              <input type="text" placeholder="Ask about your code..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} disabled={isAiLoading} />
              <button type="submit" className="ai-send-btn" disabled={isAiLoading}><Send size={18} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

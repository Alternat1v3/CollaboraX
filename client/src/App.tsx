import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
// ADDED ArrowLeft for mobile chat back button
import { Camera, Users, FolderKanban, LayoutDashboard, LogOut, Plus, Edit2, Trash2, X, Menu, UserPlus, Save, UserX, BookOpen, MessageSquare, Send, ArrowLeft } from 'lucide-react';
// IMPORT SOCKET.IO-CLIENT
import { io, Socket } from 'socket.io-client';
import { showCustomPopup } from './utils/toast';

// API & SOCKET Configuration
const API_BASE_URL = 'http://localhost:8000/api';
// Define your socket server URL
const SOCKET_SERVER_URL = 'http://localhost:8000';

// ----------------------------------------------------------------------
// 1. TYPES/INTERFACES DEFINITIONS
// ----------------------------------------------------------------------

interface User {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface Team {
  _id: string;
  name: string;
  members: User[];
  createdBy: string;
  // ID of the user who created the team
}

interface Project {
  _id: string;
  teamId: string;
  name: string;
  description?: string;
  createdAt: string;
}

type TaskStatus = 'todo' | 'doing' | 'done';
interface Task {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee: string[];
  createdAt: string;
}

// --- NEW CHAT TYPES ---
interface Conversation {
  _id: string;
  members: User[];
  lastMessage?: Message; // Good to have for previews
  updatedAt: string;
}

interface Message {
  _id: string;
  conversationId: string;
  sender: User; // Populated from backend
  content: string;
  createdAt: string;
}
// --- END NEW CHAT TYPES ---

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
// --- NEW: Notification Context ---
interface NotificationContextType {
  unreadCount: number;
  incrementUnread: () => void;
  resetUnread: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);
const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const incrementUnread = useCallback(() => {
    setUnreadCount(prev => prev + 1);
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, incrementUnread, resetUnread }}>
      {children}
    </NotificationContext.Provider>
  );
};
// ----------------------------------------------------------------------
// 2. TOAST SYSTEM (Top-right, auto-hide 1.5s, light-green success tone)
// ----------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}
// NOTE: Make sure the 'Modal' component, 'Task', 'User', and 'TaskStatus' interfaces, and the 'Edit2', 'Trash2', 'X' icons, and 'useAuth', 'useCallback' are imported/defined. They appear to be in the provided file.

interface TaskDetailModalProps {
    task: Task;
    teamMembers: User[];
    onClose: () => void;
    onEdit: (task: Task) => void;
    isTeamCreator: boolean;
    onDelete: (taskId: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
    task, 
    teamMembers, 
    onClose, 
    onEdit, 
    isTeamCreator, 
    onDelete 
}) => {
    // Utility to find a member by ID, using useCallback for stability (already in Tasks component)
    const getAssignee = useCallback((id: string) => teamMembers.find(member => member._id === id), [teamMembers]);
    const { user } = useAuth();

    const assigneeDetails = task.assignee
        .map(getAssignee)
        .filter((member): member is User => member !== undefined);

    const statusMap: Record<TaskStatus, { label: string, color: string }> = {
        todo: { label: 'To Do', color: 'bg-[#00b3ff]/20 text-[#00b3ff] border-[#00b3ff]/30' },
        doing: { label: 'In Progress', color: 'bg-[#ffd166]/20 text-[#ffd166] border-[#ffd166]/30' },
        done: { label: 'Completed', color: 'bg-[#2fe06f]/20 text-[#2fe06f] border-[#2fe06f]/30' },
    };
    const currentStatus = statusMap[task.status];
    
    // Check if current user is an assignee
    const isAssignee = task.assignee.includes(user?._id || '');

    return (
        <Modal title={task.title} onClose={onClose}>
            <div className="space-y-6 text-slate-300">
                <div className="flex justify-between items-center pb-4 border-b border-[#12212b]">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${currentStatus.color}`}>
                        {currentStatus.label}
                    </span>
                    <p className="text-sm text-slate-500">
                        Created: {new Date(task.createdAt).toLocaleDateString()}
                    </p>
                </div>

                <div className="pt-2">
                    <h4 className="text-lg font-semibold text-slate-100 mb-2">Description</h4>
                    <p className="text-slate-400 whitespace-pre-wrap leading-relaxed">{task.description || 'No description provided.'}</p>
                </div>

                <div>
                    <h4 className="text-lg font-semibold text-slate-100 mb-3">Assigned To ({assigneeDetails.length})</h4>
                    {assigneeDetails.length > 0 ? (
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {assigneeDetails.map(member => (
                                <div key={member._id} className="flex items-center gap-3 p-3 bg-[#0a1824] rounded-xl border border-[#12212b]">
                                    <img 
                                        src={member.avatarUrl || `https://ui-avatars.com/api/?name=${member.name}&size=30&background=random&color=fff`} 
                                        alt={member.name} 
                                        className="w-8 h-8 rounded-full object-cover border-2 border-[#2f6bff]" 
                                    />
                                    <div>
                                        <p className="font-medium text-slate-100">{member.name}</p>
                                        <p className="text-sm text-slate-400">{member.email}</p>
                                    </div>
                                    {/* Display 'You' badge if it's the current user */}
                                    {user?._id === member._id && (
                                        <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-[#2fe06f]/20 text-[#2fe06f]">
                                            You
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 italic">This task is not currently assigned to anyone.</p>
                    )}
                </div>
            </div>
            
            {/* Action buttons (Edit/Delete) - only show if user has permission (Creator or Assignee) */}
            {(isTeamCreator || isAssignee) && (
                 <div className="flex gap-3 pt-6 border-t border-[#12212b] mt-6">
                    <button
                        onClick={() => onEdit(task)}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#001426] text-[#00b3ff] py-3 rounded-xl font-semibold hover:bg-[#03151b] transition"
                    >
                        <Edit2 size={18} /> Edit Task
                    </button>
                    {isTeamCreator && (
                        <button
                            onClick={() => onDelete(task._id)}
                            className="w-1/3 flex items-center justify-center gap-2 bg-rose-600 text-white py-3 rounded-xl font-semibold hover:bg-rose-700 transition"
                        >
                            <Trash2 size={18} /> Delete
                        </button>
                    )}
                </div>
            )}
        </Modal>
    );
};
const ToastContext = createContext<ToastContextType | null>(null);
const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  // **FIX**: Wrap showToast in useCallback to stabilize its reference
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${idRef.current++}`;
    setToasts((t) => [...t, { id, message, type }]);
    // Auto remove after 1500ms
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2000);
  }, []);
  // Empty dependency array means it's created once

  const removeToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container (top-right) */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[220px] max-w-sm rounded-lg px-4 py-3 shadow-lg transform transition-all duration-300 ease-out
       ${toast.type === 'success' ? 'bg-gradient-to-r from-[#e9f9e8] to-[#d6f5d0] text-[#05320b]' : ''}
              ${toast.type === 'error' ? 'bg-gradient-to-r from-[#ffe8e8] to-[#ffd0d0] text-[#4b0505]' : ''}
              ${toast.type === 'info' ? 'bg-gradient-to-r from-[#e6f7ff] to-[#d6f0ff] text-[#04253f]' : ''}
              border border-white/5`}
            role="status"
            aria-live="polite"
            onClick={() => removeToast(toast.id)}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium leading-tight">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-sm text-slate-600 hover:text-slate-800 ml-2"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ----------------------------------------------------------------------
// 3. REUSABLE COMPONENTS (Modal)
// ----------------------------------------------------------------------

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[100]">
      <div className="bg-[#0b1220]/80 backdrop-blur-md border border-[#14202b] rounded-2xl shadow-[0_10px_30px_rgba(3,105,161,0.12)] w-full max-w-lg p-6 transform transition-all scale-100 ease-out duration-300">
        <div className="flex justify-between items-center pb-3 border-b border-[#10202b]">
          <h3 className="text-2xl font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// 4. AUTH CONTEXT & PROVIDER
// ----------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | null>(null);
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      const userData = JSON.parse(localStorage.getItem('user') || '{}') as User;
      setUser(userData);
      api.setToken(token);
    }
  }, [token]);
  // **FIX**: Wrap login in useCallback to stabilize its reference
  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(token);
    setUser(userData);
    api.setToken(token);
  }, []);
  // **FIX**: Wrap logout in useCallback to stabilize its reference
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    api.setToken(null);
    window.location.hash = '';
  }, []);
  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

// ----------------------------------------------------------------------
// 5. API SERVICE (Updated with correct types for backend responses)
// ----------------------------------------------------------------------

interface ProjectCreationResponse {
  message: string;
  project: Project;
}

interface ApiService {
  token: string | null;
  setToken: (token: string | null) => void;
  request: (endpoint: string, options?: RequestInit) => Promise<any>;
  auth: {
    register: (data: any) => Promise<any>;
    login: (data: any) => Promise<{ token: string; user: User }>;
  };
  teams: {
    getAll: () => Promise<Team[]>;
    create: (data: { name: string }) => Promise<{ team: Team }>;
    addMember: (teamId: string, email: string) => Promise<{ message: string; team: Team }>;
    removeMember: (teamId: string, memberId: string) => Promise<{ message: string; team: Team }>;
    delete: (teamId: string) => Promise<{ message: string }>;
  };
  projects: {
    getByTeam: (teamId: string) => Promise<Project[]>;
    create: (data: Omit<Project, '_id' | 'createdAt'>) => Promise<ProjectCreationResponse>;
    update: (id: string, data: Partial<Project>) => Promise<Project>;
    delete: (id: string) => Promise<{ message: string }>;
  };
  tasks: {
    getByProject: (projectId: string) => Promise<Task[]>;
    create: (data: Omit<Task, '_id' | 'createdAt'>) => Promise<{ task: Task }>;
    update: (id: string, data: Partial<Task>) => Promise<{ task: Task }>;
    delete: (id: string) => Promise<{ message: string }>;
  };
  users: {
    updateAvatar: (userId: string, avatarUrl: string) => Promise<{ message: string; user: User }>;
  };
  files: {
    upload: (file: File) => Promise<{ fileUrl: string; message: string }>;
  };
  // --- NEW CHAT API METHODS ---
  chat: {
    startConversation: (email: string) => Promise<{ conversation: Conversation }>;
    getConversations: () => Promise<Conversation[]>;
    getMessages: (conversationId: string) => Promise<Message[]>;
    sendMessage: (conversationId: string, content: string) => Promise<{ message: Message }>;
  };
  // --- END NEW CHAT API METHODS ---
}


const api: ApiService = {
  token: localStorage.getItem('token') || null,

  setToken: (token: string | null) => {
    api.token = token;
  },

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(api.token && { Authorization: `Bearer ${api.token}` }),
      ...options.headers,
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      try {
        const error = JSON.parse(text);
        throw new Error(error.message || 'Request failed');
      } catch {
        throw new Error(text || `Request failed with status ${response.status}`);
      }
    }

    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");
    if (response.status === 204 || !isJson) {
      return {};
    }

    return response.json();
  },

  auth: {
    register: (data: any) => api.request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => api.request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  },

  teams: {
    getAll: () => api.request('/teams'),
    create: (data: { name: string }) => api.request('/teams', { method: 'POST', body: JSON.stringify(data) }),
    addMember: (teamId: string, email: string) => api.request(`/teams/${teamId}/add`, { method: 'POST', body: JSON.stringify({ email }) }),
    removeMember:
      (teamId: string, memberId: string) => api.request(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),
    delete: (teamId: string) => api.request(`/teams/${teamId}`, { method: 'DELETE' }),
  },

  projects: {
    getByTeam: (teamId: string) => api.request(`/projects/team/${teamId}`),
    create: (data: Omit<Project, '_id' | 'createdAt'>) => api.request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Project>) => api.request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => api.request(`/projects/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    getByProject: (projectId: string) => api.request(`/tasks/project/${projectId}`),
    create: (data: Omit<Task, '_id' |
      'createdAt'>) => api.request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Task>) => api.request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => api.request(`/tasks/${id}`, { method: 'DELETE' }),
  },

  users: {
    updateAvatar: (userId: string, avatarUrl: string) => api.request(`/users/${userId}/avatar`, { method: 'PATCH', body: JSON.stringify({ avatarUrl }) }),
  },

  files: {
    async upload(file: File) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.token}` },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
  },

  // --- NEW CHAT API IMPLEMENTATION ---
  chat: {
    startConversation: (email: string) => api.request('/chat/start', { method: 'POST', body: JSON.stringify({ email }) }),
    getConversations: () => api.request('/chat/conversations'),
    getMessages: (conversationId: string) => api.request(`/chat/messages/${conversationId}`),
    sendMessage: (conversationId: string, content: string) => api.request('/chat/messages', { method: 'POST', body: JSON.stringify({ conversationId, content }) }),
  },
  // --- END NEW CHAT API IMPLEMENTATION ---
} as unknown as ApiService;

// ----------------------------------------------------------------------
// 6. COMPONENTS
// ----------------------------------------------------------------------

// Login/Register Component
const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const response = await api.auth.login({ email: formData.email, password: formData.password });
        login(response.token, response.user);
        window.location.hash = 'dashboard';
      } else {
        await api.auth.register(formData);
        setIsLogin(true);
        setError('Registration successful! Please login.');
        showToast('Registration successful! Please login.', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'An unknown error occurred';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04111a] to-[#071023] flex items-center justify-center p-4">
      <div className="bg-[#07121a] border border-[#0f1b27] rounded-3xl shadow-[0_20px_50px_rgba(3,105,161,0.14)] w-full max-w-md p-10">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] bg-clip-text text-transparent tracking-tight">
            CollaboraX
          </h1>
          <p className="text-slate-300 mt-2 text-lg">Collaborate. Create. Conquer.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-5 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none transition"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-5 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none transition"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-5 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none transition"
            required
          />

          {error && (
            <div className={`text-sm py-2 px-3 rounded-lg ${error.includes('successful') ?
              'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white py-3 rounded-xl font-semibold text-lg shadow-[0_10px_30px_rgba(47,107,255,0.18)] hover:shadow-[0_12px_36px_rgba(0,179,255,0.22)] transition duration-300 disabled:opacity-50"
          >
            {loading ?
              'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#7dd3fc] hover:text-[#a3eaff] font-medium transition"
          >
            {isLogin ?
              "Don't have an account? Register Now" : 'Already have an account?Sign In'}
          </button>
        </div>
        <div className="text-center mt-6 text-slate-400 text-sm">
  Created by{" "}
  <a
    href="https://github.com/Alternat1v3"
    target="_blank"
    rel="noopener noreferrer"
    className="text-cyan-400 hover:text-cyan-600 underline-offset-0 transition"
  >
    Alternative
  </a>
</div>
      </div>
      
    </div>
  );
};

// Dashboard Component
const Dashboard: React.FC<{ teams: Team[], projects: Project[], tasks: Task[] }> = ({ teams, projects, tasks }) => {
  const todoTasks = tasks.filter((t: Task) => t.status === 'todo').length;
  const doingTasks = tasks.filter((t: Task) => t.status === 'doing').length;
  const doneTasks = tasks.filter((t: Task) => t.status === 'done').length;
  const stats = [
    { label: 'Total Teams', value: teams.length, icon: Users, color: 'text-[#00b3ff]', bg: 'bg-[#05232b]' },
    { label: 'Total Projects', value: projects.length, icon: FolderKanban, color: 'text-[#7c5cff]', bg: 'bg-[#0b1220]' },
    { label: 'Total Tasks', value: tasks.length, icon: LayoutDashboard, color: 'text-[#2fe0c1]', bg: 'bg-[#05232b]' },
    { label: 'Completed Tasks', value: doneTasks, icon: Save, color: 'text-[#2fe06f]', bg: 'bg-[#05232b]' },
  ];
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold text-slate-100">Overview Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-[#07131a]/80 rounded-2xl shadow-[0_8px_30px_rgba(2,6,23,0.6)] p-6 border border-[#10202b] hover:shadow-[0_12px_40px_rgba(0,179,255,0.06)] transition duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${stat.bg} ring-1 ring-[#0ea5e9]/20`}>
                <stat.icon size={24} className={`${stat.color}`} />
              </div>
              <span className="text-3xl font-extrabold text-slate-100">{stat.value}</span>
            </div>
            <h3 className="text-slate-400 font-medium text-lg">{stat.label}</h3>
          </div>
        ))}
      </div>

      <div className="bg-[#07131a]/80 rounded-2xl shadow-[0_10px_30px_rgba(2,6,23,0.6)] p-8 border border-[#10202b]">
        <h3 className="text-2xl font-semibold text-slate-100 mb-6">Task Progress</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">To Do</span>
            <span className="font-bold text-[#00b3ff]">{todoTasks} tasks</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">In Progress</span>
            <span className="font-bold text-[#ffd166]">{doingTasks} tasks</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Completed</span>
            <span className="font-bold text-[#2fe06f]">{doneTasks} tasks</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Team Members Modal Content
const TeamMembersModal: React.FC<{ team: Team, onClose: () => void, setTeams: React.Dispatch<React.SetStateAction<Team[]>> }> = ({ team, onClose, setTeams }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [memberEmail, setMemberEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const isTeamCreator = user?._id === team.createdBy;
  const updateTeamInState = useCallback((updatedTeam: Team) => {
    setTeams(prevTeams =>
      prevTeams.map(t => (t._id === updatedTeam._id ? updatedTeam : t))
    );
  }, [setTeams]);
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.teams.addMember(team._id, memberEmail);
      showToast(`Member ${memberEmail} added successfully!`, 'success');
      updateTeamInState(response.team);
      setMemberEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'Failed to add member. (Check if you are the team creator)';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    // Replaced window.confirm
    showToast(`Feature not fully implemented: Remove ${memberName}`, 'info');
    console.warn("window.confirm removed. Implement custom modal for confirmation.");
    // if (!window.confirm(`Are you sure you want to remove ${memberName} from the team?`)) return;
    setLoading(true);

    try {
      await api.teams.removeMember(team._id, memberId);
      const updatedMembers = team.members.filter(m => m._id !== memberId);
      const updatedTeam: Team = { ...team, members: updatedMembers };
      updateTeamInState(updatedTeam);
      showToast(`${memberName} removed successfully.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'Failed to remove member. (Check if you are the team creator)';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={`${team.name} Members`} onClose={onClose}>
      <div className="space-y-4">
        <div className="max-h-60 overflow-y-auto pr-2 border-b pb-4">
          {team.members.map((member) => {
            const isCreator = member._id === team.createdBy;
            const isCurrentUser = user?._id === member._id;
            const canRemove = isTeamCreator && !isCurrentUser;
            return (
              <div key={member._id} className="flex items-center justify-between p-3 mb-2 bg-[#06121a] rounded-lg border border-[#0f1b27]">
                <div className='flex items-center'>
                  <img
                    src={member.avatarUrl || `https://ui-avatars.com/api/?name=${member.name}&background=random&color=fff`}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover mr-4"
                  />
                  <div className="flex flex-col">
                    <p className="font-semibold text-slate-100 flex items-center gap-2">
                      {member.name}
                      {isCreator && <span className="text-xs font-bold text-[#7c5cff] bg-[#221d35] px-2 py-0.5 rounded-full">Creator</span>}
                      {isCurrentUser && <span className="text-xs font-bold text-[#00b3ff] bg-[#021426] px-2 py-0.5 rounded-full">You</span>}
                    </p>
                    <p className="text-sm text-slate-400">{member.email}</p>
                  </div>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleRemoveMember(member._id, member.name)}
                    disabled={loading}
                    className="text-rose-400 hover:text-white hover:bg-rose-500 p-2 rounded-full transition disabled:opacity-50 disabled:bg-[#07121a]"
                    title={`Remove ${member.name}`}
                  >
                    <UserX size={20} />
                  </button>
                )}
              </div>
            );
          })}
          {team.members.length === 0 && (
            <p className="text-slate-400 italic text-center py-4">No members in this team yet.</p>
          )}
        </div>

        {isTeamCreator && (
          <form onSubmit={handleAddMember} className="pt-4 flex gap-2">
            <input
              type="email"
              placeholder="Member Email to Add"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="flex-grow px-4 py-2 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading || !memberEmail.includes('@')}
              className="bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white px-4 py-2 rounded-xl hover:brightness-105 transition flex items-center gap-1 disabled:opacity-50"
            >
              {loading ?
                'Adding...' : <><UserPlus size={18} /> Add</>}
            </button>
          </form>
        )}

      </div>
    </Modal>
  );
};


// Teams Component
const Teams: React.FC<{ teams: Team[], setTeams: React.Dispatch<React.SetStateAction<Team[]>>, onSelectTeam: (team: Team) => void }> = ({ teams, setTeams, onSelectTeam }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  // --- FIX: Store only the ID, not the whole object ---
  const [membersModalTeamId, setMembersModalTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { team } = await api.teams.create({ name: teamName });
      setTeams(prev => [...prev, team]);
      setTeamName('');
      setShowCreateModal(false);
      showToast('Team created successfully!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'An unknown error occurred';
      showToast(msg, 'error');
    }
  };
  const handleDeleteTeam = async (team: Team) => {
    // Replaced window.confirm
    showToast(`Feature not fully implemented: Delete ${team.name}`, 'info');
    console.warn("window.confirm removed. Implement custom modal for confirmation.");
    // if (!window.confirm(`WARNING: This will delete the team "${team.name}" and ALL its projects and tasks. Are you absolutely sure?`)) {
    //   return;
    // }

    try {
      await api.teams.delete(team._id);
      showToast(`Team "${team.name}" deleted successfully.`, 'success');
      // **FIX**: Removed local state update. Socket handler 'handleTeamDeleted' will manage state.
      // setTeams(prevTeams => prevTeams.filter(t => t._id !== team._id));
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'Failed to delete team.';
      showToast(msg, 'error');
    }
  };
  // --- FIX: Find the live team from the 'teams' prop ---
  const modalTeam = teams.find(t => t._id === membersModalTeamId);
  return (
    <div className="space-y-8">
      {/* --- RESPONSIVE HEADER FIX --- */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-100">Team Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          // **FIX**: Added w-full md:w-auto and justify-center
          className="w-full md:w-auto justify-center bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white px-6 py-3 rounded-xl font-semibold shadow-[0_10px_30px_rgba(47,107,255,0.18)] hover:shadow-[0_14px_40px_rgba(47,107,255,0.22)] transition flex items-center gap-2"
        >
          <Plus size={20} /> Create New Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team: Team) => {
          const isCreator = user?._id === team.createdBy;

          return (
            <div
              key={team._id}
              className="bg-[#07131a] rounded-2xl shadow-[0_12px_30px_rgba(2,6,23,0.6)] p-6 border border-[#10202b] hover:shadow-[0_18px_50px_rgba(0,179,255,0.06)] transition duration-300"
            >
              <h3 className="text-2xl font-semibold text-slate-100 mb-2">{team.name}</h3>
              <p className="text-slate-400 mb-4">{team.members.length} members</p>

              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={() => onSelectTeam(team)}
                  className="w-full bg-[#0b1f2a] text-[#00b3ff] py-2 rounded-xl font-medium hover:bg-[#08202a] transition flex items-center justify-center gap-2"
                >
                  <FolderKanban size={18} /> View Projects
                </button>

                <div className="flex gap-3">
                  <button
                    // --- FIX: Set the ID, not the object ---
                    onClick={() => setMembersModalTeamId(team._id)}
                    className="flex-1 bg-[#071419] text-slate-200 py-2 rounded-xl font-medium hover:bg-[#0a1c23] transition flex items-center justify-center gap-2"
                  >
                    <Users size={18} /> Members
                  </button>

                  {isCreator && (
                    <button
                      onClick={() => handleDeleteTeam(team)}
                      title="Delete Team"
                      className="p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition flex items-center justify-center"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {teams.length === 0 && (
          <div className="md:col-span-3 text-center py-10 bg-[#07131a] rounded-2xl shadow-[0_8px_30px_rgba(2,6,23,0.6)] border border-[#10202b]">
            <p className="text-slate-400 text-lg">
              You are not a member of any team yet. Create one above!
            </p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <Modal title="Create New Team" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <input
              type="text"
              placeholder="Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none"
              required
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white py-3 rounded-xl font-semibold hover:brightness-105 transition"
            >
              Create Team
            </button>
          </form>
        </Modal>
      )}

      {/* --- FIX: Render using the 'modalTeam' (the live one) --- */}
      {modalTeam && (
        <TeamMembersModal
          team={modalTeam}
          onClose={() => setMembersModalTeamId(null)}
          setTeams={setTeams}
        />
      )}
    </div>
  );
};

// Projects Component
const Projects: React.FC<{ selectedTeam: Team, projects: Project[], setProjects: React.Dispatch<React.SetStateAction<Project[]>>, onSelectProject: (project: Project) => void }> = ({ selectedTeam, projects, onSelectProject }) => {
  const { showToast } = useToast();
  const { user } = useAuth(); // Get current user
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project |
    null>(null);
  const [formData, setFormData] = useState<Omit<Project, '_id' |
    'createdAt'>>({
    teamId: selectedTeam._id,
    name: '',
    description: '',
  });
  // **NEW**: Check if the current user is the team creator
  const isTeamCreator = user?._id === selectedTeam.createdBy;
  useEffect(() => {
    if (editingProject) {
      setFormData({
        teamId: editingProject.teamId,
        name: editingProject.name,
        description: editingProject.description || '',
      });
    } else {
      setFormData({
        teamId: selectedTeam._id,
        name: '',
        description: '',
      });
    }
  }, [editingProject, selectedTeam._id]);

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setShowModal(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProject) {
        // 1. CALL API (No local state update)
        await api.projects.update(editingProject._id, formData);
        showToast('Project updated.', 'success');
      } else {
        // 2. CALL API (No local state update)
        await api.projects.create(formData);
        showToast('Project created.', 'success');
      }
      
      // 3. Close modal
      setShowModal(false);
      setEditingProject(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'An unknown error occurred';
      showToast(msg, 'error');
    }
  };
  const handleDelete = async (id: string) => {
    // Replaced window.confirm
    showToast(`Feature not fully implemented: Delete project`, 'info');
    console.warn("window.confirm removed. Implement custom modal for confirmation.");
    // if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await api.projects.delete(id);
        // **FIX**: Removed local state update. Socket handler 'handleProjectDeleted' will manage state.
        // const updatedProjects = projects.filter((p: Project) => p._id !== id);
        // setProjects(updatedProjects);
        showToast('Project deleted.', 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ?
          err.message : 'An unknown error occurred';
        showToast(msg, 'error');
      }
    // }
  };
  return (
    <div className="space-y-8">
      {/* --- RESPONSIVE HEADER FIX --- */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-100">{selectedTeam.name} - Projects</h2>
        
        {/* **NEW**: Only show Create Project button to Team Creator */}
        {isTeamCreator && (
          <button
            onClick={() => {
              setEditingProject(null);
              setShowModal(true);
            }}
            // **FIX**: Added w-full md:w-auto and justify-center
            className="w-full md:w-auto justify-center bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white px-4 py-2 md:px-6 md:py-3 
rounded-xl font-semibold 
shadow-[0_10px_30px_rgba(47,107,255,0.18)] hover:shadow-[0_14px_40px_rgba(47,107,255,0.22)] transition flex items-center gap-2"
          >
            <Plus size={20} /> Create Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project: Project) => (
          <div
            key={project._id}
            className="bg-[#07131a] 
rounded-2xl shadow-[0_12px_30px_rgba(2,6,23,0.6)] 
p-6 border border-[#10202b] hover:shadow-[0_18px_50px_rgba(0,179,255,0.06)] transition duration-300"
          >
            <h3 className="text-2xl font-semibold text-slate-100 mb-2">{project.name}</h3>
            <p className="text-slate-400 mb-4">{project.description ||
              'No description provided.'}</p>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#0e1b24]">
              <button
                onClick={() => onSelectProject(project)}
                className="bg-[#0b1f2a] text-[#00b3ff] py-2 px-4 rounded-xl font-medium hover:bg-[#08202a] transition flex items-center gap-2 text-sm"
              >
                <LayoutDashboard size={16} /> View Tasks
              </button>
              
              {/* **NEW**: Only show Edit/Delete buttons to Team Creator */}
              {isTeamCreator && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(project)}
                    className="p-2 text-slate-300 
hover:text-[#00b3ff] transition"
                    title="Edit Project"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(project._id)}
                    className="p-2 text-slate-300 hover:text-rose-400 transition"
                    title="Delete Project"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="md:col-span-3 text-center py-10 bg-[#07131a] rounded-2xl shadow-[0_8px_30px_rgba(2,6,23,0.6)] border border-[#10202b]">
            <p className="text-slate-400 text-lg">
              No projects in this team yet. {isTeamCreator ? "Create one!"
                : ""}
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editingProject ? 'Edit Project' : 'Create New Project'}
          onClose={() => {
            setShowModal(false);
            setEditingProject(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Project Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none"
              required
            />
            <textarea
              placeholder="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none h-32"
            />
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white py-3 rounded-xl font-semibold hover:brightness-105 transition"
              >
                {editingProject ?
                  'Update Project' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingProject(null);
                }}
                className="flex-1 bg-[#0f1a22] text-slate-200 py-3 rounded-xl font-semibold hover:bg-[#0b242c] transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
// Tasks Component
const Tasks: React.FC<{ selectedProject: Project, selectedTeam: Team, tasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>>, teamMembers: User[] }> = ({ selectedProject, selectedTeam, tasks, setTasks, teamMembers }) => {
  const { showToast } = useToast();
  const { user } = useAuth(); // Get current user
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null); // **NEW STATE**

  const [formData, setFormData] = useState<Omit<Task, '_id' | 'createdAt'>>({
    projectId: selectedProject._id,
    title: '',
    description: '',
    status: 'todo',
    assignee: [],
  });
  // **NEW**: Check if the current user is the team creator
  const isTeamCreator = user?._id === selectedTeam.createdBy;

  useEffect(() => {
    if (editingTask) {
      setFormData({
        projectId: editingTask.projectId,
        title: editingTask.title,
        description: editingTask.description || '',
        status: editingTask.status,
        assignee: editingTask.assignee,
      });
    } else {
      setFormData({
        projectId: selectedProject._id,
        title: '',
        description: '',
        status: 'todo',
        assignee: [],
      });
    }
  }, [editingTask, selectedProject._id]);

  // Utility function to get assignee details by ID
  const getAssignee = useCallback((id: string) => teamMembers.find(member => member._id === id), [teamMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await api.tasks.update(editingTask._id, formData);
        showToast('Task updated.', 'success');
      } else {
        await api.tasks.create(formData);
        showToast('Task created.', 'success');
      }
      setShowModal(false);
      setEditingTask(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred';
      showToast(msg, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    // Replaced window.confirm
    showToast(`Feature not fully implemented: Delete task`, 'info');
    console.warn("window.confirm removed. Implement custom modal for confirmation.");
    // if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.tasks.delete(id);
        // setTasks(prev => prev.filter((t: Task) => t._id !== id));
        showToast('Task deleted.', 'success');
        setViewingTask(null); // **MODIFICATION: Close detail modal after delete**
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'An unknown error occurred';
        showToast(msg, 'error');
      }
    // }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: TaskStatus) => {
    if (!draggedTask) return;

    if (draggedTask.status !== newStatus) {
      try {
        const updatedTaskLocal = { ...draggedTask, status: newStatus };
        setTasks(prev => prev.map((t) => t._id === draggedTask._id ? updatedTaskLocal : t));
        await api.tasks.update(draggedTask._id, { status: newStatus });
        showToast('Task status updated.', 'success');
      } catch (err: unknown) {
        const msg = 'Failed to update task status. Restoring tasks.';
        showToast(msg, 'error');
        // Re-fetch tasks on failure to restore local state (optional but good practice)
        const currentTasks = await api.tasks.getByProject(selectedProject._id);
        setTasks(currentTasks);
      }
    }
    setDraggedTask(null);
  };

  const columns: { id: TaskStatus, title: string, bg: string, color: string }[] = [
    { id: 'todo', title: 'To Do', bg: 'bg-[#08121a]', color: 'text-slate-300' },
    { id: 'doing', title: 'In Progress', bg: 'bg-[#0a121f]', color: 'text-slate-300' },
    { id: 'done', title: 'Done', bg: 'bg-[#05131a]', color: 'text-slate-300' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-slate-100">{selectedProject.name} Tasks</h2>
        {isTeamCreator && (
          <button
            onClick={() => { setShowModal(true); setEditingTask(null); }}
            className="bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white px-5 py-2 rounded-xl font-semibold hover:brightness-105 transition flex items-center gap-2 shadow-[0_5px_15px_rgba(47,107,255,0.1)]"
          >
            <Plus size={20} /> New Task
          </button>
        )}
      </div>
<p className="text-slate-400 text-sm flex items-center gap-2 italic mt-1">
  <span className="text-cyan-400">⤳</span>
  Hold & drag tasks to move them between statuses.
</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(column => (
          <div
            key={column.id}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
            className={`${column.bg} rounded-2xl shadow-[0_10px_30px_rgba(2,6,23,0.6)] p-4 border border-[#10202b]`}
          >
            <h3 className={`text-xl font-semibold mb-4 border-b pb-2 ${column.color}`}>{column.title} ({tasks.filter(t => t.status === column.id).length})</h3>
            <div className="space-y-4 min-h-[50px]">
              {tasks
                .filter(task => task.status === column.id)
                .map((task: Task) => (
                  <div 
                    key={task._id} 
                    draggable 
                    onDragStart={() => handleDragStart(task)} 
                    // **MODIFICATION: Added onClick to open detail modal**
                    onClick={(e) => { 
                        if (draggedTask) return;
                        setViewingTask(task);
                        e.stopPropagation();
                    }}
                    className="bg-[#07131a] rounded-xl shadow-[0_8px_20px_rgba(2,6,23,0.6)] p-4 border border-[#0e1b24] cursor-pointer hover:shadow-[0_12px_30px_rgba(0,179,255,0.06)] transition duration-200" 
                  >
                    <h4 className="font-semibold text-slate-100 mb-2">{task.title}</h4>
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">{task.description}</p>
                    
                    {/* Display Assignees' Avatars */}
                    {task.assignee.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.assignee.map(id => {
                          const member = getAssignee(id);
                          return member ? (
                            <img 
                              key={id} 
                              src={member.avatarUrl || `https://ui-avatars.com/api/?name=${member.name}&size=20&background=random&color=fff`} 
                              alt={member.name} 
                              className="w-5 h-5 rounded-full object-cover border-2 border-[#07131a] shadow-sm" 
                              title={member.name} 
                            />
                          ) : null;
                        })}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#0e1b24]">
                      <p className="text-xs text-slate-500">Created: {new Date(task.createdAt).toLocaleDateString()}</p>
                      
                      {/* **MODIFICATION: Removed Edit button from card, kept Delete for convenience/creator** */}
                      {isTeamCreator && (
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(task._id); }} 
                            title="Delete Task" 
                            className="p-1 bg-rose-600/30 text-rose-300 rounded-lg hover:bg-rose-600 hover:text-white transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {tasks.filter(t => t.status === column.id).length === 0 && (
                <p className="text-center text-slate-500 italic py-4">No tasks in this column.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* **NEW MODAL RENDERING** */}
      {viewingTask && (
          <TaskDetailModal 
              task={viewingTask} 
              teamMembers={teamMembers} 
              isTeamCreator={isTeamCreator}
              onClose={() => setViewingTask(null)}
              // This function switches from detail view to edit view
              onEdit={(task) => {
                  setViewingTask(null); // Close detail modal
                  setEditingTask(task); // Set task for edit
                  setShowModal(true);   // Open edit modal
              }}
              // Pass the existing delete handler
              onDelete={handleDelete}
          />
      )}

      {/* EXISTING EDIT/CREATE MODAL */}
      {showModal && (
        <Modal
          title={editingTask ? 'Edit Task' : 'Create New Task'}
          onClose={() => {
            setShowModal(false);
            setEditingTask(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Task Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none"
              required
            />
            <textarea
              placeholder="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none h-24"
            />
            
            {/* Task Status Selector */}
            <div className="flex gap-4">
                <label className="text-slate-300 font-medium">Status:</label>
                <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="flex-grow px-3 py-2 rounded-lg border border-[#12212b] bg-[#071419] text-slate-200 focus:ring-2 focus:ring-[#0ea5e9] outline-none"
                >
                    <option value="todo">To Do</option>
                    <option value="doing">In Progress</option>
                    <option value="done">Done</option>
                </select>
            </div>

            {/* Assignee Selector */}
            {teamMembers.length > 0 && (
                <div className="pt-2 max-h-40 overflow-y-auto border border-[#12212b] p-3 rounded-xl bg-[#071419] space-y-2">
                    <label className="text-slate-300 font-medium block pb-1 border-b border-[#12212b]">Assign Members:</label>
                    {teamMembers.map(member => (
                        <label key={member._id} className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.assignee.includes(member._id)}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        assignee: e.target.checked ?
                                            [...prev.assignee, member._id] : prev.assignee.filter(id => id !== member._id),
                                    }));
                                }}
                                className="
                                    appearance-none
                                    h-5 w-5
                                    border border-[#1b2a38]
                                    rounded-full
                                    bg-[#0b1620]
                                    checked:bg-[#24b5e0]
                                    checked:border-[#24b5e0]
                                    cursor-pointer
                                    transition
                                    duration-200
                                    ease-in-out
                                    focus:ring-2
                                    focus:ring-[#26bdeb]
                                    focus:outline-none
                                "
                            />
                            <span className="text-slate-200">{member.name} ({member.email})</span>
                        </label>
                    ))}
                </div>
            )}
            
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white py-3 rounded-xl font-semibold hover:brightness-105 transition"
                >
                    {editingTask ? 'Update Task' : 'Create Task'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setShowModal(false);
                        setEditingTask(null);
                    }}
                    className="flex-1 bg-[#0f1a22] text-slate-200 py-3 rounded-xl font-semibold hover:bg-[#0b242c] transition"
                >
                    Cancel
                </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
// Profile Component
const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
    } else {
      setAvatarFile(null);
    }
  };
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarFile || !user) return;
    setLoading(true);
    try {
      const uploadResponse = await api.files.upload(avatarFile);
      const newAvatarUrl = uploadResponse.fileUrl;
      const updateResponse = await api.users.updateAvatar(user._id, newAvatarUrl);
      const updatedUser: User = { ...user, avatarUrl: updateResponse.user.avatarUrl };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      showToast('Avatar updated successfully!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ?
        err.message : 'Failed to upload/update avatar.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-8 max-w-xl">
      <h2 className="text-3xl font-semibold text-slate-100">User Profile</h2>
      <div className="bg-[#07131a] rounded-2xl shadow-[0_12px_30px_rgba(2,6,23,0.6)] p-6 border border-[#10202b] space-y-4">
        <div className="flex items-center space-x-6">
          <img
            className="h-24 w-24 rounded-full object-cover border-4 border-[#0b2430]"
            src={avatarUrl || `https://ui-avatars.com/api/?name=${user?.name}&background=random&color=fff`}
            alt="User Avatar"
          />
          <div>
            <p className="text-2xl font-semibold text-slate-100">{user?.name}</p>
            <p className="text-slate-400">{user?.email}</p>
          </div>
        </div>
        <h3 className="text-xl font-semibold border-t pt-4 text-slate-100">Update Profile Picture</h3>
        <form onSubmit={handleUpload} className="space-y-3">
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#001426] file:text-[#00b3ff] hover:file:bg-[#001826]"
          />
          <button
            type="submit"
            disabled={!avatarFile || loading}
            className="w-full bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white py-3 rounded-xl font-semibold hover:brightness-105 transition disabled:opacity-50"
          >
            {loading ?
              'Uploading...' : 'Set New Avatar'}
          </button>
        </form>
      </div>
    </div>
  );
};

// **NEW**: Guide Modal Component
const GuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <Modal title="Welcome to CollaboraX!" onClose={onClose}>
      <div className="space-y-4 text-slate-300 max-h-[70vh] overflow-y-auto pr-2">
        <p>
          CollaboraX is your all-in-one hub for real-time collaboration. Manage your teams, organize projects, and track tasks from start to finish.
        </p>
        
        <h4 className="text-lg font-semibold text-slate-100 pt-2">🚀 Getting Started</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>Create an Account:</strong> You must register with your full name, email, and password to use the app.</li>
          <li><strong>Sign In:</strong> If you already have an account, you can log in using your email and password.</li>
        </ul>

        <h4 className="text-lg font-semibold text-slate-100 pt-2">👥 Team Management</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>Create Teams:</strong> You can create new teams, which automatically makes you the Team Creator.</li>
          <li><strong>Add Members:</strong> As a Team Creator, you can add members to your team by entering their email address.</li>
          <li className="pl-4 bg-[#0f1b27] border-l-2 border-yellow-400 py-2 rounded-r-md">
            <strong>Important Rule:</strong> You can only add users who already have an account on CollaboraX.
            If you want to add someone, they must register first.
          </li>
          <li><strong>Remove Members:</strong> Only the Team Creator has the permission to remove members from a team.</li>
          <li><strong>Delete Teams:</strong> Only the Team Creator can delete a team.</li>
          <li className="pl-4 bg-[#0f1b27] border-l-2 border-rose-500 py-2 rounded-r-md">
            <strong>WARNING:</strong> Deleting a team is permanent.
            It will also delete all projects and all tasks inside that team.
          </li>
        </ul>

        <h4 className="text-lg font-semibold text-slate-100 pt-2">🗂️ Project Workflow</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>View Projects:</strong> Select any team to see all the projects associated with it.</li>
          <li><strong>Create Projects:</strong> Inside a team, only the Team Creator can create multiple projects, each with a name and an optional description.</li>
          <li><strong>Manage Projects:</strong> Only the Team Creator can edit or delete projects from the project dashboard.</li>
        </ul>

        <h4 className="text-lg font-semibold text-slate-100 pt-2">✅ Task Board</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>Kanban Board:</strong> Each project has its own task board with three statuses: 'To Do', 'In Progress', and 'Completed'.</li>
          <li><strong>Drag & Drop:</strong> You can easily update a task's status by dragging and dropping it from one column to another.</li>
          <li><strong>Assign Members:</strong> When a Team Creator creates or edits a task, they can assign it to one or more members of the team.</li>
          <li><strong>Task Details:</strong> Each task includes a title, description, and a list of its assigned members.</li>
        </ul>

        {/* --- NEW CHAT SECTION --- */}
        <h4 className="text-lg font-semibold text-slate-100 pt-2">💬 Inbox & Chat</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>Direct Messages:</strong> Go to the "Inbox" to start private, one-on-one chats with other users.</li>
          <li><strong>Start a Chat:</strong> Enter a user's registered email address in the search bar to find them and start a conversation.</li>
          <li><strong>Real-Time:</strong> Messages are sent and received instantly without needing to refresh the page.</li>
        </ul>
        {/* --- END NEW CHAT SECTION --- */}


        <h4 className="text-lg font-semibold text-slate-100 pt-2">👤 Your Profile</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>View Your Info:</strong> You can navigate to the "Profile" page to see your name and email address.</li>
          <li><strong>Update Avatar:</strong> You can upload a custom profile picture (avatar) at any time.</li>
        </ul>

        <h4 className="text-lg font-semibold text-slate-100 pt-2">⚡ Live Updates</h4>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>No Refresh Needed:</strong> This application is powered by a live connection.
            When a teammate creates a new task, adds a member, or sends you a message, you will see the changes on your screen instantly.</li>
        </ul>
      </div>
    </Modal>
  );
};

// ----------------------------------------------------------------------
// 7. NEW CHAT COMPONENTS
// ----------------------------------------------------------------------

// Component for the right-hand side chat window
const ChatWindow: React.FC<{
  conversation: Conversation;
  messages: Message[];
  onBack: () => void; // MODIFIED: onBack is now mandatory
}> = ({ conversation, messages, onBack }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherUser = conversation.members.find(m => m._id !== user?._id);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-slate-500">Error: Could not find other user in conversation.</p>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      // API call will trigger socket event, no local state update needed here
      await api.chat.sendMessage(conversation._id, newMessage);
      setNewMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07131a] md:rounded-r-2xl border-l border-[#10202b]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[#10202b] shadow-sm">
        {/* MODIFIED: Add Back Button for mobile */}
        <button onClick={onBack} className="text-slate-300 p-1 -ml-1 rounded-full hover:bg-[#0a1824] md:hidden">
          <ArrowLeft size={20} />
        </button>
        <img
          src={otherUser.avatarUrl || `https://ui-avatars.com/api/?name=${otherUser.name}&size=40&background=random&color=fff`}
          alt={otherUser.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="overflow-hidden">
          <h3 className="text-lg font-semibold text-slate-100 truncate">{otherUser.name}</h3>
          <p className="text-sm text-slate-400 truncate">{otherUser.email}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender._id === user?._id;
          return (
            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-3 max-w-xs md:max-w-md ${isMe ? 'flex-row-reverse' : ''}`}>
                <img
                  src={msg.sender.avatarUrl || `https://ui-avatars.com/api/?name=${msg.sender.name}&size=32&background=random&color=fff`}
                  alt={msg.sender.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div
                  className={`px-4 py-3 rounded-xl ${isMe ? 'bg-[#002840] text-slate-100 rounded-br-none' : 'bg-[#0a1824] text-slate-200 rounded-bl-none border border-[#12212b]'}`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-xs mt-2 ${isMe ? 'text-slate-400 text-right' : 'text-slate-500'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#10202b]">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none transition"
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="p-3 bg-gradient-to-r from-[#00b3ff] to-[#2f6bff] text-white rounded-xl hover:brightness-105 transition disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};


// Component for the left-hand side conversation list
const ConversationList: React.FC<{
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  onSelect: (conversation: Conversation) => void;
  selectedConversationId?: string | null;
  unreadCounts: Record<string, number>; // ADDED: unreadCounts prop
}> = ({ conversations, setConversations, onSelect, selectedConversationId, unreadCounts }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim() || !searchEmail.includes('@')) {
      showToast('Please enter a valid email.', 'error');
      return;
    }
    if (searchEmail === user?.email) {
      showToast("You can't start a chat with yourself.", 'info');
      return;
    }

    setLoading(true);
    try {
      const { conversation } = await api.chat.startConversation(searchEmail);
      
      // Check if conversation already exists in our state
      const existing = conversations.find(c => c._id === conversation._id);
      if (!existing) {
        // Add new conversation to the top
        setConversations(prev => [conversation, ...prev]);
      } else {
        // If it exists, just re-order
        setConversations(prev => [conversation, ...prev.filter(c => c._id !== conversation._id)]);
      }
      
      onSelect(conversation); // Select it
      setSearchEmail('');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start conversation';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Sort conversations by most recent message
  const sortedConversations = [...conversations].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    // MODIFIED: Removed responsive width, parent now controls it
    <div className="w-full h-full flex flex-col border-r border-[#10202b] bg-[#07131a] md:rounded-l-2xl">
      {/* Header & Search */}
      <div className="p-4 border-b border-[#10202b]">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4">Inbox</h2>
        <form onSubmit={handleStartChat}>
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            disabled={loading}
            placeholder="Start chat by email..."
            className="w-full px-4 py-2 rounded-xl border border-[#12212b] bg-[#071419] text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-[#0ea5e9] outline-none"
          />
        </form>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {sortedConversations.length === 0 && (
          <p className="text-slate-500 text-center p-6 italic">No conversations yet. Start one above!</p>
        )}
        {sortedConversations.map(convo => {
          const otherUser = convo.members.find(m => m._id !== user?._id);
          if (!otherUser) return null; // Should not happen

          const isSelected = selectedConversationId === convo._id;
          const unreadCount = unreadCounts[convo._id] || 0; // Get unread count

          return (
            <div
              key={convo._id}
              onClick={() => onSelect(convo)}
              className={`flex items-center gap-3 p-4 cursor-pointer transition ${isSelected ? 'bg-[#001426]' : 'hover:bg-[#0a1824]'}`}
            >
              <img
                src={otherUser.avatarUrl || `https://ui-avatars.com/api/?name=${otherUser.name}&size=44&background=random&color=fff`}
                alt={otherUser.name}
                className="w-11 h-11 rounded-full object-cover"
              />
              <div className="flex-1 overflow-hidden">
                <h4 className={`font-semibold text-slate-100 truncate ${unreadCount > 0 ? 'font-bold' : ''}`}>
                  {otherUser.name}
                </h4>
                <p className={`text-sm truncate ${unreadCount > 0 ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                  {convo.lastMessage?.content || otherUser.email}
                </p>
              </div>
              <div className="flex flex-col items-end space-y-1 ml-auto">
                <span className="text-xs text-slate-500">
                  {new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {/* ADDED: Unread count badge */}
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// Main Inbox View Component
const Inbox: React.FC<{
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  socket: Socket | null;
  unreadCounts: Record<string, number>; // ADDED
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>; // ADDED
  selectedConversationId: string | null; // ADDED
  setSelectedConversationId: React.Dispatch<React.SetStateAction<string | null>>; // ADDED
}> = ({
  conversations,
  setConversations,
  socket,
  unreadCounts,
  setUnreadCounts,
  selectedConversationId,
  setSelectedConversationId
}) => {
  
  const { showToast } = useToast();
  // MODIFIED: State for messages now lives inside Inbox
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Ref to hold the current selectedConversationId for the socket closure
  const selectedIdRef = useRef(selectedConversationId);
  useEffect(() => {
    selectedIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // MODIFIED: Effect to listen for messages *within* the inbox
  useEffect(() => {
    if (!socket) return;
  
    const handleInboxMessage = (newMessage: Message, updatedConversation: Conversation) => {
      console.log('Socket: newMessage (Inbox)', newMessage);
      
      // Always update conversation list
      setConversations(prev => 
        [updatedConversation, ...prev.filter(c => c._id !== updatedConversation._id)]
      );

      // If this message is for the currently viewed chat, add it
      if (selectedIdRef.current === newMessage.conversationId) {
        setMessages(prev => [...prev, newMessage]);
      } 
      // Note: The global listener in AppLayout will handle toasts/counts
      // if not in this conversation.
    };

    socket.on('newMessage', handleInboxMessage);
    return () => {
      socket.off('newMessage', handleInboxMessage);
    };
    // Dependency array is stable
  }, [socket, setConversations, setUnreadCounts, showToast]);


  // MODIFIED: This logic now lives inside Inbox
  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    // Leave previous room
    if (selectedConversationId && socket) {
      socket.emit('leaveConversation', selectedConversationId);
    }
    
    setSelectedConversationId(conversation._id); // Set ID
    setLoadingMessages(true);
    
    // Clear unread count for this conversation
    setUnreadCounts(prev => ({ ...prev, [conversation._id]: 0 }));
    
    // Join new room
    if (socket) {
      socket.emit('joinConversation', conversation._id);
    }
    
    try {
      const fetchedMessages = await api.chat.getMessages(conversation._id);
      setMessages(fetchedMessages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages';
      showToast(msg, 'error');
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedConversationId, setSelectedConversationId, setMessages, showToast, socket, setUnreadCounts]);

  // MODIFIED: Handler for mobile back button
  const handleBack = () => {
    if (socket && selectedConversationId) {
      socket.emit('leaveConversation', selectedConversationId);
    }
    setSelectedConversationId(null);
    setMessages([]);
  };

  // Find the full conversation object from the ID
  const selectedConversationObject = conversations.find(c => c._id === selectedConversationId);

  return (
    // MODIFIED: New responsive layout
    <div className="bg-[#07131a]/80 rounded-2xl shadow-[0_12px_30px_rgba(2,6,23,0.6)] border border-[#10202b] h-[calc(100vh_-_10rem)] flex overflow-hidden">
      
      {/* Conversation List Area (Slides off-screen on mobile) */}
      <div className={`w-full h-full flex-shrink-0 transition-transform duration-300 ease-in-out md:w-1/3 lg:w-1/4 ${selectedConversationId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <ConversationList
          conversations={conversations}
          setConversations={setConversations}
          onSelect={handleSelectConversation}
          selectedConversationId={selectedConversationId}
          unreadCounts={unreadCounts}
        />
      </div>

      {/* Chat Window Area (Slides into view on mobile) */}
      <div className={`absolute md:static top-0 left-0 w-full h-full flex-shrink-0 transition-transform duration-300 ease-in-out md:flex-1 ${selectedConversationId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        {loadingMessages ? (
           <div className="flex-1 flex items-center justify-center h-full bg-[#07131a] md:rounded-r-2xl">
              <p className="text-slate-400 text-lg animate-pulse">Loading messages...</p>
           </div>
        ) : selectedConversationObject ? (
          <ChatWindow
            conversation={selectedConversationObject}
            messages={messages}
            onBack={handleBack} // Pass back handler for mobile
          />
        ) : (
          // Placeholder for desktop when no chat is selected
          <div className="flex-1 items-center justify-center h-full hidden md:flex bg-[#07131a] rounded-r-2xl"> 
            <p className="text-slate-500 text-xl">Select a conversation or start a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};
// --- END NEW CHAT COMPONENTS ---


// App Layout Component (Main Application Router and Socket Handler)
const AppLayout: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const notificationSound = useRef(new Audio('/pop-effect.mp3'));
  // --- CHAT STATE REFACTORED ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // State for unread counts (conversationId: count)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(() => {
  try {
    const stored = localStorage.getItem('unreadCounts');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load unread counts:', error);
    return {};
  }
});
useEffect(() => {
  try {
    localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
  } catch (error) {
    console.error('Failed to save unread counts:', error);
  }
}, [unreadCounts]);
  // State for *only* the ID of the selected conversation
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  // --- END CHAT STATE ---

  // Navigation Persistence
  const handleHashChange = useCallback(() => {
    const hash = window.location.hash.substring(1);
    setCurrentView(hash || 'dashboard');
  }, []);
  
  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [handleHashChange]);
  
  const navigate = useCallback((viewId: string) => {
    window.location.hash = viewId;
    setCurrentView(viewId);
    setMobileMenuOpen(false);
  }, []);
  
  const loadInitialData = useCallback(async () => {
    if (!token) return;

    try {
      // Parallelize fetching
      const [teamsData, convosData] = await Promise.all([
        api.teams.getAll(),
        api.chat.getConversations()
      ]);
      
      setTeams(teamsData as Team[]);
      setConversations(convosData as Conversation[]);
      
      // Initialize unread counts (can be expanded later to fetch from backend)
      // Merge with existing unread counts instead of resetting
setUnreadCounts(prevCounts => {
  const mergedCounts = { ...prevCounts };
  // Only add conversations that don't exist yet (set to 0)
  convosData.forEach((convo: Conversation) => {
    if (!(convo._id in mergedCounts)) {
      mergedCounts[convo._id] = 0;
    }
  });
  return mergedCounts;
});

      let allTasksData: Task[] = [];
      let allProjectsData: Project[] = [];

      for (const team of teamsData) {
        if (team.members.some(m => m._id === user?._id)) {
          const teamProjects: Project[] = await api.projects.getByTeam(team._id);
          allProjectsData = [...allProjectsData, ...teamProjects];

          for (const project of teamProjects) {
            const projectTasks: Task[] = await api.tasks.getByProject(project._id);
            allTasksData = [...allTasksData, ...projectTasks];
          }
        }
      }
      setAllProjects(allProjectsData);
      setAllTasks(allTasksData);

    }
    catch (err: unknown) {
      console.error('Error loading initial data:', err);
      if (err instanceof Error && (err.message.includes('No token') ||
        err.message.includes('Unauthorized'))) {
        logout();
      } else {
        showToast(err instanceof Error ?
          err.message : 'Failed to load initial data', 'error');
      }
    }
  }, [token, logout, user?._id, showToast]);
  
  useEffect(() => {
    if (token) {
      loadInitialData();
    }
  }, [token, loadInitialData]);
  
  // -- Team Handlers --
  const handleTeamCreated = useCallback((newTeam: Team) => {
    console.log('Socket: teamCreated', newTeam);
    setTeams(prev => [newTeam, ...prev]
      .filter((t, i, a) => a.findIndex(f => f._id === t._id) === i));
  }, []);
  
  const handleTeamUpdated = useCallback((updatedTeam: Team) => {
    console.log('Socket: teamUpdated', updatedTeam);
    setTeams(prev => prev.map(t => t._id === updatedTeam._id ? updatedTeam : t));
    if (selectedTeam?._id === updatedTeam._id) {
      setSelectedTeam(updatedTeam);
    }
  }, [selectedTeam?._id]);
  
  const handleTeamDeleted = useCallback((teamId: string) => {
    console.log('Socket: teamDeleted', teamId);
    setTeams(prev => prev.filter(t => t._id !== teamId));
    if (selectedTeam?._id === teamId) {
      setSelectedTeam(null);
      setSelectedProject(null);
      navigate('teams');
    }
    const teamProjectIds = allProjects.filter(p => p.teamId === teamId).map(p => p._id);
    setAllProjects(prev => prev.filter(p => p.teamId !== teamId));
    setAllTasks(prev => prev.filter(t => !teamProjectIds.includes(t.projectId)));
  }, [selectedTeam?._id, navigate, allProjects]);
  
  // -- Project Handlers --
  const handleProjectCreated = useCallback((newProject: Project) => {
    console.log('Socket: projectCreated', newProject);
    setAllProjects(prev => [newProject, ...prev]
      .filter((p, i, a) => a.findIndex(f => f._id === p._id) === i));
    if (selectedTeam?._id === newProject.teamId) {
      setProjects(prev => [newProject, ...prev]
        .filter((p, i, a) => a.findIndex(f => f._id === p._id) === i));
    }
  }, [selectedTeam?._id]);
  
  const handleProjectUpdated = useCallback((updatedProject: Project) => {
    console.log('Socket: projectUpdated', updatedProject);
    setAllProjects(prev => prev.map(p => p._id === updatedProject._id ? updatedProject : p));
    if (selectedTeam?._id === updatedProject.teamId) {
      setProjects(prev => prev.map(p => p._id === updatedProject._id ? updatedProject : p));
    }
  }, [selectedTeam?._id]);
  
  const handleProjectDeleted = useCallback((projectId: string, teamId: string) => {
    console.log('Socket: projectDeleted', projectId);
    if (selectedTeam?._id === teamId) {
      setProjects(prev => prev.filter(p => p._id !== projectId));
    }
    setAllTasks(prev => prev.filter(t => t.projectId !== projectId));
    setAllProjects(prev => prev.filter(p => p._id !== projectId));
  }, [selectedTeam?._id]);
  
  // -- Task Handlers --
  const handleTaskCreated = useCallback((newTask: Task) => {
    console.log('Socket: taskCreated', newTask);
    setAllTasks(prev => [newTask, ...prev]
      .filter((t, i, a) => a.findIndex(f => f._id === t._id) === i));
    if (selectedProject?._id === newTask.projectId) {
      setTasks(prev => [newTask, ...prev]
        .filter((t, i, a) => a.findIndex(f => f._id === t._id) === i));
    }
  }, [selectedProject?._id]);
  
  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    console.log('Socket: taskUpdated', updatedTask);
    setAllTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
    if (selectedProject?._id === updatedTask.projectId) {
      setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
    }
  }, [selectedProject?._id]);
  
  const handleTaskDeleted = useCallback((taskId: string, projectId: string) => {
    console.log('Socket: taskDeleted', taskId);
    setAllTasks(prev => prev.filter(t => t._id !== taskId));
    if (selectedProject?._id === projectId) {
      setTasks(prev => prev.filter(t => t._id !== taskId));
    }
  }, [selectedProject?._id]);
  
  // --- CHAT SOCKET HANDLER (Global) ---
  const handleNewMessage = useCallback((newMessage: Message, updatedConversation: Conversation) => {
    console.log('Socket: newMessage (AppLayout)', newMessage);
    
    // Always update the conversation list to re-order
    setConversations(prev => 
      [updatedConversation, ...prev.filter(c => c._id !== updatedConversation._id)]
    );
    
    // If user is NOT in the inbox OR is in inbox but not viewing this chat, update count/toast
    if (currentView !== 'inbox' || selectedConversationId !== newMessage.conversationId) {
        setUnreadCounts(prev => ({
          ...prev,
          [newMessage.conversationId]: (prev[newMessage.conversationId] || 0) + 1
        }));
        
        // Only show toast if not in inbox at all
        if (currentView !== 'inbox') {
          showCustomPopup(`New message from ${newMessage.sender.name}`);
          try {
          // Play the persistent, pre-loaded sound
          notificationSound.current.play().catch(e => {
            // This error is expected if the user hasn't clicked yet.
            // It will work on the next message after interaction.
            console.warn("Audio autoplay blocked by browser. User must interact with the page first.");
          });
        } catch (e) {
          console.error("Failed to play sound:", e);
        }
        }

    }

  }, [currentView, selectedConversationId, showToast]); // Dependencies
  // --- END CHAT SOCKET HANDLER ---
  
  
  // --- SOCKET.IO IMPLEMENTATION ---
  useEffect(() => {
    if (!token || !user) {
      if (socket) socket.disconnect();
      return;
    }

    const newSocket = io(SOCKET_SERVER_URL, { query: { token } });
    setSocket(newSocket);
    console.log('Socket.io connected.');

    // Join user-specific room for direct messages
    newSocket.emit('joinRoom', `user:${user._id}`);
    
    // Join rooms for all teams
    teams.forEach(team => {
      newSocket.emit('joinRoom', `team:${team._id}`);
    });
    
    // Join room for selected project
    if (selectedProject) {
      newSocket.emit('joinRoom', `project:${selectedProject._id}`);
    }
    
    // MODIFIED: Inbox component now handles joining/leaving conversation rooms

    newSocket.on('teamCreated', handleTeamCreated);
    newSocket.on('teamUpdated', handleTeamUpdated);
    newSocket.on('teamDeleted', handleTeamDeleted);

    newSocket.on('projectCreated', handleProjectCreated);
    newSocket.on('projectUpdated', handleProjectUpdated);
    newSocket.on('projectDeleted', handleProjectDeleted);

    newSocket.on('taskCreated', handleTaskCreated);
    newSocket.on('taskUpdated', handleTaskUpdated);
    newSocket.on('taskDeleted', handleTaskDeleted);
    
    // Global listener for notifications/re-ordering
    newSocket.on('newMessage', handleNewMessage);

    return () => {
      console.log('Socket.io disconnected.');
      newSocket.off('teamCreated', handleTeamCreated);
      newSocket.off('teamUpdated', handleTeamUpdated);
      newSocket.off('teamDeleted', handleTeamDeleted);
      newSocket.off('projectCreated', handleProjectCreated);
      newSocket.off('projectUpdated', handleProjectUpdated);
      newSocket.off('projectDeleted', handleProjectDeleted);
      newSocket.off('taskCreated', handleTaskCreated);
      newSocket.off('taskUpdated', handleTaskUpdated);
      newSocket.off('taskDeleted', handleTaskDeleted);
      newSocket.off('newMessage', handleNewMessage);
      newSocket.disconnect();
    };
  }, [
    token, user, teams, selectedProject, // MODIFIED: Removed selectedConversationId
    handleTeamCreated, handleTeamUpdated, handleTeamDeleted,
    handleProjectCreated, handleProjectUpdated, handleProjectDeleted,
    handleTaskCreated, handleTaskUpdated, handleTaskDeleted,
    handleNewMessage // Pass stable handler
  ]);
  
  // --- NAVIGATION LOGIC ---

  // EFFECT 1: Handles state cleanup WHEN THE VIEW CHANGES.
  useEffect(() => {
    if (currentView !== 'tasks') {
      setTasks([]); // Clear tasks if we are not on the tasks view
    }
    if (currentView !== 'projects' && currentView !== 'tasks') {
      setProjects([]); // Clear specific projects if not on projects/tasks
    }
    if (currentView === 'dashboard' || currentView === 'teams') {
      // If we go back to dashboard or teams, clear selections
      setSelectedTeam(null);
      setSelectedProject(null);
    }
    if (currentView !== 'inbox') {
        // If we leave the inbox, clear the selected conversation ID
        setSelectedConversationId(null);
    }
  }, [currentView]);
  
  // EFFECT 2: Handles data validation FOR the current view.
  useEffect(() => {
    if (currentView === 'projects') {
      // If we are on #projects, we MUST have a selectedTeam.
      if (!selectedTeam || !teams.some(t => t._id === selectedTeam._id)) {
        navigate('teams');
      }
    } else if (currentView === 'tasks') {
      // If we are on #tasks, we MUST have a selectedTeam AND selectedProject.
      if (!selectedTeam || !teams.some(t => t._id === selectedTeam._id)) {
        navigate('teams');
      } else if (!selectedProject || !allProjects.some(p => p._id === selectedProject._id)) {
        navigate('projects');
      }
    }
  }, [currentView, teams, allProjects, selectedTeam, selectedProject, navigate]);
  
  const handleSelectTeam = useCallback(async (team: Team) => {
    setSelectedTeam(team);
    setSelectedProject(null);
    setTasks([]);
    try {
      const teamProjects = await api.projects.getByTeam(team._id);
      setProjects(teamProjects);
      navigate('projects');
    } catch (err) {
      showToast('Failed to load projects for team.', 'error');
      setProjects([]);
    }
  }, [navigate, showToast]);
  
  const handleSelectProject = useCallback(async (project: Project) => {
    setSelectedProject(project);
    try {
      const projectTasks = await api.tasks.getByProject(project._id);
      setTasks(projectTasks);
      navigate('tasks');
    } catch (err) {
      showToast('Failed to load tasks for project.', 'error');
      setTasks([]);
    }
  }, [navigate, showToast]);
  
  if (!user) {
    return null;
  }

  const currentPath = [
    { id: 'dashboard', label: 'Dashboard', onClick: () => navigate('dashboard') },
    ...(currentView === 'teams' ? [{ id: 'teams', label: 'Teams', onClick: () => navigate('teams') }] : []),
    ...(currentView === 'profile' ? [{ id: 'profile', label: 'Profile', onClick: () => navigate('profile') }] : []),
    ...(currentView === 'inbox' ? [{ id: 'inbox', label: 'Inbox', onClick: () => navigate('inbox') }] : []),
    ...(currentView === 'projects' && selectedTeam ? [{ id: 'teams', label: 'Teams', onClick: () => navigate('teams') }, { id: 'projects', label: `${selectedTeam.name} Projects`, onClick: () => navigate('projects') }] : []),
    ...(currentView === 'tasks' && selectedProject && selectedTeam ? [{ id:
      'teams', label: 'Teams', onClick: () => navigate('teams') }, { id: 'projects', label: `${selectedTeam.name} Projects`, onClick: () => navigate('projects') }, { id: 'tasks', label: `${selectedProject.name} Tasks` }] : []),
  ];
  const teamMembersForSelectedTeam: User[] = selectedTeam?.members || [];

  // Calculate total unread messages for sidebar
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard teams={teams} projects={allProjects} tasks={allTasks} />;
      case 'teams':
        return <Teams teams={teams} setTeams={setTeams} onSelectTeam={handleSelectTeam} />;
      case 'projects':
        if (selectedTeam) {
          return <Projects selectedTeam={selectedTeam} projects={projects} setProjects={setProjects} onSelectProject={handleSelectProject} />;
        }
        return <p className="p-8 text-center text-slate-400">Please select a team from the Teams view.</p>;
      case 'tasks':
        if (selectedProject && selectedTeam) {
          return <Tasks selectedProject={selectedProject} selectedTeam={selectedTeam} tasks={tasks} setTasks={setTasks} teamMembers={teamMembersForSelectedTeam} />;
        }
        return <p className="p-8 text-center text-slate-400">Please select a project from the Projects view.</p>;
      case 'profile':
        return <Profile />;
      // --- MODIFIED INBOX VIEW ---
      case 'inbox':
        return <Inbox
                  conversations={conversations}
                  setConversations={setConversations}
                  socket={socket}
                  unreadCounts={unreadCounts}
                  setUnreadCounts={setUnreadCounts}
                  selectedConversationId={selectedConversationId}
                  setSelectedConversationId={setSelectedConversationId}
               />;
      // --- END INBOX VIEW ---
      default:
        return <Dashboard teams={teams} projects={allProjects} tasks={allTasks} />;
    }
  };
  return (
    <div className="min-h-screen bg-[#04060a] flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 w-64 bg-[#02060b] shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-40 flex flex-col`}>
        <div className="p-6 flex-shrink-0">
          <h2 className="text-2xl font-extrabold text-[#00b3ff]">CollaboraX</h2>
          <p className="text-slate-400 text-xs mt-1">Collaborate. Create. Conquer.</p>

          {/* User Info (detailed) - same solid dark background */}
          <div className="mt-8 flex items-center gap-4">
            <img
              src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name}&size=64&background=random&color=fff`}
              alt={user.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#07121a]"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100">{user.name}</span>
              <span className="text-xs text-slate-400">{user.email}</span>
            </div>
          </div>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <nav className="space-y-2 mt-4">
            <a
              href="#dashboard"
              onClick={() => navigate('dashboard')}
              className={`flex items-center p-3 rounded-xl transition ${currentView === 'dashboard' ?
                'bg-[#001426] text-[#00b3ff] font-semibold' : 'text-slate-300 hover:bg-[#03151b]'}`}
            >
              <LayoutDashboard size={20} className="mr-3" /> Dashboard
            </a>
            <a
              href="#teams"
              onClick={() => navigate('teams')}
              className={`flex items-center p-3 rounded-xl transition ${currentView === 'teams' || currentView === 'projects' || currentView === 'tasks' ?
                'bg-[#001426] text-[#00b3ff] font-semibold' : 'text-slate-300 hover:bg-[#03151b]'}`}
            >
              <Users size={20} className="mr-3" /> Teams
            </a>
            {/* --- MODIFIED INBOX LINK --- */}
            <a
              href="#inbox"
              onClick={() => navigate('inbox')}
              className={`flex items-center justify-between p-3 rounded-xl transition ${currentView === 'inbox' ?
                'bg-[#001426] text-[#00b3ff] font-semibold' : 'text-slate-300 hover:bg-[#03151b]'}`}
            >
              <span className="flex items-center">
                <MessageSquare size={20} className="mr-3" /> Inbox
              </span>
              {/* Notification Badge */}
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </a>
            {/* --- END INBOX LINK --- */}
            <a
              href="#profile"
              onClick={() => navigate('profile')}
              className={`flex items-center p-3 rounded-xl transition ${currentView === 'profile' ?
                'bg-[#001426] text-[#00b3ff] font-semibold' : 'text-slate-300 hover:bg-[#03151b]'}`}
            >
              <Camera size={20} className="mr-3" /> Profile
            </a>
          </nav>
          <div className="mt-8">
            <button
              onClick={logout}
              className="flex items-center p-3 w-full rounded-xl text-rose-400 bg-[#07121a] hover:bg-[#09141a] font-semibold transition"
            >
              <LogOut size={20} className="mr-3" /> Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Content Area - flush to the sidebar */}
      <div className="flex-1 flex flex-col ml-0">
        {/* Header/Breadcrumbs */}
        <header className="bg-[#07121a] shadow-[0_4px_12px_rgba(2,6,23,0.6)] p-4 sticky top-0 z-30">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="text-slate-300 lg:hidden mr-4"
              >
                <Menu size={24} />
              </button>
              <nav className="hidden sm:flex text-xs font-medium space-x-2">
                {currentPath.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <button
                      onClick={item.onClick}
                      disabled={index === currentPath.length - 1}
                      className={`
          text-xs sm:text-sm md:text-base 
          text-slate-400 
          hover:text-[#00b3ff] 
          transition-colors duration-200 
          disabled:text-slate-300 
          disabled:cursor-default 
          truncate
          max-w-[90px] sm:max-w-[150px] md:max-w-none
        `}
                      title={item.label}
                    >
                      {item.label}
                    </button>

                    {index < currentPath.length - 1 && (
                      <span
                        className="text-slate-600 mx-1 sm:mx-2 text-xs sm:text-sm select-none"
                        aria-hidden="true"
                      >
                        /
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </nav>

            </div>

            {/* User Info in Header */}
            <div className="flex items-center space-x-3">
              {/* **NEW**: Guide Button */}
              <button
                onClick={() => setShowGuideModal(true)}
                className="text-slate-400 hover:text-[#00b3ff] transition p-2 rounded-full hover:bg-[#0b1f2a]"
                title="Open Guide"
              >
                <BookOpen size={20} />
              </button>

              <span className="font-medium text-slate-200 hidden sm:inline">{user.name}</span>
              <img
                src={user.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${user.name}&size=32&background=random&color=fff`}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-[#07121a]"
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        {/* --- RESPONSIVE PADDING FIX --- */}
        <main className="flex-1 p-4 md:p-8 w-full">
          <div className="w-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}

      {/* **NEW**: Guide Modal */}
      {showGuideModal && <GuideModal onClose={() => setShowGuideModal(false)} />}
    </div>
  );
};

// Root Component
const Root: React.FC = () => {
  const [loading, setLoading] = useState(true);
  // Simple loading delay to prevent flash of unstyled content/loading issues
  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 10);
  }, []);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04060a]">
        <div className="text-2xl font-semibold text-slate-200">Loading CollaboraX...</div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  );
};

// App Router
const App: React.FC = () => {
  // FIX: Removed 'login' from destructuring to fix the 'value is never read' warning.
  const { isAuthenticated } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  if (!isAuthenticated) {
    // Redirect non-authenticated users to root
    if (window.location.hash !== '') {
      window.location.hash = '';
    }
    return <AuthScreen />;
  }

  // Authenticated users go to the app layout
  // --- ADDED #inbox ---
  const validHashes = ['#dashboard', '', '#teams', '#projects', '#tasks', '#profile', '#inbox'];
  if (validHashes.includes(currentHash)) {
    return <AppLayout />;
  }
  
  // Default to dashboard if hash is invalid
  window.location.hash = 'dashboard';
  return <AppLayout />;
};
export default Root;
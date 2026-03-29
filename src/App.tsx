import React, { useState, useEffect } from 'react';
import { 
  Eye,
  Globe,
  Github, 
  RefreshCw, 
  FileCode,
  Search,
  ExternalLink,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  default_branch: string;
  has_pages: boolean;
  owner: {
    login: string;
  };
}

interface RepoDetails {
  readme: string | null;
  fileCount: number;
  files: { name: string; download_url: string }[];
  hasHtml: boolean;
}

// WARNING: Hardcoding a GitHub token is a security risk. 
// This token is exposed to anyone who visits the site.
const HARDCODED_GITHUB_TOKEN = "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";

export default function App() {
  const [username, setUsername] = useState('VictorP-Sec');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoDetails, setRepoDetails] = useState<Record<number, RepoDetails>>({});
  const [expandedRepo, setExpandedRepo] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vault_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.className = theme;
    document.documentElement.setAttribute('data-color-mode', theme);
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const fetchRepos = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return;
    
    setLoading(true);
    setError(null);
    localStorage.setItem('vault_github_user', trimmedUsername);
    
    const token = import.meta.env.VITE_GITHUB_TOKEN || HARDCODED_GITHUB_TOKEN;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      const response = await fetch(
        `https://api.github.com/users/${trimmedUsername}/repos?sort=updated&per_page=100`,
        { headers }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No se encontró el usuario de GitHub.');
        }
        if (response.status === 403) {
          throw new Error('Límite de API de GitHub alcanzado (60 req/h). Inténtalo más tarde.');
        }
        throw new Error(`Error de GitHub (${response.status}): Verifica el usuario.`);
      }
      
      const data = await response.json();
      const repoList = Array.isArray(data) ? data : [];
      
      // Filter: Only show repos with GitHub Pages enabled
      const filtered = repoList.filter((repo: any) => !repo.fork && repo.has_pages);
      setRepos(filtered);
      
      if (filtered.length === 0) {
        setError('No se encontraron repositorios con GitHub Pages habilitado para este usuario.');
      }
      
      // Pre-fetch details for all repos (or fetch on expand for performance)
      // For now, let's fetch on expand to save API calls
    } catch (err: any) {
      setError(err.message);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (repo: GitHubRepo) => {
    if (repoDetails[repo.id]) return repoDetails[repo.id];
    
    const token = import.meta.env.VITE_GITHUB_TOKEN || HARDCODED_GITHUB_TOKEN;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      // Fetch README (Raw content doesn't need token, but we'll use it for API calls below)
      const readmeRes = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/README.md`);
      const readme = readmeRes.ok ? await readmeRes.text() : null;

      // Fetch Languages to check for HTML
      const langRes = await fetch(`https://api.github.com/repos/${repo.full_name}/languages`, { headers });
      const languages = langRes.ok ? await langRes.json() : {};
      const hasHtml = !!languages.HTML;

      // Fetch Contents to count files
      const contentsRes = await fetch(`https://api.github.com/repos/${repo.full_name}/contents`, { headers });
      const contents = contentsRes.ok ? await contentsRes.json() : [];
      
      const files = Array.isArray(contents) 
        ? contents.filter((item: any) => item.type === 'file').map((f: any) => ({
            name: f.name,
            download_url: f.download_url
          }))
        : [];

      const details = {
        readme,
        fileCount: files.length,
        files,
        hasHtml
      };

      setRepoDetails(prev => ({
        ...prev,
        [repo.id]: details
      }));

      return details;
    } catch (err) {
      console.error('Error fetching repo details:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const formatRepoName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/[_-]/g, ' ')      // Replace underscores/hyphens with spaces
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase()); // Capitalize first letter
  };

  const handleAnalyze = async (repo: GitHubRepo) => {
    setLoading(true);
    const details = await fetchDetails(repo);
    setLoading(false);
    
    if (details) {
      // Expand to show README
      setExpandedRepo(repo.id);
      
      if (details.hasHtml) {
        const deployUrl = `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}`;
        window.open(deployUrl, '_blank');
      } else {
        setError(`El repositorio "${repo.name}" no parece contener archivos HTML para visualizar.`);
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const scanAllRepos = async () => {
    setLoading(true);
    let foundCount = 0;
    
    for (const repo of filteredRepos) {
      const details = await fetchDetails(repo);
      if (details?.hasHtml) {
        const deployUrl = `https://${repo.owner.login.toLowerCase()}.github.io/${repo.name}`;
        window.open(deployUrl, '_blank');
        foundCount++;
      }
    }
    
    if (foundCount === 0) {
      setError('No se encontraron repositorios con contenido web visualizable.');
      setTimeout(() => setError(null), 3000);
    }
    setLoading(false);
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatRepoName(repo.name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = async (repo: GitHubRepo) => {
    if (expandedRepo === repo.id) {
      setExpandedRepo(null);
    } else {
      setLoading(true);
      await fetchDetails(repo);
      setLoading(false);
      setExpandedRepo(repo.id);
    }
  };

  return (    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0A0A0A] text-white' : 'bg-[#f6f8fa] text-[#1f2328]'} font-sans selection:bg-primary/30`}>
      {/* Header */}
      <header className={`border-b ${theme === 'dark' ? 'border-white/5 bg-black/50' : 'border-black/10 bg-[#1f2328]'} backdrop-blur-xl sticky top-0 z-50`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3 sm:gap-8">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/10 border-white/10'} rounded-xl flex items-center justify-center border`}>
              <Github size={18} className="text-white" />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white">Web Analyzer</h1>
              <p className="text-[8px] sm:text-[10px] font-mono opacity-40 uppercase tracking-widest text-white">Auto-Scan & Deploy</p>
            </div>
          </div>

          <div className="flex-grow max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text" 
              placeholder="Analizar repositorios..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 focus:border-white/20' : 'bg-white/10 border-white/10 focus:border-white/20'} border rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-sm focus:outline-none transition-all text-white placeholder:text-white/20`}
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className={`p-2.5 sm:p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/10 border-white/10 hover:bg-white/20'} border transition-all text-white`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={scanAllRepos}
              disabled={loading}
              title="Escanear y abrir todos"
              className={`p-2.5 sm:p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/10 border-white/10 hover:bg-white/20'} border transition-all disabled:opacity-50 text-white`}
            >
              <Globe size={18} className={loading ? 'animate-pulse text-primary' : ''} />
            </button>
            <button 
              onClick={fetchRepos}
              disabled={loading}
              className={`p-2.5 sm:p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/10 border-white/10 hover:bg-white/20'} border transition-all disabled:opacity-50 text-white`}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* User Configuration */}
        <section className="mb-8 sm:mb-16">
          <div className={`${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-[#d0d7de] shadow-sm'} border rounded-3xl p-6 sm:p-8 transition-all duration-300`}>
            <h2 className={`text-[10px] font-mono uppercase tracking-widest mb-4 ${theme === 'dark' ? 'opacity-40' : 'text-[#636c76]'}`}>Usuario de GitHub</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                className={`flex-grow ${theme === 'dark' ? 'bg-black/40 border-white/10 focus:border-white/30 text-white' : 'bg-[#f6f8fa] border-[#d0d7de] focus:border-[#0969da] text-[#1f2328]'} border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-all`}
              />
              <button 
                onClick={fetchRepos}
                className={`${theme === 'dark' ? 'bg-white text-black hover:bg-white/90' : 'bg-[#1f2328] text-white hover:bg-[#2f3338]'} px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm`}
              >
                Conectar
              </button>
            </div>
            <p className={`mt-4 text-[10px] sm:text-xs flex items-center gap-2 ${theme === 'dark' ? 'opacity-40' : 'text-[#636c76]'}`}>
              <ExternalLink size={12} /> Tipo: Usuario Editable
            </p>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 sm:mb-12 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400"
          >
            <AlertCircle size={24} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {/* Repos List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#1f2328]'}`}>Repositorios ({filteredRepos.length})</h3>
          </div>

          {loading && !expandedRepo ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-40">
              <Loader2 size={32} className="animate-spin" />
              <p className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-[#1f2328]'}`}>Sincronizando...</p>
            </div>
          ) : filteredRepos.length > 0 ? (
            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {filteredRepos.map((repo) => (
                  <motion.div 
                    key={repo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`group ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20' : 'bg-white border-[#d0d7de] hover:border-[#0969da] shadow-sm'} border rounded-2xl overflow-hidden transition-all duration-300`}
                  >
                    <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 sm:gap-5">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-[#f6f8fa] border-black/5'} rounded-xl flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors border`}>
                          <FileCode size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                            <h4 className={`text-base sm:text-lg font-bold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-[#1f2328]'}`}>
                              {formatRepoName(repo.name)}
                            </h4>
                            {repoDetails[repo.id]?.hasHtml && (
                              <span className="px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[8px] font-bold uppercase tracking-wider border border-green-500/20">
                                Web Ready
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] sm:text-xs font-mono truncate transition-opacity ${theme === 'dark' ? 'opacity-30 group-hover:opacity-60' : 'text-[#636c76]'}`}>
                            {repo.full_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <button 
                          onClick={() => toggleExpand(repo)}
                          className={`flex-1 sm:flex-none p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-[#f6f8fa] border-[#d0d7de] hover:bg-[#ebeef1] text-[#1f2328]'} border transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest`}
                        >
                          <BookOpen size={16} />
                          <span className="sm:hidden">Info</span>
                          {expandedRepo === repo.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        
                        <button 
                          onClick={() => handleAnalyze(repo)}
                          className={`flex-[2] sm:flex-none ${theme === 'dark' ? 'bg-white text-black hover:bg-white/90' : 'bg-[#1f2328] text-white hover:bg-[#2f3338]'} px-4 sm:px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm`}
                        >
                          <Eye size={16} />
                          Analizar
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content (README) */}
                    <AnimatePresence>
                      {expandedRepo === repo.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={`border-t ${theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-[#d0d7de] bg-[#f6f8fa]/50'}`}
                        >
                          <div className="p-4 sm:p-8 max-w-none overflow-x-auto">
                            {repoDetails[repo.id]?.readme ? (
                              <div className="markdown-body !bg-transparent !p-0">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {repoDetails[repo.id].readme || ''}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div className="py-8 sm:py-12 flex flex-col items-center justify-center gap-4 opacity-30">
                                <AlertCircle size={32} />
                                <p className="text-[10px] font-mono uppercase tracking-widest">No se encontró README.md</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className={`py-20 sm:py-32 border-2 border-dashed ${theme === 'dark' ? 'border-white/5' : 'border-black/5'} rounded-3xl flex flex-col items-center justify-center text-center px-6`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'} rounded-full flex items-center justify-center mb-6`}>
                <FileCode size={32} className={`${theme === 'dark' ? 'opacity-20' : 'text-[#636c76] opacity-20'}`} />
              </div>
              <h4 className={`text-lg sm:text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-[#1f2328]'}`}>No se encontraron repositorios</h4>
              <p className={`text-xs sm:text-sm max-w-xs ${theme === 'dark' ? 'opacity-40' : 'text-[#636c76]'}`}>
                Asegúrate de que el usuario tenga repositorios públicos en GitHub.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className={`max-w-5xl mx-auto px-6 py-8 sm:py-12 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'} flex flex-col sm:flex-row justify-between items-center gap-4 ${theme === 'dark' ? 'opacity-30' : 'text-[#636c76] opacity-60'}`}>
        <p className="text-[8px] sm:text-[10px] font-mono uppercase tracking-widest">Web Analyzer v5.0</p>
        <div className="flex gap-6 text-[8px] sm:text-[10px] font-mono uppercase tracking-widest">
          <a href="#" className={`hover:text-primary transition-colors ${theme === 'dark' ? '' : 'hover:text-[#0969da]'}`}>GitHub API</a>
          <a href="#" className={`hover:text-primary transition-colors ${theme === 'dark' ? '' : 'hover:text-[#0969da]'}`}>Docs</a>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  PanelLeft, Plus, ArrowUp, Mic, Table2, Presentation, FileText, Search, Hammer, Box,
  ChevronRight, ChevronDown, X, Copy, Download, Check, Square, RotateCcw, ArrowLeft,
  Clock3, Info, CalendarDays, ArrowUpRight, FolderPlus, Puzzle, Monitor, Lightbulb,
  MoreHorizontal, BookOpen, CircleHelp, CheckCheck, CircleAlert,
} from 'lucide-react';
import { MATERIALS, type MaterialId } from './materials';
import {
  STORAGE_KEY, loadState, initialState, settle, home, revisit, choose, skip, decline, invalidate,
  revalidateSelection, sourceValid, submit, cancel, retry, seed, beginJob, log, visibleCandidates,
  type State, type Message,
} from './state';
import { Result, resultMarkdown } from './results';
import './styles.css';

type DialogState = { type: 'material'; id: MaterialId } | { type: 'attachments' } |
  { type: 'info'; title: string; text: string } | { type: 'history' };
const STATUS = { idle: '未准备', pending: '准备中', ready: '已可用', failed: '生成失败', stale: '来源已失效' };
const pad = (n: number) => String(n).padStart(2, '0');
function clockText(time: number) {
  const d = new Date(time);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function wallTime(time: number | null) { return time == null ? '尚未发生' : new Date(time).toLocaleTimeString('zh-CN', { hour12: false }); }
function saveDownload(name: string, body: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function IconButton({ label, children, onClick, className = '', disabled = false }: {
  label: string; children: ReactNode; onClick: () => void; className?: string; disabled?: boolean;
}) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`icon-button ${className}`}>{children}</button>;
}

export default function App() {
  const [s, setS] = useState<State>(loadState);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const persistWarning = useRef(false);
  const active = s.sessions.find(c => c.id === s.activeSessionId);
  const running = s.sessions.find(c => c.task?.status === 'running');
  const candidates = visibleCandidates(s);
  const invalid = !!s.selection && !sourceValid(s, s.selection);
  const confirmIds = s.selection ? s.draftMaterials.filter(id => s.source?.materials.includes(id)) : s.draftMaterials;
  const update = (fn: (current: State) => State) => setS(current => fn(current));
  const notify = (text: string) => setToast(text);
  const focusInput = () => requestAnimationFrame(() => input.current?.focus());
  const navigateHome = () => { update(home); setSourceOpen(false); setMenuOpen(false); };
  const info = (title: string, text: string) => setDialog({ type: 'info', title, text });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    catch { if (!persistWarning.current) { setToast('当前浏览器无法保存本地状态；本次页面内仍可使用。'); persistWarning.current = true; } }
  }, [s]);
  useEffect(() => {
    const timer = setInterval(() => setS(current => settle(current)), 200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${Math.min(240, Math.max(56, input.current.scrollHeight))}px`;
  }, [s.draft, s.view]);
  useEffect(() => {
    if (s.view === 'chat') endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [s.view, active?.messages.length, active?.task?.status]);
  useEffect(() => {
    if (dialog) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else previousFocus.current?.focus();
  }, [dialog]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDialog(null); setMenuOpen(false); setSourceOpen(false);
        if (window.innerWidth < 768) setS(current => ({ ...current, sidebar: false }));
      }
      if (event.key === 'Tab' && dialogRef.current && dialog) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]');
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [dialog]);

  const send = () => {
    const result = submit(s);
    if (result.error) { notify(result.error); return; }
    setS(result.state);
    setSourceOpen(false);
  };
  const reset = () => {
    localStorage.removeItem(STORAGE_KEY); setS(initialState());
    setDialog(null); setMenuOpen(false); setSourceOpen(false); setDemoOpen(false);
    notify('已重置本原型，回到注册第一天。');
  };
  const loadExample = (mode: Parameters<typeof seed>[0]) => {
    setS(seed(mode)); setMenuOpen(false); setSourceOpen(false);
    notify(mode === 'unmatched' ? '已载入旅行规划示例历史，没有材料阅读建议。' : '已载入示例历史；没有补造此前的交互记录。');
  };
  const select = (c: typeof candidates[number]) => {
    update(current => choose(current, c)); setSourceOpen(false); focusInput();
  };
  const viewSession = (id: string) => {
    const session = s.sessions.find(c => c.id === id);
    if (!session) return;
    setS({ ...s, view: 'chat', activeSessionId: id, selection: null, presented: [], draft: '',
      draftMaterials: session.task?.materials.map(m => m.id) ?? [],
      sidebar: window.innerWidth < 768 ? false : s.sidebar });
    setDialog(null); setSourceOpen(false);
  };
  const copyResult = async (message: Message) => {
    const text = resultMarkdown(message);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.append(t); t.select();
        const success = document.execCommand('copy'); t.remove();
        if (!success) throw new Error('clipboard unavailable');
      }
      update(current => log(current, 'result_copied', { messageId: message.id, kind: message.kind }));
      notify('已复制结果，可粘贴到文档。');
    } catch { notify('浏览器未允许复制，请使用“导出 Markdown”。'); }
  };
  const exportResult = (message: Message) => {
    saveDownload(`${message.kind === 'compare' ? 'AI学习材料-研究对比表' : message.kind === 'outline' ? 'AI学习材料-课堂汇报提纲' : '材料A-摘要'}.md`, resultMarkdown(message));
    update(current => log(current, 'result_exported', { messageId: message.id, kind: message.kind, format: 'markdown' }));
    notify('Markdown 已导出。');
  };
  const materialTags = (ids: MaterialId[], removable = false, compact = false) => <div className={`material-tags ${compact ? 'compact' : ''}`}>
    {ids.map(id => <span className="file-tag" key={id}>
      <button type="button" className="file-preview" onClick={() => setDialog({ type: 'material', id })} aria-label={`查看材料 ${id}：${MATERIALS[id].title}`} title={`查看材料 ${id}：${MATERIALS[id].title}`}>
        <FileText size={16} /><span><b>{id}</b><span className="file-name">{MATERIALS[id].title}</span></span>
      </button>
      {removable && <button type="button" className="remove-file" aria-label={`移除材料 ${id}`} title={`移除材料 ${id}`}
        onClick={() => { update(current => ({ ...current, draftMaterials: current.draftMaterials.filter(x => x !== id) })); notify(`已移除材料 ${id}，本次结果将不使用它。`); }}><X size={14} /></button>}
    </span>)}
  </div>;

  const composer = (isHome = false) => <div className={`composer-wrap ${isHome ? 'home-composer' : ''}`}>
    <div className={`composer ${running ? 'is-running' : ''}`}>
      {s.draftMaterials.length > 0 && s.view !== 'confirm' && materialTags(s.draftMaterials, true, true)}
      <textarea ref={input} aria-label="输入你的问题" placeholder={'输入 “/” 唤起插件和工具，或直接提问'}
        value={s.draft} onChange={event => update(current => ({ ...current, draft: event.target.value }))}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault(); if (!running) send();
          }
        }} rows={2} />
      <div className="composer-controls">
        <IconButton label="添加材料" onClick={() => setDialog({ type: 'attachments' })}><Plus size={21} /></IconButton>
        <div className="model-controls">
          <button className="model-button" onClick={() => info('快速 · 进阶', '保留主端的模型选项样式。本原型的摘要、对比表和提纲由本地规则与模板生成，不调用真实 Kimi 模型。')}>快速<span>进阶</span></button>
          <IconButton label="语音输入说明" onClick={() => info('语音输入', '此入口仅展示主端控件样式。请通过文本输入体验本次材料任务。')}><Mic size={18} /></IconButton>
          {running ? <IconButton label="停止输出" className="send-button stop" onClick={() => { update(cancel); notify('已停止整理，可以重新开始。'); }}><Square size={15} fill="currentColor" /></IconButton>
            : <IconButton label={s.view === 'confirm' ? '开始整理' : '发送'} className="send-button" disabled={!s.draft.trim() || invalid || (s.view === 'confirm' && !confirmIds.length)} onClick={send}><ArrowUp size={22} /></IconButton>}
        </div>
      </div>
    </div>
    {isHome ? <>
      <div className="tool-tray">
        <button onClick={() => info('新建项目', '项目可以集中管理任务与材料。本次 P0 原型使用当前课堂材料，无需创建项目。')}><FolderPlus size={16} />新建项目</button>
        <button onClick={() => info('插件', '主端插件入口保留为功能说明；本演示无需调用外部工具。')}><span className="plugin-mini"><Puzzle size={16} /></span>插件</button>
        <button className="client-link" onClick={() => info('使用客户端', '这里保留主端的客户端入口样式。本原型直接在浏览器内运行。')}><Monitor size={16} />使用客户端</button>
      </div>
      <div className="capabilities">
        {[
          [Box, '3D Make', '通过对话探索三维创作。'],
          [Presentation, 'PPT', '把内容组织成演示文稿。'],
          [Search, '深度研究', '围绕复杂问题展开研究。'],
          [FileText, '文档', '阅读、整理与编写文档。'],
          [Hammer, '构建应用', '从需求开始创建应用。'],
          [Table2, '表格', '组织数据与比较不同维度。'],
        ].map(([Icon, label, detail]) => {
          const Component = Icon as typeof Box;
          return <button key={label as string} onClick={() => info(label as string, `${detail}此入口为主端样式的功能说明，未接入真实工具。`)}><Component size={16} />{label as string}</button>;
        })}
        <IconButton label="更多功能" onClick={() => info('更多功能', '本次只实现历史任务延伸建议，以及课堂材料的摘要、对比与提纲。')}><ChevronRight size={19} /></IconButton>
      </div>
    </> : <div className="input-footnote">{s.view === 'confirm' ? '核对材料和请求后再开始 · Enter 发送，Shift + Enter 换行' : '合成演示材料 · 本地规则输出，请核对内容'}</div>}
  </div>;

  return <>
    <div className="demo-toolbar">
      <div className="demo-status"><span className="demo-pill">P0 演示</span><span className="stage"><i />{s.visitNumber === 1 ? '注册第一天 · 首次使用' : `第 ${Math.floor((s.now - s.registeredAt) / 86400000) + 1} 天 · 回访`}</span><span className="demo-clock">{clockText(s.now)}</span></div>
      <div className="demo-actions">
        <button className="day-button" onClick={() => { update(revisit); setSourceOpen(false); notify('已模拟离开并推进 24 小时，读取之前准备的候选。'); }}><CalendarDays size={15} /><span>模拟第二天回访</span><ArrowUpRight size={14} /></button>
        <div className="scenario-anchor">
          <button className={`toolbar-button ${menuOpen ? 'active' : ''}`} aria-label="场景" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls={menuOpen ? 'scenario-menu' : undefined}><MoreHorizontal size={17} /><span>场景</span></button>
          {menuOpen && <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="scenario-menu" id="scenario-menu">
              <div className="menu-label">快速进入</div>
              <button onClick={reset}>初次使用<span>清理本原型数据</span></button>
              <button onClick={() => loadExample('ready')}>直接体验回访<span>载入示例材料历史</span></button>
              <div className="menu-label">异常场景</div>
              <button onClick={() => loadExample('unmatched')}>无匹配历史<span>示例：周末旅行规划</span></button>
              <button onClick={() => loadExample('pending')}>候选延迟<span>约 12 秒后准备好</span></button>
              <button onClick={() => loadExample('failed')}>候选生成失败<span>普通输入仍可用</span></button>
              <button onClick={() => { update(current => ({ ...current, nextTaskFail: true })); setMenuOpen(false); notify('下一次任务会模拟失败；失败后可重试。'); }}>下一次任务失败<span>检查恢复与重试</span></button>
              <button onClick={() => { update(current => ({ ...current, now: current.registeredAt + 8 * 86400000, visitNumber: 9, visitId: `expired-${Date.now()}`, presented: [], draft: '', draftMaterials: [], view: 'home', selection: null, activeSessionId: null })); setMenuOpen(false); notify('已模拟注册第 9 天，不再展示首周建议。'); }}>超过首周<span>注册第 9 天，无 P0 建议</span></button>
            </div>
          </>}
        </div>
        <button className={`toolbar-button ${demoOpen ? 'active' : ''}`} aria-label="演示说明" aria-expanded={demoOpen} aria-controls={demoOpen ? 'demo-explanation' : undefined} onClick={() => setDemoOpen(!demoOpen)}><Info size={15} /><span>演示说明</span><ChevronDown size={13} /></button>
        <IconButton label="重置演示" onClick={reset} className="reset-button"><RotateCcw size={15} /></IconButton>
      </div>
    </div>

    {demoOpen && <section className="demo-explanation" id="demo-explanation" aria-label="演示说明">
      <div className="explanation-head"><strong>两次访问之间，发生了什么？</strong><IconButton label="关闭演示说明" onClick={() => setDemoOpen(false)}><X size={17} /></IconButton></div>
      <div className="explanation-grid">
        <div><span className="explanation-label">01 · 历史来源</span><p>{s.source ? `《${s.sessions.find(c => c.id === s.source?.id)?.title}》` : '首轮尚未完成，没有历史推荐。'}</p><small>{s.source ? `来源 ${s.source.id.slice(-8)} · revision ${s.source.revision} · ${s.source.materials.length ? `材料 ${s.source.materials.join(' / ')}` : '无课堂材料'}${s.source.seeded ? ' · 示例历史' : ' · 实际本地会话'}` : '首次使用只完成眼前请求。'}</small></div>
        <div><span className="explanation-label">02 · 候选准备</span><p className="job-status" data-status={s.job.status}><i />{STATUS[s.job.status]} <small>({s.job.status})</small></p><small>准备：{wallTime(s.job.startedAt)} · 可用：{wallTime(s.job.readyAt)}</small><small>候选来源版本：{s.job.revision || '—'} {s.job.reason && `· ${s.job.reason}`}</small></div>
        <div><span className="explanation-label">03 · 模拟范围</span><p>本地规则生成，浏览器内运行。</p><small>时间跳转不等于云端后台执行。关闭页面后不会运行作业；刷新按真实时间恢复。材料均为合成素材。</small></div>
      </div>
      <div className="explanation-tools">
        <button disabled={!s.source?.materials.includes('C')} onClick={() => { update(current => invalidate(current, true)); notify('材料 C 已从来源移除，旧候选失效。'); }}>移除源材料 C</button>
        <button disabled={!s.source} onClick={() => { update(current => invalidate(current)); notify('源会话 revision 已增加，旧候选失效。'); }}>修改源版本</button>
        <button disabled={!s.source?.matched || s.job.status === 'pending'} onClick={() => { update(current => beginJob(current)); notify('正在根据当前来源重新准备；下次进入首页读取建议。'); }}>重新准备候选</button>
        <button onClick={() => { saveDownload('kimi-p0-local-events.json', JSON.stringify(s.events, null, 2), 'application/json;charset=utf-8'); notify('已导出实际本地事件，不包含虚构的历史操作。'); }}><Download size={14} />导出本地事件（{s.events.length}）</button>
        <span>预填 ≠ 执行 · 点击 ≠ 获得产物</span>
      </div>
      <details className="event-details"><summary>查看最近的实际事件</summary><ul>{s.events.slice(-8).reverse().map((e, i) => <li key={i}><code>{e.type}</code><span>{clockText(e.at)}</span></li>)}</ul>{!s.events.length && <p>还没有交互事件。</p>}</details>
    </section>}

    <div className={`product-shell ${s.sidebar ? 'sidebar-open' : ''}`}>
      {s.sidebar && <div className="mobile-nav-backdrop" onClick={() => update(current => ({ ...current, sidebar: false }))} />}
      <aside className="sidebar" aria-label="主导航" {...(!s.sidebar ? { inert: true } : {})}>
        <div className="sidebar-brand"><button onClick={navigateHome}>Kimi</button><IconButton label="折叠导航" onClick={() => update(current => ({ ...current, sidebar: false }))}><PanelLeft size={19} /></IconButton></div>
        <button className="new-chat" onClick={navigateHome}><Plus size={18} />新建会话</button>
        <button className="nav-item" onClick={() => setDialog({ type: 'history' })}><Search size={17} />搜索演示历史</button>
        <button className="nav-item" onClick={() => info('探索 Kimi', '保留主端能力入口。本次可操作范围是 AI 学习材料的历史延伸任务。')}><Box size={17} />探索 Kimi</button>
        <div className="history-label">演示会话</div>
        <div className="history-list">{[...s.sessions].reverse().map(session => <button key={session.id} className={`history-item ${session.id === s.activeSessionId ? 'selected' : ''}`} onClick={() => viewSession(session.id)} title={session.title}>{session.title}{session.seeded && <small>示例</small>}</button>)}
          {!s.sessions.length && <p className="history-empty">完成首次提问后<br />会话将保存在这里</p>}
        </div>
        <div className="sidebar-footer"><span className="avatar">K</span><div>演示新用户<small>仅使用合成材料</small></div></div>
      </aside>

      <main className="product-main">
        <header className="product-header">
          <div>{!s.sidebar && <IconButton label="展开导航" onClick={() => update(current => ({ ...current, sidebar: true }))}><PanelLeft size={20} /></IconButton>}
            {s.view !== 'home' && <button className="back-home" onClick={navigateHome}><ArrowLeft size={15} />首页</button>}
          </div>
          {s.view === 'chat' && <span className="conversation-title">{active?.title}</span>}
          <button className="product-disclaimer" onClick={() => info('关于本原型', '为 Kimi 产品经理笔试制作的 P0 交互演示。UI 参考当前网页端；全部材料为合成素材，输出由本地规则生成。没有接入真实 Kimi 模型、会员交易或线上实验。')}><CircleHelp size={15} /><span>合成材料 · 本地演示</span></button>
        </header>

        {s.view === 'home' ? <div className={`home-page ${candidates.length ? 'revisit-page' : ''}`}>
          <div className="home-content">
            <div className="hero"><div className="kimi-wordmark" aria-label="Kimi">KIMI<span className="brand-spark" /></div><p>尽管问，或做个 Agent 任务<span className="welcome-dots">...</span></p></div>
            {s.seededNotice && <div className="seeded-notice"><Info size={13} />已载入示例历史 <button onClick={() => update(current => ({ ...current, seededNotice: false }))} aria-label="关闭示例历史说明"><X size={13} /></button></div>}
            {candidates.length > 0 && <section className="recommendations" aria-label="历史任务延伸建议">
              <div className="recommendation-heading"><h1>接着上次，还可以这样做</h1><button className="skip-button" onClick={() => { update(skip); setSourceOpen(false); focusInput(); }}>跳过，直接提问<ChevronRight size={14} /></button></div>
              <button className="source-toggle" onClick={() => setSourceOpen(!sourceOpen)} aria-expanded={sourceOpen}><Clock3 size={14} />基于{s.source && s.now - s.source.createdAt < 2 * 86400000 ? '昨天' : '近期'}的《AI 学习材料阅读》<ChevronDown size={14} className={sourceOpen ? 'rotated' : ''} /></button>
              {sourceOpen && <div className="source-summary"><div className="source-summary-head"><strong>上次聊到这里</strong><IconButton label="关闭来源摘要" onClick={() => setSourceOpen(false)}><X size={15} /></IconButton></div><p>{s.source?.summary}</p>{materialTags(s.source?.materials ?? [])}<button className="source-session-link" onClick={() => s.source && viewSession(s.source.id)}>查看源会话<ArrowUpRight size={14} /></button></div>}
              <div className="suggestion-grid">{candidates.map(c => <div className="suggestion" key={c.id}>
                <button className="suggestion-main" onClick={() => select(c)} aria-label={c.title}>
                  <span className="suggestion-icon">{c.kind === 'compare' ? <Table2 size={20} /> : <Presentation size={20} />}</span>
                  <span className="suggestion-copy"><strong>{c.title}</strong><span>{c.benefit}</span></span><ArrowUpRight size={16} className="suggestion-arrow" />
                </button>
                <button className="decline-button" aria-label={`与我无关：${c.kind === 'compare' ? '对比表' : '汇报提纲'}`} onClick={() => { update(current => decline(current, c.id)); notify('已隐藏这条建议，后续不会重复展示。'); }}>与我无关</button>
              </div>)}</div>
            </section>}
            {composer(true)}
            {!s.initialDone && s.visitNumber === 1 && <p className="synthetic-note">已附三份课堂材料 · 均为合成演示素材，可点击查看</p>}
          </div>
          <button className="inspiration" onClick={() => info('探索灵感', '从你已有的目标出发，也可以自由提出新问题。P0 仅在首周回访、有合适材料历史时提供建议。')}><Lightbulb size={16} />探索灵感</button>
        </div> : s.view === 'confirm' ? <div className="confirm-page">
          <div className="confirm-content">
            <div className="confirm-intro"><span className="mini-brand">Kimi</span><h1>从已有材料，继续往前一步</h1><p>背景已经带入。核对一下，再开始整理。</p></div>
            <section className="context-review" aria-label="本次任务材料确认">
              <div className="context-heading"><BookOpen size={17} /><span>来自《AI 学习材料阅读》</span><button onClick={() => setSourceOpen(!sourceOpen)} aria-expanded={sourceOpen}>查看来源<ChevronDown size={14} /></button></div>
              <p className="context-summary">{s.source?.summary}</p>
              {sourceOpen && <div className="confirmation-source"><p>上次只完成了材料 A 的摘要。本次将使用下方保留的材料，生成新的产物。</p><button onClick={() => s.source && viewSession(s.source.id)}>查看源会话<ArrowUpRight size={14} /></button></div>}
              <div className="context-material-label"><span>本次使用的材料</span><small>点击查看 · 可移除</small></div>
              {materialTags(confirmIds, true)}
              {!confirmIds.length && <p className="empty-materials">没有保留材料。请通过下方加号添加，或返回首页直接提问。</p>}
              {s.selection && <p className="context-removed">本次仅使用材料 {confirmIds.join('、') || '（无）'}。请求里提到但已移除的材料将不参与结果。</p>}
              {invalid && <div className="validation-warning" role="alert"><CircleAlert size={16} /><div><strong>来源已经更新，请重新核对</strong><p>旧材料不会被继续带入。你的请求仍保留。</p></div><button onClick={() => { update(revalidateSelection); notify('已更新材料上下文，请确认当前请求。'); }}>更新并核对</button></div>}
            </section>
            <div className="request-label">可编辑的任务请求<span>修改后按你的新目标执行</span></div>
            {composer()}
            <div className="confirm-actions"><button className="secondary-button" onClick={navigateHome}><ArrowLeft size={15} />返回首页</button><button className="primary-button" disabled={!s.draft.trim() || invalid || !confirmIds.length || !!running} onClick={send}>开始整理<ArrowUp size={16} /></button></div>
          </div>
        </div> : <div className="chat-page">
          <div className="conversation">
            {active?.messages.map(message => message.role === 'user' ? <div className="user-message" key={message.id}><p>{message.text}</p>{materialTags(message.materials.map(m => m.id), false, true)}</div>
              : <article className="assistant-message" key={message.id}><div className="assistant-avatar" aria-label="Kimi">K<span /></div><div className="assistant-content"><Result message={message} /><div className="result-actions"><button onClick={() => copyResult(message)}><Copy size={15} />复制</button><button onClick={() => exportResult(message)}><Download size={15} />导出 Markdown</button>{message.kind !== 'unsupported' && <span><CheckCheck size={14} />依据已确认材料</span>}</div></div></article>)}
            {active?.task?.status === 'running' && <div className="task-progress" role="status"><span className="loading-dots"><i /><i /><i /></span><div>正在整理材料<span>本地演示输出 · 可随时停止</span></div></div>}
            {active?.task && ['failed', 'cancelled'].includes(active.task.status) && <div className="task-error" role="status"><CircleAlert size={18} /><div><strong>{active.task.status === 'failed' ? '这次整理未完成' : '已停止整理'}</strong><p>{active.task.failureReason === 'source_material_removed' ? '源材料已变化，任务已中止。重新整理将只使用当前保留的材料。' : active.task.status === 'failed' ? '模拟任务失败。原问题和已确认材料仍保留。' : '没有生成完整产物。原问题和材料仍保留。'}</p></div><button onClick={() => update(retry)}><RotateCcw size={14} />重新整理</button></div>}
          </div>
          <div className="chat-composer">{composer()}</div>
          <div ref={endRef} />
        </div>}
      </main>
    </div>

    {dialog && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(null); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={dialogRef}>
        <div className="modal-header"><h2 id="modal-title">{dialog.type === 'material' ? `材料 ${dialog.id} · ${MATERIALS[dialog.id].title}` : dialog.type === 'attachments' ? '选择本次使用的材料' : dialog.type === 'history' ? '搜索演示历史' : dialog.title}</h2><IconButton label="关闭弹层" onClick={() => setDialog(null)}><X size={20} /></IconButton></div>
        {dialog.type === 'material' ? <div className="material-detail"><p className="material-demo-badge"><Info size={14} />合成演示素材 · 不是实际论文</p><dl>{[
          ['场景', MATERIALS[dialog.id].scene], ['关注内容', MATERIALS[dialog.id].focus],
          ['材料记录', MATERIALS[dialog.id].record], ['可以讨论', MATERIALS[dialog.id].supports],
          ['证据边界', MATERIALS[dialog.id].boundary], ['不能推出', MATERIALS[dialog.id].cannot],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button className="secondary-button" onClick={() => setDialog(null)}>返回当前任务</button></div>
          : dialog.type === 'attachments' ? <div className="attachment-picker"><p>课堂材料已预置，无需寻找或上传文件。</p>{(s.source ? s.source.materials : ['A', 'B', 'C'] as MaterialId[]).map(id => <button key={id} className={s.draftMaterials.includes(id) ? 'picked' : ''} onClick={() => update(current => ({ ...current, draftMaterials: current.draftMaterials.includes(id) ? current.draftMaterials.filter(x => x !== id) : [...current.draftMaterials, id].sort() }))}><FileText size={20} /><span><b>材料 {id}</b>{MATERIALS[id].title}</span>{s.draftMaterials.includes(id) ? <Check size={18} /> : <Plus size={18} />}</button>)}{s.source?.materials.length === 0 && <p>当前示例历史不包含课堂材料。</p>}<button className="primary-button" onClick={() => setDialog(null)}>确认材料</button></div>
          : dialog.type === 'history' ? <div className="history-search"><input aria-label="搜索会话名称" autoFocus placeholder="输入会话名称" value={historySearch} onChange={e => setHistorySearch(e.target.value)} />{s.sessions.filter(c => c.title.includes(historySearch)).map(c => <button key={c.id} onClick={() => viewSession(c.id)}><Clock3 size={16} />{c.title}<ChevronRight size={15} /></button>)}{!s.sessions.filter(c => c.title.includes(historySearch)).length && <p>没有匹配的演示会话。</p>}</div>
            : <div className="info-body"><p>{dialog.text}</p><button className="primary-button" onClick={() => setDialog(null)}>我知道了</button></div>}
      </div>
    </div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </>;
}

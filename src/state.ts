import { INITIAL_REQUEST, MATERIALS, SOURCE_SUMMARY, contextRequest, type Material, type MaterialId } from './materials';

export const STORAGE_KEY = 'kimi-p0-prototype:v1';
export type JobStatus = 'idle' | 'pending' | 'ready' | 'failed' | 'stale';
export type TaskStatus = 'unstarted' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type ResultKind = 'summary' | 'compare' | 'outline' | 'unsupported';
export interface Event {
  type: string; at: number; visitId: string; data: Record<string, unknown>;
}
export interface Candidate {
  id: string; kind: 'compare' | 'outline'; title: string; benefit: string;
  sourceId: string; revision: number; materials: MaterialId[]; materialVersions: Record<string, number>;
  generatedAt: number;
}
export interface Source {
  id: string; revision: number; materials: MaterialId[];
  goal: string; summary: string; matched: boolean; seeded: boolean; createdAt: number;
}
export interface Job {
  id: string; status: JobStatus; sourceId: string | null; revision: number;
  startedAt: number | null; dueAt: number | null; readyAt: number | null;
  shouldFail: boolean; candidates: Candidate[]; reason: string;
}
export interface Task {
  id: string; status: TaskStatus; kind: ResultKind; prompt: string;
  materials: Material[]; dueAt: number; shouldFail: boolean; recommendationId?: string; failureReason?: string;
}
export interface Message {
  id: string; role: 'user' | 'assistant'; text: string; kind?: ResultKind;
  materials: Material[]; taskId?: string;
}
export interface Session {
  id: string; title: string; messages: Message[]; task: Task | null; createdAt: number;
  sourceId?: string; recommendationId?: string; seeded?: boolean;
}
export interface State {
  schema: 1; registeredAt: number; now: number; visitId: string; visitNumber: number;
  source: Source | null; job: Job; sessions: Session[];
  view: 'home' | 'confirm' | 'chat'; activeSessionId: string | null;
  draft: string; draftMaterials: MaterialId[]; selection: Candidate | null;
  skippedVisits: string[]; declined: string[]; presented: string[];
  events: Event[]; initialDone: boolean; nextTaskFail: boolean;
  delayMs: number; seededNotice: boolean; sidebar: boolean;
}
const DEMO_START = Date.UTC(2026, 10, 20, 10, 0);
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
function idleJob(): Job {
  return { id: uid('job'), status: 'idle', sourceId: null, revision: 0, startedAt: null,
    dueAt: null, readyAt: null, shouldFail: false, candidates: [], reason: '' };
}
export function initialState(): State {
  return {
    schema: 1, registeredAt: DEMO_START, now: DEMO_START, visitId: uid('visit'), visitNumber: 1,
    source: null, job: idleJob(), sessions: [], view: 'home', activeSessionId: null,
    draft: INITIAL_REQUEST, draftMaterials: ['A', 'B', 'C'], selection: null,
    skippedVisits: [], declined: [], presented: [], events: [], initialDone: false,
    nextTaskFail: false, delayMs: 1500, seededNotice: false, sidebar: false,
  };
}
export function loadState(): State {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as State | null;
    if (value?.schema === 1 && Array.isArray(value.sessions) && Array.isArray(value.events) && value.job) {
      // Persisted dueAt is real wall time. Resumption occurs through the same tick path.
      return settle(value);
    }
  } catch { /* Missing/corrupt prototype storage never touches another application's keys. */ }
  return initialState();
}
export function log(s: State, type: string, data: Record<string, unknown> = {}): State {
  return { ...s, events: [...s.events, { type, at: s.now, visitId: s.visitId, data }].slice(-300) };
}
export function sourceValid(s: State, candidate: Candidate): boolean {
  return !!s.source && s.source.matched && s.source.id === candidate.sourceId
    && s.source.revision === candidate.revision
    && candidate.materials.every(id => s.source!.materials.includes(id) && MATERIALS[id]?.version === candidate.materialVersions[id]);
}
function eligible(s: State): boolean {
  const age = s.now - s.registeredAt;
  return s.visitNumber > 1 && age >= 0 && age < 7 * 86400000 && !!s.source?.matched
    && s.job.status === 'ready' && !s.skippedVisits.includes(s.visitId);
}
export function visibleCandidates(s: State): Candidate[] {
  if (!eligible(s)) return [];
  return s.presented.map(id => s.job.candidates.find(c => c.id === id))
    .filter((c): c is Candidate => !!c && sourceValid(s, c) && !isDeclined(s, c));
}
function isDeclined(s: State, c: Candidate): boolean {
  return s.declined.some(id => id === c.id || (id.startsWith(`${c.sourceId}:`) && id.endsWith(`:${c.kind}`)));
}
function enterHome(s: State): State {
  const presented = eligible(s)
    ? s.job.candidates.filter(c => sourceValid(s, c) && !isDeclined(s, c)).map(c => c.id) : [];
  let next: State = { ...s, view: 'home', activeSessionId: null, selection: null, presented,
    draft: '', draftMaterials: [] };
  if (presented.length) next = log(next, 'recommendation_impression', { candidateIds: presented, sourceId: s.source?.id, revision: s.source?.revision });
  return next;
}
export function home(s: State): State {
  if (!s.initialDone && !s.sessions.length && s.visitNumber === 1) {
    return { ...s, view: 'home', activeSessionId: null, selection: null, presented: [],
      draft: INITIAL_REQUEST, draftMaterials: ['A', 'B', 'C'] };
  }
  // New chat in the same skipped visit must stay blank.
  return enterHome(s);
}
export function revisit(s: State): State {
  const next = { ...s, now: s.now + 86400000, visitId: uid('visit'), visitNumber: s.visitNumber + 1 };
  return enterHome(log(next, 'visit_started', { simulatedHours: 24 }));
}
export function beginJob(s: State, options: { fail?: boolean; delay?: number } = {}): State {
  if (!s.source?.matched || s.source.materials.length < 2) {
    return { ...s, job: { ...idleJob(), reason: '没有适合延伸的材料阅读历史。' }, presented: [] };
  }
  const job: Job = {
    ...idleJob(), status: 'pending', sourceId: s.source.id, revision: s.source.revision,
    startedAt: Date.now(), dueAt: Date.now() + (options.delay ?? s.delayMs),
    shouldFail: !!options.fail, reason: '',
  };
  return log({ ...s, job, presented: [] }, 'candidate_job_pending', { jobId: job.id, sourceId: job.sourceId, revision: job.revision });
}
function generateCandidates(s: State): Candidate[] {
  const src = s.source;
  if (!src || !src.matched || src.materials.length < 2 || src.id !== s.job.sourceId || src.revision !== s.job.revision) return [];
  const count = src.materials.length === 3 ? '三' : '两';
  const base = { sourceId: src.id, revision: src.revision, materials: [...src.materials],
    materialVersions: Object.fromEntries(src.materials.map(id => [id, MATERIALS[id].version])), generatedAt: Date.now() };
  return [
    { ...base, id: `${src.id}:${src.revision}:compare`, kind: 'compare', title: `把这${count}份材料整理成研究对比表`,
      benefit: '对齐场景、关注内容、可支持的判断和证据边界。' },
    { ...base, id: `${src.id}:${src.revision}:outline`, kind: 'outline', title: '整理共识与分歧，生成课堂汇报提纲',
      benefit: `从${count}份材料出发，形成讨论问题和汇报结构。` },
  ];
}
export function settle(state: State): State {
  let s = state;
  if (s.job.status === 'pending' && s.job.dueAt != null && Date.now() >= s.job.dueAt) {
    const candidates = generateCandidates(s);
    const status: JobStatus = s.job.shouldFail ? 'failed' : candidates.length ? 'ready' : 'stale';
    s = log({ ...s, job: { ...s.job, status, candidates: status === 'ready' ? candidates : [],
      readyAt: status === 'ready' ? Date.now() : null,
      reason: status === 'failed' ? '演示：候选生成失败。普通输入不受影响。' : status === 'stale' ? '来源已变化，旧候选失效。' : '' } },
    `candidate_job_${status}`, { jobId: s.job.id, revision: s.job.revision });
    // Deliberately do not update presented: pending completion must never inject suggestions into the current entry.
  }
  const running = s.sessions.find(c => c.task?.status === 'running' && Date.now() >= c.task.dueAt);
  if (running?.task) {
    const t = running.task;
    const missingSourceMaterial = !!s.source && t.materials.some(m => !s.source!.materials.includes(m.id));
    if (t.shouldFail || missingSourceMaterial) {
      s = { ...s, sessions: s.sessions.map(c => c.id === running.id ? { ...c, task: { ...t, status: 'failed',
        failureReason: missingSourceMaterial ? 'source_material_removed' : 'simulated_failure' } } : c) };
      return log(s, 'task_failed', { taskId: t.id, recommendationId: t.recommendationId,
        reason: missingSourceMaterial ? 'source_material_removed' : 'simulated_failure' });
    }
    const response: Message = { id: uid('msg'), role: 'assistant', kind: t.kind,
      text: t.kind === 'unsupported'
        ? '已保留你的原问题。本演示只支持已附课堂材料的摘要、对比表与汇报提纲，暂时不能回答这个问题。你可以编辑原问题，或继续材料任务。'
        : '', materials: t.materials, taskId: t.id };
    const updated: Session = { ...running, messages: [...running.messages, response], task: { ...t, status: 'succeeded' } };
    s = { ...s, sessions: s.sessions.map(c => c.id === running.id ? updated : c) };
    s = log(s, t.kind === 'unsupported' ? 'unsupported_response' : 'result_completed',
      { taskId: t.id, kind: t.kind, materialIds: t.materials.map(m => m.id), recommendationId: t.recommendationId });
    if (t.kind === 'summary' && !s.initialDone && t.materials.some(m => m.id === 'A')) {
      const available = t.materials.map(m => m.id);
      s = { ...s, initialDone: true, source: { id: running.id, revision: 1, materials: available,
        goal: t.prompt, summary: SOURCE_SUMMARY.replace('A、B、C', available.join('、')),
        matched: /课堂|汇报|AI|学习/.test(t.prompt), seeded: false, createdAt: s.now },
        sessions: s.sessions.map(c => c.id === running.id ? { ...updated, title: 'AI 学习材料阅读' } : c) };
      s = beginJob(s);
    }
  }
  return s;
}
export function choose(s: State, candidate: Candidate): State {
  if (!sourceValid(s, candidate)) return s;
  return log({ ...s, view: 'confirm', activeSessionId: null, selection: candidate,
    draft: contextRequest(candidate.kind, candidate.materials), draftMaterials: [...candidate.materials],
    presented: [] }, 'recommendation_clicked', { candidateId: candidate.id, sourceId: candidate.sourceId, revision: candidate.revision });
}
export function skip(s: State): State {
  return log({ ...s, view: 'home', selection: null, presented: [], draft: '', draftMaterials: [],
    skippedVisits: [...new Set([...s.skippedVisits, s.visitId])] }, 'recommendation_skipped');
}
export function decline(s: State, id: string): State {
  return log({ ...s, declined: [...new Set([...s.declined, id])], presented: s.presented.filter(x => x !== id) },
    'recommendation_declined', { candidateId: id });
}
export function invalidate(s: State, removeC = false): State {
  if (!s.source) return s;
  const materials = removeC ? s.source.materials.filter(id => id !== 'C') : s.source.materials;
  const summary = `你准备做关于 AI 辅助学习的课堂汇报，当前保留材料 ${materials.join('、')}。上次已理解材料 A 的内容与证据边界。`;
  return log({ ...s, source: { ...s.source, revision: s.source.revision + 1, materials, summary },
    job: { ...s.job, status: 'stale', candidates: [], reason: '源会话版本已变化，需要重新准备建议。' },
    presented: [] }, 'source_invalidated', { removed: removeC ? 'C' : null, revision: s.source.revision + 1 });
}
export function revalidateSelection(s: State): State {
  if (!s.selection || !s.source) return s;
  const ids = s.draftMaterials.filter(id => s.source!.materials.includes(id));
  const updated: Candidate = { ...s.selection, revision: s.source.revision, materials: [...s.source.materials],
    materialVersions: Object.fromEntries(s.source.materials.map(id => [id, MATERIALS[id].version])) };
  return log({ ...s, selection: updated, draftMaterials: ids }, 'task_context_revalidated', { revision: updated.revision, materialIds: ids });
}
export function inferKind(prompt: string, materials: MaterialId[], s: State): ResultKind {
  if (!materials.length) return 'unsupported';
  // User-entered goals take precedence over the clicked candidate; unsupported requests never become a recommendation.
  if (/提纲|汇报结构/.test(prompt) && /材料|AI|学习|课堂/.test(prompt)) return 'outline';
  if (/对比|比较|表格|对照表/.test(prompt) && /材料|AI|学习|课堂/.test(prompt)) return 'compare';
  if (/材料\s*A|材料A/.test(prompt) && /概括|总结|读懂|摘要|局限|内容/.test(prompt) && materials.includes('A')) return 'summary';
  if (!s.initialDone && materials.includes('A') && /先.*A/.test(prompt)) return 'summary';
  return 'unsupported';
}
export function submit(s: State): { state: State; error?: string } {
  if (!s.draft.trim()) return { state: s, error: '请先输入你的问题。' };
  if (s.sessions.some(c => c.task?.status === 'running')) return { state: s, error: '当前任务正在整理，请先停止或等待完成。' };
  if (s.selection && !sourceValid(s, s.selection)) {
    return { state: s, error: '来源已经更新，请先核对当前材料，再开始整理。' };
  }
  if (s.selection && !s.draftMaterials.length) return { state: s, error: '没有可用材料。请添加材料，或回首页直接提问。' };
  const validIds = s.source ? s.draftMaterials.filter(id => s.source!.materials.includes(id)) : s.draftMaterials;
  const materials = validIds.map(id => ({ ...MATERIALS[id] }));
  const kind = inferKind(s.draft, validIds, s);
  const task: Task = { id: uid('task'), status: 'running', kind, prompt: s.draft,
    materials, dueAt: Date.now() + 1600, shouldFail: s.nextTaskFail, recommendationId: s.selection?.id };
  const user: Message = { id: uid('msg'), role: 'user', text: s.draft, materials, taskId: task.id };
  const existing = s.view === 'chat' ? s.sessions.find(c => c.id === s.activeSessionId) : null;
  const session: Session = existing
    ? { ...existing, messages: [...existing.messages, user], task }
    : { id: uid('session'), title: kind === 'summary' ? 'AI 学习材料阅读' : kind === 'compare' ? 'AI 学习材料 · 研究对比表'
      : kind === 'outline' ? 'AI 学习材料 · 课堂汇报提纲' : s.draft.trim().slice(0, 18),
      messages: [user], task, createdAt: s.now, sourceId: s.selection?.sourceId ?? s.source?.id, recommendationId: s.selection?.id };
  let next: State = { ...s, sessions: existing ? s.sessions.map(c => c.id === session.id ? session : c) : [...s.sessions, session],
    view: 'chat', activeSessionId: session.id, draft: '', selection: null, presented: [],
    draftMaterials: validIds, nextTaskFail: false };
  next = log(next, 'task_confirmed', { taskId: task.id, kind, prompt: task.prompt,
    materialIds: validIds, recommendationId: task.recommendationId, sourceRevision: s.selection?.revision });
  return { state: next };
}
export function cancel(s: State): State {
  const running = s.sessions.find(c => c.task?.status === 'running');
  if (!running?.task) return s;
  return log({ ...s, sessions: s.sessions.map(c => c.id === running.id ? { ...c, task: { ...running.task!, status: 'cancelled' } } : c) },
    'task_cancelled', { taskId: running.task.id });
}
export function retry(s: State): State {
  const session = s.sessions.find(c => c.id === s.activeSessionId);
  if (!session?.task || !['failed', 'cancelled'].includes(session.task.status)) return s;
  const original = session.task;
  const allowed = s.source ? s.source.materials : original.materials.map(m => m.id);
  const task: Task = { ...original, id: uid('task'), status: 'running', shouldFail: false, failureReason: undefined, dueAt: Date.now() + 1600,
    materials: original.materials.filter(m => allowed.includes(m.id)) };
  return log({ ...s, sessions: s.sessions.map(c => c.id === session.id ? { ...c, task } : c) }, 'task_retry_confirmed',
    { taskId: task.id, originalTaskId: original.id, materialIds: task.materials.map(m => m.id) });
}
export function seed(mode: 'ready' | 'unmatched' | 'pending' | 'failed'): State {
  let s = initialState();
  const id = uid('source');
  const unmatched = mode === 'unmatched';
  const source: Source = { id, revision: 1, materials: unmatched ? [] : ['A', 'B', 'C'],
    goal: unmatched ? '周末短途旅行规划' : INITIAL_REQUEST,
    summary: unmatched ? '你上次规划了一次周末短途旅行，没有材料阅读任务。' : SOURCE_SUMMARY,
    matched: !unmatched, seeded: true, createdAt: s.now };
  const msgs: Message[] = unmatched ? [
    { id: uid('msg'), role: 'user', text: '请帮我规划周末短途旅行。', materials: [] },
    { id: uid('msg'), role: 'assistant', text: '这是一条与课堂材料无关的示例历史，仅用于验证不匹配时不展示建议。', materials: [] },
  ] : [
    { id: uid('msg'), role: 'user', text: INITIAL_REQUEST, materials: Object.values(MATERIALS) },
    { id: uid('msg'), role: 'assistant', text: '', kind: 'summary', materials: Object.values(MATERIALS) },
  ];
  s = { ...s, initialDone: true, source, seededNotice: true,
    sessions: [{ id, title: unmatched ? '周末短途旅行规划' : 'AI 学习材料阅读', messages: msgs, task: null, seeded: true, createdAt: s.now }],
    now: s.now + 86400000, visitNumber: 2, visitId: uid('visit'), draft: '', draftMaterials: [] };
  // Only seed-load is logged. We never invent prior impressions, submissions, or completions.
  s = log(s, 'example_history_loaded', { mode, sourceId: id });
  if (!unmatched) {
    s = beginJob(s, { delay: mode === 'pending' ? 12000 : 0, fail: mode === 'failed' });
    s = settle(s);
  }
  return enterHome(s);
}

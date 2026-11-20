export type MaterialId = 'A' | 'B' | 'C';
export interface Material {
  id: MaterialId;
  title: string;
  version: number;
  scene: string;
  focus: string;
  record: string;
  supports: string;
  boundary: string;
  cannot: string;
  missing: string;
}

// Single source of truth for material previews, candidate context and result artifacts.
export const MATERIALS: Record<MaterialId, Material> = {
  A: {
    id: 'A', version: 1, title: '课堂讨论中的 AI 辅助',
    scene: '课堂讨论', focus: '课堂发言与即时理解',
    record: '使用 AI 追问和解释后的讨论发言与理解表现。',
    supports: '可以讨论工具如何参与课堂互动。',
    boundary: '未提供分组方式、因果识别方法或延迟记忆测验。',
    cannot: '不能推出长期学习效果已经提升。',
    missing: '分组方式、因果识别方法、延迟记忆测验：未提供。',
  },
  B: {
    id: 'B', version: 1, title: '写作反馈中的 AI 辅助',
    scene: '写作修订', focus: '稿件修改与反馈采纳',
    record: '使用 AI 建议前后的修订过程。',
    supports: '可以讨论反馈如何进入修改。',
    boundary: '未提供独立修订测验、统一评分量表或组间对照。',
    cannot: '不能推出离开工具后的独立写作能力已经提升。',
    missing: '独立修订测验、统一评分量表、组间对照：未提供。',
  },
  C: {
    id: 'C', version: 1, title: '独立练习中的 AI 辅助',
    scene: '课后练习', focus: '任务完成过程与解题步骤',
    record: '对求助和完成过程作定性记录。',
    supports: '可以讨论工具在练习过程中的作用。',
    boundary: '学习者基础不同、比较条件不统一，未提供独立测验数据。',
    cannot: '不能简单排列三份材料的效果优劣。',
    missing: '统一比较条件、独立测验数据：未提供。',
  },
};

export const INITIAL_REQUEST = '我上传了三份关于 AI 辅助学习的课堂材料，之后要做课堂汇报。现在先帮我读懂材料 A，概括主要内容和局限。';
export const SOURCE_SUMMARY = '你准备做一场关于 AI 辅助学习的课堂汇报，已上传材料 A、B、C。上次先读懂了材料 A：它记录课堂发言与即时理解，但不足以判断长期学习效果。';
export const QUESTIONS = [
  '即时任务表现与离开工具后的独立能力，应该如何区分？',
  '需要什么额外证据，才能判断 AI 辅助的长期学习效果？',
  '不同使用场景之间，哪些结论可以比较，哪些不能直接比较？',
];

export function materialNames(ids: MaterialId[]) {
  return ids.map(id => id).join('、');
}
export function contextRequest(kind: 'compare' | 'outline', ids: MaterialId[]) {
  const names = `材料 ${materialNames(ids)}`;
  return kind === 'compare'
    ? `请基于${names}，按使用场景、关注内容、材料记录、可支持的判断和证据局限整理对比表，最后归纳适合课堂汇报的讨论问题。材料未提供的信息请写“未提供”。`
    : `请基于${names}，整理共识与分歧，生成课堂汇报提纲。包括主题、不同使用场景、共识与差异、证据边界和讨论问题。材料未提供的信息请写“未提供”。`;
}

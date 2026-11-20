import type { Message } from './state';
import { QUESTIONS, type Material } from './materials';

export function resultMarkdown(message: Message): string {
  const ms = message.materials;
  const heading = ms.length === 3 ? '三份材料' : `${ms.length}份材料`;
  if (message.kind === 'unsupported' || !message.kind) return message.text;
  if (message.kind === 'summary') {
    const a = ms.find(m => m.id === 'A');
    if (!a) return '材料 A 未提供，无法生成摘要。';
    return `## 材料 A：先理解内容，再看证据边界\n\n**主要内容**\n${a.title}聚焦${a.scene}，关注${a.focus}。材料记录了${a.record}\n\n**可以如何理解**\n${a.supports} 它可以帮助你描述 AI 参与学习的过程，不能据此证明能力提升。\n\n**局限**\n${a.boundary} ${a.cannot}\n\n课堂汇报中可以这样表述：“这份材料呈现了 AI 参与课堂互动的过程，长期学习效果仍需额外证据。”\n\n*依据合成演示材料 A；没有引用外部研究。*`;
  }
  if (message.kind === 'compare') {
    const rows: [string, keyof Material][] = [
      ['使用场景', 'scene'], ['关注内容', 'focus'], ['材料记录', 'record'],
      ['可支持的判断', 'supports'], ['证据边界', 'boundary'], ['不能推出的结论', 'cannot'], ['方法与数据', 'missing'],
    ];
    return `## AI 辅助学习：${heading}的研究对比表\n\n依据本次确认的材料 ${ms.map(m => m.id).join('、')}。材料描述过程，不等于证明学习效果。\n\n| 比较维度 | ${ms.map(m => `材料 ${m.id} · ${m.scene}`).join(' | ')} |\n|---|${ms.map(() => '---').join('|')}|\n${rows.map(([label, key]) => `| ${label} | ${ms.map(m => m[key]).join(' | ')} |`).join('\n')}\n\n### 适合课堂汇报的讨论问题\n${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n### 汇报时的表述建议\n可以比较${heading}关注的学习环节与证据类型；不宜把不同场景的过程记录，直接排列成学习效果的强弱。\n\n*全部内容来自合成演示材料，未提供的信息没有补编。*`;
  }
  return `## 课堂汇报提纲：AI 进入学习过程之后\n\n### 1. 开场：我们究竟在比较什么？\n主题：AI 如何参与学习过程，以及“任务完成”与“能力提升”的区别。以课堂汇报为目标，先说明材料范围：${ms.map(m => `材料 ${m.id}《${m.title}》`).join('、')}。\n\n### 2. ${heading}，${ms.length}种使用场景\n${ms.map(m => `- **材料 ${m.id} · ${m.scene}**：关注${m.focus}。记录${m.record} ${m.supports}`).join('\n')}\n\n### 3. 共识与差异：比较过程，不排列效果\n共识：这些材料都能帮助讨论 AI 在具体学习环节中的作用，但现有证据不足以推出长期效果或离开工具后的独立能力已经提升。\n差异：${ms.map(m => `${m.id} 聚焦${m.focus}`).join('；')}。\n分歧边界：材料未提供可相互检验的对立结论，不把不同关注点写成已经证实的研究争议。\n\n### 4. 证据边界：哪些结论先不要说？\n${ms.map(m => `- **材料 ${m.id}**：${m.boundary} ${m.cannot}`).join('\n')}\n\n### 5. 留给课堂的讨论\n${QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n收束：AI 辅助的过程值得讨论；要判断学习成效，还需要统一比较条件、独立测验与延迟测验等额外证据。\n\n*提纲仅依据本次确认的合成演示材料；未提供的信息没有补编。*`;
}

export function Result({ message }: { message: Message }) {
  const ms = message.materials;
  if (!message.kind || message.kind === 'unsupported') return <p>{message.text}</p>;
  if (message.kind === 'summary') {
    const a = ms.find(m => m.id === 'A');
    return a ? <div className="result-body">
      <h2>材料 A：先理解内容，再看证据边界</h2>
      <h3>主要内容</h3>
      <p>《{a.title}》聚焦<strong>{a.scene}</strong>，关注{a.focus}。材料记录了{a.record}</p>
      <h3>可以如何理解</h3>
      <p>{a.supports}它可以帮助你描述 AI 参与学习的过程，不能据此证明能力提升。</p>
      <h3>局限</h3>
      <p>{a.boundary}<strong>{a.cannot}</strong></p>
      <blockquote>课堂汇报中可以这样表述：“这份材料呈现了 AI 参与课堂互动的过程，长期学习效果仍需额外证据。”</blockquote>
      <p className="result-note">依据合成演示材料 A · 没有引用外部研究</p>
    </div> : <p>材料 A 未提供，无法生成摘要。</p>;
  }
  if (message.kind === 'compare') {
    const rows: [string, keyof Material][] = [
      ['使用场景', 'scene'], ['关注内容', 'focus'], ['材料记录', 'record'],
      ['可支持的判断', 'supports'], ['证据边界', 'boundary'], ['不能推出的结论', 'cannot'], ['方法与数据', 'missing'],
    ];
    return <div className="result-body">
      <h2>AI 辅助学习：研究对比表</h2>
      <p className="result-lead">已对齐本次确认的材料 {ms.map(m => m.id).join('、')}。这些材料描述学习过程，不等于证明学习效果。</p>
      <div className="table-scroll" role="region" aria-label="研究对比表，可横向滚动" tabIndex={0}>
        <table>
          <caption>合成演示材料的场景、判断与证据边界</caption>
          <thead><tr><th scope="col">比较维度</th>{ms.map(m => <th scope="col" key={m.id}><span className="table-material">材料 {m.id}</span>{m.scene}</th>)}</tr></thead>
          <tbody>{rows.map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{ms.map(m => <td key={m.id}>{m[key]}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <h3>适合课堂汇报的讨论问题</h3>
      <ol>{QUESTIONS.map(q => <li key={q}>{q}</li>)}</ol>
      <h3>汇报时的表述建议</h3>
      <p>可以比较这{ms.length === 3 ? '三' : ms.length === 2 ? '两' : '一'}份材料关注的学习环节与证据类型；不宜把不同场景的过程记录，直接排列成学习效果的强弱。</p>
      <p className="result-note">全部内容来自合成演示材料 · 未提供的信息没有补编</p>
    </div>;
  }
  return <div className="result-body outline-result">
    <h2>课堂汇报提纲：AI 进入学习过程之后</h2>
    <p className="result-lead">从材料 {ms.map(m => m.id).join('、')} 出发，把内容整理成可以讲述、可以讨论的结构。</p>
    <h3><span className="outline-number">01</span>开场：我们究竟在比较什么？</h3>
    <p>主题：AI 如何参与学习过程，以及“任务完成”与“能力提升”的区别。先说明材料范围，再提出这场汇报的核心问题。</p>
    <h3><span className="outline-number">02</span>{ms.length === 3 ? '三' : ms.length === 2 ? '两' : '一'}份材料，不同使用场景</h3>
    <ul>{ms.map(m => <li key={m.id}><strong>材料 {m.id} · {m.scene}</strong>：关注{m.focus}。记录{m.record}{m.supports}</li>)}</ul>
    <h3><span className="outline-number">03</span>共识与差异：比较过程，不排列效果</h3>
    <p><strong>共识：</strong>这些材料都能帮助讨论 AI 在具体学习环节中的作用，但现有证据不足以推出长期效果或离开工具后的独立能力已经提升。</p>
    <p><strong>差异：</strong>{ms.map(m => `${m.id} 聚焦${m.focus}`).join('；')}。</p>
    <p><strong>分歧边界：</strong>材料未提供可相互检验的对立结论，不把不同关注点写成已经证实的研究争议。</p>
    <h3><span className="outline-number">04</span>证据边界：哪些结论先不要说？</h3>
    <ul>{ms.map(m => <li key={m.id}><strong>材料 {m.id}：</strong>{m.boundary}{m.cannot}</li>)}</ul>
    <h3><span className="outline-number">05</span>留给课堂的讨论</h3>
    <ol>{QUESTIONS.map(q => <li key={q}>{q}</li>)}</ol>
    <blockquote>AI 辅助的过程值得讨论；要判断学习成效，还需要统一比较条件、独立测验与延迟测验等额外证据。</blockquote>
    <p className="result-note">仅依据本次确认的合成演示材料 · 未提供的信息没有补编</p>
  </div>;
}

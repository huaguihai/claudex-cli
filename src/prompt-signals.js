function compile(...patterns) {
  return patterns.map((pattern) => new RegExp(pattern, 'i'));
}

const repoResearchPatterns = compile(
  'research', 'investigate', 'explore', 'how does', 'where is', 'find', 'understand',
  '调研', '研究', '分析', '定位', '入口', '谁负责', '哪里', '搞清楚'
);

const boundedFixPatterns = compile(
  'small bug', 'small fix', 'quick fix', 'tiny', 'minor', 'just fix', '明确的小',
  '小 bug', '小修', '修一下', '改一下', '顺手修'
);

const multiFilePatterns = compile(
  'multi-file', 'multiple files', 'cross-file', 'architecture', 'plan first', 'new feature', 'refactor',
  '多文件', '跨文件', '架构', '方案', '新功能', '重构', '先给我方案', '先给方案', '给我方案再做', '先出方案'
);

const providerSensitivePatterns = compile(
  'provider', 'openai-compatible', 'dashscope', 'proxy', 'anthropic', 'gateway',
  'provider', '兼容层', '代理层', '网关', 'provider 差异', '协议'
);

const workflowSensitivePatterns = compile(
  'agent', 'subagent', 'delegate', 'delegation', 'plan', 'workflow', 'enterplanmode', 'task', 'todo',
  'agent 路径', '子代理', '委派', '规划', '工作流', '先 plan', '任务板', '任务', '待办'
);

const capabilityQuestionPatterns = compile(
  'can ', 'does ', 'how do', 'what is', 'should i', '\\?', '？',
  '能不能', '怎么', '如何', '是什么', '该不该', '要不要'
);

const safetySensitivePatterns = compile(
  'risk', 'danger', 'safe', 'safety', 'boundary', 'guardrail',
  '风险', '安全', '边界', '护栏', '危险'
);

const sessionFollowupPatterns = compile(
  'next', 'continue', 'follow up', 'after that', 'then', '顺手', '接着', '继续', '下一步', '刚研究完', '刚才', '再回来', '往下'
);

const verifyIntentPatterns = compile(
  'verify', 'verification', 'smoke', 'replay', '收尾', '验一下', '验证', '验收', '回归', '冒烟'
);

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyPromptSignals(input = '') {
  const text = String(input || '').trim().toLowerCase();
  if (!text) {
    return {
      repoResearch: false,
      boundedFix: false,
      multiFileFeature: false,
      providerSensitive: false,
      workflowSensitive: false,
      capabilityQuestion: false,
      safetySensitive: false,
      sessionFollowup: false,
      verifyIntent: false,
      signalList: []
    };
  }

  const signals = {
    repoResearch: hasAny(text, repoResearchPatterns),
    boundedFix: hasAny(text, boundedFixPatterns),
    multiFileFeature: hasAny(text, multiFilePatterns),
    providerSensitive: hasAny(text, providerSensitivePatterns),
    workflowSensitive: hasAny(text, workflowSensitivePatterns),
    capabilityQuestion: hasAny(text, capabilityQuestionPatterns),
    safetySensitive: hasAny(text, safetySensitivePatterns),
    sessionFollowup: hasAny(text, sessionFollowupPatterns),
    verifyIntent: hasAny(text, verifyIntentPatterns)
  };

  signals.signalList = Object.entries(signals)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  return signals;
}

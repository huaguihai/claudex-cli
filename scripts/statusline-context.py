#!/usr/bin/env python3
"""Claude Code statusLine: 显示当前 context 使用百分比。

原理: 读取会话 transcript(JSONL), 反向取最近一次的 context 占用 ——
compact 边界(compactMetadata.postTokens, 压缩后大小)与真实 assistant usage
谁先遇到用谁; usage ≈ input + cache_read + cache_creation_input_tokens。
跳过 token 全为 0 的合成消息(<synthetic>, API 出错时会留下)。
注意: compact 后若直接取最后一条 usage 会穿透到压缩前的旧值, 显示仍是压缩前的占用。

context 窗口上限:
  - 环境变量 CLAUDE_CTX_LIMIT 优先(整数, 如 1000000)
  - 否则: model id 含 "1m" → 1,000,000, 其余 → 200,000
"""
import sys
import json
import os


def context_limit(model_id):
    override = os.environ.get("CLAUDE_CTX_LIMIT")
    if override:
        try:
            return int(override)
        except ValueError:
            pass
    return 1_000_000 if "1m" in model_id else 200_000


def used_tokens(transcript_path):
    """反向扫 transcript, 返回当前 context 占用 token 数。

    compact 边界(compactMetadata.postTokens, 压缩后大小)与真实 usage,
    谁先在反向遍历中出现就用谁:
      - 从未 compact          → 先遇到 usage, 用它
      - compact 后已有新调用  → 先遇到新 usage(已反映压缩后), 用它
      - compact 后还没发消息  → 先遇到 compactMetadata, 用 postTokens
    若取最后一条 usage 会穿透到压缩前的旧值(即原 bug)。全 0 合成消息跳过。
    """
    try:
        with open(transcript_path, encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        return 0
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        meta = obj.get("compactMetadata")
        if isinstance(meta, dict) and isinstance(meta.get("postTokens"), int):
            return meta["postTokens"]
        message = obj.get("message")
        if not isinstance(message, dict):
            continue
        usage = message.get("usage")
        if not isinstance(usage, dict):
            continue
        total = (usage.get("input_tokens", 0)
                 + usage.get("cache_read_input_tokens", 0)
                 + usage.get("cache_creation_input_tokens", 0))
        if total > 0:  # 跳过全 0 的合成消息
            return total
    return 0


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        print("ctx —")
        return

    model = data.get("model") or {}
    model_id = (model.get("id") or "").lower()
    model_name = model.get("display_name") or model.get("id") or "claude"

    limit = context_limit(model_id)
    used = used_tokens(data.get("transcript_path") or "")
    pct = (used / limit * 100) if limit else 0

    if pct >= 85:
        color = "\033[91m"   # 亮红: 该 /compact 了
    elif pct >= 60:
        color = "\033[93m"   # 亮黄: 留意
    else:
        color = "\033[92m"   # 亮绿: 充裕
    reset = "\033[0m"
    dim = "\033[2m"

    bar_len = 10
    filled = min(bar_len, round(pct / 100 * bar_len))
    bar = "█" * filled + "░" * (bar_len - filled)

    print(f"{dim}{model_name}{reset} {color}{bar} {pct:.0f}%{reset} "
          f"{dim}({used // 1000}k/{limit // 1000}k){reset}")


main()

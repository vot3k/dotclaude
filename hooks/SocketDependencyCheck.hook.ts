#!/usr/bin/env bun
/**
 * SocketDependencyCheck.hook.ts - Supply Chain Security (PreToolUse)
 *
 * Validates npm/yarn/bun/pnpm packages against Socket.dev before installation.
 * Blocks critical issues (malware, typosquatting), prompts on high severity.
 *
 * TRIGGER: npm install *, yarn add *, bun add *, pnpm add *
 * REQUIRES:
 *  Socket Account (API Required)
 *  npm install -g bun
 *  npm install -g @socketsecurity/cli
 *
 * LOGGING: Define directory for logging with the SOCKET_HOOK_LOG_DIR env
 *
 * Fail-open on errors (network timeout, parse failures) for usability.
 * Fail-safe when CLI missing (prompts user).
 */

import { spawnSync } from "child_process";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ========================================
// Log Directory Configuration
// ========================================

/**
 * Get the base directory for security logs.
 * Priority:
 * 1. SOCKET_HOOK_LOG_DIR env var (explicit override)
 * 2. PAI_DIR/MEMORY/SECURITY (PAI users)
 * 3. ~/.socket-security-logs (standalone users)
 */
function getLogDir(): string {
  if (process.env.SOCKET_HOOK_LOG_DIR) {
    return process.env.SOCKET_HOOK_LOG_DIR;
  }
  if (process.env.PAI_DIR) {
    return join(process.env.PAI_DIR, "MEMORY", "SECURITY");
  }
  return join(process.env.HOME || "~", ".socket-security-logs");
}

// ========================================
// Types
// ========================================

interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown> | string;
}

interface SocketAlert {
  name: string;
  severity: "critical" | "high" | "middle" | "low";
  category?: string;
  example?: string;
}

interface SocketResult {
  ok: boolean;
  data?: {
    purl?: string;
    self?: {
      purl?: string;
      score?: {
        overall?: number;
        supplyChain?: number;
        vulnerability?: number;
      };
      alerts?: SocketAlert[];
    };
  };
}

interface SecurityEvent {
  timestamp: string;
  session_id: string;
  event_type: "block" | "warn" | "allow" | "error";
  tool: string;
  package: string;
  alerts?: SocketAlert[];
  reason?: string;
  action_taken: string;
}

// ========================================
// Logging
// ========================================

function generateEventSummary(event: SecurityEvent): string {
  const eventWord = event.event_type;
  const pkg = event.package.replace(/[^a-z0-9]/gi, "-").slice(0, 20);
  return `${eventWord}-${pkg}`;
}

function getSecurityLogPath(event: SecurityEvent): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hour = now.getHours().toString().padStart(2, "0");
  const min = now.getMinutes().toString().padStart(2, "0");
  const sec = now.getSeconds().toString().padStart(2, "0");

  const summary = generateEventSummary(event);
  const timestamp = `${year}${month}${day}-${hour}${min}${sec}`;

  return join(getLogDir(), year, month, `socket-${summary}-${timestamp}.jsonl`);
}

function logSecurityEvent(event: SecurityEvent): void {
  try {
    const logPath = getSecurityLogPath(event);
    const dir = logPath.substring(0, logPath.lastIndexOf("/"));

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(event, null, 2);
    writeFileSync(logPath, content);
  } catch {
    // Logging failure should not block operations
  }
}

// ========================================
// Hook Output Helpers (Claude Code PreToolUse format)
// ========================================

function outputAllow(): void {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
      },
    }),
  );
}

function outputDeny(reason: string): void {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}

function outputAsk(reason: string): void {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    }),
  );
}

// ========================================
// Package Extraction
// ========================================

/**
 * Extract package name from install command
 * Handles: npm install lodash, npm i lodash@4.0.0, yarn add @scope/pkg, etc.
 */
function extractPackageName(command: string): string | null {
  // Patterns for package install commands
  const patterns = [
    /npm\s+(?:install|i|add)\s+([^\s-][^\s]*)/i,
    /yarn\s+add\s+([^\s-][^\s]*)/i,
    /bun\s+add\s+([^\s-][^\s]*)/i,
    /pnpm\s+add\s+([^\s-][^\s]*)/i,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) {
      // Return package name, strip version specifier for lookup
      const pkg = match[1];
      // Handle @scope/package@version -> @scope/package
      return pkg.replace(/@[\d.]+.*$/, "").replace(/@latest$/, "");
    }
  }

  return null;
}

/**
 * Check if command is a lockfile-only install (no package name)
 */
function isLockfileInstall(command: string): boolean {
  // These are lockfile installs, not adding new dependencies
  const lockfilePatterns = [
    /^npm\s+(install|i|ci)\s*$/i,
    /^yarn\s*(install)?\s*$/i,
    /^bun\s+install\s*$/i,
    /^pnpm\s+install\s*$/i,
  ];

  return lockfilePatterns.some((p) => p.test(command.trim()));
}

// ========================================
// Socket.dev Integration
// ========================================

function checkSocketInstalled(): boolean {
  try {
    const result = spawnSync("which", ["socket"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function runSocketCheck(packageName: string): SocketResult | null {
  try {
    const result = spawnSync(
      "socket",
      ["package", "score", "npm", packageName, "--json", "--no-banner"],
      {
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (result.status !== 0) {
      // Socket command failed - could be unknown package or network issue
      return null;
    }

    return JSON.parse(result.stdout) as SocketResult;
  } catch {
    return null;
  }
}

// ========================================
// Decision Logic
// ========================================

function analyzeSocketResult(
  result: SocketResult,
  packageName: string,
  sessionId: string,
): void {
  // Extract alerts from the correct path in the response
  const alerts = result.data?.self?.alerts || [];

  const critical = alerts.filter((a) => a.severity === "critical");
  const high = alerts.filter((a) => a.severity === "high");

  if (critical.length > 0) {
    // Block on critical issues
    const reasons = critical
      .map((a) => `  - ${a.name}: ${a.category || "detected"}`)
      .join("\n");

    logSecurityEvent({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      event_type: "block",
      tool: "Bash",
      package: packageName,
      alerts: critical,
      reason: `Critical supply chain issues detected`,
      action_taken: "Blocked installation",
    });

    outputDeny(
      `🚨 Socket.dev found ${critical.length} CRITICAL issue(s) in "${packageName}":\n\n${reasons}\n\nInstallation blocked for security. Review at: https://socket.dev/npm/package/${packageName}`,
    );
    return;
  }

  if (high.length > 0) {
    // Warn but allow on high severity (user can review)
    const reasons = high
      .map((a) => `  - ${a.name}: ${a.category || "detected"}`)
      .join("\n");

    logSecurityEvent({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      event_type: "warn",
      tool: "Bash",
      package: packageName,
      alerts: high,
      reason: `High severity issues detected`,
      action_taken: "Warned user, allowed installation",
    });

    outputAsk(
      `⚠️ Socket.dev found ${high.length} HIGH severity issue(s) in "${packageName}":\n\n${reasons}\n\nReview at: https://socket.dev/npm/package/${packageName}\n\nProceed with installation?`,
    );
    return;
  }

  // No critical or high issues - allow
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    event_type: "allow",
    tool: "Bash",
    package: packageName,
    alerts: alerts,
    reason: "No critical or high severity issues",
    action_taken: "Allowed installation",
  });

  outputAllow();
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  let input: HookInput;

  try {
    const text = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 100),
      ),
    ]);

    if (!text.trim()) {
      outputAllow();
      return;
    }

    input = JSON.parse(text);
  } catch {
    outputAllow();
    return;
  }

  // Only handle Bash commands
  if (input.tool_name !== "Bash") {
    outputAllow();
    return;
  }

  const command =
    typeof input.tool_input === "string"
      ? input.tool_input
      : (input.tool_input?.command as string) || "";

  if (!command) {
    outputAllow();
    return;
  }

  // Skip lockfile-only installs (npm install, yarn, etc. without package name)
  if (isLockfileInstall(command)) {
    outputAllow();
    return;
  }

  // Extract package name
  const packageName = extractPackageName(command);
  if (!packageName) {
    outputAllow();
    return;
  }

  // Check if Socket CLI is installed
  if (!checkSocketInstalled()) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event_type: "error",
      tool: "Bash",
      package: packageName,
      reason: "Socket CLI not installed",
      action_taken: "Warned user, allowed installation",
    });

    // Fail open but warn
    outputAsk(
      `⚠️ Socket.dev CLI not installed. Cannot verify "${packageName}" for supply chain security.\n\nInstall with: npm install -g @socketsecurity/cli\n\nProceed without verification?`,
    );
    return;
  }

  // Run Socket check
  const result = runSocketCheck(packageName);

  if (!result) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event_type: "error",
      tool: "Bash",
      package: packageName,
      reason: "Socket check failed or timed out",
      action_taken: "Allowed installation (fail-open)",
    });

    // Fail open on Socket errors
    outputAllow();
    return;
  }

  // Analyze results and output decision
  analyzeSocketResult(result, packageName, input.session_id);
}

main().catch(() => {
  outputAllow();
});

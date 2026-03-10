#!/usr/bin/env npx tsx
/**
 * Skill benchmark suite.
 *
 * Two modes:
 *   trigger     — Does the skill get selected based on the user prompt?
 *   mcp-install — Once the skill is active, does the agent auto-install the Solana MCP?
 *
 * Usage:
 *   npx tsx run.ts                          # run both suites
 *   npx tsx run.ts trigger                  # run trigger suite only
 *   npx tsx run.ts mcp-install              # run mcp-install suite only
 *   npx tsx run.ts --verbose                # show model reasoning
 *   npx tsx run.ts trigger --case 3         # run a single trigger case
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────
const MODEL = "claude-haiku-4-5-20251001";
const TARGET_SKILL = "solana-dev";

// ── Helpers ───────────────────────────────────────────────────────────
interface SkillEntry {
  name: string;
  description: string;
}

function loadSkillDescription(path: string): SkillEntry | null {
  try {
    const content = readFileSync(path, "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;
    const frontmatter = match[1];
    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (!name || !description) return null;
    return { name, description };
  } catch {
    return null;
  }
}

function loadSkillBody(path: string): string {
  const content = readFileSync(path, "utf-8");
  // Strip frontmatter
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "").trim();
}

const skills: SkillEntry[] = [
  loadSkillDescription(resolve(__dirname, "../skill/SKILL.md")),
  { name: "remotion-best-practices", description: "Best practices for Remotion - Video creation in React" },
  { name: "find-skills", description: "Helps users discover and install agent skills" },
  { name: "claude-api", description: "Build apps with the Claude API or Anthropic SDK. TRIGGER when: code imports anthropic/@anthropic-ai/sdk/claude_agent_sdk, or user asks to use Claude API, Anthropic SDKs, or Agent SDK." },
  { name: "simplify", description: "Review changed code for reuse, quality, and efficiency, then fix any issues found." },
].filter(Boolean) as SkillEntry[];

const skillBody = loadSkillBody(resolve(__dirname, "../skill/SKILL.md"));

// ── Types ─────────────────────────────────────────────────────────────
interface TestCase {
  prompt: string;
  expected: boolean;
}

interface SuiteResult {
  name: string;
  pass: number;
  fail: number;
  failures: { prompt: string; expected: boolean; got: boolean; reasoning: string }[];
}

// ── Suite runner ──────────────────────────────────────────────────────
async function runSuite(
  client: Anthropic,
  suiteName: string,
  systemPrompt: string,
  cases: TestCase[],
  evaluator: (text: string) => { matched: boolean; reasoning: string },
  verbose: boolean,
  singleCase: number,
): Promise<SuiteResult> {
  const selected = singleCase >= 0 ? [cases[singleCase]] : cases;
  const startIdx = singleCase >= 0 ? singleCase : 0;

  const result: SuiteResult = { name: suiteName, pass: 0, fail: 0, failures: [] };

  console.log(`\n🧪 ${suiteName}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Cases: ${selected.length}\n`);

  for (let i = 0; i < selected.length; i++) {
    const { prompt, expected } = selected[i];
    const idx = startIdx + i + 1;

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const { matched, reasoning } = evaluator(text);
      const ok = matched === expected;

      if (ok) {
        result.pass++;
        console.log(`  ✅ #${idx} ${expected ? "SHOULD" : "SHOULD NOT"} match — "${prompt}"`);
      } else {
        result.fail++;
        console.log(`  ❌ #${idx} ${expected ? "SHOULD" : "SHOULD NOT"} match — "${prompt}"`);
        result.failures.push({ prompt, expected, got: matched, reasoning });
      }

      if (verbose) {
        console.log(`     → ${reasoning}\n`);
      }
    } catch (err: any) {
      result.fail++;
      console.log(`  💥 #${idx} ERROR — "${prompt}": ${err.message}`);
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════
// SUITE 1: Trigger matching
// ══════════════════════════════════════════════════════════════════════
const triggerSystemPrompt = `You are a skill-matching engine for a coding assistant.
You are given a list of available skills with their names and descriptions.
Your job is to decide which skills (if any) should be activated for the user's message.

Available skills:
${skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")}

Respond with a JSON object:
{
  "triggered_skills": ["skill-name", ...],
  "reasoning": "brief explanation"
}

Rules:
- Only include skills that are clearly relevant to the user's request.
- If no skill matches, return an empty array.
- A skill should trigger when the user's request falls within its described scope.
- Do not trigger a skill for tangentially related requests.
- Respond ONLY with the JSON object, no other text.`;

const triggerCases: TestCase[] = [
  // ✅ Should trigger
  { prompt: "Build me a Solana dapp", expected: true },
  { prompt: "Write an Anchor program for a token vault", expected: true },
  { prompt: "How do I create a token on Solana?", expected: true },
  { prompt: "Debug this Solana transaction error", expected: true },
  { prompt: "Set up wallet connection in my Next.js app for Solana", expected: true },
  { prompt: "Test my Solana program with LiteSVM", expected: true },
  { prompt: "Deploy my program to devnet", expected: true },
  { prompt: "Help me with a PDA in Anchor", expected: true },
  { prompt: "How do I send SOL to another wallet?", expected: true },
  { prompt: "My anchor test is failing with AccountNotInitialized", expected: true },
  { prompt: "Generate a client for my Solana program using Codama", expected: true },
  { prompt: "How does Surfpool work for local testing?", expected: true },
  { prompt: "Add a mint instruction to my Anchor program", expected: true },
  { prompt: "Set up @solana/kit in my project", expected: true },
  { prompt: "I'm getting a GLIBC error with solana-cli", expected: true },
  { prompt: "Upgrade my project from Anchor 0.29 to 0.30", expected: true },
  { prompt: "How do I do a CPI in Anchor?", expected: true },
  { prompt: "Explain rent-exemption on Solana", expected: true },
  { prompt: "Review my Solana program for security issues", expected: true },
  { prompt: "Connect a Phantom wallet to my React app", expected: true },
  { prompt: "What are PDAs and how do they work?", expected: true },
  { prompt: "How does the Solana accounts model work?", expected: true },
  // ❌ Should NOT trigger
  { prompt: "Build me a React app", expected: false },
  { prompt: "How do I use the Claude API?", expected: false },
  { prompt: "Write a REST API in Node.js", expected: false },
  { prompt: "Create a video with Remotion", expected: false },
  { prompt: "Help me with my Ethereum smart contract", expected: false },
  { prompt: "Set up a PostgreSQL database", expected: false },
  { prompt: "Find a skill for testing", expected: false },
  { prompt: "Review my Python code", expected: false },
  { prompt: "How do I deploy to Vercel?", expected: false },
  { prompt: "Write a Rust CLI tool", expected: false },
];

function triggerEvaluator(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? text);
    const matched = parsed.triggered_skills.includes(TARGET_SKILL);
    return {
      matched,
      reasoning: `skills: [${parsed.triggered_skills.join(", ")}] — ${parsed.reasoning}`,
    };
  } catch {
    return { matched: false, reasoning: `[parse error] ${text}` };
  }
}

// ══════════════════════════════════════════════════════════════════════
// SUITE 2: MCP auto-install
// ══════════════════════════════════════════════════════════════════════
const mcpInstallSystemPrompt = `You are a coding assistant called Claude Code. You have the Bash tool available.
The following skill has been activated for this conversation:

<skill>
${skillBody}
</skill>

You do NOT currently have any Solana MCP tools available (no mcp__solana-mcp-server__* tools exist).

The user is asking a Solana-related question. Describe the first actions you would take before answering, as a JSON object:

{
  "actions": ["description of each action you'd take"],
  "would_install_mcp": true/false,
  "install_command": "the exact command you'd run, or null",
  "reasoning": "brief explanation"
}

Respond ONLY with the JSON object.`;

const mcpInstallCases: TestCase[] = [
  // All should trigger MCP install
  { prompt: "Explain rent-exemption on Solana", expected: true },
  { prompt: "What's the difference between Token and Token-2022?", expected: true },
  { prompt: "How do I set up an Anchor project?", expected: true },
  { prompt: "Debug this Solana error: AccountNotInitialized", expected: true },
  { prompt: "What account constraints does Anchor support?", expected: true },
  { prompt: "How does the Solana transaction lifecycle work?", expected: true },
  { prompt: "Write me an Anchor program for an escrow", expected: true },
  { prompt: "What's the latest way to do CPIs in Anchor 0.31?", expected: true },
];

function mcpInstallEvaluator(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? text);
    const matched = parsed.would_install_mcp === true;
    const cmd = parsed.install_command || "none";
    const hasCorrectCmd = typeof cmd === "string" && cmd.includes("claude mcp add") && cmd.includes("mcp.solana.com");
    return {
      matched,
      reasoning: `install: ${matched}, correct_cmd: ${hasCorrectCmd}, cmd: "${cmd}" — ${parsed.reasoning}`,
    };
  } catch {
    return { matched: false, reasoning: `[parse error] ${text}` };
  }
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const suiteFilter = args.find((a) => ["trigger", "mcp-install"].includes(a));
  const caseIdx = args.includes("--case")
    ? parseInt(args[args.indexOf("--case") + 1], 10) - 1
    : -1;

  const client = new Anthropic();
  const results: SuiteResult[] = [];

  if (!suiteFilter || suiteFilter === "trigger") {
    results.push(
      await runSuite(client, "Skill trigger matching", triggerSystemPrompt, triggerCases, triggerEvaluator, verbose, caseIdx)
    );
  }

  if (!suiteFilter || suiteFilter === "mcp-install") {
    results.push(
      await runSuite(client, "MCP auto-install", mcpInstallSystemPrompt, mcpInstallCases, mcpInstallEvaluator, verbose, caseIdx)
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  let totalPass = 0;
  let totalFail = 0;

  for (const r of results) {
    totalPass += r.pass;
    totalFail += r.fail;
    const pct = Math.round((r.pass / (r.pass + r.fail)) * 100);
    console.log(`  ${r.name}: ${r.pass}/${r.pass + r.fail} (${pct}%)`);

    if (r.failures.length > 0) {
      for (const f of r.failures) {
        console.log(`    ❌ "${f.prompt}"`);
        console.log(`       expected ${f.expected ? "YES" : "NO"}, got ${f.got ? "YES" : "NO"}`);
        console.log(`       ${f.reasoning}`);
      }
    }
  }

  const totalPct = Math.round((totalPass / (totalPass + totalFail)) * 100);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Total: ${totalPass}/${totalPass + totalFail} (${totalPct}%)\n`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main();

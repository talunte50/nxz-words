#!/usr/bin/env node
/**
 * gh-run-logs.mjs — 拉取指定 workflow run 的 job 日志并过滤关键行
 * 用法: node scripts/gh-run-logs.mjs <TOKEN> <owner/repo> <run_id> [run_number]
 */
import fs from "node:fs";

for (const k of [
  "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
  "all_proxy", "ALL_PROXY",
]) delete process.env[k];
process.env.no_proxy = "*";

const [TOKEN, REPO = "talunte50/nxz-words", RUN_ID] = process.argv.slice(2);
if (!TOKEN || !RUN_ID) {
  console.error("用法: node scripts/gh-run-logs.mjs <TOKEN> <owner/repo> <run_id>");
  process.exit(2);
}

const h = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "nxz-words-deploy",
  "X-GitHub-Api-Version": "2022-11-28",
};

const jobsRes = await fetch(
  `https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/jobs`,
  { headers: h }
);
const jobs = (await jobsRes.json()).jobs || [];
for (const job of jobs) {
  console.log(`=== JOB ${job.name} [${job.status}/${job.conclusion || "-"}] ===`);
  for (const s of job.steps || []) {
    console.log(`   step ${s.number} ${s.name} -> ${s.status}/${s.conclusion || "-"}`);
  }
  const logsRes = await fetch(
    `https://api.github.com/repos/${REPO}/actions/jobs/${job.id}/logs`,
    { headers: h }
  );
  const text = await logsRes.text();
  console.log(`--- 日志长度 ${text.length} ---`);
  const lines = text.split("\n");
  const keep = lines.filter((ln) =>
    /edgeone|EdgeOne|deploy|Deploy|uploaded|Success|success|失败|成功|https:\/\/[a-z0-9.-]*edgeone[a-z0-9.-]*|Error|error:/i.test(
      ln
    )
  );
  console.log(keep.slice(0, 80).join("\n"));
}

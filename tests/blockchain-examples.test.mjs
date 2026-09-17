import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

const markdown = await readFile(new URL("../skills/sce-blockchain/examples/javascript.md", import.meta.url), "utf8");
const source = markdown.match(/```javascript\r?\n([\s\S]*?)\r?\n```/)?.[1];
assert.ok(source, "The published JavaScript example must contain runnable code");
// Execute the actual example with injected built-ins and an entirely fake network/filesystem.
const script = new vm.Script(`(async () => {\n${source.replace(/^import .+;\r?\n/gm, "")}\n})()`, {
  filename: "blockchain-example.mjs"
});
const baseUrl = "https://api.securecontentengine.com/sce-api-services-prod";
const input = Buffer.from("Content snapshot\n");
const expectedHash = createHash("sha256").update(input).digest("hex");
const fileId = "file/with space";
const hashId = "job/with space";
const uploadUrl = "https://storage.invalid/upload?sig=private";
const downloadUrl = "https://storage.invalid/download?sig=private";

async function runExample(options = {}) {
  const calls = [];
  const files = new Map();
  const logs = [];
  if (options.existingJob) files.set("output.bin.job.json", "existing attempt");
  let now = 0;
  let statusReads = 0;
  const states = options.states ?? ["queued", "finalized"];
  const verification = options.verification ?? { verified: true, hash: expectedHash };
  const envelope = (operation, result) => ({ ok: true, provider: "blockchain", operation, result });
  const jsonResponse = data => ({ ok: true, status: 200, json: async () => data });
  const sandbox = {
    Buffer, path, createHash, encodeURIComponent,
    AbortSignal: { timeout: () => undefined },
    Date: { now: () => now },
    setTimeout: (callback, delay) => { now += delay; callback(); },
    process: { env: { SCE_API_KEY: "secret-key", INPUT_FILE: "input.bin", CONTENT_TYPE: "application/octet-stream", OUTPUT_FILE: "output.bin" } },
    console: { log: (...args) => logs.push(args.join(" ")), error: (...args) => logs.push(args.join(" ")) },
    readFile: async name => { assert.equal(name, "input.bin"); return input; },
    writeFile: async (name, data, flags) => {
      if (flags?.flag === "wx" && files.has(name)) throw new Error("EEXIST");
      files.set(name, data);
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, ...init });
      if (url === uploadUrl) {
        assert.deepEqual(init.body, input);
        return { ok: !options.uploadFailure, status: options.uploadFailure ? 403 : 201 };
      }
      if (url === downloadUrl) {
        return { ok: true, status: 200, arrayBuffer: async () => options.mismatchedDownload ? Buffer.from("changed") : input };
      }
      assert.ok(url.startsWith(baseUrl), "Unexpected network destination");
      const route = url.slice(baseUrl.length);
      if (route === "/v1/blockchain/upload-url") {
        const result = options.aliases ? { file_id: fileId, upload_url: uploadUrl } : { id: fileId, sas_url: uploadUrl };
        return jsonResponse(envelope("upload_url", result));
      }
      if (route === "/v1/blockchain/sign") {
        assert.equal(JSON.parse(files.get("output.bin.job.json")).file_id, fileId, "Save file ID before dispatch");
        assert.deepEqual(JSON.parse(init.body), { file_id: fileId });
        if (options.lostDispatch) throw new Error("Network timeout");
        if (options.sign502) return { ok: false, status: 502 };
        return jsonResponse(envelope("sign", options.missingHashId ? {} : { hash_id: hashId, status: "queued" }));
      }
      if (route === "/v1/blockchain/status/" + encodeURIComponent(hashId)) {
        assert.equal(JSON.parse(files.get("output.bin.job.json")).hash_id, hashId, "Save job ID before polling");
        if (options.statusFailure) return { ok: false, status: 502 };
        const state = states[Math.min(statusReads++, states.length - 1)];
        return jsonResponse(envelope("status", { status: state }));
      }
      if (route === "/v1/blockchain/download/" + encodeURIComponent(fileId)) {
        return jsonResponse(envelope("download", options.aliases ? { download_url: downloadUrl } : { sas_url: downloadUrl }));
      }
      if (route === "/v1/blockchain/verify/" + expectedHash) return jsonResponse(envelope("verify", verification));
      throw new Error("Unexpected route " + route);
    }
  };
  let error;
  try { await script.runInNewContext(sandbox); } catch (caught) { error = caught; }
  return { calls, files, logs, error, now };
}

test("notarization uses each identifier correctly and keeps the key off storage", async () => {
  const result = await runExample();
  assert.ifError(result.error);
  assert.deepEqual(result.files.get("output.bin"), input);
  assert.deepEqual(JSON.parse(result.files.get("output.bin.job.json")), { file_id: fileId, hash_id: hashId, hash_hex: expectedHash });
  const saved = JSON.parse(result.files.get("output.bin.verification.json"));
  assert.deepEqual(saved.result, { verified: true, hash: expectedHash });
  assert.equal(saved.result.signature, undefined, "Never invent a signature from a simplified verify result");
  for (const call of result.calls) {
    const key = call.headers?.["Ocp-Apim-Subscription-Key"];
    assert.equal(key, call.url.startsWith(baseUrl) ? "secret-key" : undefined);
  }
  assert.equal(result.calls.filter(call => call.url.endsWith("/sign")).length, 1);
  assert.ok(!result.logs.join("\n").includes("sig=private"));
});

test("documented response aliases work", async () => {
  const result = await runExample({ aliases: true });
  assert.ifError(result.error);
  assert.deepEqual(result.files.get("output.bin"), input);
});

for (const [label, options] of [
  ["lost dispatch response", { lostDispatch: true }],
  ["missing hash_id", { missingHashId: true }],
  ["ambiguous 502", { sign502: true }]
]) {
  test(`${label} retains file ID without redispatch or status-by-file-ID`, async () => {
    const result = await runExample(options);
    assert.ok(result.error);
    assert.equal(result.calls.filter(call => call.url.endsWith("/sign")).length, 1);
    assert.ok(!result.calls.some(call => call.url.includes("/status/") || call.url.includes("/download/")));
    assert.equal(JSON.parse(result.files.get("output.bin.job.json")).file_id, fileId);
    assert.ok(result.logs.some(message => message.includes("Do not sign again automatically")));
  });
}

test("failed upload never dispatches", async () => {
  const result = await runExample({ uploadFailure: true });
  assert.ok(result.error);
  assert.ok(!result.calls.some(call => call.url.endsWith("/sign")));
});

test("unknown state is not mistaken for C2PA success or indefinite pending", async () => {
  const result = await runExample({ states: ["signed"] });
  assert.match(result.error?.message ?? "", /Unrecognized job state/);
  assert.ok(!result.calls.some(call => call.url.includes("/download/")));
});

test("bounded waiting retains both IDs without another dispatch", async () => {
  const result = await runExample({ states: ["queued"] });
  assert.match(result.error?.message ?? "", /Waiting limit reached/);
  assert.equal(result.now, 120000);
  assert.equal(result.calls.filter(call => call.url.endsWith("/sign")).length, 1);
  assert.equal(JSON.parse(result.files.get("output.bin.job.json")).hash_id, hashId);
});

test("status read failure preserves the job for recovery", async () => {
  const result = await runExample({ statusFailure: true });
  assert.ok(result.error);
  assert.equal(JSON.parse(result.files.get("output.bin.job.json")).hash_id, hashId);
  assert.equal(result.calls.filter(call => call.url.endsWith("/sign")).length, 1);
});

test("download mismatch prevents successful output and verification lookup", async () => {
  const result = await runExample({ mismatchedDownload: true });
  assert.match(result.error?.message ?? "", /Downloaded bytes differ/);
  assert.ok(!result.files.has("output.bin"));
  assert.ok(!result.calls.some(call => call.url.includes("/verify/")));
});

test("existing attempt prevents any new network operation", async () => {
  const result = await runExample({ existingJob: true });
  assert.match(result.error?.message ?? "", /EEXIST/);
  assert.equal(result.calls.length, 0);
  assert.equal(result.files.get("output.bin.job.json"), "existing attempt");
});

test("verification fields retain their actual meaning, including negative results", async () => {
  const verification = { verified: false, exists: true, valid: false, signature: { algorithm: "RS256", signed_hash_str: "fixture-only" } };
  const result = await runExample({ verification });
  assert.ifError(result.error);
  assert.deepEqual(JSON.parse(result.files.get("output.bin.verification.json")).result, verification);
  assert.ok(result.logs.some(message => message.includes("Inspect")));
});

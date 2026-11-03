#!/usr/bin/env node
/**
 * node tools/hash-password.mjs  — prints the scrypt hash for PORTAL_PASSWORD_HASH or the "h" of
 * a PORTAL_PARTNERS entry, so no plain password has to live in a variable.
 *
 * The password is read from stdin: typed at a prompt (not echoed) in a terminal, or piped
 * (`printf %s "$PW" | node tools/hash-password.mjs`). Passing it as an argument still works but
 * leaves it in the shell history.
 */
import { scryptSync, randomBytes } from "node:crypto";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const done = (fn) => { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); stderr.write("\n"); fn(); };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return done(() => resolve(value));
        if (ch === "\u0003") return done(() => reject(new Error("cancelled")));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    }
    stdin.on("data", onData);
  });
}

async function readPiped() {
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

async function readPassword() {
  if (process.argv[2] !== undefined) {
    console.error("warning: a password passed as an argument lands in your shell history; run without it to be prompted.");
    return process.argv[2];
  }
  return process.stdin.isTTY ? readHidden("Password (8+ characters): ") : readPiped();
}

let password;
try { password = await readPassword(); } catch { process.exit(130); }
if (password.length < 8) { console.error("usage: node tools/hash-password.mjs  (then type a password of 8+ characters), or pipe it on stdin"); process.exit(1); }
const salt = randomBytes(16);
console.log(`scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`);

# dsh-opencode-acp

[![npm](https://img.shields.io/npm/v/dsh-opencode-acp.svg)](https://www.npmjs.com/package/dsh-opencode-acp)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-8250df.svg)](https://github.com/topics/dsh-plugin)

Run [opencode](https://opencode.ai) as an ACP subagent inside DeepSeek Harness (DSH).

Your main agent keeps its own model and context; `subagent_opencode` hands a self-contained task to
opencode in a separate process, opencode does the work with **its own models, tools and free tier**,
and only the final answer comes back. A settings page lets you switch models, choose the permission
policy and working directory, and watch every run — including the opencode session id, duration and
token usage.

[中文说明](README.zh.md)

## Why

- **Two harnesses, one conversation.** DSH stays the driver. opencode brings its own free models and
  its own tooling; nothing it does lands in your context or your token bill.
- **You can see what happened.** Because this plugin speaks ACP itself, each run records the remote
  session id, the model, the duration, tool-call count and token usage — so "which opencode session
  was that?" has an answer.
- **Settings without restarts.** Settings are read at the start of every delegation, so a saved
  change applies to the next run.

## Requirements

| | |
|---|---|
| DeepSeek Harness | `>=0.2.1-rc.1 <0.3.0` (declared as `engines.dsh`; install refuses other versions) |
| opencode | v2 with the `acp` subcommand (`opencode --version`, `opencode acp --help`) |
| opencode auth | already logged in (`opencode auth login`); the child reuses your login and free models |

## Install

From the DSH Plugins page, or from a terminal:

```sh
# from npm (prebuilt, no build step)
dsh plugin --profile default add dsh-opencode-acp

# or from a tarball
dsh plugin --profile default add ./dsh-opencode-acp-0.1.1.tgz
```

Then restart or refresh DSH. Two things appear:

- a **delegation tool** named `subagent_opencode` for every agent in the profile;
- **Settings → OpenCode 委派**, the configuration page.

## Use

Just ask for it, or call the tool directly:

```
Delegate to subagent_opencode: in this repo, add a unit test for parseDuration and report what you changed.
```

The call returns immediately with a child id; the completion notice carries opencode's final answer.
The child gets only your task text and the working directory — never your conversation.

## Settings

| Group | Setting | Meaning |
|---|---|---|
| Model | main model | Picker built from the models your opencode has used, plus a free-form id |
| Model | small model | opencode's model for titles and small jobs (blank = let opencode choose) |
| Model | health check | Runs `opencode --version` and reports whether the executable resolves |
| Execution | permission | `allow` auto-answers permission requests, `reject` denies them |
| Execution | working directory | Follow the calling session, or pin one path |
| Advanced | command / args | The opencode executable plus the `acp` argument |
| Advanced | grace | Process teardown window in milliseconds |
| Advanced | env | Extra environment variables as a JSON object |

Settings live in `$DSH_HOME/opencode-acp/settings.json`; runs in `runs.json` beside it (last 100).

## How it works

```
DSH agent ── subagent_opencode ──► ctx.subagents ──► dsh-opencode-acp (provider "opencode")
                                                        │ spawn: opencode acp
                                                        ▼
                                              ACP over stdio (NDJSON JSON-RPC)
                                       initialize → session/new → session/prompt
                                                        │
                                     ◄── agent_message_chunk, usage_update
```

- The ACP protocol carries no model parameter, so the model is decided on the opencode side. This
  plugin injects `OPENCODE_CONFIG_CONTENT` into the child; `OPENCODE_CONFIG` (a file path) is
  ignored by `opencode acp` in v2 — verified, not assumed.
- Runs are one-shot: an external ACP child cannot receive follow-up messages, so it is not
  continuable. For multi-turn delegation use DSH's built-in `subagent` instead.
- The child process runs with your user account and is **not** confined by the DSH sandbox, exactly
  like DSH's own `@deepseek-ai/dsh-subagent-acp`. Treat delegation as "opencode may do what you
  could do".

## Limits

- Only assistant text is returned; opencode's tool traffic, reasoning and plans stay in its own
  session.
- A fresh process per run: expect a few seconds of startup on every delegation.
- Windows, macOS and Linux are all supported. The default command is the npm-global opencode on
  Windows (`%APPDATA%\npm\node_modules\@opencode\cli\bin\opencode.exe`) and `opencode` on `PATH`
  elsewhere; override **Advanced → command** if your install differs.

## Uninstall

```sh
dsh plugin --profile default remove dsh-opencode-acp
```

Removing the bundle removes the tool and the settings page; `$DSH_HOME/opencode-acp` stays until you
delete it.

## Development

Plain JavaScript, no build step.

```sh
node --check index.js
node --check client.js
npm pack --dry-run
```

The Host half is `index.js` (ACP client, provider, storage, HTTP routes under `/.dsh-opencode-acp`),
the browser half is `client.js` (a `settings.section` page registered through the client module
table). Both are named exports; `cordis.patch.yml` inserts the two rows.

## Licence

MIT

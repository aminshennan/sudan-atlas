# Listing Sudan Atlas for AI assistants

How to submit the MCP server and the skill to the official MCP Registry and the main directories, with text ready to paste. Directories change their forms often: if a step below no longer matches the site, follow the site.

What is in this repository:

| File | What it is |
| --- | --- |
| [`server.json`](../server.json) | The entry for the official MCP Registry |
| [`plugins/sudan-atlas/skills/sudan-atlas/SKILL.md`](../plugins/sudan-atlas/skills/sudan-atlas/SKILL.md) | The skill: when and how an assistant should use Sudan Atlas |
| [`plugins/sudan-atlas/`](../plugins/sudan-atlas/) | A Claude Code plugin: the skill plus the MCP server, installed together |
| [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | Makes this repository a plugin marketplace |

## Installing (for users)

**Claude Code, skill and MCP server together:**

```text
/plugin marketplace add aminshennan/sudan-atlas
/plugin install sudan-atlas@sudan-atlas
```

**MCP server only** (any client that supports remote servers):

```text
claude mcp add --transport http sudan-atlas https://atlas-sudan.vercel.app/api/mcp
```

```json
{ "mcpServers": { "sudan-atlas": { "type": "http", "url": "https://atlas-sudan.vercel.app/api/mcp" } } }
```

**Skill only, in other agents** that read Agent Skills (a folder with a `SKILL.md`): copy `plugins/sudan-atlas/skills/sudan-atlas/` into that agent's skills folder. In the Claude apps, zip the `sudan-atlas` folder and upload it under Settings, Capabilities, Skills.

## 1. The official MCP Registry

The registry at registry.modelcontextprotocol.io is the public list that many clients and directories read from. It is in preview, so details may change.

1. Install the publisher:

   ```sh
   brew install mcp-publisher
   # or, on Linux and macOS without Homebrew:
   curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
   ```

2. From the repository folder (where `server.json` is), sign in with GitHub. It gives you the name `io.github.aminshennan/...`:

   ```sh
   mcp-publisher login github
   ```

   Open https://github.com/login/device and enter the code it shows.

3. Publish:

   ```sh
   mcp-publisher publish
   ```

   It should end with "✓ Successfully published".

4. Check it is listed:

   ```sh
   curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.aminshennan/sudan-atlas"
   ```

To change something later (a new address, a new description), edit `server.json`, raise `version`, and publish again.

**Choose the name before the first publish.** The name cannot be changed later; a new name makes a separate entry. Two choices:

- `io.github.aminshennan/sudan-atlas` (in `server.json` now): sign in with GitHub, nothing else to set up.
- A name from your own domain, such as `org.example/sudan-atlas` for example.org: it shows the server belongs to the same owner as the website. It needs a key and a DNS record (or a file on the website), and you must keep the domain. The registry's authentication page explains the steps: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx

## 2. Other directories

Several directories copy from the official registry by themselves; the ones below also take submissions. Use the same text everywhere.

| Directory | How |
| --- | --- |
| Smithery (smithery.ai) | Sign in with GitHub, add a server, choose an existing remote URL, paste the address |
| Glama (glama.ai/mcp/servers) | Add the GitHub repository; it builds the listing from it |
| PulseMCP (pulsemcp.com) | Use the submit page |
| mcp.so | Use the submit button (it opens a GitHub issue) |
| awesome-mcp-servers (github.com/punkpeye/awesome-mcp-servers) | Open a pull request adding one line under the location or geography section, following the file's format |
| Agensi (agensi.io) | Only if it can be listed free; Sudan Atlas stays free |

## Text to paste

**Name:** Sudan Atlas

**One line (under 100 characters):**
Match Sudanese place names (Arabic or English) to official P-codes; get places and boundaries.

**Short description:**
Sudan Atlas turns messy Sudanese place names, in Arabic or English and any spelling, into the official OCHA P-codes for Sudan's 18 states, the Abyei PCA area and 189 localities. It never guesses silently: when a name could be two places, it returns the candidates so the assistant asks. It also gives official names in both languages, areas, mid-2025 population estimates and boundaries as GeoJSON. Free, read-only, no sign-up.

**Tools:**
- `match_place_name`: one name to its P-code, with score, method and alternatives
- `match_place_names`: up to 1,000 names at once, each with its own state hint
- `search_places`: find states and localities by part of a name
- `get_place`: names, parent state, localities, area and estimated population
- `list_places`: all states, or the localities of the country or of one state
- `get_boundary`: a boundary as GeoJSON

**Address:** `https://atlas-sudan.vercel.app/api/mcp` (Streamable HTTP, no authentication)

**Links:** website https://atlas-sudan.vercel.app · docs https://atlas-sudan.vercel.app/docs/#mcp · code https://github.com/aminshennan/sudan-atlas · DOI https://doi.org/10.5281/zenodo.24191932

**Tags:** sudan, p-codes, place names, gazetteer, geocoding, humanitarian, OCHA, COD-AB, Arabic, GeoJSON, maps

**Category:** location / geography / data

**Licence:** code MIT; data CC BY 3.0 IGO (boundaries), CC BY 4.0, and ODbL 1.0 for OpenStreetMap spellings only

**Privacy:** names sent to the server are processed to answer the request and not stored. Each address may make 60 requests a minute.

## When the website moves to its own domain

The `.vercel.app` address keeps working after a custom domain is added, so existing installs do not break. Update the address in:

- `server.json`, then raise `version` and publish again
- `plugins/sudan-atlas/.mcp.json` and `SKILL.md`, then raise the plugin `version`
- the site: the counter's allowed origins in `site/api/_counter.ts` (or counts from the new domain are refused), the MCP server's instructions in `site/api/mcp.ts`, and the docs pages
- `README.md`, the package READMEs, `CITATION.cff` and `.zenodo.json`
- each directory listing

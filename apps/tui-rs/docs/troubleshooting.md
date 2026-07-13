# Troubleshooting Guide

## Common Issues

### "Connection refused" or "Failed to connect"

The API server is not reachable.

**Symptoms**:
```
Error: Failed to connect to API server
```

**Solutions**:

1. **Check if cv-api is running**:
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return `{"status":"ok"}`.

2. **Verify the configured URL**:
   ```bash
   cat ~/.config/cv/config.toml
   ```
   Look for `base_url` in the `[api]` section.

3. **Test connectivity to the server**:
   ```bash
   # Replace with your actual server URL
   curl http://your-api-server:3001/api/health
   ```

4. **If using a custom URL, override it**:
   ```bash
   CV_API_URL=http://correct-host:3001 cv-rs
   ```

5. **Check network connectivity**:
   ```bash
   ping your-api-server
   # If ping fails, check your network connection and firewall rules
   ```

### "Unauthorized" or "Invalid API key"

The API key is missing or incorrect.

**Symptoms**:
```
Error: Unauthorized (401)
```

**Solutions**:

1. **Verify the API key in config**:
   ```bash
   cat ~/.config/cv/config.toml
   ```
   Check the `api_key` field under `[api]`.

2. **Generate a new API key** (if lost):
   On the cv-api server:
   ```bash
   openssl rand -base64 32
   ```
   Update `config.toml` with the new key.

3. **Override the key temporarily**:
   ```bash
   CV_API_KEY=your-correct-key cv-rs
   ```

4. **Test the key with curl**:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     http://localhost:3001/api/health
   ```

### "Request timeout"

API calls are taking too long.

**Symptoms**:
```
Error: Request timeout after 30 seconds
```

**Solutions**:

1. **Increase the timeout**:
   ```bash
   CV_TIMEOUT=120 cv-rs
   ```
   The value is in seconds. 120 = 2 minutes.

2. **Check server performance**:
   ```bash
   time curl http://localhost:3001/api/health
   ```
   If curl takes >5 seconds, the server is slow.

3. **Monitor server resources**:
   ```bash
   # On the cv-api server
   top
   # Check CPU and memory usage
   ```

4. **Reduce payload size**:
   If you have thousands of applications, caching should help.
   - Check if the applications list is loading: press `R` to refresh
   - If refresh takes 30+ seconds, the server needs optimization

### Applications list is empty

The API returns no applications.

**Symptoms**:
```
Applications (0)
```

**Solutions**:

1. **Check if applications exist**:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     http://localhost:3001/api/applications | jq .
   ```
   Should return a list of applications.

2. **Check the API directory**:
   On the cv-api server:
   ```bash
   ls -la /path/to/applications/
   ```

3. **Force a cache refresh**:
   The list is cached for 60 seconds. After adding applications, press `R` to refresh.

4. **Check filtering**:
   If using the filter (press `/`), make sure it's not filtering out all apps.
   Press `Esc` to clear the filter.

### Actions not running or hanging

Action doesn't start or gets stuck.

**Symptoms**:
```
Running tailor...
[stuck, no output]
```

**Solutions**:

1. **Check if action exists**:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     http://localhost:3001/api/targets | jq .
   ```
   Should list available actions like "tailor", "review", etc.

2. **Check Make target**:
   On the cv-api server:
   ```bash
   cd /path/to/cv-repo
   make tailor app=your-app
   ```
   Should complete successfully.

3. **Increase timeout for slow actions**:
   ```bash
   CV_TIMEOUT=120 cv-rs
   ```

4. **Try a simpler action first**:
   Start with "build" which is usually fast.

5. **Check application directory**:
   On the cv-api server:
   ```bash
   ls -la /path/to/applications/your-app/
   ```
   Should contain meta.yml and other files.

### Action output not appearing

Real-time streaming isn't working.

**Symptoms**:
```
Running action...
[nothing happens]
[wait 30 seconds]
[output appears all at once]
```

**Solutions**:

1. **WebSocket may be unavailable** - The TUI falls back to HTTP polling, which takes longer
   Check network connectivity and proxy settings.

2. **Large action output** - If the action produces >1MB of output, streaming may be slow
   This is normal; the TUI will catch up.

3. **Server not sending output** - Check if the Make target is actually outputting something:
   ```bash
   cd /path/to/applications/your-app
   make tailor
   ```

### Keybinding not working

A keybinding doesn't do anything.

**Symptoms**:
```
Press 't' in detail view → nothing happens
```

**Solutions**:

1. **Verify you're in the right view**:
   - Detail view keybindings (t, v, b, s, p, a) only work from application detail view
   - Make sure you pressed Enter on an application first

2. **Check terminal settings**:
   Some terminals or shells intercept certain keys. Try a different terminal.

3. **Check Vim keybindings**:
   If Vim is running in the background, it might capture keys.
   Make sure cv-rs has focus.

4. **Try alternate key**:
   Many keybindings have alternates:
   - `j` or `Down` to move down
   - `k` or `Up` to move up
   - `h` or `Left` to move left
   - `l` or `Right` to move right

### UI glitching or corruption

Terminal display is broken or overlapping.

**Symptoms**:
```
[characters overlapping]
[colors wrong]
[text not aligned]
```

**Solutions**:

1. **Resize terminal and press Ctrl+L**:
   Many TUI apps need to redraw after resize.

2. **Clear terminal**:
   ```bash
   clear
   cv-rs
   ```

3. **Check terminal support**:
   cv-tui-rs requires:
   - 24-bit color support (true color)
   - UTF-8 encoding

   Try a different terminal or set `TERM`:
   ```bash
   TERM=xterm-256color cv-rs
   ```

4. **Disable theme temporarily**:
   Edit `~/.config/cv/config.toml`:
   ```toml
   [ui]
   theme = "catppuccin-mocha"
   ```
   Try changing to "dracula" or "nord".

### Config file not found

The TUI can't find the config file.

**Symptoms**:
```
Error: failed to read config: No such file or directory
```

**Solutions**:

1. **Create the config file**:
   ```bash
   mkdir -p ~/.config/cv
   cp config.example.toml ~/.config/cv/config.toml
   ```

2. **Check the path**:
   cv-tui-rs looks for `~/.config/cv/config.toml`.
   Verify it exists:
   ```bash
   ls -la ~/.config/cv/config.toml
   ```

3. **Use custom path**:
   If your config is elsewhere, you can pass it:
   ```bash
   cv-rs --config /path/to/config.toml
   ```

### Invalid TOML in config file

Config file has syntax errors.

**Symptoms**:
```
Error: failed to parse config: invalid TOML
```

**Solutions**:

1. **Validate TOML**:
   Use an online TOML validator or install `tomli-cli`:
   ```bash
   pip install tomli-cli
   tomli ~/.config/cv/config.toml
   ```

2. **Common mistakes**:
   - Missing `=` sign: `base_url "http://..."` should be `base_url = "http://..."`
   - Unquoted strings: `theme = catppuccin-mocha` should be `theme = "catppuccin-mocha"`
   - Trailing commas: `api_key = "key",` (comma is not allowed)

3. **Reset to example**:
   ```bash
   cp config.example.toml ~/.config/cv/config.toml
   # Then edit with correct values
   ```

### Performance is slow

The TUI is sluggish or unresponsive.

**Symptoms**:
```
[lag when typing]
[slow to render]
[navigation feels delayed]
```

**Solutions**:

1. **Check API server performance**:
   ```bash
   time curl http://localhost:3001/api/applications
   ```
   Should respond in <1 second. If slower, the server needs optimization.

2. **Monitor local resources**:
   ```bash
   # In another terminal
   top
   ```
   Check if cv-rs or cv-api is using excessive CPU or memory.

3. **Clear the cache** (if it's stale):
   The TUI caches responses. If cache is corrupt:
   ```bash
   # Restart cv-rs, it will rebuild the cache
   cv-rs
   ```

4. **Reduce number of applications**:
   If you have >1000 applications:
   - Archive old ones
   - Use filtering to show only active ones

5. **Disable debug logging**:
   If you set `RUST_LOG=debug`, disable it:
   ```bash
   unset RUST_LOG
   cv-rs
   ```

## Advanced Debugging

### Enable verbose logging

```bash
RUST_LOG=debug cv-rs
```

This will print detailed logs to stderr showing API requests, responses, and state changes.

### Test API directly

Use curl to verify the API is working:

```bash
# Health check
curl http://localhost:3001/api/health

# List applications
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:3001/api/applications

# Get specific application
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:3001/api/applications/acme-software-engineer

# Create application
curl -X POST -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company":"Acme","position":"Engineer","url":"..."}' \
  http://localhost:3001/api/applications
```

### Check cv-api logs

On the cv-api server:

```bash
# View recent logs
journalctl -u cv-api -n 50

# Watch logs in real-time
journalctl -u cv-api -f

# Check for errors
grep -i error /var/log/cv-api.log
```

### Monitor network traffic

```bash
# Linux/macOS
tcpdump -i lo 'port 3001'

# Or use a GUI tool
wireshark
```

### Collect debug info for issues

When reporting a bug, include:

1. **Version**:
   ```bash
   cv-rs --version
   ```

2. **Config** (without secrets):
   ```bash
   cat ~/.config/cv/config.toml | sed 's/api_key = .*/api_key = "***"/'
   ```

3. **API health**:
   ```bash
   curl http://localhost:3001/api/health
   ```

4. **Terminal info**:
   ```bash
   echo $TERM
   echo $SHELL
   uname -a
   ```

5. **Logs** (with debug enabled):
   ```bash
   RUST_LOG=debug cv-rs 2>&1 | head -100
   ```

## Getting Help

If you've tried these solutions and still have issues:

1. **Check existing issues**: https://github.com/jsoyer/cv-tui-rs/issues
2. **Open a new issue** with:
   - Error message (exact text)
   - Steps to reproduce
   - Your environment (OS, terminal, cv-api version)
   - Debug logs (if applicable)

3. **Ask in discussions**: https://github.com/jsoyer/cv-tui-rs/discussions

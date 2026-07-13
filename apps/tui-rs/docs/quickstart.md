# Quick Start Guide

Get cv-tui-rs running in 5 minutes.

## 1. Install

Choose one method:

### Cargo (easiest for Rust users)

```bash
cargo install --git https://github.com/jsoyer/cv-tui-rs.git
cv-rs --version
```

### Binary release

```bash
# macOS (Apple Silicon)
curl -Lo cv-rs.tar.gz https://github.com/jsoyer/cv-tui-rs/releases/latest/download/cv-rs-aarch64-apple-darwin.tar.gz
tar xzf cv-rs.tar.gz
mv cv-rs /usr/local/bin/

# Linux (amd64)
curl -Lo cv-rs.tar.gz https://github.com/jsoyer/cv-tui-rs/releases/latest/download/cv-rs-x86_64-unknown-linux-gnu.tar.gz
tar xzf cv-rs.tar.gz
sudo mv cv-rs /usr/local/bin/

cv-rs --version
```

### From source

```bash
git clone https://github.com/jsoyer/cv-tui-rs.git
cd cv-tui-rs
make build
./target/release/cv-rs --version
```

## 2. Configure

Create the config file:

```bash
mkdir -p ~/.config/cv
cat > ~/.config/cv/config.toml << 'EOF'
[api]
base_url = "http://localhost:3001"
api_key = "your-api-key-here"

[ui]
theme = "catppuccin-mocha"
EOF
```

Edit the `api_key` with your actual key from the cv-api server.

## 3. Verify

Check if cv-api is running:

```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{"status":"ok"}
```

If it fails, ensure cv-api is running. See [cv-api docs](https://github.com/jsoyer/cv-api).

## 4. Launch

```bash
cv-rs
```

You should see:
- Dashboard view (default)
- Application stats
- Recent activity

## 5. Try Key Actions

### View applications

```
Press: 2 (or Tab until Applications view)
Then:  j/k to navigate
       Enter to view details
       Esc to go back
```

### Create an application

```
Press: n (any view)
Type:  Company name, job title, job URL (optional)
Press: Tab to move to next field
       Enter to submit
```

### Quick actions from detail view

After opening an application (`Enter`):

```
Press: t  → Tailor CV
       v  → Review CV
       b  → Build artifacts
       s  → Score against job
       p  → Prep interview
       a  → Audit CV health
```

### View audit results

```
Press: a (in detail view)
       j/k to see audit metrics
       Esc to close
```

## 6. Navigation Basics

| Key | Action |
|-----|--------|
| `1`-`6` | Jump to view |
| `j`/`k` | Down/up |
| `h`/`l` | Left/right |
| `Enter` | Select/open |
| `Esc` | Back/close |
| `?` | Help |
| `q` | Quit |

**View numbers**:
1. Dashboard
2. Applications
3. Kanban
4. Actions
5. Stats

## 7. Common Workflows

### Check job status

```
1. Press 2 (Applications)
2. Navigate to the job with j/k
3. Press Enter to view details
4. See status, notes, and recent actions
5. Press Esc to go back
```

### Score and tailor a CV

```
1. Open application (press 2, find job, press Enter)
2. Press s to score against job description
3. Review the score and feedback
4. Press t to tailor the CV
5. Check the updated CV
6. Press p to prep for interview
```

### Track multiple applications

```
1. Press 3 (Kanban) to see application pipeline
2. Use h/l to move between columns (Applied, Interview, Offer, etc.)
3. Use j/k to move between applications in a column
4. Press m to move application to next stage
```

### Monitor statistics

```
1. Press 5 (Stats)
2. See conversion rates, timeline, company breakdown
3. Press R to refresh
4. Press Tab to switch chart
```

## 8. Configuration Tips

### Use different API servers

```bash
# Production
cv-rs

# Staging
CV_API_URL=http://staging.api.local cv-rs

# Local development
CV_API_URL=http://localhost:3002 CV_API_KEY=dev-key cv-rs
```

### Slow network?

```bash
# Increase timeout to 2 minutes
CV_TIMEOUT=120 cv-rs
```

### Change theme

Edit `~/.config/cv/config.toml`:

```toml
[ui]
theme = "dracula"  # or "nord"
```

## 9. Next Steps

- **Full keybindings**: See [docs/keybindings.md](keybindings.md)
- **All features**: See [docs/features.md](features.md)
- **API details**: See [docs/api.md](api.md)
- **Troubleshooting**: See [docs/troubleshooting.md](troubleshooting.md)
- **Architecture**: See [docs/architecture.md](architecture.md)

## Troubleshooting

### "Connection refused"

```bash
# Check if cv-api is running
curl http://localhost:3001/api/health

# Try custom server
CV_API_URL=http://your-server:3001 cv-rs
```

### "Unauthorized"

```bash
# Verify your API key in config
cat ~/.config/cv/config.toml

# Or override it
CV_API_KEY=correct-key cv-rs
```

### "Request timeout"

```bash
# Increase timeout
CV_TIMEOUT=120 cv-rs
```

For more help, see [docs/troubleshooting.md](troubleshooting.md).

## Performance

cv-tui-rs is fast:

| Metric | Time |
|--------|------|
| Startup | <10ms |
| Memory (idle) | ~3 MB |
| Binary size | ~5 MB |

Thanks to Rust, minimal dependencies, and smart caching.

## Tips & Tricks

### Copy application path

Open detail view and press `y` to copy the application directory path.

### Open job URL

In detail view, press `o` to open the job posting in your default browser.

### Real-time action output

When running actions (tailor, review, etc.), output streams in real-time via WebSocket. Fallback to HTTP polling if needed.

### Cache refresh

Data is cached for 60 seconds. Press `R` in Dashboard or Stats to manually refresh.

### Help overlay

Press `?` anytime to see keybindings and commands for the current view.

Enjoy using cv-tui-rs! Happy job hunting!

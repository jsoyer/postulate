# Installation

## Cargo install

```bash
cargo install --git https://github.com/jsoyer/cv-tui-rs.git
```

## Binary release

Download the latest release from [GitHub Releases](https://github.com/jsoyer/cv-tui-rs/releases).

```bash
# macOS (Apple Silicon)
curl -Lo cv-rs.tar.gz https://github.com/jsoyer/cv-tui-rs/releases/latest/download/cv-rs-aarch64-apple-darwin.tar.gz
tar xzf cv-rs.tar.gz
mv cv-rs /usr/local/bin/

# Linux (amd64)
curl -Lo cv-rs.tar.gz https://github.com/jsoyer/cv-tui-rs/releases/latest/download/cv-rs-x86_64-unknown-linux-gnu.tar.gz
tar xzf cv-rs.tar.gz
sudo mv cv-rs /usr/local/bin/
```

## Build from source

```bash
git clone https://github.com/jsoyer/cv-tui-rs.git
cd cv-tui-rs
make build
# Binary: target/release/cv-rs
```

### Cross-compilation

```bash
# Linux from macOS
rustup target add x86_64-unknown-linux-gnu
cargo build --release --target x86_64-unknown-linux-gnu
```

## Post-install setup

1. Configure the API connection:

```bash
mkdir -p ~/.config/cv
cp config.example.toml ~/.config/cv/config.toml
# Edit ~/.config/cv/config.toml with your API key
```

2. Ensure cv-api is running:

```bash
curl http://localhost:3001/health
```

3. Launch:

```bash
cv-rs
```

## Why both Go and Rust TUIs?

- **cv-tui-go** (`cv`): Easier to extend, richer Charm ecosystem, Homebrew install
- **cv-tui-rs** (`cv-rs`): Smaller binary, faster startup, lower memory usage

Both share the same config file and keybindings. Use whichever fits your preference.

## Next Steps

- [Configuration Guide](config.md) - Set up API connection and theme
- [Keybindings Reference](keybindings.md) - Learn all keyboard shortcuts
- [Features Guide](features.md) - Discover quick actions, audit, and more
- [Architecture](architecture.md) - Understand how cv-tui-rs works

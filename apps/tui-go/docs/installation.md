# Installation

## Homebrew (macOS and Linux)

The Homebrew tap is the easiest method on both macOS and Linux.

```bash
brew install jsoyer/tap/cv
```

This installs the `cv` binary and keeps it up to date with `brew upgrade`.

## go install

If you have Go 1.24 or later installed:

```bash
go install github.com/jsoyer/cv-tui-go/cmd/cv@latest
```

The binary is placed in `$(go env GOPATH)/bin/cv`. Make sure that directory is on your `PATH`.

## Binary releases

Pre-built binaries are published for every release via [GoReleaser](https://goreleaser.com/).

### Platform matrix

| OS | Architecture | Archive |
|----|-------------|---------|
| macOS | Apple Silicon (arm64) | `cv_Darwin_arm64.tar.gz` |
| macOS | Intel (amd64) | `cv_Darwin_amd64.tar.gz` |
| Linux | amd64 | `cv_Linux_amd64.tar.gz` |
| Linux | arm64 | `cv_Linux_arm64.tar.gz` |
| Windows | amd64 | `cv_Windows_amd64.zip` |
| Windows | arm64 | `cv_Windows_arm64.zip` |

### Download and install

**macOS — Apple Silicon**

```bash
curl -Lo cv.tar.gz \
  https://github.com/jsoyer/cv-tui-go/releases/latest/download/cv_Darwin_arm64.tar.gz
tar xzf cv.tar.gz cv
mv cv /usr/local/bin/
```

**macOS — Intel**

```bash
curl -Lo cv.tar.gz \
  https://github.com/jsoyer/cv-tui-go/releases/latest/download/cv_Darwin_amd64.tar.gz
tar xzf cv.tar.gz cv
mv cv /usr/local/bin/
```

**Linux — amd64**

```bash
curl -Lo cv.tar.gz \
  https://github.com/jsoyer/cv-tui-go/releases/latest/download/cv_Linux_amd64.tar.gz
tar xzf cv.tar.gz cv
sudo mv cv /usr/local/bin/
```

**Linux — arm64**

```bash
curl -Lo cv.tar.gz \
  https://github.com/jsoyer/cv-tui-go/releases/latest/download/cv_Linux_arm64.tar.gz
tar xzf cv.tar.gz cv
sudo mv cv /usr/local/bin/
```

### Verify the checksum

Each release includes a `checksums.txt` file. To verify the integrity of a downloaded archive:

```bash
# Download the checksum file alongside the archive
curl -Lo checksums.txt \
  https://github.com/jsoyer/cv-tui-go/releases/latest/download/checksums.txt

# Verify (macOS)
shasum -a 256 --check --ignore-missing checksums.txt

# Verify (Linux)
sha256sum --check --ignore-missing checksums.txt
```

## Build from source

**Requirements:** Go 1.24 or later.

```bash
git clone https://github.com/jsoyer/cv-tui-go.git
cd cv-tui-go
make build
```

This produces a `./cv` binary in the project root. To install it system-wide:

```bash
make install   # copies to $(GOPATH)/bin/cv
```

To build with version information embedded:

```bash
go build -ldflags="-s -w -X main.version=$(git describe --tags --always)" \
  -o cv ./cmd/cv
```

## Post-install verification

```bash
# Check the version
cv --version

# Expected output:
# cv-tui vX.Y.Z
```

## Configuration setup

After installing the binary, create the configuration file:

```bash
# 1. Create the config directory
mkdir -p ~/.config/cv

# 2. Copy the example config (from the cloned repo, or download it)
cp /path/to/cv-tui-go/config.example.toml ~/.config/cv/config.toml

# Alternative: download the example directly
curl -o ~/.config/cv/config.toml \
  https://raw.githubusercontent.com/jsoyer/cv-tui-go/main/config.example.toml

# 3. Edit the config
$EDITOR ~/.config/cv/config.toml
```

Minimum required fields:

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-api-key-here"
```

See [config.md](config.md) for the full configuration reference.

## Verify cv-api connectivity

Before launching, confirm that cv-api is running and reachable. Use the `cv health` command:

```bash
cv health
# Expected output: successful connection, no error
```

Alternatively, use curl directly:

```bash
curl -s http://localhost:3001/health
# Expected: {"status":"ok"} or similar
```

## Launch

```bash
cv
```

Press `?` inside the TUI to open the help overlay. Press `q` to quit.

## Verbose logging

If you encounter issues, enable verbose logging to see the config path and API URL:

```bash
cv --verbose
cv -v
```

This prints diagnostic information to stderr while the TUI runs.

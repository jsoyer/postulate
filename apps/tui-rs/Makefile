.PHONY: build install run test lint clean check

BINARY := cv-rs

build:
	cargo build --release

install: build
	cp target/release/$(BINARY) $(HOME)/.cargo/bin/$(BINARY)

run:
	cargo run

check:
	cargo check

test:
	cargo test

lint:
	cargo clippy -- -D warnings

clean:
	cargo clean

fmt:
	cargo fmt

fmt-check:
	cargo fmt -- --check

.PHONY: build install run test lint clean release

BINARY := cv
PKG    := ./cmd/cv

build:
	go build -ldflags="-s -w" -o $(BINARY) $(PKG)

install: build
	cp $(BINARY) $(GOPATH)/bin/$(BINARY)

run:
	go run $(PKG)

test:
	go test ./... -v -race

lint:
	golangci-lint run ./...

clean:
	rm -f $(BINARY)
	go clean -cache

release:
	goreleaser release --clean

snapshot:
	goreleaser release --snapshot --clean

fmt:
	gofumpt -l -w .

deps:
	go mod tidy
	go mod verify

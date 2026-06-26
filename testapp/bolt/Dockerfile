# ── Stage 1: build ralfpack ───────────────────────────────────────────────────
FROM ubuntu:24.04 AS ralfpack-builder

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gcc \
        clang \
        libclang-dev \
        binutils \
        automake \
        autoconf \
        libtool \
        make \
        pkg-config \
        libssl-dev

# Install Rust toolchain via rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:$PATH"

RUN git clone --depth=1 https://github.com/rdkcentral/ralfpack.git /opt/ralfpack
WORKDIR /opt/ralfpack
RUN cargo build --release

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

# Set locale to en_US.UTF-8
RUN apt-get update && \
    apt-get install -y --no-install-recommends locales && \
    echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && \
    locale-gen

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

# Install Node.js 22.x and all bolt + ralfpack runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends \
        nodejs \
        git \
        tar \
        rsync \
        umoci \
        erofs-utils \
        cryptsetup-bin \
        zip \
        unzip \
        openssh-client \
        libssl3 \
        vim \
        repo \
        binutils \
        bzip2 \
        chrpath \
        cpio \
        diffstat \
        file \
        gawk \
        lz4 \
        patch \
        wget \
        xz-utils \
        zstd \
        python3 \
        python3-venv \
        python3-pip \
        socat \
        texinfo


# Copy ralfpack binary from the builder stage
COPY --from=ralfpack-builder /opt/ralfpack/target/release/ralfpack /usr/local/bin/ralfpack
RUN chmod +x /usr/local/bin/ralfpack

# Clone bolt-tools (sparse checkout — only the bolt/ subtree)
RUN git clone --depth=1 --filter=blob:none --sparse \
        https://github.com/rdkcentral/bolt-tools.git /opt/bolt-tools && \
    cd /opt/bolt-tools && \
    git sparse-checkout set bolt && \
    chmod +x /opt/bolt-tools/bolt/bin/bolt

ENV PATH="/opt/bolt-tools/bolt/bin:$PATH"

# Bitbake refuses to run as root — create a non-root build user
RUN useradd --create-home --shell /bin/bash build && \
    mkdir -p /workspace && \
    chown build:build /workspace

USER build

# Some process required this (unsure why)
RUN git config --global user.email "no-reply@infosys.com" && \
    git config --global user.name "no-reply"

WORKDIR /workspace

CMD ["/bin/bash"]

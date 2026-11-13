// A minimal ZIP writer: stored entries, no compression, no dependencies.
// Enough to hand a visitor all the generated files in one download.

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

export function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// A fixed timestamp (2026-01-01 00:00) keeps the archive identical for identical input.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/**
 * files: [{ path, content, exec? }] → Uint8Array holding a ZIP archive.
 * Paths use forward slashes. `exec` marks a file executable for unzip on Unix.
 */
export function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
        const name = enc.encode(f.path);
        const data = enc.encode(f.content);
        const crc = crc32(data);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034B50, true);
        local.setUint16(4, 20, true); // version needed
        local.setUint16(6, 0x0800, true); // names are UTF-8
        local.setUint16(8, 0, true); // stored
        local.setUint16(10, DOS_TIME, true);
        local.setUint16(12, DOS_DATE, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, data.length, true);
        local.setUint32(22, data.length, true);
        local.setUint16(26, name.length, true);
        parts.push(new Uint8Array(local.buffer), name, data);

        const entry = new DataView(new ArrayBuffer(46));
        entry.setUint32(0, 0x02014B50, true);
        entry.setUint16(4, (3 << 8) | 20, true); // made on Unix, so the mode below is honoured
        entry.setUint16(6, 20, true);
        entry.setUint16(8, 0x0800, true);
        entry.setUint16(10, 0, true);
        entry.setUint16(12, DOS_TIME, true);
        entry.setUint16(14, DOS_DATE, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, data.length, true);
        entry.setUint32(24, data.length, true);
        entry.setUint16(28, name.length, true);
        entry.setUint32(38, ((f.exec ? 0o100755 : 0o100644) << 16) >>> 0, true);
        entry.setUint32(42, offset, true);
        central.push(new Uint8Array(entry.buffer), name);
        offset += 30 + name.length + data.length;
    }
    const centralSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054B50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of all) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

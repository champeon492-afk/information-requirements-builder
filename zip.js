/* Store multiple IDS documents in a standards-compatible, uncompressed ZIP. */
(function (root) {
  "use strict";
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function buildZip(entries) {
    if (entries.length > 65535) throw new Error("Too many IDS files for one ZIP archive.");
    const encoder = new TextEncoder(), chunks = [], directory = [];
    const write16 = (view, at, n) => view.setUint16(at, n, true);
    const write32 = (view, at, n) => view.setUint32(at, n >>> 0, true);
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.name.replace(/[\\/]/g, "_"));
      const data = encoder.encode(entry.content);
      if (name.length > 65535 || data.length > 0xffffffff) throw new Error("An IDS file is too large for ZIP export.");
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
      write32(lv, 0, 0x04034b50); write16(lv, 4, 20); write16(lv, 6, 0x0800); write16(lv, 8, 0);
      write16(lv, 10, dosTime); write16(lv, 12, dosDate); write32(lv, 14, crc);
      write32(lv, 18, data.length); write32(lv, 22, data.length); write16(lv, 26, name.length); write16(lv, 28, 0);
      local.set(name, 30); chunks.push(local, data);
      const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
      write32(cv, 0, 0x02014b50); write16(cv, 4, 20); write16(cv, 6, 20); write16(cv, 8, 0x0800);
      write16(cv, 10, 0); write16(cv, 12, dosTime); write16(cv, 14, dosDate); write32(cv, 16, crc);
      write32(cv, 20, data.length); write32(cv, 24, data.length); write16(cv, 28, name.length);
      write16(cv, 30, 0); write16(cv, 32, 0); write16(cv, 34, 0); write16(cv, 36, 0);
      write32(cv, 38, 0); write32(cv, 42, offset); central.set(name, 46);
      directory.push(central); offset += local.length + data.length;
    }
    const directorySize = directory.reduce((n, part) => n + part.length, 0);
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    write32(ev, 0, 0x06054b50); write16(ev, 4, 0); write16(ev, 6, 0);
    write16(ev, 8, entries.length); write16(ev, 10, entries.length);
    write32(ev, 12, directorySize); write32(ev, 16, offset); write16(ev, 20, 0);
    return new Blob([...chunks, ...directory, end], {type: "application/zip"});
  }
  root.idsBuilderZip = buildZip;
  if (typeof module !== "undefined" && module.exports) module.exports = buildZip;
})(typeof window !== "undefined" ? window : globalThis);


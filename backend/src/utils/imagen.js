// ¿El archivo es de verdad una imagen jpg, png, gif o webp? Se mira el
// contenido (los primeros bytes), no el tipo que declara el navegador, que
// el cliente puede cambiar.
const esImagen = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const ascii = (desde, hasta) => buf.toString("latin1", desde, hasta);
  return (
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) || // jpg
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || // png
    ascii(0, 6) === "GIF87a" ||
    ascii(0, 6) === "GIF89a" ||
    (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
  );
};

module.exports = { esImagen };

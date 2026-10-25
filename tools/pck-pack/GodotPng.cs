using System.Security.Cryptography;
using System.Text;

namespace StS2PckPack;

/// <summary>Creates the imported texture pair needed by an exported Godot game.</summary>
public static class GodotPng
{
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    public static IReadOnlyDictionary<string, byte[]> Import(string relativePath, byte[] png)
    {
        if (png.Length < 26 || !png.Take(8).SequenceEqual(PngSignature))
            throw new InvalidDataException($"not a PNG file: {relativePath}");
        if (png[8] != 0 || png[9] != 0 || png[10] != 0 || png[11] != 13 ||
            png[12] != (byte)'I' || png[13] != (byte)'H' || png[14] != (byte)'D' || png[15] != (byte)'R')
            throw new InvalidDataException($"PNG has no leading IHDR: {relativePath}");

        var width = ReadBigEndianUInt32(png, 16);
        var height = ReadBigEndianUInt32(png, 20);
        var bitDepth = png[24];
        var colorType = png[25];
        if (width == 0 || height == 0 || width > ushort.MaxValue || height > ushort.MaxValue)
            throw new InvalidDataException($"PNG dimensions are outside the CTEX limit: {relativePath}");
        if (bitDepth != 8 || colorType is not (2 or 6))
            throw new InvalidDataException($"R0 supports only 8-bit RGB or RGBA PNG files: {relativePath}");

        // Godot Image.Format: RGB8 = 4, RGBA8 = 5.
        var imageFormat = colorType == 2 ? 4u : 5u;
        var payload = new byte[png.Length + 4];
        Encoding.ASCII.GetBytes("PNG ").CopyTo(payload, 0);
        png.CopyTo(payload, 4);

        using var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream, Encoding.UTF8, true);
        writer.Write(Encoding.ASCII.GetBytes("GST2"));
        writer.Write(1u); // CTEX format version.
        writer.Write(width);
        writer.Write(height);
        writer.Write(0u); // Data-format flags.
        writer.Write(uint.MaxValue); // No mipmap limit.
        writer.Write(0u);
        writer.Write(0u);
        writer.Write(0u);
        writer.Write(1u); // CompressedTexture2D.DATA_FORMAT_PNG.
        writer.Write((ushort)width);
        writer.Write((ushort)height);
        writer.Write(0u); // Mipmaps beyond the base image.
        writer.Write(imageFormat);
        writer.Write((uint)payload.Length);
        writer.Write(payload);
        writer.Flush();

        var hash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes($"res://{relativePath}"))).ToLowerInvariant();
        var fileName = Path.GetFileName(relativePath);
        var ctexPath = $".godot/imported/{fileName}-{hash}.ctex";
        var importText = $"[remap]\n\nimporter=\"texture\"\ntype=\"CompressedTexture2D\"\npath=\"res://{ctexPath}\"\nmetadata={{\n\"vram_texture\": false\n}}\n";

        return new Dictionary<string, byte[]>(StringComparer.Ordinal)
        {
            [ctexPath] = stream.ToArray(),
            [$"{relativePath}.import"] = Encoding.UTF8.GetBytes(importText),
        };
    }

    private static uint ReadBigEndianUInt32(byte[] bytes, int offset) =>
        ((uint)bytes[offset] << 24) | ((uint)bytes[offset + 1] << 16) |
        ((uint)bytes[offset + 2] << 8) | bytes[offset + 3];
}

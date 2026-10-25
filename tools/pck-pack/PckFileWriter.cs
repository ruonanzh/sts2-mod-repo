using System.Security.Cryptography;
using System.Text;

namespace Sts2SkinManager.Discovery;

// Source: https://github.com/ing-gom/Sts2SkinManager/blob/main/Sts2SkinManagerCode/Discovery/PckFileWriter.cs
// MIT, copyright 2026 inggom. The upstream license is distributed beside this file.
public static class PckFileWriter
{
    private const uint MagicGdpc = 0x43504447;
    private const int FileBase = 112;
    private const uint PackRelFilebase = 2;

    public static void Write(string outPath, IReadOnlyDictionary<string, byte[]> files)
    {
        using var body = new MemoryStream();
        var entries = new List<(string path, long relOff, long size, byte[] md5)>();
        using (var md5 = MD5.Create())
        {
            foreach (var kv in files)
            {
                while (body.Length % 16 != 0) body.WriteByte(0);
                var relOff = body.Length;
                body.Write(kv.Value, 0, kv.Value.Length);
                entries.Add((kv.Key, relOff, kv.Value.Length, md5.ComputeHash(kv.Value)));
            }
        }
        var bodyBytes = body.ToArray();
        long dirOffset = FileBase + bodyBytes.Length;
        var dir = Path.GetDirectoryName(outPath);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        using var fs = new FileStream(outPath, FileMode.Create, FileAccess.Write);
        using var bw = new BinaryWriter(fs);
        bw.Write(MagicGdpc);
        bw.Write((uint)3);
        bw.Write((uint)4);
        bw.Write((uint)5);
        bw.Write((uint)1);
        bw.Write(PackRelFilebase);
        bw.Write((long)FileBase);
        bw.Write(dirOffset);
        for (var i = 40; i < FileBase; i++) bw.Write((byte)0);
        bw.Write(bodyBytes);
        bw.Write((uint)entries.Count);
        foreach (var (path, relOff, size, md5) in entries)
        {
            var pb = Encoding.UTF8.GetBytes(path);
            var pad = (4 - (pb.Length % 4)) % 4;
            bw.Write((uint)(pb.Length + pad));
            bw.Write(pb);
            for (var i = 0; i < pad; i++) bw.Write((byte)0);
            bw.Write(relOff);
            bw.Write(size);
            bw.Write(md5);
            bw.Write((uint)0);
        }
    }
}

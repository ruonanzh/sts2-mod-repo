using Sts2SkinManager.Discovery;
using StS2PckPack;

if (args.Length != 2)
{
    Console.Error.WriteLine("FAIL: usage: pck-pack <input-directory> <output.pck>");
    return 2;
}

try
{
    var input = Path.GetFullPath(args[0]);
    var output = Path.GetFullPath(args[1]);
    if (!Directory.Exists(input))
    {
        Console.Error.WriteLine($"FAIL: input directory does not exist: {input}");
        return 1;
    }

    var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
    foreach (var path in Directory.EnumerateFiles(input, "*", SearchOption.AllDirectories).Order(StringComparer.Ordinal))
    {
        var relative = Path.GetRelativePath(input, path).Replace(Path.DirectorySeparatorChar, '/');
        if (relative.StartsWith(".godot/", StringComparison.Ordinal) || relative.EndsWith(".import", StringComparison.Ordinal))
            throw new InvalidDataException($"generated import files are not source assets: {relative}");

        var bytes = await File.ReadAllBytesAsync(path);
        if (relative.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var entry in GodotPng.Import(relative, bytes)) files.Add(entry.Key, entry.Value);
        }
        else
        {
            files.Add(relative, bytes);
        }
    }

    PckFileWriter.Write(output, files);
    Console.WriteLine($"PASS: wrote {files.Count} entries to {output} ({new FileInfo(output).Length} bytes)");
    return 0;
}
catch (Exception error) when (error is IOException or InvalidDataException or UnauthorizedAccessException)
{
    Console.Error.WriteLine($"FAIL: {error.Message}");
    return 1;
}

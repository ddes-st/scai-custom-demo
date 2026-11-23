using System.Reflection;
using System.Runtime.Serialization;

var plugin = args[0];
foreach (var dll in Directory.GetFiles(plugin, "*.dll"))
{
    try { Assembly.LoadFrom(dll); } catch { }
}

var client = Assembly.LoadFrom(Path.Combine(plugin, "Sitecore.DevEx.Serialization.Client.dll"));
var models = Assembly.LoadFrom(Path.Combine(plugin, "Sitecore.DevEx.Serialization.dll"));
Type[] types;
try { types = client.GetTypes(); }
catch (ReflectionTypeLoadException ex) { types = ex.Types.Where(t => t != null).Cast<Type>().ToArray(); }

var providerType = types.First(t => t.Name == "SubtreeFilesystemPathProvider");
var specType = types.First(t => t.Name == "FilesystemTreeSpec");
var itemPathType = models.GetType("Sitecore.DevEx.Serialization.Models.ItemPath")!;
var apply = providerType.GetMethod("ApplyPathLengthHashes", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)!;
var fromPath = itemPathType.GetMethod("FromPathString", BindingFlags.Public | BindingFlags.Static)!;
var toPath = itemPathType.GetMethod("ToPathString", BindingFlags.Public | BindingFlags.Instance)!;

foreach (var max in new int?[] { 100, 110, 120, 150, 200, null })
{
    var provider = FormatterServices.GetUninitializedObject(providerType);
    var spec = FormatterServices.GetUninitializedObject(specType);
    specType.GetProperty("MaxRelativePathLength")!.SetValue(spec, max);
    foreach (var f in providerType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public))
        if (f.FieldType == specType) f.SetValue(provider, spec);

    Console.WriteLine($"\n=== max={max?.ToString() ?? "null/default"} ===");
    string[] samples =
    [
        "/Project/build-quick-demos-and-proof-of-concepts/CtaButton/CtaButton Parameters/__Standard Values",
        "/Project/build-quick-demos-and-proof-of-concepts/Custom Card/Custom Card Parameters/Data/CssClass",
        "/Project/build-quick-demos-and-proof-of-concepts/Custom Test Rendering/Custom Test Rendering Parameters/Data",
        "/Project/build-quick-demos-and-proof-of-concepts/Custom Test Rendering/Custom Test Rendering Parameters/__Standard Values",
        "/Project/build-quick-demos-and-proof-of-concepts/Example Rendering/Example Rendering Folder/__Standard Values",
        "/Project/build-quick-demos-and-proof-of-concepts/Custom Test Rendering/Custom Test Rendering Parameters",
        "/build-quick-demos-and-proof-of-concepts/build-quick-demos-and-proof-of-concepts/Add CtaButtons Data Item",
    ];
    foreach (var p in samples)
    {
        var ip = fromPath.Invoke(null, [p])!;
        var applied = apply.Invoke(provider, [ip])!;
        var result = (string)toPath.Invoke(applied, null)!;
        var changed = result != p.TrimEnd('/');
        Console.WriteLine($"{(changed ? "HASH" : "keep")} {p}");
        if (changed) Console.WriteLine($"  -> {result}");
    }
}

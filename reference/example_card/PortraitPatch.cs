using System;
using System.IO;
using System.Reflection;
using Godot;
using HarmonyLib;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;

namespace ExampleCard;

/// <summary>
/// 临时卡面：在运行期把一张 PNG 变成 <c>Texture2D</c>，塞进 <see cref="CardModel.Portrait"/>。
///
/// 为什么只能这么做（三条都是实测的）：
///
/// 1. wiki 里所有美术例子（充能球 <c>CustomIconPath</c>、远古 <c>CustomMapIconPath</c>、
///    事件 <c>CustomInitialPortraitPath</c>）都返回 <c>res://&lt;ModRoot&gt;/images/...</c>。
///    那是**要 PCK** 的路径 —— DLL-only 的 mod 没有 <c>res://&lt;id&gt;/</c> 命名空间。
/// 2. <see cref="CardModel.Portrait"/> 不是 virtual，能覆写的只有 <c>PortraitPath</c>(string)。
/// 3. <c>PortraitPath</c> 的消费方是 <c>ResourceLoader.Load&lt;Texture2D&gt;(path)</c>。
///    实测：<c>ResourceLoader</c> 读不了运行期的原始 PNG（装出来的游戏没有 importer），返回 null，
///    而且**不报错** —— 比缺图更糟，卡面直接空白。
///
/// 所以走第四条路：<c>Image.LoadFromFile</c> 能读 PNG（实测 512×384 读到了），
/// <c>ImageTexture.CreateFromImage</c> 能造纹理，再用 postfix 顶掉 <c>Portrait</c> 的返回值。
/// <c>Portrait</c> 不是 virtual，但有 Harmony。
///
/// 这是应急通道，不是长久的做法：真正该做的是把图打进 `<id>.pck`。图放哪、
/// 尺寸取多少、和原版卡框怎么对齐，都要在美术方向定了以后重做。
/// </summary>
[HarmonyPatch(typeof(CardModel), nameof(CardModel.Portrait), MethodType.Getter)]
internal static class PortraitPatch
{
    private static Texture2D? _cached;
    private static bool _tried;

    private static void Postfix(CardModel __instance, ref Texture2D? __result)
    {
        if (__instance is not FocusedStrike) return;
        __result = Load();
    }

    private static Texture2D? Load()
    {
        if (_tried) return _cached;
        _tried = true;

        var path = Path.Combine(ModDir(), "portrait.png");
        if (!File.Exists(path))
        {
            Log.Warn($"[ExampleCard] no portrait.png next to the assembly ({path}); the card keeps the placeholder");
            return null;
        }

        var image = Image.LoadFromFile(path);
        if (image == null)
        {
            Log.Warn($"[ExampleCard] Godot could not read {path}");
            return null;
        }

        _cached = ImageTexture.CreateFromImage(image);
        Log.Info($"[ExampleCard] portrait loaded from {path} ({image.GetWidth()}x{image.GetHeight()})");
        return _cached;
    }

    /// <summary>本程序集所在目录。也就是游戏 mods 下这个 mod 的目录。</summary>
    private static string ModDir() =>
        Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".";
}

import AVFoundation
import CoreImage
import UIKit

struct ExportClip: Hashable {
    let url: URL
    let text: String
    let speaker: String
    let duration: Double
    var start: Double? = nil      // manual start time on the timeline (seconds)
    var emoji: String = ""        // character face shown on screen (auto video)
}

struct TextOverlay {
    var text: String
    var start: Double
    var end: Double
    var y: Double          // 0 = top, 1 = bottom
    var size: Double
}

struct SFXCue: Identifiable, Hashable {
    var id = UUID()
    var kind: SFXKind
    var time: Double
}

struct ExportSettings {
    var image: UIImage?
    var clips: [ExportClip]
    var gap: Double = 0.25
    var music: MusicKind = .funny
    var musicVolume: Float = 0.25
    var voiceVolume: Float = 1.0
    var sfx: [SFXCue] = []
    var captions = true
    var showSpeaker = true
    var hookText = ""
    var endCard = true
    var endCardHandle = "@KKClipRush"
    var watermark = true          // free version only
    var videoURL: URL? = nil      // user's own video as background
    var videoDuration: Double = 0
    var videoVolume: Float = 0.5
    var videoStart: Double = 0         // trim: start of the user's video (seconds)
    var captionColor: UIColor = UIColor(red: 1, green: 0.85, blue: 0.05, alpha: 1)
    var overlays: [TextOverlay] = []   // stickers / emoji text

    static let leadIn = 0.3
    static let tail = 0.6
    static let endCardLength = 2.0

    /// Start time of each clip on the timeline
    var clipStarts: [Double] {
        var t = Self.leadIn
        var result: [Double] = []
        for c in clips {
            let st = c.start ?? t
            result.append(st)
            t = st + c.duration + gap
        }
        return result
    }
    var contentLength: Double {
        let voicesEnd = zip(clipStarts, clips).map { $0 + $1.duration }.max().map { $0 + Self.tail } ?? 0
        if videoURL != nil { return max(voicesEnd, videoDuration, 1) }
        return clips.isEmpty ? 5 : voicesEnd
    }
    var totalLength: Double { contentLength + (endCard ? Self.endCardLength : 0) }
}

enum ExportError: LocalizedError {
    case writer(String), export(String)
    var errorDescription: String? {
        switch self {
        case .writer(let m): return "Video render failed: \(m)"
        case .export(let m): return "Export failed: \(m)"
        }
    }
}

enum VideoExporter {
    static let size = CGSize(width: 1080, height: 1920)   // 9:16, 1080p
    static let fps: Int32 = 30

    /// Builds the final MP4. `progress` is called with 0...1 (from a background thread).
    static func export(_ settings: ExportSettings, progress: @escaping (Double) -> Void) async throws -> URL {
        let silent = FileStore.temp.appendingPathComponent("silent_\(UUID().uuidString).mp4")
        defer { FileStore.delete(silent) }
        try await renderFrames(settings, to: silent) { progress($0 * 0.8) }
        let out = FileStore.videos.appendingPathComponent("KKStudio_\(Int(Date().timeIntervalSince1970)).mp4")
        try await compose(settings, video: silent, to: out)
        progress(1)
        return out
    }

    // MARK: - 1. Draw every frame (image + captions + hook + end card)

    private static func renderFrames(_ s: ExportSettings, to url: URL, progress: @escaping (Double) -> Void) async throws {
        FileStore.delete(url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(size.width),
            AVVideoHeightKey: Int(size.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 10_000_000,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(size.width),
            kCVPixelBufferHeightKey as String: Int(size.height),
        ])
        guard writer.canAdd(input) else { throw ExportError.writer("cannot add input") }
        writer.add(input)
        guard writer.startWriting() else { throw ExportError.writer(writer.error?.localizedDescription ?? "start") }
        writer.startSession(atSourceTime: .zero)

        var videoSource: VideoFrameSource? = nil
        if let v = s.videoURL { videoSource = try await VideoFrameSource.make(url: v, start: s.videoStart, length: s.videoDuration) }
        let renderer = FrameRenderer(settings: s, size: size, video: videoSource)
        let frameCount = Int((s.totalLength * Double(fps)).rounded(.up))

        for f in 0..<frameCount {
            while !input.isReadyForMoreMediaData {
                try await Task.sleep(nanoseconds: 3_000_000)
            }
            guard let pool = adaptor.pixelBufferPool else { throw ExportError.writer("no buffer pool") }
            var pbOut: CVPixelBuffer?
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pbOut)
            guard let pb = pbOut else { throw ExportError.writer("no pixel buffer") }

            // autoreleasepool frees each frame's images right away (otherwise memory grows until iOS kills the app)
            let ok: Bool = autoreleasepool {
                CVPixelBufferLockBaseAddress(pb, [])
                if let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb),
                                       width: Int(size.width), height: Int(size.height),
                                       bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
                                       space: CGColorSpaceCreateDeviceRGB(),
                                       bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) {
                    renderer.draw(time: Double(f) / Double(fps), in: ctx)
                }
                CVPixelBufferUnlockBaseAddress(pb, [])
                return adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: fps))
            }
            if !ok {
                throw ExportError.writer(writer.error?.localizedDescription ?? "append failed")
            }
            if f % 10 == 0 { progress(Double(f) / Double(frameCount)) }
        }
        input.markAsFinished()
        await writer.finishWriting()
        if writer.status != .completed { throw ExportError.writer(writer.error?.localizedDescription ?? "finish") }
    }

    // MARK: - 2. Add voices, music and SFX

    private static func compose(_ s: ExportSettings, video: URL, to out: URL) async throws {
        let comp = AVMutableComposition()
        let vAsset = AVURLAsset(url: video)
        guard let vSrc = try await vAsset.loadTracks(withMediaType: .video).first,
              let vTrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
        else { throw ExportError.export("no video track") }
        let vDur = try await vAsset.load(.duration)
        try vTrack.insertTimeRange(CMTimeRange(start: .zero, duration: vDur), of: vSrc, at: .zero)
        let total = vDur.seconds

        var params: [AVMutableAudioMixInputParameters] = []

        func addAudio(_ url: URL, at start: Double, volume: Float, loop: Bool = false, fadeOut: Bool = false,
                      from: Double = 0, length: Double? = nil) async throws {
            let asset = AVURLAsset(url: url)
            guard let src = try await asset.loadTracks(withMediaType: .audio).first,
                  let track = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
            else { return }
            let full = try await asset.load(.duration).seconds
            let len = min(length ?? (full - from), full - from)
            guard len > 0.01 else { return }
            var t = start
            repeat {
                let piece = min(len, total - t)
                if piece <= 0.01 { break }
                try track.insertTimeRange(CMTimeRange(start: CMTime(seconds: from, preferredTimescale: 600),
                                                      duration: CMTime(seconds: piece, preferredTimescale: 600)),
                                          of: src, at: CMTime(seconds: t, preferredTimescale: 600))
                t += piece
            } while loop && t < total - 0.01
            let p = AVMutableAudioMixInputParameters(track: track)
            p.setVolume(volume, at: .zero)
            if fadeOut, total > 1.5 {
                p.setVolumeRamp(fromStartVolume: volume, toEndVolume: 0,
                                timeRange: CMTimeRange(start: CMTime(seconds: total - 1.2, preferredTimescale: 600),
                                                       duration: CMTime(seconds: 1.2, preferredTimescale: 600)))
            }
            params.append(p)
        }

        // original sound of the user's video (looped under the content)
        if let v = s.videoURL, s.videoVolume > 0.001 {
            try await addAudio(v, at: 0, volume: s.videoVolume, loop: true, fadeOut: false,
                               from: s.videoStart, length: s.videoDuration)
        }
        // voices
        for (clip, start) in zip(s.clips, s.clipStarts) {
            try await addAudio(clip.url, at: start, volume: s.voiceVolume)
        }
        // music (looped under everything)
        if let musicURL = try AudioSynth.url(for: s.music) {
            try await addAudio(musicURL, at: 0, volume: s.musicVolume, loop: true, fadeOut: true)
        }
        // sound effects
        for cue in s.sfx {
            let url = try await AudioSynth.url(for: cue.kind)
            try await addAudio(url, at: min(max(0, cue.time), max(0, total - 0.2)), volume: 0.9)
        }

        let mix = AVMutableAudioMix()
        mix.inputParameters = params

        FileStore.delete(out)
        guard let session = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality) else {
            throw ExportError.export("session")
        }
        session.outputURL = out
        session.outputFileType = .mp4
        session.audioMix = mix
        session.shouldOptimizeForNetworkUse = true
        await session.export()
        if session.status != .completed {
            throw ExportError.export(session.error?.localizedDescription ?? "status \(session.status.rawValue)")
        }
    }
}

// MARK: - Frame drawing

final class FrameRenderer {
    let s: ExportSettings
    let size: CGSize
    private let background: UIImage
    private let starts: [Double]
    private let wordTimes: [[(word: String, start: Double, end: Double)]]

    let video: VideoFrameSource?

    init(settings: ExportSettings, size: CGSize, video: VideoFrameSource? = nil) {
        self.video = video
        self.s = settings
        self.size = size
        self.background = FrameRenderer.prepareBackground(settings.image, size: size)
        self.starts = settings.clipStarts
        self.wordTimes = settings.clips.map { FrameRenderer.timings(text: $0.text, duration: $0.duration) }
    }

    /// Estimate when each word is spoken (by word length).
    static func timings(text: String, duration: Double) -> [(word: String, start: Double, end: Double)] {
        let words = text.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else { return [] }
        let weights = words.map { Double($0.count) + 1.5 }
        let total = weights.reduce(0, +)
        var t = 0.0
        var result: [(word: String, start: Double, end: Double)] = []
        for (w, wt) in zip(words, weights) {
            let d = duration * wt / total
            result.append((word: w, start: t, end: t + d))
            t += d
        }
        return result
    }

    static func prepareBackground(_ image: UIImage?, size: CGSize) -> UIImage {
        let canvas = CGSize(width: size.width * 1.1, height: size.height * 1.1) // room for slow zoom
        let r = UIGraphicsImageRenderer(size: canvas, format: { let f = UIGraphicsImageRendererFormat(); f.scale = 1; return f }())
        return r.image { ctx in
            if let image {
                let scale = max(canvas.width / image.size.width, canvas.height / image.size.height)
                let w = image.size.width * scale, h = image.size.height * scale
                image.draw(in: CGRect(x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, width: w, height: h))
            } else {
                LavaArt.draw(in: ctx.cgContext, size: canvas)
            }
        }
    }

    func draw(time t: Double, in ctx: CGContext) {
        // flip to UIKit coordinates
        ctx.translateBy(x: 0, y: size.height)
        ctx.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(ctx)
        defer { UIGraphicsPopContext() }

        if s.endCard && t >= s.contentLength {
            drawEndCard(in: ctx)
            return
        }

        // 🥁 "dun dun" — zoom + shake on every Dham sound
        let hit = dramaticAmount(at: t)
        ctx.saveGState()
        if hit > 0.001 {
            let z = 1 + 0.22 * hit
            let shakeX = CGFloat(sin(t * 90) * 22 * hit), shakeY = CGFloat(cos(t * 77) * 16 * hit)
            ctx.translateBy(x: size.width / 2 + shakeX, y: size.height / 2 + shakeY)
            ctx.scaleBy(x: z, y: z)
            ctx.translateBy(x: -size.width / 2, y: -size.height / 2)
        }
        if let video, let frame = video.image(at: t) {
            // user's video, aspect-fill into 9:16
            let iw = CGFloat(frame.width), ih = CGFloat(frame.height)
            let scale = max(size.width / iw, size.height / ih)
            let w = iw * scale, h = ih * scale
            UIImage(cgImage: frame).draw(in: CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h))
        } else {
            // slow zoom (Ken Burns)
            let progress = min(1, t / max(1, s.contentLength))
            let zoom = 1.0 + 0.08 * progress
            let w = size.width * zoom, h = size.height * zoom
            background.draw(in: CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h))
        }

        // dark gradient at bottom so captions pop
        let colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.55).cgColor] as CFArray
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: size.height * 0.55), end: CGPoint(x: 0, y: size.height), options: [])
        }

        if s.image == nil && s.videoURL == nil { drawCharacter(at: t) }
        ctx.restoreGState()
        if hit > 0.001 {   // red flash
            UIColor(red: 0.9, green: 0, blue: 0, alpha: CGFloat(0.35 * hit)).setFill()
            UIRectFillUsingBlendMode(CGRect(origin: .zero, size: size), .normal)
        }
        if !s.hookText.isEmpty { drawHook() }
        if s.captions { drawCaption(at: t) }
        drawOverlays(at: t)
        if s.watermark { drawWatermark() }
    }

    private lazy var dhamTimes: [Double] = s.sfx.filter { $0.kind == .dham }.map { $0.time }

    /// 0…1 strength of the dramatic hit at time t (three quick hits like "dun dun dun")
    private func dramaticAmount(at t: Double) -> Double {
        var best = 0.0
        for d in dhamTimes {
            for hitTime in [d, d + 0.42, d + 0.84] {
                let dt = t - hitTime
                if dt >= 0 && dt < 0.4 { best = max(best, exp(-dt * 7)) }
            }
        }
        return best
    }

    private func drawOverlays(at t: Double) {
        for o in s.overlays where t >= o.start && t <= o.end {
            let age = t - o.start
            let pop = 1.0 + 0.25 * max(0, 1 - age / 0.15)
            _ = drawText(o.text, font: .systemFont(ofSize: CGFloat(o.size * pop), weight: .black), color: .white,
                         in: CGRect(x: 40, y: CGFloat(o.y) * size.height - CGFloat(o.size) / 2, width: size.width - 80, height: CGFloat(o.size) * 3))
        }
    }

    private func drawWatermark() {
        let a = NSAttributedString(string: "🎬 Made with KK Studio", attributes: [
            .font: UIFont.systemFont(ofSize: 38, weight: .heavy),
            .foregroundColor: UIColor.white.withAlphaComponent(0.75),
            .strokeColor: UIColor.black.withAlphaComponent(0.6),
            .strokeWidth: -3,
        ])
        let sz = a.size()
        a.draw(at: CGPoint(x: size.width - sz.width - 36, y: size.height * 0.26))
    }

    /// Big character face for whoever is talking (used when there is no photo/video)
    private func drawCharacter(at t: Double) {
        guard let idx = starts.indices.last(where: { starts[$0] <= t + 0.05 }) else { return }
        let clip = s.clips[idx]
        guard !clip.emoji.isEmpty else { return }
        let local = max(0, t - starts[idx])
        let pop = 1.0 + 0.15 * max(0, 1 - local / 0.2)            // pops in when they start talking
        let talking = local <= clip.duration
        let bob = talking ? 12 * sin(local * 14) : 0               // little bounce while speaking
        let side = 560 * pop
        let rect = CGRect(x: (size.width - side) / 2, y: size.height * 0.36 - side / 2 + bob, width: side, height: side)
        // glow circle
        UIColor(red: 1, green: 0.55, blue: 0.1, alpha: 0.25).setFill()
        UIBezierPath(ovalIn: rect.insetBy(dx: -40, dy: -40)).fill()
        let a = NSAttributedString(string: clip.emoji, attributes: [.font: UIFont.systemFont(ofSize: side * 0.8)])
        let sz = a.size()
        a.draw(at: CGPoint(x: rect.midX - sz.width / 2, y: rect.midY - sz.height / 2))
    }

    private func drawHook() {
        let lines = s.hookText.components(separatedBy: .newlines).filter { !$0.isEmpty }
        let colors: [UIColor] = [UIColor(red: 1, green: 0.82, blue: 0.1, alpha: 1), .white, UIColor(red: 1, green: 0.3, blue: 0.3, alpha: 1)]
        var y: CGFloat = 130
        for (i, line) in lines.prefix(3).enumerated() {
            let fontSize: CGFloat = i == 0 ? 96 : 74
            let h = drawText(line, font: .systemFont(ofSize: fontSize, weight: .black), color: colors[i % colors.count],
                             in: CGRect(x: 40, y: y, width: size.width - 80, height: 400))
            y += h + 10
        }
    }

    private func drawCaption(at t: Double) {
        guard let idx = starts.indices.last(where: { starts[$0] <= t }) else { return }
        let local = t - starts[idx]
        let clip = s.clips[idx]
        guard local <= clip.duration + 0.15 else { return }
        let words = wordTimes[idx]
        guard !words.isEmpty else { return }
        let current = words.lastIndex(where: { $0.start <= local }) ?? 0

        // show the current group of 3 words, highlight the spoken word
        let groupStart = (current / 3) * 3
        let group = words[groupStart..<min(words.count, groupStart + 3)]
        let font = UIFont.systemFont(ofSize: 104, weight: .black)
        let para = NSMutableParagraphStyle(); para.alignment = .center; para.lineBreakMode = .byWordWrapping
        let text = NSMutableAttributedString()
        for (i, w) in group.enumerated() {
            let isNow = groupStart + i == current
            text.append(NSAttributedString(string: (i > 0 ? " " : "") + w.word, attributes: [
                .font: font,
                .foregroundColor: isNow ? s.captionColor : UIColor.white,
                .strokeColor: UIColor.black,
                .strokeWidth: -7,
                .paragraphStyle: para,
            ]))
        }
        let rect = CGRect(x: 40, y: size.height * 0.70, width: size.width - 80, height: 420)
        // pop-in scale for the new word
        let wordAge = local - words[current].start
        let pop = 1.0 + 0.12 * max(0, 1 - wordAge / 0.12)
        let ctx = UIGraphicsGetCurrentContext()
        ctx?.saveGState()
        ctx?.translateBy(x: size.width / 2, y: rect.midY)
        ctx?.scaleBy(x: pop, y: pop)
        ctx?.translateBy(x: -size.width / 2, y: -rect.midY)
        text.draw(with: rect, options: [.usesLineFragmentOrigin], context: nil)
        ctx?.restoreGState()

        if s.showSpeaker, !clip.speaker.isEmpty {
            let tag = NSAttributedString(string: "  \(clip.speaker.uppercased())  ", attributes: [
                .font: UIFont.systemFont(ofSize: 50, weight: .heavy),
                .foregroundColor: UIColor.white,
            ])
            let ts = tag.size()
            let tagRect = CGRect(x: (size.width - ts.width) / 2 - 10, y: rect.minY - ts.height - 40, width: ts.width + 20, height: ts.height + 16)
            UIColor(red: 0.9, green: 0.1, blue: 0.15, alpha: 0.95).setFill()
            UIBezierPath(roundedRect: tagRect, cornerRadius: 22).fill()
            tag.draw(at: CGPoint(x: tagRect.minX + 10, y: tagRect.minY + 8))
        }
    }

    private func drawEndCard(in ctx: CGContext) {
        LavaArt.drawDark(in: ctx, size: size)
        var y = size.height * 0.36
        y += drawText("LIKE &", font: .systemFont(ofSize: 150, weight: .black), color: .white,
                      in: CGRect(x: 40, y: y, width: size.width - 80, height: 220)) + 10
        y += drawText("SUBSCRIBE", font: .systemFont(ofSize: 160, weight: .black), color: UIColor(red: 1, green: 0.15, blue: 0.2, alpha: 1),
                      in: CGRect(x: 20, y: y, width: size.width - 40, height: 240)) + 30
        if !s.endCardHandle.isEmpty {
            _ = drawText(s.endCardHandle, font: .systemFont(ofSize: 84, weight: .heavy), color: UIColor(red: 1, green: 0.82, blue: 0.1, alpha: 1),
                         in: CGRect(x: 40, y: y, width: size.width - 80, height: 160))
        }
    }

    /// Draws centred, black-outlined text. Returns used height.
    @discardableResult
    private func drawText(_ string: String, font: UIFont, color: UIColor, in rect: CGRect) -> CGFloat {
        let para = NSMutableParagraphStyle(); para.alignment = .center
        let a = NSAttributedString(string: string, attributes: [
            .font: font, .foregroundColor: color, .strokeColor: UIColor.black, .strokeWidth: -6, .paragraphStyle: para,
        ])
        let bounds = a.boundingRect(with: CGSize(width: rect.width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil)
        a.draw(with: CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: bounds.height + 4), options: [.usesLineFragmentOrigin], context: nil)
        return bounds.height
    }
}

/// Code-drawn "Narak lava" background used when no picture is picked.
enum LavaArt {
    static func draw(in ctx: CGContext, size: CGSize) {
        let space = CGColorSpaceCreateDeviceRGB()
        let sky = [UIColor(red: 0.08, green: 0.02, blue: 0.02, alpha: 1).cgColor,
                   UIColor(red: 0.35, green: 0.05, blue: 0.02, alpha: 1).cgColor,
                   UIColor(red: 0.95, green: 0.35, blue: 0.02, alpha: 1).cgColor] as CFArray
        if let g = CGGradient(colorsSpace: space, colors: sky, locations: [0, 0.6, 1]) {
            ctx.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
        // lava blobs
        var seed: UInt64 = 42
        func rnd() -> CGFloat { seed = seed &* 6364136223846793005 &+ 1; return CGFloat((seed >> 33) % 1000) / 1000 }
        for _ in 0..<26 {
            let r = 60 + rnd() * 220
            let x = rnd() * size.width, y = size.height * (0.62 + rnd() * 0.4)
            let c = [UIColor(red: 1, green: 0.75, blue: 0.1, alpha: 0.9).cgColor, UIColor(red: 1, green: 0.2, blue: 0, alpha: 0).cgColor] as CFArray
            if let g = CGGradient(colorsSpace: space, colors: c, locations: [0, 1]) {
                ctx.drawRadialGradient(g, startCenter: CGPoint(x: x, y: y), startRadius: 0, endCenter: CGPoint(x: x, y: y), endRadius: r, options: [])
            }
        }
        // rocky ground line
        ctx.setFillColor(UIColor(red: 0.06, green: 0.03, blue: 0.03, alpha: 0.85).cgColor)
        let path = UIBezierPath()
        path.move(to: CGPoint(x: 0, y: size.height * 0.6))
        var x: CGFloat = 0
        while x < size.width { x += 80; path.addLine(to: CGPoint(x: x, y: size.height * (0.56 + rnd() * 0.06))) }
        path.addLine(to: CGPoint(x: size.width, y: 0)); path.addLine(to: .zero); path.close()
        ctx.addPath(path.cgPath); ctx.setAlpha(0.35); ctx.fillPath(); ctx.setAlpha(1)
    }

    static func drawDark(in ctx: CGContext, size: CGSize) {
        let c = [UIColor(red: 0.05, green: 0.02, blue: 0.03, alpha: 1).cgColor, UIColor(red: 0.3, green: 0.03, blue: 0.04, alpha: 1).cgColor] as CFArray
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: c, locations: [0, 1]) {
            ctx.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
    }

    static func image(size: CGSize = CGSize(width: 540, height: 960)) -> UIImage {
        UIGraphicsImageRenderer(size: size).image { draw(in: $0.cgContext, size: size) }
    }
}


// MARK: - Reads frames of the user's video, in order, looping if needed

final class VideoFrameSource {
    private let asset: AVURLAsset
    private let track: AVAssetTrack
    private let transform: CGAffineTransform
    let duration: Double
    private var reader: AVAssetReader?
    private var output: AVAssetReaderTrackOutput?
    private var pending: CMSampleBuffer?
    private var current: CGImage?
    private var lastLocal = -1.0
    private let ci = CIContext(options: [.cacheIntermediates: false])

    /// Turn the track's rotation into an image orientation (iPhone videos are often stored rotated)
    private var orientation: CGImagePropertyOrientation {
        let angle = atan2(transform.b, transform.a)
        switch angle {
        case let a where abs(a - .pi / 2) < 0.1: return .right
        case let a where abs(a + .pi / 2) < 0.1: return .left
        case let a where abs(abs(a) - .pi) < 0.1: return .down
        default: return .up
        }
    }

    private var offset: Double = 0

    private init(asset: AVURLAsset, track: AVAssetTrack, transform: CGAffineTransform, duration: Double) {
        self.asset = asset; self.track = track; self.transform = transform; self.duration = duration
    }

    static func make(url: URL, start: Double = 0, length: Double = 0) async throws -> VideoFrameSource? {
        let asset = AVURLAsset(url: url)
        guard let track = try await asset.loadTracks(withMediaType: .video).first else { return nil }
        let transform = try await track.load(.preferredTransform)
        let full = try await asset.load(.duration).seconds
        let st = max(0, min(start, full - 0.1))
        let len = length > 0.05 ? min(length, full - st) : full - st
        let src = VideoFrameSource(asset: asset, track: track, transform: transform, duration: len)
        src.offset = st
        try src.restart()
        return src
    }

    private func restart() throws {
        reader?.cancelReading()
        let r = try AVAssetReader(asset: asset)
        let o = AVAssetReaderTrackOutput(track: track, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        ])
        o.alwaysCopiesSampleData = false
        if r.canAdd(o) { r.add(o) }
        r.timeRange = CMTimeRange(start: CMTime(seconds: offset, preferredTimescale: 600),
                                  duration: CMTime(seconds: duration, preferredTimescale: 600))
        r.startReading()
        reader = r; output = o; pending = nil
    }

    /// Frame to show at timeline time t (seconds).
    func image(at t: Double) -> CGImage? {
        guard duration > 0.05 else { return current }
        let local = offset + t.truncatingRemainder(dividingBy: duration)
        if local < lastLocal { try? restart() }      // looped
        lastLocal = local
        while true {
            if pending == nil { pending = output?.copyNextSampleBuffer() }
            guard let sb = pending else { break }
            let pts = CMSampleBufferGetPresentationTimeStamp(sb).seconds
            if pts > local + 0.0001, current != nil { break }
            autoreleasepool {
                if let pb = CMSampleBufferGetImageBuffer(sb) {
                    var img = CIImage(cvPixelBuffer: pb).oriented(orientation)
                    // shrink 4K / big frames to about 1080 wide before converting (saves lots of memory)
                    let maxSide: CGFloat = 1920
                    let scale = min(1, maxSide / max(img.extent.width, img.extent.height))
                    if scale < 0.999 { img = img.transformed(by: CGAffineTransform(scaleX: scale, y: scale)) }
                    if let cg = ci.createCGImage(img, from: img.extent) { current = cg }
                }
            }
            pending = nil
        }
        return current
    }
}

import ExpoModulesCore
import AVFoundation
import UIKit

/// Bridge between the React Native screens and the Swift voice / video engine.
public class YamrajNativeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("YamrajNative")

        // ---------- files ----------
        Function("documentsPath") { () -> String in
            FileStore.documents.path
        }

        Function("readJSON") { (name: String) -> String? in
            let url = FileStore.documents.appendingPathComponent(name)
            return try? String(contentsOf: url, encoding: .utf8)
        }

        Function("writeJSON") { (name: String, text: String) -> Bool in
            let url = FileStore.documents.appendingPathComponent(name)
            return (try? text.write(to: url, atomically: true, encoding: .utf8)) != nil
        }

        Function("deleteFile") { (path: String) in
            FileStore.delete(FileStore.resolve(path))
        }

        // ---------- voices ----------
        Function("hindiVoices") { () -> [[String: Any]] in
            SpeechEngine.hindiVoices.map { v in
                [
                    "id": v.identifier,
                    "name": v.name,
                    "gender": v.gender == .male ? "male" : (v.gender == .female ? "female" : "other"),
                    "enhanced": v.quality != .default,
                ]
            }
        }

        Function("speak") { (text: String, pitch: Double, rate: Double, voiceId: String?, preferMale: Bool) in
            let voice = SpeechEngine.voice(preferMale: preferMale, identifier: voiceId)
            let u = SpeechEngine.utterance(text: text, pitch: Float(pitch), rate: Float(rate), voice: voice)
            DispatchQueue.main.async { SpeechEngine.shared.speak(u) }
        }

        Function("stopSpeaking") {
            DispatchQueue.main.async { SpeechEngine.shared.stop() }
        }

        /// Saves speech to Documents/Audio. Returns { path (relative), duration }.
        AsyncFunction("renderSpeech") { (text: String, pitch: Double, rate: Double, voiceId: String?, preferMale: Bool, echo: Bool, effect: String?) async throws -> [String: Any] in
            let voice = SpeechEngine.voice(preferMale: preferMale, identifier: voiceId)
            let u = SpeechEngine.utterance(text: text, pitch: Float(pitch), rate: Float(rate), voice: voice)
            let name = "voice_\(UUID().uuidString).caf"
            let url = FileStore.audio.appendingPathComponent(name)
            let duration = try await SpeechRenderer().render(u, to: url, echo: echo, effect: effect ?? "")
            return ["path": "Audio/\(name)", "duration": duration]
        }

        // ---------- AI scenes ----------
        /// Downloads a URL into Documents/Media. Returns relative path.
        AsyncFunction("downloadFile") { (urlString: String, ext: String) async throws -> String in
            guard let url = URL(string: urlString) else { throw NSError(domain: "KK", code: 1, userInfo: [NSLocalizedDescriptionKey: "Bad link"]) }
            let (tmp, _) = try await URLSession.shared.download(from: url)
            let name = "ai_\(UUID().uuidString).\(ext)"
            let dest = FileStore.media.appendingPathComponent(name)
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: tmp, to: dest)
            return "Media/\(name)"
        }

        /// Joins several videos one after another (video only). Returns { path, duration }.
        AsyncFunction("joinVideos") { (paths: [String]) async throws -> [String: Any] in
            let out = try await VideoJoiner.join(paths.map { FileStore.resolve($0) })
            let d = try await AVURLAsset(url: out).load(.duration).seconds
            return ["path": "Media/\(out.lastPathComponent)", "duration": d]
        }

        // ---------- record your own voice ----------
        AsyncFunction("startRecording") { () async throws -> Bool in
            return try await VoiceRecorder.shared.start()
        }

        AsyncFunction("stopRecording") { (effect: String?) async throws -> [String: Any]? in
            guard let raw = VoiceRecorder.shared.stop() else { return nil }
            let name = "rec_\(UUID().uuidString).caf"
            let url = FileStore.audio.appendingPathComponent(name)
            let duration = try AudioFX.process(input: raw, output: url, echo: false, effect: effect ?? "")
            FileStore.delete(raw)
            SpeechEngine.activateSession()
            return ["path": "Audio/\(name)", "duration": duration]
        }

        // ---------- playback ----------
        Function("playFile") { (path: String) in
            try ClipPlayer.shared.play(FileStore.resolve(path))
        }

        Function("stopPlayback") {
            ClipPlayer.shared.stop()
        }

        AsyncFunction("playMusic") { (kind: String) in
            guard let m = MusicKind(rawValue: kind), let url = try AudioSynth.url(for: m) else { return }
            try ClipPlayer.shared.play(url)
        }

        AsyncFunction("playSFX") { (kind: String) async throws in
            guard let s = SFXKind(rawValue: kind) else { return }
            let url = try await AudioSynth.url(for: s)
            try ClipPlayer.shared.play(url)
        }

        // ---------- photos ----------
        AsyncFunction("pickImage") { () async -> String? in
            let presenter = await MainActor.run { self.appContext?.utilities?.currentViewController() }
            return await ImagePicker.pick(from: presenter)
        }

        AsyncFunction("pickVideo") { () async -> [String: Any]? in
            let presenter = await MainActor.run { self.appContext?.utilities?.currentViewController() }
            guard let path = await VideoPicker.pick(from: presenter) else { return nil }
            let (duration, thumb) = await VideoInfo.inspect(path)
            return ["path": path, "duration": duration, "thumbnail": thumb ?? ""]
        }

        // ---------- export ----------
        Events("onExportProgress")

        /// options: { image?, clips:[{path,text,speaker,duration}], music, musicVolume, voiceVolume,
        ///            sfx:[{kind,time}], captions, showSpeaker, hookText, endCard, endCardHandle, watermark }
        AsyncFunction("exportVideo") { (options: [String: Any]) async throws -> [String: Any] in
            var image: UIImage?
            if let p = options["image"] as? String, !p.isEmpty {
                image = UIImage(contentsOfFile: FileStore.resolve(p).path)
            }
            let clips: [ExportClip] = (options["clips"] as? [[String: Any]] ?? []).compactMap { c in
                guard let p = c["path"] as? String else { return nil }
                return ExportClip(url: FileStore.resolve(p),
                                  text: c["text"] as? String ?? "",
                                  speaker: c["speaker"] as? String ?? "",
                                  duration: (c["duration"] as? NSNumber)?.doubleValue ?? 1,
                                  start: (c["start"] as? NSNumber)?.doubleValue,
                                  emoji: c["emoji"] as? String ?? "")
            }
            var s = ExportSettings(image: image, clips: clips)
            s.music = MusicKind(rawValue: options["music"] as? String ?? "None") ?? .none
            s.musicVolume = (options["musicVolume"] as? NSNumber)?.floatValue ?? 0.25
            s.voiceVolume = (options["voiceVolume"] as? NSNumber)?.floatValue ?? 1
            s.sfx = (options["sfx"] as? [[String: Any]] ?? []).compactMap { d in
                guard let k = SFXKind(rawValue: d["kind"] as? String ?? "") else { return nil }
                return SFXCue(kind: k, time: (d["time"] as? NSNumber)?.doubleValue ?? 0)
            }
            s.captions = options["captions"] as? Bool ?? true
            s.showSpeaker = options["showSpeaker"] as? Bool ?? true
            s.hookText = options["hookText"] as? String ?? ""
            s.endCard = options["endCard"] as? Bool ?? true
            s.endCardHandle = options["endCardHandle"] as? String ?? ""
            s.watermark = options["watermark"] as? Bool ?? true
            if let hex = options["captionColor"] as? String, let c = UIColor(hex: hex) { s.captionColor = c }
            s.overlays = (options["overlays"] as? [[String: Any]] ?? []).compactMap { o in
                guard let text = o["text"] as? String, !text.isEmpty else { return nil }
                return TextOverlay(text: text,
                                   start: (o["start"] as? NSNumber)?.doubleValue ?? 0,
                                   end: (o["end"] as? NSNumber)?.doubleValue ?? 3,
                                   y: (o["y"] as? NSNumber)?.doubleValue ?? 0.35,
                                   size: (o["size"] as? NSNumber)?.doubleValue ?? 110)
            }
            s.videoStart = (options["videoStart"] as? NSNumber)?.doubleValue ?? 0
            if let v = options["video"] as? String, !v.isEmpty {
                let url = FileStore.resolve(v)
                s.videoURL = url
                if let d = (options["videoDuration"] as? NSNumber)?.doubleValue, d > 0 {
                    s.videoDuration = d
                } else {
                    let d = try? await AVURLAsset(url: url).load(.duration)
                    s.videoDuration = d?.seconds ?? 0
                }
                s.videoVolume = (options["videoVolume"] as? NSNumber)?.floatValue ?? 0.5
            }

            let url = try await VideoExporter.export(s) { [weak self] p in
                self?.sendEvent("onExportProgress", ["progress": p])
            }
            return ["path": "Videos/\(url.lastPathComponent)", "absolutePath": url.path, "duration": s.totalLength]
        }

        // ---------- Pro (in-app purchase) ----------
        AsyncFunction("proStatus") { () async -> [String: Any] in
            let store = await ProStore.shared
            await store.load()
            let pro = await store.isPro
            let price = await store.product?.displayPrice ?? ""
            return ["isPro": pro, "price": price]
        }

        AsyncFunction("buyPro") { () async -> [String: Any] in
            let store = await ProStore.shared
            let msg = await store.buy()
            let pro = await store.isPro
            return ["isPro": pro, "message": msg]
        }

        AsyncFunction("restorePro") { () async -> [String: Any] in
            let store = await ProStore.shared
            let msg = await store.restore()
            let pro = await store.isPro
            return ["isPro": pro, "message": msg]
        }
    }
}

extension UIColor {
    convenience init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
                  blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}

/// Records the user's own voice to a temp .m4a file.
final class VoiceRecorder {
    static let shared = VoiceRecorder()
    private var recorder: AVAudioRecorder?
    private var url: URL?

    func start() async throws -> Bool {
        let session = AVAudioSession.sharedInstance()
        let granted: Bool = await withCheckedContinuation { cont in
            session.requestRecordPermission { ok in cont.resume(returning: ok) }
        }
        guard granted else { return false }
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("rec_\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        let r = try AVAudioRecorder(url: u, settings: settings)
        guard r.record() else { return false }
        recorder = r; url = u
        return true
    }

    func stop() -> URL? {
        recorder?.stop()
        recorder = nil
        defer { url = nil }
        return url
    }
}

/// Puts AI scene clips back-to-back into one silent video (scaled to the first clip's size).
enum VideoJoiner {
    static func join(_ urls: [URL]) async throws -> URL {
        let comp = AVMutableComposition()
        guard let track = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            throw NSError(domain: "KK", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not join videos"])
        }
        var cursor = CMTime.zero
        var firstTransform: CGAffineTransform?
        for u in urls {
            let asset = AVURLAsset(url: u)
            guard let v = try await asset.loadTracks(withMediaType: .video).first else { continue }
            let range = try await v.load(.timeRange)
            try track.insertTimeRange(range, of: v, at: cursor)
            if firstTransform == nil { firstTransform = try await v.load(.preferredTransform) }
            cursor = CMTimeAdd(cursor, range.duration)
        }
        if let t = firstTransform { track.preferredTransform = t }
        guard CMTimeGetSeconds(cursor) > 0.01 else { throw NSError(domain: "KK", code: 3, userInfo: [NSLocalizedDescriptionKey: "No AI clips to join"]) }
        let out = FileStore.media.appendingPathComponent("aijoin_\(UUID().uuidString).mp4")
        guard let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality) else {
            throw NSError(domain: "KK", code: 4, userInfo: [NSLocalizedDescriptionKey: "Export not available"])
        }
        ex.outputURL = out
        ex.outputFileType = .mp4
        await ex.export()
        if let e = ex.error { throw e }
        return out
    }
}
